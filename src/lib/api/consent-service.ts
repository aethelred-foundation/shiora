// ============================================================
// Shiora on Aethelred — Consent Service
//
// The live, encrypted datastore for patient consent grants. Consents start
// empty per patient and are encrypted at rest, with every mutation written to
// the tamper-evident audit chain. Postgres when DATABASE_URL is set, otherwise
// in-memory — both via the generic EncryptedDocumentRepository.
// ============================================================

import { getAuditLog } from '@/lib/api/audit-log';
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import type { ConsentGrant } from '@/types';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';

const COLLECTION = 'consent';

let repository: EncryptedDocumentRepository<ConsentGrant> | null = null;

function createStore(): DocumentStorePort {
  if (shouldUsePostgres()) {
    return new PgDocumentStore(getPgClient());
  }
  return new InMemoryDocumentStore();
}

function repo(): EncryptedDocumentRepository<ConsentGrant> {
  if (!repository) {
    repository = new EncryptedDocumentRepository<ConsentGrant>(
      createStore(),
      getAuditLog(),
      COLLECTION,
      { create: 'CONSENT_CREATE', update: 'CONSENT_UPDATE' },
    );
  }
  return repository;
}

export function listConsents(patientAddress: string): Promise<ConsentGrant[]> {
  return repo().list(patientAddress);
}

/** All consents across every patient. For aggregate analytics only. */
export function listAllConsents(): Promise<ConsentGrant[]> {
  return repo().listAll();
}

export function getConsent(
  patientAddress: string,
  id: string,
): Promise<ConsentGrant | undefined> {
  return repo().get(patientAddress, id);
}

export function createConsent(
  patientAddress: string,
  consent: ConsentGrant,
): Promise<ConsentGrant> {
  return repo().create(patientAddress, consent);
}

export function updateConsent(
  patientAddress: string,
  id: string,
  patch: Partial<ConsentGrant>,
): Promise<ConsentGrant | undefined> {
  return repo().update(patientAddress, id, patch);
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetConsentForTests(): void {
  repository = null;
}
