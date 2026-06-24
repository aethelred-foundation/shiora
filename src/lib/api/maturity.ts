// ============================================================
// Shiora on Aethelred — Feature Maturity Registry
//
// Single source of truth for which platform capabilities are production-grade,
// pilot, or simulated. It exists so that "all six audiences are live" stays an
// honest statement: the real, PHI-bearing data paths (records, consent, access,
// RBAC, audit, GDPR, analytics, marketplace, employer admin, MFA) are
// production-grade, while subsystems that are not yet backed by their named
// external system (a TEE, an on-chain anchor, a ZK prover, IPFS, an LLM) are
// labelled `simulated` and never presented as verified results.
//
//   - production : real implementation, encrypted + audited where PHI is involved.
//   - pilot      : functional and integrated, but not yet production-validated
//                  (e.g., awaiting real device/partner integration or load proof).
//   - simulated  : real-shaped responses for product/demo use, NOT backed by the
//                  named external system. Every such API response carries
//                  simulationMeta() so no caller mistakes it for a real result.
//
// The registry is exposed verbatim at GET /api/system/status, so a partner or
// auditor can see exactly what is real without reading the source.
// ============================================================

import type { NextResponse } from 'next/server';
import { successResponse } from './responses';

export type Maturity = 'production' | 'pilot' | 'simulated';

export type Audience =
  | 'individuals'
  | 'providers'
  | 'employers'
  | 'governments'
  | 'health_plans'
  | 'researchers'
  | 'platform';

export interface FeatureSpec {
  /** Human-readable capability name. */
  title: string;
  maturity: Maturity;
  /** Audiences this capability primarily serves. */
  audiences: Audience[];
  /** What is — and isn't — real about this capability today. */
  summary: string;
}

/**
 * Every platform capability, keyed by a stable identifier used in both API
 * responses (`simulationMeta().feature`) and the public status endpoint.
 */
export const FEATURE_MATURITY = {
  // ── Production: real, encrypted, audited, Postgres-ready ────────────────
  identity_auth: {
    title: 'Wallet identity & sessions',
    maturity: 'production',
    audiences: ['platform'],
    summary: 'Real secp256k1 signature verification and HMAC-signed __Host- session cookies.',
  },
  phi_records: {
    title: 'Health records',
    maturity: 'production',
    audiences: ['individuals'],
    summary: 'AES-256-GCM envelope-encrypted PHI, owner-scoped, tamper-evident audit on every change.',
  },
  consent: {
    title: 'Consent management',
    maturity: 'production',
    audiences: ['individuals', 'providers', 'researchers'],
    summary: 'Encrypted, audited consent records on the production datastore.',
  },
  access_grants: {
    title: 'Access grants',
    maturity: 'production',
    audiences: ['individuals', 'providers'],
    summary: 'Encrypted owner-scoped access grants; providers see only records explicitly shared with them.',
  },
  rbac: {
    title: 'Role-based access control',
    maturity: 'production',
    audiences: ['platform'],
    summary: 'Six-audience role model + capability matrix enforced on every PHI/analytics route.',
  },
  audit_log: {
    title: 'Tamper-evident audit log',
    maturity: 'production',
    audiences: ['platform'],
    summary: 'SHA-256 hash-chained, persisted, concurrency-safe append; admin query + chain verification.',
  },
  gdpr_rights: {
    title: 'GDPR data-subject rights',
    maturity: 'production',
    audiences: ['individuals'],
    summary: 'Access (Art.15), portability (Art.20), and erasure (Art.17) over real stored data.',
  },
  marketplace: {
    title: 'Research data marketplace',
    maturity: 'production',
    audiences: ['individuals', 'researchers'],
    summary: 'Encrypted, audited listing catalogue. Aggregate marketplace statistics are simulated.',
  },
  population_analytics: {
    title: 'Population analytics',
    maturity: 'production',
    audiences: ['governments', 'health_plans', 'employers'],
    summary: 'De-identified cohort analytics with k-anonymity suppression (min cohort 5).',
  },
  provider_directory: {
    title: 'Provider patient directory',
    maturity: 'production',
    audiences: ['providers'],
    summary: 'Providers see the patients who have granted them access, from real access grants.',
  },
  clinical_notes: {
    title: 'Clinical notes',
    maturity: 'production',
    audiences: ['providers'],
    summary: 'Providers record encrypted, audited clinical notes on patients who have granted '
      + 'them an active access grant; the patient owns the resulting record.',
  },
  employer_admin: {
    title: 'Employer admin console',
    maturity: 'production',
    audiences: ['employers'],
    summary: 'Encrypted, owner-scoped organization and membership management.',
  },
  mfa: {
    title: 'Multi-factor authentication',
    maturity: 'production',
    audiences: ['platform'],
    summary: 'RFC 6238 TOTP enrolment and verification with encrypted secret storage.',
  },
  rate_limiting: {
    title: 'Distributed rate limiting',
    maturity: 'production',
    audiences: ['platform'],
    summary: 'Cross-instance fixed-window limiter backed by Postgres atomic counters.',
  },
  data_access_requests: {
    title: 'Consented data-access requests',
    maturity: 'production',
    audiences: ['researchers', 'governments'],
    summary: 'Researchers request access to a marketplace dataset; a government data steward '
      + 'reviews and approves or denies. Encrypted and audited end to end.',
  },

  // ── Pilot: functional, integrated, not yet production-validated ─────────
  wearables: {
    title: 'Wearables integration',
    maturity: 'pilot',
    audiences: ['individuals'],
    summary: 'Sync surface is implemented; live device-vendor connections are not yet wired.',
  },
  fhir_interop: {
    title: 'FHIR interoperability',
    maturity: 'pilot',
    audiences: ['providers', 'health_plans'],
    summary: 'FHIR export/import/mapping surface; not yet validated against a production FHIR server.',
  },
  research_studies: {
    title: 'Research studies',
    maturity: 'pilot',
    audiences: ['researchers'],
    summary: 'Study catalogue surface; recruitment and data pipelines are not yet wired.',
  },
  alerts: {
    title: 'Health alerts',
    maturity: 'pilot',
    audiences: ['individuals', 'providers'],
    summary: 'Alert rules and lifecycle surface; not yet driven by a real signal pipeline.',
  },
  community: {
    title: 'Community circles',
    maturity: 'pilot',
    audiences: ['individuals'],
    summary: 'Peer-support circles and posts surface; moderation tooling is not yet production-grade.',
  },

  // ── Simulated: real-shaped, NOT backed by the named external system ─────
  tee_attestation: {
    title: 'TEE attestation',
    maturity: 'simulated',
    audiences: ['platform'],
    summary: 'No live Intel SGX / TDX enclave is attached. Attestation data is simulated.',
  },
  zk_proofs: {
    title: 'Zero-knowledge proofs',
    maturity: 'simulated',
    audiences: ['individuals', 'researchers'],
    summary: 'No real prover (Groth16/PLONK) is wired. Proof verification results are simulated.',
  },
  secure_mpc: {
    title: 'Secure multi-party computation',
    maturity: 'simulated',
    audiences: ['researchers'],
    summary: 'No real MPC engine is wired. Session and result data are simulated.',
  },
  blockchain_anchoring: {
    title: 'Blockchain anchoring & on-chain state',
    maturity: 'simulated',
    audiences: ['platform'],
    summary: 'No live L1 client. Network status, transaction hashes, governance, staking, and rewards are simulated.',
  },
  ipfs_storage: {
    title: 'IPFS / decentralized storage',
    maturity: 'simulated',
    audiences: ['individuals'],
    summary: 'No content-addressed storage node is wired. CIDs are placeholders, not resolvable content.',
  },
  ai_assistant: {
    title: 'SANA AI assistant',
    maturity: 'simulated',
    audiences: ['individuals'],
    summary: 'No LLM backend is wired. Assistant responses are simulated; no autonomous diagnosis.',
  },
  clinical_decision_support: {
    title: 'Clinical decision support',
    maturity: 'simulated',
    audiences: ['providers'],
    summary: 'Reference content only — simulated, non-clinical, and explicitly not SaMD.',
  },
  genomics: {
    title: 'Genomics & biomarkers',
    maturity: 'simulated',
    audiences: ['individuals', 'researchers'],
    summary: 'No genomic pipeline is wired. Biomarker and report data are simulated.',
  },
  digital_twin: {
    title: 'Digital twin',
    maturity: 'simulated',
    audiences: ['individuals'],
    summary: 'No physiological model is wired. Twin parameters, predictions, and simulations are simulated.',
  },
  explainable_ai: {
    title: 'Explainable AI',
    maturity: 'simulated',
    audiences: ['providers', 'researchers'],
    summary: 'No live model is attached. SHAP values, model cards, and bias metrics are simulated.',
  },
  insights: {
    title: 'Health insights',
    maturity: 'simulated',
    audiences: ['individuals'],
    summary: 'No inference engine is wired. Anomalies and inferences are simulated.',
  },
  emergency: {
    title: 'Emergency response',
    maturity: 'simulated',
    audiences: ['individuals', 'providers'],
    summary: 'Triage, protocols, and handoff surfaces are simulated; not connected to real emergency services.',
  },
  compliance_reports: {
    title: 'Compliance reports',
    maturity: 'simulated',
    audiences: ['governments', 'health_plans', 'employers'],
    summary: 'Generated compliance/check/report figures are simulated, not derived from a live control plane.',
  },
  cycle_vault: {
    title: 'Cycle & symptom vault',
    maturity: 'production',
    audiences: ['individuals'],
    summary: 'Encrypted, owner-scoped symptom and cycle logging with cycle-length and next-period '
      + 'insights derived from the user\'s own data. The storage-compartment dashboard is illustrative.',
  },
} as const satisfies Record<string, FeatureSpec>;

export type FeatureKey = keyof typeof FEATURE_MATURITY;

const SIMULATION_NOTICE =
  'This response is produced by a simulated subsystem for product and demonstration use. '
  + 'It is not backed by the named external system and must not be relied upon as a verified, '
  + 'on-chain, or clinical result.';

export interface SimulationMeta {
  mode: 'simulation';
  feature: FeatureKey;
  notice: string;
}

/** Response `meta` block that labels a simulated subsystem's output. */
export function simulationMeta(feature: FeatureKey): SimulationMeta {
  return { mode: 'simulation', feature, notice: SIMULATION_NOTICE };
}

/**
 * Build a success response whose `meta` carries the simulation label for a
 * simulated subsystem, so no consumer of a single endpoint can mistake the
 * payload for a verified, on-chain, or clinical result.
 */
export function simulatedResponse<T>(
  data: T,
  feature: FeatureKey,
  status = 200,
  extraMeta?: Record<string, unknown>,
): NextResponse<{ success: true; data: T; meta?: Record<string, unknown> }> {
  return successResponse(data, status, { ...simulationMeta(feature), ...(extraMeta ?? {}) });
}

/** The maturity of a given feature. */
export function maturityOf(feature: FeatureKey): Maturity {
  return FEATURE_MATURITY[feature].maturity;
}

/** Whether a feature's responses must be labelled as simulated. */
export function isSimulated(feature: FeatureKey): boolean {
  return FEATURE_MATURITY[feature].maturity === 'simulated';
}

/** The full registry as a flat, key-tagged list (for the status endpoint). */
export function featureList(): Array<{ key: FeatureKey } & FeatureSpec> {
  return (Object.keys(FEATURE_MATURITY) as FeatureKey[]).map((key) => ({
    key,
    ...FEATURE_MATURITY[key],
  }));
}

/** Counts of features by maturity tier. */
export function maturitySummary(): Record<Maturity, number> {
  const counts: Record<Maturity, number> = { production: 0, pilot: 0, simulated: 0 };
  for (const { maturity } of Object.values(FEATURE_MATURITY)) {
    counts[maturity] += 1;
  }
  return counts;
}
