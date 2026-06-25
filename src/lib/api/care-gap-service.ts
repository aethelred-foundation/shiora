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
  closedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface CareGapInput {
  measure: string;
  cohort: string;
  description?: string;
  openCount: number;
}

export interface CareGapAnalytics {
  totalGaps: number;
  openGaps: number;
  closedGaps: number;
  /** Sum of open-member counts across still-open gaps. */
  totalOpenMembers: number;
  /** Share of gaps that are closed, 0–100. */
  closureRate: number;
  byMeasure: Array<{ measure: string; open: number; closed: number }>;
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
    closedAt: null,
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
  const now = Date.now();
  const closure = patch.status === 'closed' ? { closedAt: now } : {};
  return repo().update(payerAddress, id, { ...patch, ...closure, updatedAt: now });
}

/** Aggregate care-gap counts and closure performance for a payer. */
export async function careGapAnalytics(payerAddress: string): Promise<CareGapAnalytics> {
  const gaps = await listCareGaps(payerAddress);
  let openGaps = 0;
  let closedGaps = 0;
  let totalOpenMembers = 0;
  const measures = new Map<string, { open: number; closed: number }>();

  for (const gap of gaps) {
    const entry = measures.get(gap.measure) ?? { open: 0, closed: 0 };
    if (gap.status === 'open') {
      openGaps += 1;
      totalOpenMembers += gap.openCount;
      entry.open += 1;
    } else {
      closedGaps += 1;
      entry.closed += 1;
    }
    measures.set(gap.measure, entry);
  }

  const totalGaps = gaps.length;
  const closureRate = totalGaps > 0 ? Math.round((closedGaps / totalGaps) * 100) : 0;
  const byMeasure = Array.from(measures.entries())
    .map(([measure, counts]) => ({ measure, open: counts.open, closed: counts.closed }));

  return { totalGaps, openGaps, closedGaps, totalOpenMembers, closureRate, byMeasure };
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetCareGapsForTests(): void {
  repository = null;
}
