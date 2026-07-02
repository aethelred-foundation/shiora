// ============================================================
// Shiora on Aethelred — Data-retention purge (GAP-16)
//
// Soft-deleted rows keep their ciphertext indefinitely — a storage-limitation
// gap (GDPR Art. 5(1)(e)). This purge walks every row in resumable batches and,
// for any that has been soft-deleted longer than the configured retention
// window, crypto-shreds it: the wrapped DEK is destroyed so no recoverable PHI
// remains, leaving only a tombstone. Disabled unless SHIORA_RETENTION_DAYS is
// set, and (like other maintenance) a durable-datastore operation.
// ============================================================

import { DocumentStorePort } from '@/lib/persistence/document-store';
import { RecordStorePort } from '@/lib/persistence/record-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { PgRecordStore } from '@/lib/persistence/pg-record-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { hasDurableDatastore } from '@/lib/api/preflight';
import { shredEnvelope, isShredded } from '@/lib/crypto/envelope';
import { createLogger } from '@/lib/observability/logger';
import { counter } from '@/lib/observability/metrics';
import type { ResealStores } from '@/lib/maintenance/kek-reseal';

const log = createLogger({ subsystem: 'retention' });

const purgedTotal = counter(
  'shiora_retention_purged_total',
  'Rows crypto-shredded by retention, by store',
);

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_RETENTION_BATCH = 200;

export interface RetentionReport {
  durable: boolean;
  /** Configured retention window in days, or null when disabled. */
  retentionDays: number | null;
  documentsPurged: number;
  recordsPurged: number;
  ranAt: number;
}

/** Retention window in days from env, or null when unset/invalid (disabled). */
export function retentionDays(): number | null {
  const raw = process.env.SHIORA_RETENTION_DAYS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function purgeDocuments(store: DocumentStorePort, cutoff: number, batch: number): Promise<number> {
  let cursor: string | null = null;
  let purged = 0;
  do {
    const page = await store.scanForReseal(cursor, batch);
    for (const row of page.rows) {
      if (row.deleted && !isShredded(row.sealed) && row.deletedAt !== undefined && row.deletedAt <= cutoff) {
        await store.put({ ...row, sealed: shredEnvelope() });
        purged += 1;
      }
    }
    cursor = page.nextCursor;
  } while (cursor);
  return purged;
}

async function purgeRecords(store: RecordStorePort, cutoff: number, batch: number): Promise<number> {
  let cursor: string | null = null;
  let purged = 0;
  do {
    const page = await store.scanForReseal(cursor, batch);
    for (const row of page.rows) {
      if (row.deleted && !isShredded(row.sealedPhi) && row.deletedAt !== undefined && row.deletedAt <= cutoff) {
        await store.put({ ...row, sealedPhi: shredEnvelope() });
        purged += 1;
      }
    }
    cursor = page.nextCursor;
  } while (cursor);
  return purged;
}

/**
 * Crypto-shred rows soft-deleted before the retention cutoff. Injectable for
 * testing. Returns zero purges when retention is disabled.
 */
export async function runRetention(
  stores: ResealStores,
  days: number | null = retentionDays(),
  now: number = Date.now(),
  batch: number = DEFAULT_RETENTION_BATCH,
): Promise<RetentionReport> {
  if (days === null) {
    return { durable: true, retentionDays: null, documentsPurged: 0, recordsPurged: 0, ranAt: now };
  }
  const cutoff = now - days * MS_PER_DAY;
  const documentsPurged = await purgeDocuments(stores.documents, cutoff, batch);
  const recordsPurged = await purgeRecords(stores.records, cutoff, batch);

  purgedTotal.inc({ store: 'documents' }, documentsPurged);
  purgedTotal.inc({ store: 'records' }, recordsPurged);

  const report: RetentionReport = {
    durable: true,
    retentionDays: days,
    documentsPurged,
    recordsPurged,
    ranAt: now,
  };
  log.info('retention purge completed', { ...report });
  return report;
}

/** Production entry point: purge the durable corpus (no-op on in-memory). */
export async function runDurableRetention(): Promise<RetentionReport> {
  const days = retentionDays();
  if (!hasDurableDatastore()) {
    return { durable: false, retentionDays: days, documentsPurged: 0, recordsPurged: 0, ranAt: Date.now() };
  }
  return runRetention(
    { documents: new PgDocumentStore(getPgClient()), records: new PgRecordStore(getPgClient()) },
    days,
  );
}
