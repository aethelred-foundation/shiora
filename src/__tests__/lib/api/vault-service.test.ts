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
  computeCycleAnalytics,
  computeSymptomAnalytics,
  cycleInsights,
  vaultOverview,
  vaultAnalytics,
  __resetVaultForTests,
  type CycleEntry,
  type SymptomEntry,
} from '@/lib/api/vault-service';
import { seededAddress } from '@/lib/utils';

const USER = seededAddress(700);
const OTHER = seededAddress(701);
const DAY = 86_400_000;

function sym(date: number, severity: number, symptom = 'Cramps', category: SymptomEntry['category'] = 'pain'): SymptomEntry {
  return { id: `s${date}`, date, category, symptom, severity, notes: '', tags: [], loggedAt: date };
}

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

describe('computeCycleAnalytics', () => {
  const base = 1000 * DAY;

  it('reports insufficient data with no period starts', () => {
    const a = computeCycleAnalytics([nonStart(base)], base);
    expect(a.regularity).toBe('insufficient_data');
    expect(a.cycleLengthVariability).toBeNull();
    expect(a.fertileWindow).toBeNull();
    expect(a.predictedPeriods).toEqual([]);
  });

  it('projects a fertile window and future periods from a single start', () => {
    const lastStart = base - 2 * DAY;
    const a = computeCycleAnalytics([start(lastStart)], base);
    expect(a.regularity).toBe('insufficient_data'); // only one start → no completed cycle
    expect(a.predictedPeriods).toHaveLength(3);
    expect(a.predictedPeriods[0]).toBe(lastStart + 28 * DAY);
    // ovulation = predicted next period − 14d; window is −5d..+1d around it
    const ovulation = lastStart + 28 * DAY - 14 * DAY;
    expect(a.fertileWindow).toEqual({ start: ovulation - 5 * DAY, end: ovulation + 1 * DAY });
  });

  it('classifies an even cycle history as regular', () => {
    const starts = [start(base - 56 * DAY), start(base - 28 * DAY), start(base)];
    const a = computeCycleAnalytics(starts, base);
    expect(a.regularity).toBe('regular');
    expect(a.cycleLengthVariability).toBe(0);
  });

  it('classifies a variable cycle history as irregular', () => {
    // lengths [21, 35] → mean 28, stddev 7 (> 4)
    const starts = [start(base - 56 * DAY), start(base - 35 * DAY), start(base)];
    const a = computeCycleAnalytics(starts, base);
    expect(a.regularity).toBe('irregular');
    expect(a.cycleLengthVariability).toBe(7);
  });
});

describe('computeSymptomAnalytics', () => {
  const base = 1000 * DAY;

  it('summarises an empty history', () => {
    const a = computeSymptomAnalytics([], [], base);
    expect(a).toEqual({
      totalLogged: 0,
      byCategory: {},
      averageSeverity: null,
      topSymptoms: [],
      severityTrend: 'insufficient_data',
      byCyclePhase: { menstrual: 0, follicular: 0, ovulation: 0, luteal: 0, unknown: 0 },
    });
  });

  it('aggregates categories, average severity, and top symptoms', () => {
    const entries = [
      sym(base, 4, 'Cramps', 'pain'),
      sym(base - DAY, 2, 'Cramps', 'pain'),
      sym(base - 2 * DAY, 3, 'Anxiety', 'mood'),
    ];
    const a = computeSymptomAnalytics(entries, [], base);
    expect(a.totalLogged).toBe(3);
    expect(a.byCategory).toEqual({ pain: 2, mood: 1 });
    expect(a.averageSeverity).toBe(3);
    expect(a.topSymptoms[0]).toEqual({ symptom: 'Cramps', count: 2 });
  });

  it.each([
    ['improving', 4, 2],
    ['worsening', 2, 4],
    ['stable', 3, 3],
  ] as const)('derives a %s severity trend', (trend, olderSeverity, recentSeverity) => {
    const entries = [
      sym(base - 50 * DAY, olderSeverity), // older than the 30-day window
      sym(base - 1 * DAY, recentSeverity), // within the window
    ];
    expect(computeSymptomAnalytics(entries, [], base).severityTrend).toBe(trend);
  });

  it('reports insufficient trend data when only recent symptoms exist', () => {
    const entries = [sym(base - 1 * DAY, 3)];
    expect(computeSymptomAnalytics(entries, [], base).severityTrend).toBe('insufficient_data');
  });

  it('reports insufficient trend data when only older symptoms exist', () => {
    const entries = [sym(base - 50 * DAY, 3)];
    expect(computeSymptomAnalytics(entries, [], base).severityTrend).toBe('insufficient_data');
  });

  it('correlates symptoms with cycle phase, marking pre-history symptoms unknown', () => {
    const cycleEntries = [start(base - 28 * DAY), start(base)]; // a later start exists → break path
    const entries = [
      sym(base + 2 * DAY, 3), // 3 days into the current cycle → menstrual
      sym(base + 9 * DAY, 3), // ~10 days in → follicular
      sym(base - 40 * DAY, 3), // before any logged start → unknown
    ];
    const a = computeSymptomAnalytics(entries, cycleEntries, base);
    expect(a.byCyclePhase.menstrual).toBe(1);
    expect(a.byCyclePhase.follicular).toBe(1);
    expect(a.byCyclePhase.unknown).toBe(1);
  });
});

describe('vaultAnalytics (async)', () => {
  it('derives full analytics from the owner\'s stored entries', async () => {
    await logSymptom(USER, { category: 'pain', symptom: 'Cramps', severity: 3, date: Date.now() - DAY });
    await logCycleEntry(USER, { flow: 'heavy', isPeriodStart: true, date: Date.now() - 2 * DAY });

    const analytics = await vaultAnalytics(USER);
    expect(analytics.symptoms.totalLogged).toBe(1);
    expect(analytics.cycle.predictedPeriods).toHaveLength(3);
    expect(analytics.cycle.insights.periodStartCount).toBe(1);
  });
});
