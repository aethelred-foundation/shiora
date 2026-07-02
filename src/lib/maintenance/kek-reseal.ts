// ============================================================
// Shiora on Aethelred — KEK re-sealing maintenance (GAP-14)
//
// Versioned rotation lets new writes adopt a fresh KEK immediately, but the
// old key can only be retired once NO stored ciphertext still depends on it.
// This operation walks every sealed row in batches, and for any value still
// sealed under a superseded KEK version, decrypts it under its old key and
// re-seals it under the current one — preserving the exact plaintext and its
// AAD binding. Shredded tombstones are skipped (nothing to re-seal).
//
// Like store GC (GAP-01) this is a DURABLE-datastore operation: under Postgres
// every service shares the `documents`/`health_records` tables, so a single
// scan covers the whole corpus. In-memory dev deployments have no shared,
// persistent corpus to rotate, so the run is reported as not-applicable.
// ============================================================

import { DocumentStorePort } from '@/lib/persistence/document-store';
import { RecordStorePort } from '@/lib/persistence/record-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { PgRecordStore } from '@/lib/persistence/pg-record-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { documentAad } from '@/lib/persistence/encrypted-documents';
import { recordPhiAad } from '@/lib/persistence/encrypted-records';
import { hasDurableDatastore } from '@/lib/api/preflight';
import { needsReseal, resealString, isShredded } from '@/lib/crypto/envelope';
import { getKeyProvider } from '@/lib/crypto/key-provider';
import { createLogger } from '@/lib/observability/logger';
import { counter } from '@/lib/observability/metrics';

const log = createLogger({ subsystem: 'kek-reseal' });

const resealedTotal = counter(
  'shiora_kek_resealed_total',
  'Envelopes re-sealed under the current KEK version, by store',
);

/** Default rows scanned per batch (bounds memory + statement time). */
export const DEFAULT_RESEAL_BATCH = 200;

export interface ResealStores {
  documents: DocumentStorePort;
  records: RecordStorePort;
}

export interface ResealReport {
  /** Whether a durable datastore was present (else the run is a no-op). */
  durable: boolean;
  /** KEK version everything was re-sealed up to. */
  currentVersion: number;
  documentsScanned: number;
  documentsResealed: number;
  recordsScanned: number;
  recordsResealed: number;
  ranAt: number;
}

async function resealDocuments(store: DocumentStorePort, batch: number): Promise<[number, number]> {
  let cursor: string | null = null;
  let scanned = 0;
  let resealed = 0;
  do {
    const page = await store.scanForReseal(cursor, batch);
    for (const row of page.rows) {
      scanned += 1;
      if (!isShredded(row.sealed) && needsReseal(row.sealed)) {
        const fresh = resealString(row.sealed, documentAad(row.collection, row.ownerKey, row.id));
        await store.put({ ...row, sealed: fresh });
        resealed += 1;
      }
    }
    cursor = page.nextCursor;
  } while (cursor);
  return [scanned, resealed];
}

async function resealRecords(store: RecordStorePort, batch: number): Promise<[number, number]> {
  let cursor: string | null = null;
  let scanned = 0;
  let resealed = 0;
  do {
    const page = await store.scanForReseal(cursor, batch);
    for (const row of page.rows) {
      scanned += 1;
      if (!isShredded(row.sealedPhi) && needsReseal(row.sealedPhi)) {
        const fresh = resealString(row.sealedPhi, recordPhiAad(row.ownerAddress, row.id));
        await store.put({ ...row, sealedPhi: fresh });
        resealed += 1;
      }
    }
    cursor = page.nextCursor;
  } while (cursor);
  return [scanned, resealed];
}

/**
 * Re-seal every stale envelope in the provided stores. Injectable for testing;
 * see {@link runDurableKekReseal} for the production entry point.
 */
export async function runKekReseal(
  stores: ResealStores,
  batch: number = DEFAULT_RESEAL_BATCH,
): Promise<ResealReport> {
  const [documentsScanned, documentsResealed] = await resealDocuments(stores.documents, batch);
  const [recordsScanned, recordsResealed] = await resealRecords(stores.records, batch);

  resealedTotal.inc({ store: 'documents' }, documentsResealed);
  resealedTotal.inc({ store: 'records' }, recordsResealed);

  const report: ResealReport = {
    durable: true,
    currentVersion: getKeyProvider().currentVersion(),
    documentsScanned,
    documentsResealed,
    recordsScanned,
    recordsResealed,
    ranAt: Date.now(),
  };
  log.info('kek re-seal completed', { ...report });
  return report;
}

/**
 * Production entry point: re-seal the durable corpus. On an in-memory
 * deployment there is no shared persistent corpus, so this reports a
 * not-applicable no-op rather than pretending to rotate ephemeral state.
 */
export async function runDurableKekReseal(batch: number = DEFAULT_RESEAL_BATCH): Promise<ResealReport> {
  if (!hasDurableDatastore()) {
    return {
      durable: false,
      currentVersion: getKeyProvider().currentVersion(),
      documentsScanned: 0,
      documentsResealed: 0,
      recordsScanned: 0,
      recordsResealed: 0,
      ranAt: Date.now(),
    };
  }
  return runKekReseal({
    documents: new PgDocumentStore(getPgClient()),
    records: new PgRecordStore(getPgClient()),
  }, batch);
}
