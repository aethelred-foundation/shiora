// ============================================================
// Shiora on Aethelred — Population Analytics
//
// Aggregate, de-identified population metrics for the government, health-plan,
// and employer audiences. Computed across the whole datastore but emitted only
// as counts and distributions — never individual records.
//
// Privacy guarantee is on the OUTPUT: a k-anonymity threshold suppresses any
// cohort or cell smaller than MIN_COHORT, so no statistic can be traced to a
// small, re-identifiable group. (Running the aggregation itself inside a TEE
// is tracked as future hardening — COMPLIANCE.md C-TEE-1.)
// ============================================================

import { listAllConsents } from './consent-service';
import { listAllAccessGrants } from './access-service';

/** Minimum cohort/cell size below which results are suppressed. */
export const MIN_COHORT = 5;

export interface Distribution {
  /** Cells with at least MIN_COHORT members. */
  counts: Record<string, number>;
  /** Total members rolled up from cells too small to report. */
  suppressed: number;
}

function distribution<T>(items: T[], key: (item: T) => string): Distribution {
  const raw: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    raw[k] = (raw[k] ?? 0) + 1;
  }

  const counts: Record<string, number> = {};
  let suppressed = 0;
  for (const [k, count] of Object.entries(raw)) {
    if (count >= MIN_COHORT) {
      counts[k] = count;
    } else {
      suppressed += count;
    }
  }
  return { counts, suppressed };
}

export interface PopulationAnalytics {
  cohortSize: number;
  sufficientCohort: boolean;
  minimumCohort: number;
  consents: { total: number; byStatus: Distribution; byScope: Distribution } | null;
  accessGrants: { total: number; byStatus: Distribution } | null;
  generatedAt: number;
}

/** Compute de-identified population analytics across the datastore. */
export async function computePopulationAnalytics(): Promise<PopulationAnalytics> {
  const [consents, grants] = await Promise.all([
    listAllConsents(),
    listAllAccessGrants(),
  ]);

  const participants = new Set<string>();
  for (const consent of consents) {
    participants.add(consent.patientAddress);
  }
  for (const grant of grants) {
    participants.add(grant.ownerAddress);
  }

  const cohortSize = participants.size;
  const sufficientCohort = cohortSize >= MIN_COHORT;

  if (!sufficientCohort) {
    return {
      cohortSize,
      sufficientCohort,
      minimumCohort: MIN_COHORT,
      consents: null,
      accessGrants: null,
      generatedAt: Date.now(),
    };
  }

  return {
    cohortSize,
    sufficientCohort,
    minimumCohort: MIN_COHORT,
    consents: {
      total: consents.length,
      byStatus: distribution(consents, (consent) => consent.status),
      byScope: distribution(consents.flatMap((consent) => consent.scopes), (scope) => scope),
    },
    accessGrants: {
      total: grants.length,
      byStatus: distribution(grants, (grant) => grant.status),
    },
    generatedAt: Date.now(),
  };
}
