// ============================================================
// Shiora on Aethelred — Data Access Request Service
//
// The consented-research access workflow that connects two audiences:
// researchers submit a request to access a marketplace dataset, and a
// government data steward reviews it. Requests are encrypted at rest,
// owner-scoped to the requester, and every create/decision is appended to the
// tamper-evident audit chain. Postgres when DATABASE_URL is set, else
// in-memory — both via the generic EncryptedDocumentRepository.
// ============================================================

import { randomUUID } from 'crypto';

import { getAuditLog } from '@/lib/api/audit-log';
import { notify } from '@/lib/api/notification-service';
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';

const COLLECTION = 'data-access-request';

export type RequestStatus = 'pending' | 'approved' | 'denied' | 'revoked';
export type RequestDecision = 'approved' | 'denied';

const DAY_MS = 86_400_000;
const GRANT_DURATION_DAYS = 90; // an approved request grants time-bound access

export interface DataAccessRequest {
  id: string;
  requesterAddress: string;
  listingId: string;
  purpose: string;
  status: RequestStatus;
  decidedBy: string | null;
  decidedAt: number | null;
  /** Epoch ms when the granted access lapses; 0 when there is no active grant. */
  expiresAt: number;
  createdAt: number;
}

export interface DataRequestStats {
  pending: number;
  approved: number;
  denied: number;
  revoked: number;
  expired: number;
}

let repository: EncryptedDocumentRepository<DataAccessRequest> | null = null;

function createStore(): DocumentStorePort {
  if (shouldUsePostgres()) {
    return new PgDocumentStore(getPgClient());
  }
  return new InMemoryDocumentStore();
}

function repo(): EncryptedDocumentRepository<DataAccessRequest> {
  if (!repository) {
    repository = new EncryptedDocumentRepository<DataAccessRequest>(
      createStore(),
      getAuditLog(),
      COLLECTION,
      { create: 'DATA_REQUEST_CREATE', update: 'DATA_REQUEST_DECIDE' },
    );
  }
  return repository;
}

const byNewest = (a: DataAccessRequest, b: DataAccessRequest) => b.createdAt - a.createdAt;

export function createDataRequest(
  requesterAddress: string,
  listingId: string,
  purpose: string,
): Promise<DataAccessRequest> {
  const request: DataAccessRequest = {
    id: `dar-${randomUUID().replace(/-/g, '')}`,
    requesterAddress,
    listingId,
    purpose,
    status: 'pending',
    decidedBy: null,
    decidedAt: null,
    expiresAt: 0,
    createdAt: Date.now(),
  };
  return repo().create(requesterAddress, request);
}

/** A requester's own data-access requests, most recent first. */
export async function listRequestsByRequester(requesterAddress: string): Promise<DataAccessRequest[]> {
  const requests = await repo().list(requesterAddress);
  return requests.sort(byNewest);
}

/** Every data-access request across requesters — for the governance reviewer. */
export async function listAllDataRequests(): Promise<DataAccessRequest[]> {
  const requests = await repo().listAll();
  return requests.sort(byNewest);
}

/**
 * Record a steward's decision on a pending request. Returns the updated request,
 * or undefined when the request does not exist or is no longer pending.
 */
export async function decideDataRequest(
  id: string,
  deciderAddress: string,
  decision: RequestDecision,
): Promise<DataAccessRequest | undefined> {
  const all = await repo().listAll();
  const existing = all.find((request) => request.id === id);
  if (!existing || existing.status !== 'pending') {
    return undefined;
  }
  const updated = await repo().update(existing.requesterAddress, id, {
    status: decision,
    decidedBy: deciderAddress,
    decidedAt: Date.now(),
    expiresAt: decision === 'approved' ? Date.now() + GRANT_DURATION_DAYS * DAY_MS : 0,
  });
  await notify(existing.requesterAddress, {
    type: 'data_request_decision',
    title: `Data access ${decision}`,
    body: `Your request for dataset ${existing.listingId} was ${decision}.`,
  });
  return updated;
}

/**
 * Revoke an approved request, ending the access grant. Returns the updated
 * request, or undefined when it does not exist or is not currently approved.
 */
export async function revokeDataRequest(
  id: string,
  deciderAddress: string,
): Promise<DataAccessRequest | undefined> {
  const all = await repo().listAll();
  const existing = all.find((request) => request.id === id);
  if (!existing || existing.status !== 'approved') {
    return undefined;
  }
  const updated = await repo().update(existing.requesterAddress, id, {
    status: 'revoked',
    decidedBy: deciderAddress,
    decidedAt: Date.now(),
    expiresAt: 0,
  });
  await notify(existing.requesterAddress, {
    type: 'data_request_decision',
    title: 'Data access revoked',
    body: `Your access to dataset ${existing.listingId} was revoked.`,
  });
  return updated;
}

/** A requester's currently-active grants (approved and not yet expired). */
export async function listActiveGrants(
  requesterAddress: string,
  now: number = Date.now(),
): Promise<DataAccessRequest[]> {
  const requests = await listRequestsByRequester(requesterAddress);
  return requests.filter((request) => request.status === 'approved' && now <= request.expiresAt);
}

/** Aggregate counts by status for the governance dashboard. */
export async function dataRequestStats(now: number = Date.now()): Promise<DataRequestStats> {
  const all = await listAllDataRequests();
  const stats: DataRequestStats = { pending: 0, approved: 0, denied: 0, revoked: 0, expired: 0 };
  for (const request of all) {
    if (request.status === 'approved' && now > request.expiresAt) {
      stats.expired += 1;
    } else {
      stats[request.status] += 1;
    }
  }
  return stats;
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetDataRequestsForTests(): void {
  repository = null;
}
