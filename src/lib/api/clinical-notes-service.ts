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
import { notify } from '@/lib/api/notification-service';
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';

const COLLECTION = 'clinical-note';

export type ClinicalNoteType = 'observation' | 'assessment' | 'plan' | 'progress';

/** An append-only addendum to a note — the clinical record is never edited in place. */
export interface NoteAmendment {
  id: string;
  providerAddress: string;
  body: string;
  createdAt: number;
}

export interface ClinicalNote {
  id: string;
  patientAddress: string;
  providerAddress: string;
  type: ClinicalNoteType;
  title: string;
  body: string;
  amendments: NoteAmendment[];
  createdAt: number;
  updatedAt: number;
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

export async function createClinicalNote(
  patientAddress: string,
  providerAddress: string,
  input: ClinicalNoteInput,
): Promise<ClinicalNote> {
  const now = Date.now();
  const note: ClinicalNote = {
    id: `note-${randomUUID().replace(/-/g, '')}`,
    patientAddress,
    providerAddress,
    type: input.type,
    title: input.title,
    body: input.body,
    amendments: [],
    createdAt: now,
    updatedAt: now,
  };
  // The provider, not the patient, is the actor on a note they authored.
  const created = await repo().create(patientAddress, note, providerAddress);
  await notify(patientAddress, {
    type: 'clinical_note',
    title: 'New clinical note',
    body: `A provider added a ${input.type} note to your record.`,
  });
  return created;
}

/**
 * Append an amendment to an existing note (clinical records are append-only —
 * the original body is never mutated). Returns the updated note, or undefined
 * when the note does not exist for the patient.
 */
export async function amendClinicalNote(
  patientAddress: string,
  noteId: string,
  providerAddress: string,
  body: string,
): Promise<ClinicalNote | undefined> {
  const note = await repo().get(patientAddress, noteId);
  if (!note) {
    return undefined;
  }
  const amendment: NoteAmendment = {
    id: `amend-${randomUUID().replace(/-/g, '')}`,
    providerAddress,
    body,
    createdAt: Date.now(),
  };
  // The amending provider is the actor on their amendment.
  const updated = await repo().update(patientAddress, noteId, {
    amendments: [...note.amendments, amendment],
    updatedAt: Date.now(),
  }, providerAddress);
  await notify(patientAddress, {
    type: 'clinical_note',
    title: 'Clinical note amended',
    body: 'A provider amended a note on your record.',
  });
  return updated;
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

/** Soft-delete every clinical note about a patient (right to erasure). */
export async function eraseClinicalNotes(patientAddress: string): Promise<number> {
  const notes = await listClinicalNotesForPatient(patientAddress);
  await Promise.all(notes.map((note) => repo().cryptoShred(patientAddress, note.id)));
  return notes.length;
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetClinicalNotesForTests(): void {
  repository = null;
}
