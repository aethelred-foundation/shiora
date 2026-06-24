/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  createProgram,
  listPrograms,
  getProgram,
  enrollMember,
  listEnrollments,
  participationSummary,
  __resetWellnessForTests,
} from '@/lib/api/wellness-service';
import { seededAddress } from '@/lib/utils';

const ORG = 'org-abc';
const OTHER_ORG = 'org-xyz';
const MEMBER_A = seededAddress(610);
const MEMBER_B = seededAddress(611);
const original = process.env.DATABASE_URL;

beforeEach(() => {
  delete process.env.DATABASE_URL;
  __resetWellnessForTests();
});

afterEach(() => {
  if (original === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = original;
  __resetWellnessForTests();
  jest.restoreAllMocks();
});

describe('wellness programs', () => {
  it('creates programs and lists them newest-first, scoped to the org', async () => {
    let clock = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => (clock += 1000));

    const first = await createProgram(ORG, { name: 'Steps Challenge', category: 'fitness' });
    expect(first.description).toBe(''); // defaulted
    await createProgram(ORG, { name: 'Mindfulness', description: 'Daily meditation', category: 'mental_health' });

    const list = await listPrograms(ORG);
    expect(list.map((p) => p.name)).toEqual(['Mindfulness', 'Steps Challenge']); // newest first
    expect(await listPrograms(OTHER_ORG)).toEqual([]); // org-scoped

    expect((await getProgram(ORG, first.id))?.name).toBe('Steps Challenge');
  });
});

describe('wellness enrollment', () => {
  it('enrolls members and summarises active participation', async () => {
    const program = await createProgram(ORG, { name: 'Steps Challenge', category: 'fitness' });

    await enrollMember(program.id, MEMBER_A);
    await enrollMember(program.id, MEMBER_B);

    const enrolled = await listEnrollments(program.id);
    expect(enrolled).toHaveLength(2);
    expect(enrolled.every((e) => e.status === 'active')).toBe(true);

    const summary = await participationSummary(program.id);
    expect(summary).toEqual({ programId: program.id, activeEnrollments: 2 });
  });

  it('treats re-enrolment as idempotent', async () => {
    const program = await createProgram(ORG, { name: 'Steps Challenge', category: 'fitness' });
    await enrollMember(program.id, MEMBER_A);
    await enrollMember(program.id, MEMBER_A);
    expect(await listEnrollments(program.id)).toHaveLength(1);
  });
});

describe('store selection', () => {
  it('uses the Postgres store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetWellnessForTests();
    expect(await listPrograms(ORG)).toEqual([]);
    expect(pgQuery).toHaveBeenCalled();
  });
});
