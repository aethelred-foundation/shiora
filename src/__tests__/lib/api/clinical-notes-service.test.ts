/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  createClinicalNote,
  listClinicalNotesForPatient,
  listClinicalNotesByProvider,
  __resetClinicalNotesForTests,
} from '@/lib/api/clinical-notes-service';
import { seededAddress } from '@/lib/utils';

const PATIENT = seededAddress(801);
const PROVIDER_A = seededAddress(800);
const PROVIDER_B = seededAddress(810);
const original = process.env.DATABASE_URL;

beforeEach(() => {
  delete process.env.DATABASE_URL;
  __resetClinicalNotesForTests();
});

afterEach(() => {
  if (original === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = original;
  __resetClinicalNotesForTests();
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

  it('uses the Postgres store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetClinicalNotesForTests();
    expect(await listClinicalNotesForPatient(PATIENT)).toEqual([]);
    expect(pgQuery).toHaveBeenCalled();
  });
});
