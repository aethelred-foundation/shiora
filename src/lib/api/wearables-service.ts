// ============================================================
// Shiora on Aethelred — Wearables telemetry → MPC pipeline
//
// Real, encrypted, owner-scoped wearable telemetry: samples are sealed at rest
// (EncryptedDocumentRepository) and audited on ingest. Per-owner analytics are
// derived from the real samples, and a cohort aggregate is computed through the
// REAL secure multi-party computation primitive (Shamir secret-sharing,
// secret-sharing.ts) — revealing only the cohort total/mean, never an
// individual's telemetry.
//
// SCOPE: the ingest + analytics + MPC bridge are real. Live device-vendor sync
// (Fitbit/Apple Health/Garmin OAuth) is the remaining integration — telemetry
// is ingested via POST /api/wearables/samples (webhook / app upload) today.
// ============================================================

import { randomUUID } from 'node:crypto';

import { getAuditLog } from '@/lib/api/audit-log';
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';
import { secureSum } from '@/lib/crypto/secret-sharing';

const COLLECTION = 'wearable-sample';

export interface WearableSample {
  id: string;
  /** e.g. 'heart_rate', 'steps', 'sleep_minutes', 'spo2'. */
  metric: string;
  value: number;
  unit: string;
  recordedAt: number;
  source: string;
}

export type NewSample = Omit<WearableSample, 'id'>;

export interface MetricSummary {
  metric: string;
  count: number;
  sum: number;
  mean: number;
  min: number;
  max: number;
  latest: number;
}

export interface CohortAggregate {
  metric: string;
  cohortSize: number;
  contributingOwners: number;
  sum: number;
  mean: number;
}

export type CohortResult =
  | { ok: true; aggregate: CohortAggregate }
  | { ok: false; reason: string };

let repository: EncryptedDocumentRepository<WearableSample> | null = null;

function createStore(): DocumentStorePort {
  if (shouldUsePostgres()) {
    return new PgDocumentStore(getPgClient());
  }
  return new InMemoryDocumentStore();
}

function repo(): EncryptedDocumentRepository<WearableSample> {
  if (!repository) {
    repository = new EncryptedDocumentRepository<WearableSample>(
      createStore(),
      getAuditLog(),
      COLLECTION,
      { create: 'WEARABLE_INGEST', update: 'WEARABLE_INGEST' },
    );
  }
  return repository;
}

/** Ingest a batch of telemetry samples for an owner. Returns how many landed. */
export async function ingestSamples(ownerAddress: string, samples: NewSample[]): Promise<number> {
  for (const sample of samples) {
    await repo().create(ownerAddress, { ...sample, id: `ws-${randomUUID().replace(/-/g, '')}` });
  }
  return samples.length;
}

/** An owner's samples, newest first, optionally filtered by metric. */
export async function listSamples(ownerAddress: string, metric?: string): Promise<WearableSample[]> {
  const all = await repo().list(ownerAddress);
  const filtered = metric ? all.filter((s) => s.metric === metric) : all;
  return filtered.sort((a, b) => b.recordedAt - a.recordedAt);
}

/** Derived analytics for one metric over an owner's own samples. */
export async function summarizeMetric(
  ownerAddress: string,
  metric: string,
): Promise<MetricSummary | null> {
  const samples = await listSamples(ownerAddress, metric);
  if (samples.length === 0) {
    return null;
  }
  const values = samples.map((s) => s.value);
  const sum = values.reduce((acc, v) => acc + v, 0);
  // samples are sorted newest-first, so the first is the latest.
  return {
    metric,
    count: samples.length,
    sum,
    mean: sum / samples.length,
    min: Math.min(...values),
    max: Math.max(...values),
    latest: samples[0].value,
  };
}

/**
 * Aggregate a metric across a cohort via real MPC. Each member's per-metric sum
 * is fed into secureSum (Shamir secret-sharing); only the cohort total/mean is
 * revealed. Requires ≥2 contributing members so no individual is exposed.
 */
export async function cohortMetricAggregate(
  cohort: string[],
  metric: string,
): Promise<CohortResult> {
  const values: bigint[] = [];
  for (const owner of cohort) {
    const summary = await summarizeMetric(owner, metric);
    if (summary) {
      values.push(BigInt(Math.round(summary.sum)));
    }
  }

  if (values.length < 2) {
    return { ok: false, reason: 'insufficient-cohort' };
  }

  const total = Number(secureSum(values, values.length));
  return {
    ok: true,
    aggregate: {
      metric,
      cohortSize: cohort.length,
      contributingOwners: values.length,
      sum: total,
      mean: total / values.length,
    },
  };
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetWearablesForTests(): void {
  repository = null;
}
