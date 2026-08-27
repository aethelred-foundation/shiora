// ============================================================
// Shiora on Aethelred — Account Profile Service
//
// A real, encrypted, owner-scoped account profile: one document per user,
// holding the human-facing identity (display name, contact email, timezone,
// locale) that a wallet address alone cannot carry. Sealed at rest and audited
// on every change. Postgres when DATABASE_URL is set, else in-memory.
//
// NOTE (honest scope): contactEmail is stored as a user preference only — no
// email is sent from it yet. It is personal data, so it participates in the
// GDPR export/erasure lifecycle.
// ============================================================

import { getAuditLog } from '@/lib/api/audit-log';
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';

const COLLECTION = 'profile';

interface StoredProfile {
  id: string; // the owner address
  ownerAddress: string;
  displayName: string;
  contactEmail: string;
  timezone: string;
  locale: string;
  updatedAt: number;
}

export interface Profile {
  displayName: string;
  contactEmail: string;
  timezone: string;
  locale: string;
  updatedAt: number | null;
}

export interface ProfileInput {
  displayName?: string;
  contactEmail?: string;
  timezone?: string;
  locale?: string;
}

const EMPTY: Profile = {
  displayName: '', contactEmail: '', timezone: '', locale: '', updatedAt: null,
};

let repository: EncryptedDocumentRepository<StoredProfile> | null = null;

function createStore(): DocumentStorePort {
  if (shouldUsePostgres()) {
    return new PgDocumentStore(getPgClient());
  }
  return new InMemoryDocumentStore();
}

function repo(): EncryptedDocumentRepository<StoredProfile> {
  if (!repository) {
    repository = new EncryptedDocumentRepository<StoredProfile>(
      createStore(),
      getAuditLog(),
      COLLECTION,
      { create: 'PROFILE_UPDATE', update: 'PROFILE_UPDATE' },
    );
  }
  return repository;
}

/** The caller's profile; empty defaults when they have never set one. */
export async function getProfile(ownerAddress: string): Promise<Profile> {
  const stored = await repo().get(ownerAddress, ownerAddress);
  if (!stored) {
    return { ...EMPTY };
  }
  return {
    displayName: stored.displayName,
    contactEmail: stored.contactEmail,
    timezone: stored.timezone,
    locale: stored.locale,
    updatedAt: stored.updatedAt,
  };
}

/**
 * Merge the given fields into the caller's profile (only provided fields change)
 * and persist. Returns the resulting profile.
 */
export async function updateProfile(ownerAddress: string, input: ProfileInput): Promise<Profile> {
  const current = await getProfile(ownerAddress);
  const merged: StoredProfile = {
    id: ownerAddress,
    ownerAddress,
    displayName: input.displayName ?? current.displayName,
    contactEmail: input.contactEmail ?? current.contactEmail,
    timezone: input.timezone ?? current.timezone,
    locale: input.locale ?? current.locale,
    updatedAt: Date.now(),
  };
  await repo().create(ownerAddress, merged);
  return {
    displayName: merged.displayName,
    contactEmail: merged.contactEmail,
    timezone: merged.timezone,
    locale: merged.locale,
    updatedAt: merged.updatedAt,
  };
}

/** Soft-delete the caller's profile (right to erasure). Returns how many removed. */
export async function eraseProfile(ownerAddress: string): Promise<number> {
  const removed = await repo().cryptoShred(ownerAddress, ownerAddress);
  return removed ? 1 : 0;
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetProfileForTests(): void {
  repository = null;
}
