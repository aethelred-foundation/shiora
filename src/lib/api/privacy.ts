// ============================================================
// Shiora on Aethelred — Privacy / Data-Subject Rights
//
// Real operations backing the GDPR data-subject-rights endpoints: assemble a
// data subject's complete record across the encrypted datastore (access &
// portability — Articles 15 & 20) and erase it (right to erasure — Article 17).
// All data is read from the owner-scoped encrypted services, so a subject only
// ever sees or erases their own data.
// ============================================================

import { listRecords, softDeleteRecord } from './records-service';
import { listConsents, updateConsent } from './consent-service';
import { listAccessGrants, updateAccessGrant } from './access-service';
import { listSymptoms, listCycleEntries, eraseVaultEntries, type SymptomEntry, type CycleEntry } from './vault-service';
import { listClinicalNotesForPatient, eraseClinicalNotes, type ClinicalNote } from './clinical-notes-service';
import { listNotifications, eraseNotifications, type Notification } from './notification-service';
import type { MockHealthRecord, MockAccessGrant } from './mock-data';
import type { ConsentGrant } from '@/types';

export interface UserDataBundle {
  records: MockHealthRecord[];
  consents: ConsentGrant[];
  accessGrants: MockAccessGrant[];
  symptoms: SymptomEntry[];
  cycleEntries: CycleEntry[];
  clinicalNotes: ClinicalNote[];
  notifications: Notification[];
}

/** Assemble a data subject's complete data across every owner-scoped store. */
export async function collectUserData(owner: string): Promise<UserDataBundle> {
  const [records, consents, accessGrants, symptoms, cycleEntries, clinicalNotes, notifications] =
    await Promise.all([
      listRecords(owner),
      listConsents(owner),
      listAccessGrants(owner),
      listSymptoms(owner),
      listCycleEntries(owner),
      listClinicalNotesForPatient(owner),
      listNotifications(owner),
    ]);
  return { records, consents, accessGrants, symptoms, cycleEntries, clinicalNotes, notifications };
}

export interface ErasureSummary {
  recordsErased: number;
  consentsRevoked: number;
  grantsRevoked: number;
  vaultEntriesErased: number;
  clinicalNotesErased: number;
  notificationsErased: number;
}

/**
 * Erase a data subject's data: soft-delete every record, vault entry, clinical
 * note, and notification, and revoke every active consent and active/pending
 * access grant. Returns counts.
 */
export async function eraseUserData(owner: string): Promise<ErasureSummary> {
  const records = await listRecords(owner);
  await Promise.all(records.map((record) => softDeleteRecord(owner, record.id)));

  const activeConsents = (await listConsents(owner)).filter(
    (consent) => consent.status === 'active',
  );
  await Promise.all(
    activeConsents.map((consent) =>
      updateConsent(owner, consent.id, { status: 'revoked', revokedAt: Date.now() }),
    ),
  );

  const activeGrants = (await listAccessGrants(owner)).filter(
    (grant) => grant.status === 'Active' || grant.status === 'Pending',
  );
  await Promise.all(
    activeGrants.map((grant) => updateAccessGrant(owner, grant.id, { status: 'Revoked' })),
  );

  const [vaultEntriesErased, clinicalNotesErased, notificationsErased] = await Promise.all([
    eraseVaultEntries(owner),
    eraseClinicalNotes(owner),
    eraseNotifications(owner),
  ]);

  return {
    recordsErased: records.length,
    consentsRevoked: activeConsents.length,
    grantsRevoked: activeGrants.length,
    vaultEntriesErased,
    clinicalNotesErased,
    notificationsErased,
  };
}
