/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  logSymptom,
  listSymptoms,
  logCycleEntry,
  listCycleEntries,
  computeCycleInsights,
  cycleInsights,
  vaultOverview,
  __resetVaultForTests,
  type CycleEntry,
} from '@/lib/api/vault-service';
import { seededAddress } from '@/lib/utils';

const USER = seededAddress(700);
const OTHER = seededAddress(701);
const DAY = 86_400_000;

const originalDatabaseUrl = process.env.DATABASE_URL;

beforeEach(() => {
  delete process.env.DATABASE_URL;
  __resetVaultForTests();
});

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  __resetVaultForTests();
});

function start(date: number): CycleEntry {
  return { id: `c${date}`, date, flow: 'medium', isPeriodStart: true, notes: '', loggedAt: date };
}
function nonStart(date: number): CycleEntry {
  return { id: `n${date}`, date, flow: 'none', isPeriodStart: false, notes: '', loggedAt: date };
}

describe('vault symptoms', () => {
  it('logs and lists symptoms most-recent-first with sensible defaults', async () => {
    await logSymptom(USER, { category: 'pain', symptom: 'Cramps', severity: 4, date: 1000 });
    await logSymptom(USER, { category: 'mood', symptom: 'Anxiety', severity: 2, date: 2000 });

    const list = await listSymptoms(USER);
    expect(list.map((s) => s.symptom)).toEqual(['Anxiety', 'Cramps']); // descending by date
    const cramps = list[1];
    expect(cramps.notes).toBe(''); // defaulted
    expect(cramps.tags).toEqual([]); // defaulted
  });

  it('scopes symptoms to their owner and dates an undated entry to now', async () => {
    const entry = await logSymptom(USER, { category: 'pain', symptom: 'X', severity: 1 });
    expect(entry.date).toBeGreaterThan(0); // date ?? Date.now()
    expect(await listSymptoms(OTHER)).toEqual([]);
  });
});

describe('vault cycle entries', () => {
  it('lists entries chronologically and keeps temperature only when provided', async () => {
    await logCycleEntry(USER, { flow: 'medium', isPeriodStart: true, date: 2000, temperature: 97.6 });
    await logCycleEntry(USER, { flow: 'none', isPeriodStart: false, date: 1000 });

    const list = await listCycleEntries(USER);
    expect(list.map((e) => e.date)).toEqual([1000, 2000]); // ascending
    expect(list[0].temperature).toBeUndefined();
    expect(list[1].temperature).toBe(97.6);
  });

  it('dates an undated cycle entry to now', async () => {
    const entry = await logCycleEntry(USER, { flow: 'light', isPeriodStart: true });
    expect(entry.date).toBeGreaterThan(0);
  });
});

describe('computeCycleInsights', () => {
  it('returns nulls when no period start is logged', () => {
    const insights = computeCycleInsights([nonStart(1000)], 1000);
    expect(insights.entryCount).toBe(1);
    expect(insights.periodStartCount).toBe(0);
    expect(insights.averageCycleLength).toBeNull();
    expect(insights.lastPeriodStart).toBeNull();
    expect(insights.predictedNextPeriod).toBeNull();
    expect(insights.currentCycleDay).toBeNull();
    expect(insights.currentPhase).toBeNull();
  });

  it('falls back to the default cycle length with a single period start', () => {
    const base = 100 * DAY;
    const insights = computeCycleInsights([start(base - 2 * DAY)], base);
    expect(insights.periodStartCount).toBe(1);
    expect(insights.averageCycleLength).toBeNull(); // no completed cycle yet
    expect(insights.currentCycleDay).toBe(3);
    expect(insights.currentPhase).toBe('menstrual');
    expect(insights.predictedNextPeriod).toBe(base - 2 * DAY + 28 * DAY);
  });

  it('computes the average cycle length from completed cycles', () => {
    const base = 100 * DAY;
    const insights = computeCycleInsights([start(base - 30 * DAY), start(base - 2 * DAY)], base);
    expect(insights.averageCycleLength).toBe(28);
  });

  it('averages only the most recent six cycles', () => {
    const base = 1000 * DAY;
    const starts: CycleEntry[] = [];
    let d = base - 8 * 28 * DAY;
    for (let k = 0; k < 8; k += 1) {
      starts.push(start(d));
      d += 28 * DAY;
    }
    const insights = computeCycleInsights(starts, base);
    expect(insights.periodStartCount).toBe(8);
    expect(insights.averageCycleLength).toBe(28);
  });

  it.each([
    [9, 'follicular'],
    [13, 'ovulation'],
    [20, 'luteal'],
  ] as const)('derives the phase %i days into the cycle', (daysSince, phase) => {
    const base = 100 * DAY;
    const insights = computeCycleInsights([start(base - daysSince * DAY)], base);
    expect(insights.currentPhase).toBe(phase);
  });
});

describe('cycleInsights and vaultOverview', () => {
  it('derive from the owner\'s stored entries', async () => {
    await logSymptom(USER, { category: 'pain', symptom: 'Cramps', severity: 3 });
    await logCycleEntry(USER, { flow: 'heavy', isPeriodStart: true, date: Date.now() - 2 * DAY });

    const insights = await cycleInsights(USER);
    expect(insights.periodStartCount).toBe(1);

    const overview = await vaultOverview(USER);
    expect(overview.symptomCount).toBe(1);
    expect(overview.cycleEntryCount).toBe(1);
    expect(overview.insights.periodStartCount).toBe(1);
  });

  it('uses the Postgres-backed store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetVaultForTests();
    expect(await listSymptoms(USER)).toEqual([]);
    expect(pgQuery).toHaveBeenCalled();
  });
});
