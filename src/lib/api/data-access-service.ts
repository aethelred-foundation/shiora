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
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';

const COLLECTION = 'data-access-request';

export type RequestStatus = 'pending' | 'approved' | 'denied';
export type RequestDecision = 'approved' | 'denied';

export interface DataAccessRequest {
  id: string;
  requesterAddress: string;
  listingId: string;
  purpose: string;
  status: RequestStatus;
  decidedBy: string | null;
  decidedAt: number | null;
  createdAt: number;
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
  return repo().update(existing.requesterAddress, id, {
    status: decision,
    decidedBy: deciderAddress,
    decidedAt: Date.now(),
  });
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetDataRequestsForTests(): void {
  repository = null;
}
