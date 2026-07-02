// ============================================================
// Shiora on Aethelred — Health Records Service
//
// The live, encrypted records datastore used by the API routes. This replaces
// the seeded record functions in store.ts: records start empty per owner and
// are encrypted at rest, with every mutation written to a tamper-evident audit
// chain.
//
// Driver selection: Postgres when DATABASE_URL is configured, otherwise an
// in-memory store (development/preview). Both run the identical encryption and
// audit logic via EncryptedRecordRepository.
// ============================================================

import { getAuditLog } from '@/lib/api/audit-log';
import {
  EncryptedRecordRepository,
  type RecordUpdate,
} from '@/lib/persistence/encrypted-records';
import { InMemoryRecordStore, type RecordStorePort } from '@/lib/persistence/record-store';
import { PgRecordStore } from '@/lib/persistence/pg-record-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import type { MockHealthRecord } from '@/lib/api/mock-data';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';
import { providerHasActiveGrant } from '@/lib/api/access-service';

let repository: EncryptedRecordRepository | null = null;

function createStore(): RecordStorePort {
  if (shouldUsePostgres()) {
    return new PgRecordStore(getPgClient());
  }
  return new InMemoryRecordStore();
}

function repo(): EncryptedRecordRepository {
  if (!repository) {
    repository = new EncryptedRecordRepository(createStore(), getAuditLog());
  }
  return repository;
}

export function listRecords(ownerAddress: string): Promise<MockHealthRecord[]> {
  return repo().list(ownerAddress);
}

/**
 * The records a patient has shared with a provider via an active access grant.
 *
 * Returns null when no active grant exists (the caller maps this to 403), so the
 * grant decision and the data read are made in one place. A successful read is
 * appended to the audit chain as a RECORD_READ by the provider against the
 * patient — the durable record of who accessed which patient's data.
 */
export async function listRecordsForProvider(
  providerAddress: string,
  patientAddress: string,
): Promise<MockHealthRecord[] | null> {
  if (!(await providerHasActiveGrant(providerAddress, patientAddress))) {
    return null;
  }
  await getAuditLog().record({
    action: 'RECORD_READ',
    actor: providerAddress,
    subject: patientAddress, // the data subject is the patient whose records were read
    resource: 'health_records',
    resourceId: patientAddress,
    success: true,
  });
  return repo().list(patientAddress);
}

export function getRecord(
  ownerAddress: string,
  id: string,
): Promise<MockHealthRecord | undefined> {
  return repo().get(ownerAddress, id);
}

export function createRecord(
  ownerAddress: string,
  record: MockHealthRecord,
): Promise<MockHealthRecord> {
  return repo().create(ownerAddress, record);
}

export function updateRecord(
  ownerAddress: string,
  id: string,
  updates: RecordUpdate,
  expectedVersion?: number,
): Promise<MockHealthRecord | undefined> {
  return repo().update(ownerAddress, id, updates, expectedVersion);
}

/** Current optimistic-concurrency version of a record, for ETag/If-Match (GAP-18). */
export function recordVersion(ownerAddress: string, id: string): Promise<number | undefined> {
  return repo().version(ownerAddress, id);
}

export function softDeleteRecord(
  ownerAddress: string,
  id: string,
): Promise<MockHealthRecord | undefined> {
  return repo().softDelete(ownerAddress, id);
}

/** Crypto-shred a record's PHI (GDPR erasure); true when it existed and was shredded. */
export function cryptoShredRecord(ownerAddress: string, id: string): Promise<boolean> {
  return repo().cryptoShred(ownerAddress, id);
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetRecordsForTests(): void {
  repository = null;
}
