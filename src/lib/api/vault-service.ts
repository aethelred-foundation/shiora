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

/** Test-only: reset the singletons so each test starts from empty state. */
export function __resetVaultForTests(): void {
  symptomRepo = null;
  cycleRepo = null;
}
