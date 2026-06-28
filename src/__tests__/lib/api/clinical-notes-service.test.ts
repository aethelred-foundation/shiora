/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  createClinicalNote,
  amendClinicalNote,
  listClinicalNotesForPatient,
  listClinicalNotesByProvider,
  eraseClinicalNotes,
  __resetClinicalNotesForTests,
} from '@/lib/api/clinical-notes-service';
import { listNotifications, __resetNotificationsForTests } from '@/lib/api/notification-service';
import { getAuditLog, __resetAuditLogForTests } from '@/lib/api/audit-log';
import { seededAddress } from '@/lib/utils';

const PATIENT = seededAddress(801);
const PROVIDER_A = seededAddress(800);
const PROVIDER_B = seededAddress(810);
const original = process.env.DATABASE_URL;

beforeEach(() => {
  delete process.env.DATABASE_URL;
  __resetClinicalNotesForTests();
  __resetNotificationsForTests();
});

afterEach(() => {
  if (original === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = original;
  __resetClinicalNotesForTests();
  __resetNotificationsForTests();
  jest.restoreAllMocks();
});

describe('clinical-notes-service', () => {
  it('creates notes and lists them most-recent-first for the patient', async () => {
    let clock = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => (clock += 1000));

    await createClinicalNote(PATIENT, PROVIDER_A, { type: 'observation', title: 'Visit 1', body: 'BP normal' });
    await createClinicalNote(PATIENT, PROVIDER_B, { type: 'plan', title: 'Visit 2', body: 'Follow up' });

    const notes = await listClinicalNotesForPatient(PATIENT);
    expect(notes).toHaveLength(2);
    expect(notes[0].title).toBe('Visit 2'); // most recent first
    expect(notes[0].id.startsWith('note-')).toBe(true);
  });

  it('attributes note writes to the authoring provider in the audit chain', async () => {
    __resetAuditLogForTests();
    const note = await createClinicalNote(PATIENT, PROVIDER_A, { type: 'observation', title: 'V', body: 'b' });
    await amendClinicalNote(PATIENT, note.id, PROVIDER_B, 'addendum');

    const [create] = await getAuditLog().list({ action: 'CLINICAL_NOTE_CREATE' });
    expect(create.actor).toBe(PROVIDER_A); // the provider, not the patient
    expect(create.actor).not.toBe(PATIENT);
    expect(create.subject).toBe(PATIENT); // the data subject is the patient

    const [update] = await getAuditLog().list({ action: 'CLINICAL_NOTE_UPDATE' });
    expect(update.actor).toBe(PROVIDER_B); // the amending provider
    expect(update.subject).toBe(PATIENT);
  });

  it('scopes the provider view to their own notes', async () => {
    await createClinicalNote(PATIENT, PROVIDER_A, { type: 'observation', title: 'A', body: 'a' });
    await createClinicalNote(PATIENT, PROVIDER_B, { type: 'progress', title: 'B', body: 'b' });

    const forA = await listClinicalNotesByProvider(PATIENT, PROVIDER_A);
    expect(forA).toHaveLength(1);
    expect(forA[0].providerAddress).toBe(PROVIDER_A);
  });

  it('scopes notes to the patient', async () => {
    await createClinicalNote(PATIENT, PROVIDER_A, { type: 'observation', title: 'X', body: 'x' });
    expect(await listClinicalNotesForPatient(seededAddress(999))).toEqual([]);
  });

  it('amends a note append-only and rejects an unknown note', async () => {
    const note = await createClinicalNote(PATIENT, PROVIDER_A, { type: 'observation', title: 'Visit', body: 'Initial' });
    expect(note.amendments).toEqual([]);

    const amended = await amendClinicalNote(PATIENT, note.id, PROVIDER_B, 'Addendum: labs normal');
    expect(amended?.amendments).toHaveLength(1);
    expect(amended?.amendments[0].providerAddress).toBe(PROVIDER_B);
    expect(amended?.body).toBe('Initial'); // original body never mutated

    expect(await amendClinicalNote(PATIENT, 'note-nope', PROVIDER_A, 'x')).toBeUndefined();
  });

  it('notifies the patient when a provider creates or amends a note about them', async () => {
    const note = await createClinicalNote(PATIENT, PROVIDER_A, { type: 'plan', title: 'Plan', body: 'b' });
    let inbox = await listNotifications(PATIENT);
    expect(inbox).toHaveLength(1);
    expect(inbox[0].type).toBe('clinical_note');
    expect(inbox[0].title).toBe('New clinical note');

    await amendClinicalNote(PATIENT, note.id, PROVIDER_B, 'Addendum');
    inbox = await listNotifications(PATIENT);
    expect(inbox).toHaveLength(2); // create + amend
    expect(inbox.map((n) => n.title).sort()).toEqual(['Clinical note amended', 'New clinical note']);
  });

  it('erases every clinical note about a patient', async () => {
    await createClinicalNote(PATIENT, PROVIDER_A, { type: 'observation', title: 'A', body: 'a' });
    await createClinicalNote(PATIENT, PROVIDER_B, { type: 'plan', title: 'B', body: 'b' });

    expect(await eraseClinicalNotes(PATIENT)).toBe(2);
    expect(await listClinicalNotesForPatient(PATIENT)).toEqual([]);
  });

  it('uses the Postgres store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetClinicalNotesForTests();
    expect(await listClinicalNotesForPatient(PATIENT)).toEqual([]);
    expect(pgQuery).toHaveBeenCalled();
  });
});
