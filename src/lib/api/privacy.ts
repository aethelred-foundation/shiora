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
import type { MockHealthRecord, MockAccessGrant } from './mock-data';
import type { ConsentGrant } from '@/types';

export interface UserDataBundle {
  records: MockHealthRecord[];
  consents: ConsentGrant[];
  accessGrants: MockAccessGrant[];
}

/** Assemble a data subject's complete data across the datastore. */
export async function collectUserData(owner: string): Promise<UserDataBundle> {
  const [records, consents, accessGrants] = await Promise.all([
    listRecords(owner),
    listConsents(owner),
    listAccessGrants(owner),
  ]);
  return { records, consents, accessGrants };
}

export interface ErasureSummary {
  recordsErased: number;
  consentsRevoked: number;
  grantsRevoked: number;
}

/**
 * Erase a data subject's data: soft-delete every record, revoke every active
 * consent, and revoke every active/pending access grant. Returns counts.
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

  return {
    recordsErased: records.length,
    consentsRevoked: activeConsents.length,
    grantsRevoked: activeGrants.length,
  };
}
