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
import { notify } from '@/lib/api/notification-service';

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

/**
 * Reconcile a patient's consents with the wall clock: any active consent whose
 * `expiresAt` has passed is either auto-renewed (when `autoRenew` is set — its
 * term is rolled forward past `now`) or transitioned to `expired`. Persists the
 * change and audits it via the repository. Returns how many of each happened.
 *
 * This is the engine behind consent expiry: without it, a consent created
 * `active` keeps reporting `active` forever and `autoRenew` is a dead flag. Call
 * it at the consent read/modify boundary so users always see the true status.
 */
export async function processConsentExpiry(
  patientAddress: string,
  now: number = Date.now(),
): Promise<{ renewed: number; expired: number }> {
  const consents = await repo().list(patientAddress);
  let renewed = 0;
  let expired = 0;

  for (const consent of consents) {
    if (consent.status !== 'active' || now <= consent.expiresAt) {
      continue;
    }

    const term = consent.expiresAt - consent.grantedAt;
    if (consent.autoRenew && term > 0) {
      let next = consent.expiresAt;
      while (next <= now) {
        next += term;
      }
      await repo().update(patientAddress, consent.id, { expiresAt: next });
      await notify(patientAddress, {
        type: 'consent',
        title: 'A consent was auto-renewed',
        body: `Your data-sharing consent for ${consent.providerName} was automatically renewed.`,
      });
      renewed += 1;
    } else {
      await repo().update(patientAddress, consent.id, { status: 'expired' });
      await notify(patientAddress, {
        type: 'consent',
        title: 'A consent expired',
        body: `Your data-sharing consent for ${consent.providerName} has expired.`,
      });
      expired += 1;
    }
  }

  return { renewed, expired };
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetConsentForTests(): void {
  repository = null;
}
