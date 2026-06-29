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
    summary: 'Encrypted, audited consent records on the production datastore, with wall-clock '
      + 'expiry reconciliation: lapsed consents auto-renew (when set) or transition to expired, '
      + 'so status is always truthful and expired consents become non-modifiable.',
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
    summary: 'Access (Art.15), portability (Art.20) with real JSON/CSV/XML serialization, and '
      + 'erasure (Art.17) over real stored data.',
  },
  activity_transparency: {
    title: 'Personal activity transparency',
    maturity: 'production',
    audiences: ['individuals', 'platform'],
    summary: 'Self-scoped, tamper-evident activity feed (GET /api/me/activity) over the audit chain '
      + 'so a user can see the recorded activity on their own account and data.',
  },
  data_access_transparency: {
    title: 'Data-access transparency',
    maturity: 'production',
    audiences: ['individuals', 'platform'],
    summary: 'Subject-scoped data-access log (GET /api/me/access-log) over the audit chain: a user '
      + 'sees who accessed their records and when (e.g. providers reading records they were granted), '
      + 'the disclosure view that complements the activity feed (GDPR Art. 15).',
  },
  account_profile: {
    title: 'Account profile',
    maturity: 'production',
    audiences: ['individuals', 'platform'],
    summary: 'Encrypted, owner-scoped account profile (GET/PUT /api/me/profile) — display name, '
      + 'contact email, timezone, locale — giving a user a human identity beyond a wallet address. '
      + 'Personal data, so it is included in the GDPR export and erasure lifecycle.',
  },
  sana_assistant: {
    title: 'SANA health assistant',
    maturity: 'pilot',
    audiences: ['individuals', 'platform'],
    summary: 'Non-diagnostic informational/navigational assistant (POST /api/sana/messages) over '
      + 'encrypted, owner-scoped conversations. Guardrails are enforced in code: self-harm/emergency '
      + 'input is intercepted with a fixed safety response without calling the model, the model is '
      + 'held to a hard non-diagnostic system prompt, and every reply is screened and disclaimed. '
      + 'NOT a medical device. The LLM seam uses the Claude API when ANTHROPIC_API_KEY is set, else a '
      + 'deterministic offline stub. Conversations are in the GDPR export/erasure lifecycle.',
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
  care_gaps: {
    title: 'Care gap registry',
    maturity: 'production',
    audiences: ['health_plans'],
    summary: 'Encrypted, owner-scoped registry a health plan maintains of open care gaps against '
      + 'de-identified member cohorts; tracks open counts, closes gaps (timestamped), and reports '
      + 'closure analytics (open/closed, open members, closure rate by measure). Holds no member PHI.',
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
    audiences: ['providers', 'individuals'],
    summary: 'Providers record encrypted, audited clinical notes on patients who granted them an '
      + 'active access grant, with append-only amendments (the record is never edited in place). '
      + 'The patient owns and can view every note about them (GET /api/me/clinical-notes).',
  },
  granted_record_access: {
    title: 'Granted record access',
    maturity: 'production',
    audiences: ['providers', 'individuals'],
    summary: 'Providers read exactly the records a patient shared with them via an active, unexpired '
      + 'access grant (GET /api/provider/patients/[address]/records), gated by the view_granted_records '
      + 'capability. Every access is written to the tamper-evident audit chain as a record read.',
  },
  employer_admin: {
    title: 'Employer admin console',
    maturity: 'production',
    audiences: ['employers'],
    summary: 'Encrypted, owner-scoped organization and membership management.',
  },
  wellness_programs: {
    title: 'Employer wellness programs',
    maturity: 'production',
    audiences: ['employers'],
    summary: 'Encrypted, owner-scoped wellness programs and member enrollment with progress and '
      + 'completion tracking, withdrawal, per-program participation, and cross-program org analytics '
      + '(completion rate, average progress), on the organization-ownership model.',
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
  notifications: {
    title: 'Notifications inbox',
    maturity: 'production',
    audiences: ['platform'],
    summary: 'Encrypted, owner-scoped notification inbox that platform flows emit to (data-access '
      + 'decisions, access-grant grant/revoke, clinical-note and wellness activity); read/mark-read '
      + 'with unread counts, and per-recipient preferences to mute notification types.',
  },
  data_access_requests: {
    title: 'Consented data-access requests',
    maturity: 'production',
    audiences: ['researchers', 'governments'],
    summary: 'Researchers request access to a marketplace dataset; a government data steward '
      + 'approves (granting time-bound access), denies, or revokes. Researchers list their active '
      + 'grants; the steward sees a status summary. Encrypted and audited end to end.',
  },

  // ── Pilot: functional, integrated, not yet production-validated ─────────
  wearables: {
    title: 'Wearables integration',
    maturity: 'pilot',
    audiences: ['individuals'],
    summary: 'Real encrypted, owner-scoped telemetry ingest (POST /api/wearables/samples), derived per-owner analytics, and cohort aggregation through the real secure-MPC primitive (POST /api/wearables/cohort-aggregate, researcher-gated; reveals only the cohort total/mean). Live device-vendor sync (Fitbit/Apple Health/Garmin OAuth) is the remaining integration.',
  },
  fhir_interop: {
    title: 'FHIR interoperability',
    maturity: 'pilot',
    audiences: ['providers', 'health_plans'],
    summary: 'Real HL7 FHIR R4 import (POST /api/fhir/import): parses + structurally validates a '
      + 'Bundle and maps Observation/Condition/MedicationStatement/AllergyIntolerance/'
      + 'DiagnosticReport resources into the encrypted, audited record store; export emits records '
      + 'back as an R4 Bundle (GET /api/fhir/export). SCOPE: structural R4 mapping is real; '
      + 'conformance against a specific production EHR sandbox (Epic/Cerner) is the remaining step.',
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

  audit_anchoring: {
    title: 'Audit anchoring',
    maturity: 'pilot',
    audiences: ['platform'],
    summary: 'The tamper-evident audit head is hash-chained into a WORM anchor series and '
      + 'submitted through a pluggable AnchorClient (POST /api/anchors, admin): broadcast to an '
      + 'EVM-compatible L1 via JSON-RPC eth_sendTransaction when SHIORA_L1_RPC_URL is configured, '
      + 'otherwise recorded locally (receipt status: local). Anchors are independently '
      + 're-verifiable (GET /api/anchors). SCOPE: the off-chain pipeline + WORM mirror are real; '
      + 'live on-chain broadcast activates on configuration (the Aethelred chain/RPC target).',
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
    maturity: 'production',
    audiences: ['individuals', 'researchers'],
    summary: 'Real, transparent-setup (no trusted setup, no ceremony) non-interactive ZK '
      + 'set-membership proofs: a Cramer–Damgård–Schoenmakers OR-proof over the order-q subgroup '
      + 'of the RFC 3526 3072-bit MODP prime, made non-interactive with domain-separated '
      + 'Fiat–Shamir (POST /api/zkp/prove, publicly verifiable at /api/zkp/verify). Proves a '
      + 'committed private value is in a public set without revealing it; the value/blinding are '
      + 'never stored. SCOPE: binding the commitment to an issuer-attested attribute (anonymous '
      + 'credentials) is the trust layer above this primitive.',
  },
  secure_mpc: {
    title: 'Secure multi-party computation',
    maturity: 'production',
    audiences: ['researchers'],
    summary: 'Real secure aggregation over a (t, n) Shamir secret-sharing scheme (GF(2^127-1)): '
      + 'POST /api/mpc/sessions secret-shares each contribution, sums the shares (additive '
      + 'homomorphism), and reconstructs only the aggregate (sum/mean/count) — individual '
      + 'contributions are used transiently and never stored. SCOPE: the protocol is sound and the '
      + 'platform retains only the result; true input privacy additionally requires the shares to '
      + 'be held by non-colluding parties (multi-party deployment is the trust model above).',
  },
  blockchain_anchoring: {
    title: 'Blockchain anchoring & on-chain state',
    maturity: 'simulated',
    audiences: ['platform'],
    summary: 'No live L1 client. Network status, transaction hashes, governance, staking, and rewards are simulated.',
  },
  ipfs_storage: {
    title: 'IPFS / content-addressed storage',
    maturity: 'production',
    audiences: ['individuals'],
    summary: 'Real, spec-compliant CIDv1 content addressing (raw codec, sha2-256, verified against '
      + 'the canonical IPFS CID vector). Upload encrypts then addresses (the CID addresses '
      + 'ciphertext, never plaintext PHI); resolution re-derives the CID from the stored bytes '
      + '(tamper-evident) before decrypting. The store is a pluggable port — a local content-'
      + 'addressed node by default, any Kubo-compatible HTTP node/pinning gateway when IPFS_API_URL '
      + 'is set. SCOPE: single-block raw addressing (UnixFS chunking for very large files is the '
      + 'next layer); a content-addressed blob can be unpinned but not force-deleted.',
  },
  ai_assistant: {
    title: 'SANA chat (web UI)',
    maturity: 'pilot',
    audiences: ['individuals'],
    summary: 'The chat UI surface (/api/chat) is backed by the real, non-diagnostic SANA engine '
      + '(guardrails + LLM seam, owner-scoped and encrypted) — the same engine as sana_assistant '
      + '(/api/sana), adapted to the chat view model. NOT a medical device and NOT TEE-attested; '
      + 'it fabricates no attestation data.',
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
    maturity: 'pilot',
    audiences: ['individuals'],
    summary: 'Real, non-diagnostic statistical insights over the user\'s own encrypted wearable '
      + 'telemetry: per-metric baseline (mean +/- 2 sigma), z-score anomaly detection vs the '
      + 'user\'s own baseline, and recent-vs-older trend (GET /api/insights, /anomalies, '
      + '/inferences). INFORMATIONAL only — surfaces deviations from the user\'s own data; it does '
      + 'not diagnose or predict disease. Advanced ML inference is the bounded layer above this.',
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
    summary: 'Encrypted, owner-scoped symptom and cycle logging with derived analytics — cycle '
      + 'regularity/variability, fertile-window and next-period prediction, symptom severity trend, '
      + 'and symptom-by-cycle-phase correlation — all computed from the user\'s own data.',
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
