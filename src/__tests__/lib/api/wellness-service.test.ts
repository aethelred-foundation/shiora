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
  updateProgress,
  withdrawMember,
  listEnrollments,
  participationSummary,
  orgWellnessAnalytics,
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
    expect(summary).toEqual({ programId: program.id, activeEnrollments: 2, completedCount: 0, averageProgress: 0 });
  });

  it('treats re-enrolment as idempotent', async () => {
    const program = await createProgram(ORG, { name: 'Steps Challenge', category: 'fitness' });
    await enrollMember(program.id, MEMBER_A);
    await enrollMember(program.id, MEMBER_A);
    expect(await listEnrollments(program.id)).toHaveLength(1);
  });

  it('summarises an empty program as zero participation', async () => {
    const program = await createProgram(ORG, { name: 'Steps', category: 'fitness' });
    expect(await participationSummary(program.id)).toEqual({
      programId: program.id, activeEnrollments: 0, completedCount: 0, averageProgress: 0,
    });
  });

  it('records progress, marks completion, and reflects it in the summary', async () => {
    const program = await createProgram(ORG, { name: 'Steps', category: 'fitness' });
    await enrollMember(program.id, MEMBER_A);
    await enrollMember(program.id, MEMBER_B);

    const partial = await updateProgress(program.id, MEMBER_A, 60);
    expect(partial?.progress).toBe(60);
    expect(partial?.completed).toBe(false);

    const done = await updateProgress(program.id, MEMBER_B, 100);
    expect(done?.completed).toBe(true);

    const summary = await participationSummary(program.id);
    expect(summary.completedCount).toBe(1);
    expect(summary.averageProgress).toBe(80); // (60 + 100) / 2
  });

  it('withdraws a member and stops counting them', async () => {
    const program = await createProgram(ORG, { name: 'Steps', category: 'fitness' });
    await enrollMember(program.id, MEMBER_A);

    const withdrawn = await withdrawMember(program.id, MEMBER_A);
    expect(withdrawn?.status).toBe('withdrawn');
    expect(await listEnrollments(program.id)).toHaveLength(0);

    // progress/withdraw on a non-active enrollment is a no-op
    expect(await updateProgress(program.id, MEMBER_A, 50)).toBeUndefined();
    expect(await withdrawMember(program.id, MEMBER_A)).toBeUndefined();
    expect(await updateProgress(program.id, seededAddress(999), 50)).toBeUndefined();
  });
});

describe('orgWellnessAnalytics', () => {
  it('aggregates participation and completion across an org\'s programs', async () => {
    const a = await createProgram(ORG, { name: 'Steps', category: 'fitness' });
    const b = await createProgram(ORG, { name: 'Mind', category: 'mental_health' });
    await enrollMember(a.id, MEMBER_A);
    await enrollMember(a.id, MEMBER_B);
    await enrollMember(b.id, MEMBER_A);
    await updateProgress(a.id, MEMBER_A, 100); // complete
    await updateProgress(a.id, MEMBER_B, 50);

    const analytics = await orgWellnessAnalytics(ORG);
    expect(analytics.programCount).toBe(2);
    expect(analytics.totalActiveEnrollments).toBe(3);
    expect(analytics.totalCompleted).toBe(1);
    expect(analytics.completionRate).toBe(33); // 1 / 3
    expect(analytics.averageProgress).toBe(50); // (100 + 50 + 0) / 3
  });

  it('reports zeros for an org with no programs', async () => {
    const analytics = await orgWellnessAnalytics(OTHER_ORG);
    expect(analytics).toEqual({
      programCount: 0, totalActiveEnrollments: 0, totalCompleted: 0, completionRate: 0, averageProgress: 0,
    });
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
