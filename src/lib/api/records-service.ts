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
): Promise<MockHealthRecord | undefined> {
  return repo().update(ownerAddress, id, updates);
}

export function softDeleteRecord(
  ownerAddress: string,
  id: string,
): Promise<MockHealthRecord | undefined> {
  return repo().softDelete(ownerAddress, id);
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetRecordsForTests(): void {
  repository = null;
}
