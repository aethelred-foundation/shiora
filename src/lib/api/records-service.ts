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
import { EncryptedRecordRepository, type RecordUpdate } from '@/lib/persistence/encrypted-records';
import { InMemoryRecordStore, type RecordStorePort } from '@/lib/persistence/record-store';
import { PgRecordStore } from '@/lib/persistence/pg-record-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import type { StoredHealthRecord } from '@/lib/api/domain-types';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';
import { activeGrantForProvider } from '@/lib/api/access-service';
import { recordAuthorizationDecision } from '@/lib/api/authz-decision';
import type { DataScope, RecordType } from '@/types';

/**
 * Record categories exposed by each patient-selected access scope. `null`
 * means unrestricted: Full Records includes every current and future record
 * category. Unknown persisted scopes fail closed in recordsWithinGrantScope.
 */
const RECORD_TYPES_BY_SCOPE: Readonly<Record<DataScope, readonly RecordType[] | null>> = {
  'Full Records': null,
  'Lab Results Only': ['lab_result'],
  'Imaging Only': ['imaging'],
  'Vitals Only': ['vitals'],
  'Prescriptions Only': ['prescription'],
  'Clinical Notes Only': ['notes'],
};

function recordsWithinGrantScope(
  records: StoredHealthRecord[],
  scope: string,
): StoredHealthRecord[] {
  const allowedTypes = RECORD_TYPES_BY_SCOPE[scope as DataScope];
  if (allowedTypes === null) return records;
  if (!allowedTypes) return [];
  return records.filter((record) => allowedTypes.includes(record.type as RecordType));
}

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

export function listRecords(ownerAddress: string): Promise<StoredHealthRecord[]> {
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
): Promise<StoredHealthRecord[] | null> {
  const grant = await activeGrantForProvider(providerAddress, patientAddress);

  // An immutable authorization-decision snapshot on both allow and deny (§3):
  // it captures why access was (dis)allowed at this instant, for the auditor.
  if (!grant) {
    await recordAuthorizationDecision({
      actor: providerAddress,
      subject: patientAddress,
      resource: 'health_records',
      resourceId: patientAddress,
      purposeOfUse: 'care_coordination',
      decision: 'deny',
      reason: 'no_active_grant',
    });
    return null;
  }

  await recordAuthorizationDecision({
    actor: providerAddress,
    subject: patientAddress,
    resource: 'health_records',
    resourceId: patientAddress,
    purposeOfUse: 'care_coordination',
    decision: 'allow',
    reason: 'active_grant',
    legalBasis: 'consent',
    grantId: grant.id,
  });

  await getAuditLog().record({
    action: 'RECORD_READ',
    actor: providerAddress,
    subject: patientAddress, // the data subject is the patient whose records were read
    resource: 'health_records',
    resourceId: patientAddress,
    success: true,
  });
  const records = await repo().list(patientAddress);
  return recordsWithinGrantScope(records, grant.scope);
}

export function getRecord(
  ownerAddress: string,
  id: string,
): Promise<StoredHealthRecord | undefined> {
  return repo().get(ownerAddress, id);
}

export function createRecord(
  ownerAddress: string,
  record: StoredHealthRecord,
): Promise<StoredHealthRecord> {
  return repo().create(ownerAddress, record);
}

export function updateRecord(
  ownerAddress: string,
  id: string,
  updates: RecordUpdate,
  expectedVersion?: number,
): Promise<StoredHealthRecord | undefined> {
  return repo().update(ownerAddress, id, updates, expectedVersion);
}

/** Current optimistic-concurrency version of a record, for ETag/If-Match (GAP-18). */
export function recordVersion(ownerAddress: string, id: string): Promise<number | undefined> {
  return repo().version(ownerAddress, id);
}

/** Find records by exact tag via blind index — no decryption of the filter (GAP-15). */
export function findRecordsByTag(ownerAddress: string, tag: string): Promise<StoredHealthRecord[]> {
  return repo().findByTag(ownerAddress, tag);
}

export function softDeleteRecord(
  ownerAddress: string,
  id: string,
): Promise<StoredHealthRecord | undefined> {
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
