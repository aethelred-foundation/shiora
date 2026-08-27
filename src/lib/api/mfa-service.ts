// ============================================================
// Shiora on Aethelred — MFA Service (TOTP)
//
// Manages per-address TOTP enrolment as an encrypted, audited document. The
// shared secret is sealed at rest like any other sensitive value; enrolment,
// confirmation, verification, and disabling are all owner-scoped.
// ============================================================

import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { getAuditLog } from '@/lib/api/audit-log';
import { generateTotpSecret, otpauthUri, verifyTotp } from './totp';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';

interface MfaEnrollment {
  id: string;
  address: string;
  secret: string;
  enabled: boolean;
  updatedAt: number;
}

const COLLECTION = 'mfa';

let repository: EncryptedDocumentRepository<MfaEnrollment> | null = null;

function createStore(): DocumentStorePort {
  if (shouldUsePostgres()) {
    return new PgDocumentStore(getPgClient());
  }
  return new InMemoryDocumentStore();
}

function repo(): EncryptedDocumentRepository<MfaEnrollment> {
  if (!repository) {
    repository = new EncryptedDocumentRepository<MfaEnrollment>(
      createStore(),
      getAuditLog(),
      COLLECTION,
      { create: 'MFA_ENROLL', update: 'MFA_ENABLE' },
    );
  }
  return repository;
}

export interface MfaStatus {
  enrolled: boolean;
  enabled: boolean;
}

export async function getMfaStatus(address: string): Promise<MfaStatus> {
  const enrollment = await repo().get(address, address);
  return { enrolled: !!enrollment, enabled: !!enrollment?.enabled };
}

/** Start (or restart) enrolment, returning the secret and provisioning URI. */
export async function beginMfaEnrollment(address: string): Promise<{ secret: string; otpauthUri: string }> {
  const secret = generateTotpSecret();
  const existing = await repo().get(address, address);
  if (existing) {
    await repo().update(address, address, { secret, enabled: false, updatedAt: Date.now() });
  } else {
    await repo().create(address, { id: address, address, secret, enabled: false, updatedAt: Date.now() });
  }
  return { secret, otpauthUri: otpauthUri(secret, address) };
}

/** Confirm enrolment with a code from the authenticator, enabling MFA. */
export async function confirmMfaEnrollment(address: string, code: string): Promise<boolean> {
  const enrollment = await repo().get(address, address);
  if (!enrollment || !verifyTotp(enrollment.secret, code)) {
    return false;
  }
  await repo().update(address, address, { enabled: true, updatedAt: Date.now() });
  return true;
}

/** Verify a code against an address's enabled MFA (for step-up auth). */
export async function verifyMfaCode(address: string, code: string): Promise<boolean> {
  const enrollment = await repo().get(address, address);
  if (!enrollment || !enrollment.enabled) {
    return false;
  }
  return verifyTotp(enrollment.secret, code);
}

/** Disable MFA, requiring a valid current code. */
export async function disableMfa(address: string, code: string): Promise<boolean> {
  const enrollment = await repo().get(address, address);
  if (!enrollment || !enrollment.enabled || !verifyTotp(enrollment.secret, code)) {
    return false;
  }
  await repo().update(address, address, { enabled: false, updatedAt: Date.now() });
  return true;
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetMfaForTests(): void {
  repository = null;
}
