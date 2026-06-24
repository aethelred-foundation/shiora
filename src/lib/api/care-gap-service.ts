// ============================================================
// Shiora on Aethelred — Care Gap Registry (health-plan audience)
//
// A real, encrypted registry a health plan maintains of open care gaps against
// de-identified member cohorts (e.g., "diabetic members overdue for an A1c
// screening"). Owner-scoped to the payer, sealed at rest, and audited on every
// create and update. Cohorts are labels the payer supplies — this registry does
// not itself hold member PHI. Postgres when DATABASE_URL is set, else in-memory.
// ============================================================

import { randomUUID } from 'crypto';

import { getAuditLog } from '@/lib/api/audit-log';
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';

const COLLECTION = 'care-gap';

export type CareGapStatus = 'open' | 'closed';

export interface CareGap {
  id: string;
  payerAddress: string;
  measure: string;
  cohort: string;
  description: string;
  openCount: number;
  status: CareGapStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CareGapInput {
  measure: string;
  cohort: string;
  description?: string;
  openCount: number;
}

export type CareGapPatch = Partial<Pick<CareGap, 'openCount' | 'status' | 'description'>>;

let repository: EncryptedDocumentRepository<CareGap> | null = null;

function createStore(): DocumentStorePort {
  if (shouldUsePostgres()) {
    return new PgDocumentStore(getPgClient());
  }
  return new InMemoryDocumentStore();
}

function repo(): EncryptedDocumentRepository<CareGap> {
  if (!repository) {
    repository = new EncryptedDocumentRepository<CareGap>(
      createStore(),
      getAuditLog(),
      COLLECTION,
      { create: 'CARE_GAP_CREATE', update: 'CARE_GAP_UPDATE' },
    );
  }
  return repository;
}

export function createCareGap(payerAddress: string, input: CareGapInput): Promise<CareGap> {
  const now = Date.now();
  const gap: CareGap = {
    id: `gap-${randomUUID().replace(/-/g, '')}`,
    payerAddress,
    measure: input.measure,
    cohort: input.cohort,
    description: input.description ?? '',
    openCount: input.openCount,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  };
  return repo().create(payerAddress, gap);
}

/** A payer's care gaps, most recently updated first. */
export async function listCareGaps(payerAddress: string): Promise<CareGap[]> {
  const gaps = await repo().list(payerAddress);
  return gaps.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getCareGap(payerAddress: string, id: string): Promise<CareGap | undefined> {
  return repo().get(payerAddress, id);
}

/** Apply a patch (e.g., decrement the open count or close the gap). */
export function updateCareGap(
  payerAddress: string,
  id: string,
  patch: CareGapPatch,
): Promise<CareGap | undefined> {
  return repo().update(payerAddress, id, { ...patch, updatedAt: Date.now() });
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetCareGapsForTests(): void {
  repository = null;
}
