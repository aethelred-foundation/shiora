// ============================================================
// Shiora on Aethelred — Clinical Notes Service (provider audience)
//
// Real, encrypted clinical notes a provider records against a patient who has
// granted them access. Notes are owner-scoped to the patient (the note is part
// of the patient's record), sealed at rest with envelope encryption, and every
// write is appended to the tamper-evident audit chain. Postgres when
// DATABASE_URL is set, otherwise in-memory — both via the generic repository.
// ============================================================

import { randomUUID } from 'crypto';

import { getAuditLog } from '@/lib/api/audit-log';
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';

const COLLECTION = 'clinical-note';

export type ClinicalNoteType = 'observation' | 'assessment' | 'plan' | 'progress';

export interface ClinicalNote {
  id: string;
  patientAddress: string;
  providerAddress: string;
  type: ClinicalNoteType;
  title: string;
  body: string;
  createdAt: number;
}

export interface ClinicalNoteInput {
  type: ClinicalNoteType;
  title: string;
  body: string;
}

let repository: EncryptedDocumentRepository<ClinicalNote> | null = null;

function createStore(): DocumentStorePort {
  if (shouldUsePostgres()) {
    return new PgDocumentStore(getPgClient());
  }
  return new InMemoryDocumentStore();
}

function repo(): EncryptedDocumentRepository<ClinicalNote> {
  if (!repository) {
    repository = new EncryptedDocumentRepository<ClinicalNote>(
      createStore(),
      getAuditLog(),
      COLLECTION,
      { create: 'CLINICAL_NOTE_CREATE', update: 'CLINICAL_NOTE_UPDATE' },
    );
  }
  return repository;
}

export function createClinicalNote(
  patientAddress: string,
  providerAddress: string,
  input: ClinicalNoteInput,
): Promise<ClinicalNote> {
  const note: ClinicalNote = {
    id: `note-${randomUUID().replace(/-/g, '')}`,
    patientAddress,
    providerAddress,
    type: input.type,
    title: input.title,
    body: input.body,
    createdAt: Date.now(),
  };
  return repo().create(patientAddress, note);
}

/** Every clinical note about a patient, most recent first (patient's own view). */
export async function listClinicalNotesForPatient(patientAddress: string): Promise<ClinicalNote[]> {
  const notes = await repo().list(patientAddress);
  return notes.sort((a, b) => b.createdAt - a.createdAt);
}

/** The notes a specific provider authored for a patient, most recent first. */
export async function listClinicalNotesByProvider(
  patientAddress: string,
  providerAddress: string,
): Promise<ClinicalNote[]> {
  const notes = await listClinicalNotesForPatient(patientAddress);
  return notes.filter((note) => note.providerAddress === providerAddress);
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetClinicalNotesForTests(): void {
  repository = null;
}
