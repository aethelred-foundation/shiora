/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  createCareGap,
  listCareGaps,
  getCareGap,
  updateCareGap,
  __resetCareGapsForTests,
} from '@/lib/api/care-gap-service';
import { seededAddress } from '@/lib/utils';

const PAYER = seededAddress(400);
const OTHER_PAYER = seededAddress(401);
const original = process.env.DATABASE_URL;

beforeEach(() => {
  delete process.env.DATABASE_URL;
  __resetCareGapsForTests();
});

afterEach(() => {
  if (original === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = original;
  __resetCareGapsForTests();
  jest.restoreAllMocks();
});

describe('care-gap-service', () => {
  it('opens gaps and lists them most-recently-updated first, scoped to the payer', async () => {
    let clock = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => (clock += 1000));

    const first = await createCareGap(PAYER, { measure: 'A1c screening', cohort: 'Diabetic Q3', openCount: 12 });
    expect(first.description).toBe(''); // defaulted
    expect(first.status).toBe('open');
    await createCareGap(PAYER, { measure: 'Mammogram', cohort: 'Women 50+', description: 'Annual', openCount: 30 });

    const list = await listCareGaps(PAYER);
    expect(list.map((g) => g.measure)).toEqual(['Mammogram', 'A1c screening']); // newest update first
    expect(await listCareGaps(OTHER_PAYER)).toEqual([]); // payer-scoped

    expect((await getCareGap(PAYER, first.id))?.measure).toBe('A1c screening');
  });

  it('updates the open count and closes a gap', async () => {
    const gap = await createCareGap(PAYER, { measure: 'A1c screening', cohort: 'Diabetic Q3', openCount: 12 });

    const reduced = await updateCareGap(PAYER, gap.id, { openCount: 5 });
    expect(reduced?.openCount).toBe(5);
    expect(reduced?.updatedAt).toBeGreaterThanOrEqual(gap.updatedAt);

    const closed = await updateCareGap(PAYER, gap.id, { status: 'closed' });
    expect(closed?.status).toBe('closed');
  });

  it('returns undefined when updating an unknown or unowned gap', async () => {
    const gap = await createCareGap(PAYER, { measure: 'A1c', cohort: 'X', openCount: 1 });
    expect(await updateCareGap(PAYER, 'gap-nope', { status: 'closed' })).toBeUndefined();
    expect(await updateCareGap(OTHER_PAYER, gap.id, { status: 'closed' })).toBeUndefined(); // not the owner
  });

  it('uses the Postgres store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetCareGapsForTests();
    expect(await listCareGaps(PAYER)).toEqual([]);
    expect(pgQuery).toHaveBeenCalled();
  });
});
