// ============================================================
// Shiora on Aethelred — Access Grants Service
//
// The live, encrypted datastore for access grants. Grants start empty per
// owner and are encrypted at rest, with every mutation written to the
// tamper-evident audit chain. Postgres when DATABASE_URL is set, otherwise
// in-memory — both via the generic EncryptedDocumentRepository.
// ============================================================

import { getAuditLog } from '@/lib/api/audit-log';
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import type { MockAccessGrant } from '@/lib/api/mock-data';

const COLLECTION = 'access-grant';

let repository: EncryptedDocumentRepository<MockAccessGrant> | null = null;

function createStore(): DocumentStorePort {
  if (process.env.DATABASE_URL) {
    return new PgDocumentStore(getPgClient());
  }
  return new InMemoryDocumentStore();
}

function repo(): EncryptedDocumentRepository<MockAccessGrant> {
  if (!repository) {
    repository = new EncryptedDocumentRepository<MockAccessGrant>(
      createStore(),
      getAuditLog(),
      COLLECTION,
      { create: 'GRANT_CREATE', update: 'GRANT_UPDATE' },
    );
  }
  return repository;
}

export function listAccessGrants(ownerAddress: string): Promise<MockAccessGrant[]> {
  return repo().list(ownerAddress);
}

export function getAccessGrant(
  ownerAddress: string,
  id: string,
): Promise<MockAccessGrant | undefined> {
  return repo().get(ownerAddress, id);
}

export function createAccessGrant(
  ownerAddress: string,
  grant: MockAccessGrant,
): Promise<MockAccessGrant> {
  return repo().create(ownerAddress, grant);
}

export function updateAccessGrant(
  ownerAddress: string,
  id: string,
  patch: Partial<MockAccessGrant>,
): Promise<MockAccessGrant | undefined> {
  return repo().update(ownerAddress, id, patch);
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetAccessForTests(): void {
  repository = null;
}
