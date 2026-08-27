// ============================================================
// Shiora on Aethelred — Vault Service (cycle & symptom tracking)
//
// The real, encrypted datastore for the individual women's-health vault:
// owner-scoped symptom logs and cycle entries, sealed at rest with envelope
// encryption and written to the tamper-evident audit chain on every mutation.
// Cycle insights (average cycle length, predicted next period, current day and
// phase) are derived from the user's own logged period starts — real math over
// real data, not generated figures. Postgres when DATABASE_URL is set, else
// in-memory; both via the generic EncryptedDocumentRepository.
// ============================================================

import { randomUUID } from 'crypto';

import { getAuditLog } from '@/lib/api/audit-log';
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';
import type { SymptomCategory } from '@/types';

const SYMPTOM_COLLECTION = 'vault-symptom';
const CYCLE_COLLECTION = 'vault-cycle';
const DAY_MS = 86_400_000;
const DEFAULT_CYCLE_LENGTH = 28; // fallback until two period starts are logged
const RECENT_CYCLES = 6; // average over the most recent cycles
const LUTEAL_LENGTH = 14; // days from ovulation to the next period
const REGULAR_STDDEV_DAYS = 4; // cycle-length spread at/below this reads as "regular"
const FERTILE_DAYS_BEFORE_OVULATION = 5; // sperm-viability window
const FERTILE_DAYS_AFTER_OVULATION = 1; // egg-viability window
const TOP_SYMPTOMS = 5;
const TREND_WINDOW_DAYS = 30; // recent vs. older split for the severity trend
const TREND_SEVERITY_DELTA = 0.5; // change below this reads as "stable"
const PREDICTED_PERIODS = 3; // how many future periods to project

export type Flow = 'none' | 'light' | 'medium' | 'heavy';
export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

export interface SymptomEntry {
  id: string;
  date: number;
  category: SymptomCategory;
  symptom: string;
  severity: number;
  notes: string;
  tags: string[];
  loggedAt: number;
}

export interface CycleEntry {
  id: string;
  date: number;
  flow: Flow;
  isPeriodStart: boolean;
  temperature?: number;
  notes: string;
  loggedAt: number;
}

export interface SymptomInput {
  category: SymptomCategory;
  symptom: string;
  severity: number;
  notes?: string;
  tags?: string[];
  date?: number;
}

export interface CycleInput {
  flow: Flow;
  isPeriodStart: boolean;
  temperature?: number;
  notes?: string;
  date?: number;
}

export interface CycleInsights {
  entryCount: number;
  periodStartCount: number;
  /** Mean of recent cycle lengths in days, or null until two starts are logged. */
  averageCycleLength: number | null;
  lastPeriodStart: number | null;
  predictedNextPeriod: number | null;
  currentCycleDay: number | null;
  currentPhase: CyclePhase | null;
}

export interface VaultOverview {
  symptomCount: number;
  cycleEntryCount: number;
  insights: CycleInsights;
}

export type Regularity = 'regular' | 'irregular' | 'insufficient_data';
export type SeverityTrend = 'improving' | 'worsening' | 'stable' | 'insufficient_data';

export interface CycleAnalytics {
  insights: CycleInsights;
  /** Standard deviation of recent cycle lengths in days, null until two cycles. */
  cycleLengthVariability: number | null;
  regularity: Regularity;
  /** Predicted fertile window around the next ovulation, null with no period data. */
  fertileWindow: { start: number; end: number } | null;
  /** The next few projected period start dates. */
  predictedPeriods: number[];
}

export interface SymptomAnalytics {
  totalLogged: number;
  byCategory: Partial<Record<SymptomCategory, number>>;
  averageSeverity: number | null;
  topSymptoms: Array<{ symptom: string; count: number }>;
  severityTrend: SeverityTrend;
  /** How symptoms distribute across the cycle phases (correlation insight). */
  byCyclePhase: Record<CyclePhase | 'unknown', number>;
}

export interface VaultAnalytics {
  cycle: CycleAnalytics;
  symptoms: SymptomAnalytics;
}

let symptomRepo: EncryptedDocumentRepository<SymptomEntry> | null = null;
let cycleRepo: EncryptedDocumentRepository<CycleEntry> | null = null;

function createStore(): DocumentStorePort {
  if (shouldUsePostgres()) {
    return new PgDocumentStore(getPgClient());
  }
  return new InMemoryDocumentStore();
}

function symptoms(): EncryptedDocumentRepository<SymptomEntry> {
  if (!symptomRepo) {
    symptomRepo = new EncryptedDocumentRepository<SymptomEntry>(
      createStore(),
      getAuditLog(),
      SYMPTOM_COLLECTION,
      { create: 'VAULT_SYMPTOM_LOG', update: 'VAULT_SYMPTOM_UPDATE' },
    );
  }
  return symptomRepo;
}

function cycles(): EncryptedDocumentRepository<CycleEntry> {
  if (!cycleRepo) {
    cycleRepo = new EncryptedDocumentRepository<CycleEntry>(
      createStore(),
      getAuditLog(),
      CYCLE_COLLECTION,
      { create: 'VAULT_CYCLE_LOG', update: 'VAULT_CYCLE_UPDATE' },
    );
  }
  return cycleRepo;
}

// ── Symptoms ────────────────────────────────────────────────────────────────

export async function logSymptom(owner: string, input: SymptomInput): Promise<SymptomEntry> {
  const entry: SymptomEntry = {
    id: `sym-${randomUUID().replace(/-/g, '')}`,
    date: input.date ?? Date.now(),
    category: input.category,
    symptom: input.symptom,
    severity: input.severity,
    notes: input.notes ?? '',
    tags: input.tags ?? [],
    loggedAt: Date.now(),
  };
  return symptoms().create(owner, entry);
}

/** An owner's symptom logs, most recent first. */
export async function listSymptoms(owner: string): Promise<SymptomEntry[]> {
  const entries = await symptoms().list(owner);
  return entries.sort((a, b) => b.date - a.date);
}

// ── Cycle ─────────────────────────────────────────────────────────────────--

export async function logCycleEntry(owner: string, input: CycleInput): Promise<CycleEntry> {
  const entry: CycleEntry = {
    id: `cyc-${randomUUID().replace(/-/g, '')}`,
    date: input.date ?? Date.now(),
    flow: input.flow,
    isPeriodStart: input.isPeriodStart,
    ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
    notes: input.notes ?? '',
    loggedAt: Date.now(),
  };
  return cycles().create(owner, entry);
}

/** An owner's cycle entries, oldest first (chronological). */
export async function listCycleEntries(owner: string): Promise<CycleEntry[]> {
  const entries = await cycles().list(owner);
  return entries.sort((a, b) => a.date - b.date);
}

/**
 * Derive cycle insights from the user's logged period starts. Pure and
 * deterministic given `now`, so callers and tests get the same result.
 */
export function computeCycleInsights(
  entries: CycleEntry[],
  now: number = Date.now(),
): CycleInsights {
  const starts = entries
    .filter((entry) => entry.isPeriodStart)
    .map((entry) => entry.date)
    .sort((a, b) => a - b);

  const entryCount = entries.length;
  const periodStartCount = starts.length;

  if (periodStartCount === 0) {
    return {
      entryCount,
      periodStartCount,
      averageCycleLength: null,
      lastPeriodStart: null,
      predictedNextPeriod: null,
      currentCycleDay: null,
      currentPhase: null,
    };
  }

  const lastPeriodStart = starts[starts.length - 1];

  const lengths: number[] = [];
  for (let i = 1; i < starts.length; i += 1) {
    lengths.push(Math.round((starts[i] - starts[i - 1]) / DAY_MS));
  }
  const recent = lengths.slice(-RECENT_CYCLES);
  const averageCycleLength = recent.length > 0
    ? Math.round(recent.reduce((sum, len) => sum + len, 0) / recent.length)
    : null;

  const cycleLength = averageCycleLength ?? DEFAULT_CYCLE_LENGTH;
  const predictedNextPeriod = lastPeriodStart + cycleLength * DAY_MS;
  const currentCycleDay = Math.floor((now - lastPeriodStart) / DAY_MS) + 1;
  const currentPhase = phaseForDay(currentCycleDay, cycleLength);

  return {
    entryCount,
    periodStartCount,
    averageCycleLength,
    lastPeriodStart,
    predictedNextPeriod,
    currentCycleDay,
    currentPhase,
  };
}

function phaseForDay(day: number, cycleLength: number): CyclePhase {
  if (day <= 5) {
    return 'menstrual';
  }
  const ovulationDay = cycleLength - LUTEAL_LENGTH;
  if (day < ovulationDay) {
    return 'follicular';
  }
  if (day <= ovulationDay + 1) {
    return 'ovulation';
  }
  return 'luteal';
}

// ── Analytics (derived women's-health intelligence) ─────────────────────────--

function periodStartsOf(entries: CycleEntry[]): number[] {
  return entries
    .filter((entry) => entry.isPeriodStart)
    .map((entry) => entry.date)
    .sort((a, b) => a - b);
}

function recentCycleLengths(starts: number[]): number[] {
  const lengths: number[] = [];
  for (let i = 1; i < starts.length; i += 1) {
    lengths.push(Math.round((starts[i] - starts[i - 1]) / DAY_MS));
  }
  return lengths.slice(-RECENT_CYCLES);
}

function standardDeviation(values: number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Which cycle phase a date falls in, given the user's period starts. */
function phaseForDate(date: number, starts: number[], cycleLength: number): CyclePhase | 'unknown' {
  let start: number | undefined;
  for (const candidate of starts) {
    if (candidate <= date) {
      start = candidate;
    } else {
      break;
    }
  }
  if (start === undefined) {
    return 'unknown';
  }
  const day = Math.floor((date - start) / DAY_MS) + 1;
  return phaseForDay(day, cycleLength);
}

/** Cycle regularity, variability, fertile window, and projected periods. */
export function computeCycleAnalytics(
  entries: CycleEntry[],
  now: number = Date.now(),
): CycleAnalytics {
  const insights = computeCycleInsights(entries, now);
  const lengths = recentCycleLengths(periodStartsOf(entries));

  let cycleLengthVariability: number | null = null;
  let regularity: Regularity = 'insufficient_data';
  if (lengths.length >= 2) {
    const spread = standardDeviation(lengths);
    cycleLengthVariability = Math.round(spread * 10) / 10;
    regularity = spread <= REGULAR_STDDEV_DAYS ? 'regular' : 'irregular';
  }

  let fertileWindow: { start: number; end: number } | null = null;
  const predictedPeriods: number[] = [];
  if (insights.lastPeriodStart !== null) {
    const cycleLength = insights.averageCycleLength ?? DEFAULT_CYCLE_LENGTH;
    const ovulation = insights.predictedNextPeriod! - LUTEAL_LENGTH * DAY_MS;
    fertileWindow = {
      start: ovulation - FERTILE_DAYS_BEFORE_OVULATION * DAY_MS,
      end: ovulation + FERTILE_DAYS_AFTER_OVULATION * DAY_MS,
    };
    for (let k = 1; k <= PREDICTED_PERIODS; k += 1) {
      predictedPeriods.push(insights.lastPeriodStart + cycleLength * DAY_MS * k);
    }
  }

  return { insights, cycleLengthVariability, regularity, fertileWindow, predictedPeriods };
}

/** Symptom frequency, severity trend, and correlation with the cycle phases. */
export function computeSymptomAnalytics(
  symptomEntries: SymptomEntry[],
  cycleEntries: CycleEntry[],
  now: number = Date.now(),
): SymptomAnalytics {
  const totalLogged = symptomEntries.length;

  const byCategory: Partial<Record<SymptomCategory, number>> = {};
  for (const entry of symptomEntries) {
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
  }

  const averageSeverity = totalLogged > 0
    ? Math.round((symptomEntries.reduce((sum, entry) => sum + entry.severity, 0) / totalLogged) * 10) / 10
    : null;

  const counts = new Map<string, number>();
  for (const entry of symptomEntries) {
    counts.set(entry.symptom, (counts.get(entry.symptom) ?? 0) + 1);
  }
  const topSymptoms = Array.from(counts.entries())
    .map(([symptom, count]) => ({ symptom, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_SYMPTOMS);

  const cutoff = now - TREND_WINDOW_DAYS * DAY_MS;
  const recent = symptomEntries.filter((entry) => entry.date >= cutoff);
  const older = symptomEntries.filter((entry) => entry.date < cutoff);
  let severityTrend: SeverityTrend = 'insufficient_data';
  if (recent.length > 0 && older.length > 0) {
    const mean = (group: SymptomEntry[]) => group.reduce((sum, entry) => sum + entry.severity, 0) / group.length;
    const recentMean = mean(recent);
    const olderMean = mean(older);
    if (recentMean < olderMean - TREND_SEVERITY_DELTA) {
      severityTrend = 'improving';
    } else if (recentMean > olderMean + TREND_SEVERITY_DELTA) {
      severityTrend = 'worsening';
    } else {
      severityTrend = 'stable';
    }
  }

  const starts = periodStartsOf(cycleEntries);
  const cycleLength = computeCycleInsights(cycleEntries, now).averageCycleLength ?? DEFAULT_CYCLE_LENGTH;
  const byCyclePhase: Record<CyclePhase | 'unknown', number> = {
    menstrual: 0, follicular: 0, ovulation: 0, luteal: 0, unknown: 0,
  };
  for (const entry of symptomEntries) {
    byCyclePhase[phaseForDate(entry.date, starts, cycleLength)] += 1;
  }

  return { totalLogged, byCategory, averageSeverity, topSymptoms, severityTrend, byCyclePhase };
}

export async function cycleInsights(owner: string): Promise<CycleInsights> {
  return computeCycleInsights(await listCycleEntries(owner));
}

export async function vaultOverview(owner: string): Promise<VaultOverview> {
  const [symptomList, cycleList] = await Promise.all([
    listSymptoms(owner),
    listCycleEntries(owner),
  ]);
  return {
    symptomCount: symptomList.length,
    cycleEntryCount: cycleList.length,
    insights: computeCycleInsights(cycleList),
  };
}

/** Full derived analytics over the owner's symptom and cycle history. */
export async function vaultAnalytics(owner: string): Promise<VaultAnalytics> {
  const [symptomList, cycleList] = await Promise.all([
    listSymptoms(owner),
    listCycleEntries(owner),
  ]);
  return {
    cycle: computeCycleAnalytics(cycleList),
    symptoms: computeSymptomAnalytics(symptomList, cycleList),
  };
}

/** Soft-delete all of an owner's symptom and cycle entries (right to erasure). */
export async function eraseVaultEntries(owner: string): Promise<number> {
  const [symptomList, cycleList] = await Promise.all([
    listSymptoms(owner),
    listCycleEntries(owner),
  ]);
  await Promise.all([
    ...symptomList.map((entry) => symptoms().cryptoShred(owner, entry.id)),
    ...cycleList.map((entry) => cycles().cryptoShred(owner, entry.id)),
  ]);
  return symptomList.length + cycleList.length;
}

// ── Compartments ────────────────────────────────────────────────────────────
//
// A compartment is the user's REAL, persisted organizational unit over their
// vault: one per category, owner-scoped and encrypted like every other vault
// document, with a user-controlled lock state that is audited on change.
// Record counts and storage are derived live from the user's actual entries —
// nothing is fabricated. Per-record data keys are never exposed and there is
// no per-compartment access-grant scoping, so those fields are honestly empty.

export type CompartmentLockStatus = 'locked' | 'unlocked';

export type CompartmentCategory =
  | 'cycle_tracking'
  | 'fertility_data'
  | 'hormone_levels'
  | 'medications'
  | 'lab_results'
  | 'imaging'
  | 'symptoms'
  | 'pregnancy';

interface CompartmentDoc {
  id: string;
  category: CompartmentCategory;
  label: string;
  description: string;
  lockStatus: CompartmentLockStatus;
  createdAt: number;
  lastAccessed: number;
}

export interface Compartment extends CompartmentDoc {
  /** Live count of the user's real entries in this category. */
  recordCount: number;
  /** Live byte size of the user's real entries in this category. */
  storageUsed: number;
  /** Always empty — per-record data keys are never exposed through the API. */
  encryptionKey: string;
  /** Always empty — no per-compartment access-grant scoping exists. */
  accessList: string[];
  jurisdictionFlags: string[];
}

const COMPARTMENT_COLLECTION = 'vault-compartment';

const DEFAULT_COMPARTMENTS: Array<{
  category: CompartmentCategory;
  label: string;
  description: string;
}> = [
  { category: 'cycle_tracking', label: 'Cycle Tracking', description: 'Period and cycle-phase entries, encrypted at rest.' },
  { category: 'fertility_data', label: 'Fertility Data', description: 'Fertility signals derived from your cycle entries.' },
  { category: 'hormone_levels', label: 'Hormone Levels', description: 'Hormone panel results you choose to store.' },
  { category: 'medications', label: 'Medications', description: 'Medication and prescription entries.' },
  { category: 'lab_results', label: 'Lab Results', description: 'Laboratory results and panels.' },
  { category: 'imaging', label: 'Imaging', description: 'Imaging reports and summaries.' },
  { category: 'symptoms', label: 'Symptoms', description: 'Symptom log entries, encrypted at rest.' },
  { category: 'pregnancy', label: 'Pregnancy', description: 'Pregnancy-related entries.' },
];

/** Stable display order — exhaustive over the closed category union. */
const CATEGORY_ORDER: Record<CompartmentCategory, number> = {
  cycle_tracking: 0,
  fertility_data: 1,
  hormone_levels: 2,
  medications: 3,
  lab_results: 4,
  imaging: 5,
  symptoms: 6,
  pregnancy: 7,
};

let compartmentRepo: EncryptedDocumentRepository<CompartmentDoc> | null = null;

function compartmentsRepo(): EncryptedDocumentRepository<CompartmentDoc> {
  if (!compartmentRepo) {
    compartmentRepo = new EncryptedDocumentRepository<CompartmentDoc>(
      createStore(),
      getAuditLog(),
      COMPARTMENT_COLLECTION,
      { create: 'VAULT_COMPARTMENT_CREATE', update: 'VAULT_COMPARTMENT_UPDATE' },
    );
  }
  return compartmentRepo;
}

/** Byte size of the user's entries as stored JSON (0 when there are none). */
function entryBytes(entries: unknown[]): number {
  return entries.length === 0 ? 0 : Buffer.byteLength(JSON.stringify(entries), 'utf8');
}

function toCompartment(
  doc: CompartmentDoc,
  syms: SymptomEntry[],
  cycs: CycleEntry[],
): Compartment {
  let entries: Array<{ date: number }> = [];
  if (doc.category === 'symptoms') {
    entries = syms;
  } else if (doc.category === 'cycle_tracking') {
    entries = cycs;
  }
  const lastEntryAt = entries.reduce((max, e) => Math.max(max, e.date), 0);
  return {
    ...doc,
    recordCount: entries.length,
    storageUsed: entryBytes(entries),
    lastAccessed: Math.max(doc.lastAccessed, lastEntryAt),
    encryptionKey: '',
    accessList: [],
    jurisdictionFlags: [],
  };
}

/**
 * The owner's compartment set, lazily initialized on first access (one
 * compartment per category, locked by default — privacy-first), with live
 * record counts and storage derived from the user's real entries.
 */
export async function listCompartments(owner: string): Promise<Compartment[]> {
  let docs = await compartmentsRepo().list(owner);
  if (docs.length === 0) {
    const now = Date.now();
    docs = [];
    for (const preset of DEFAULT_COMPARTMENTS) {
      docs.push(
        await compartmentsRepo().create(owner, {
          id: `cmp-${randomUUID().replace(/-/g, '')}`,
          ...preset,
          lockStatus: 'locked',
          createdAt: now,
          lastAccessed: now,
        }),
      );
    }
  }
  const [syms, cycs] = await Promise.all([listSymptoms(owner), listCycleEntries(owner)]);
  return docs
    .map((doc) => toCompartment(doc, syms, cycs))
    .sort((a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category]);
}

/** A single compartment with live derived stats, or null when not found. */
export async function getCompartment(owner: string, id: string): Promise<Compartment | null> {
  const doc = await compartmentsRepo().get(owner, id);
  if (!doc) {
    return null;
  }
  const [syms, cycs] = await Promise.all([listSymptoms(owner), listCycleEntries(owner)]);
  return toCompartment(doc, syms, cycs);
}

/**
 * Lock or unlock a compartment. Persisted and written to the audit chain;
 * returns the updated compartment, or null when the id is unknown.
 */
export async function setCompartmentLock(
  owner: string,
  id: string,
  action: 'lock' | 'unlock',
): Promise<Compartment | null> {
  const updated = await compartmentsRepo().update(owner, id, {
    lockStatus: action === 'lock' ? 'locked' : 'unlocked',
    lastAccessed: Date.now(),
  });
  if (!updated) {
    return null;
  }
  const [syms, cycs] = await Promise.all([listSymptoms(owner), listCycleEntries(owner)]);
  return toCompartment(updated, syms, cycs);
}

/** Test-only: reset the singletons so each test starts from empty state. */
export function __resetVaultForTests(): void {
  symptomRepo = null;
  cycleRepo = null;
  compartmentRepo = null;
}
