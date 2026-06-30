// ============================================================
// Shiora on Aethelred — Compliance reporting (live posture, not mock)
//
// Replaces the seeded "compliance" mock with a REAL report generated from live
// system state: the production-readiness controls (key custody, durable storage,
// transport hardening, authentication), the tamper-evident audit chain's own
// verification, and the maturity registry. Controls map to HIPAA technical
// safeguards / SOC 2 criteria. No PHI; no clinical-device risk.
//
// Honest scope: this is the platform's self-reported control posture from
// configuration + audit state — it is NOT an external attestation (SOC 2 Type II
// / HIPAA audit), which remains counsel/assessor-gated (docs/compliance/).
// ============================================================

import { serverEnv } from '@/lib/api/env';
import { hasConfiguredDataKey } from '@/lib/crypto/key-provider';
import { hasDurableDatastore } from '@/lib/api/preflight';
import { getAuditLog } from '@/lib/api/audit-log';
import { maturitySummary } from '@/lib/api/maturity';

export type ControlStatus = 'pass' | 'fail' | 'advisory';

export interface ComplianceCheck {
  id: string;
  control: string;
  framework: string;
  reference: string;
  status: ControlStatus;
  detail: string;
}

export interface ComplianceInputs {
  environment: string;
  isProduction: boolean;
  hasDataKey: boolean;
  hasDurableStore: boolean;
  hasSessionSecret: boolean;
  hstsEnabled: boolean;
  insecureWalletHeader: boolean;
  auditValid: boolean;
  auditLength: number;
  maturity: { production: number; pilot: number; simulated: number };
}

export interface ComplianceReport {
  generatedAt: number;
  environment: string;
  posture: { total: number; passing: number; failing: number; advisory: number; score: number };
  frameworks: Array<{ framework: string; total: number; passing: number }>;
  checks: ComplianceCheck[];
  maturity: { production: number; pilot: number; simulated: number };
}

interface ControlSpec {
  id: string;
  control: string;
  framework: string;
  reference: string;
  evaluate: (i: ComplianceInputs) => boolean;
  detail: (i: ComplianceInputs) => string;
}

const CONTROLS: readonly ControlSpec[] = [
  {
    id: 'encryption_at_rest',
    control: 'Encryption at rest',
    framework: 'HIPAA',
    reference: '§164.312(a)(2)(iv)',
    evaluate: (i) => i.hasDataKey,
    detail: (i) => (i.hasDataKey
      ? 'PHI sealed with AES-256-GCM; a managed key-encryption key is configured.'
      : 'No managed data-encryption key configured.'),
  },
  {
    id: 'audit_controls',
    control: 'Audit controls',
    framework: 'HIPAA',
    reference: '§164.312(b)',
    evaluate: (i) => i.auditValid,
    detail: (i) => `Tamper-evident audit chain ${i.auditValid ? 'verified' : 'FAILED verification'} (${i.auditLength} entries).`,
  },
  {
    id: 'integrity',
    control: 'Integrity',
    framework: 'HIPAA',
    reference: '§164.312(c)(1)',
    evaluate: (i) => i.auditValid,
    detail: (i) => (i.auditValid ? 'SHA-256 hash-chained integrity intact.' : 'Hash-chain integrity check failed.'),
  },
  {
    id: 'transmission_security',
    control: 'Transmission security',
    framework: 'HIPAA',
    reference: '§164.312(e)(1)',
    evaluate: (i) => i.hstsEnabled,
    detail: (i) => (i.hstsEnabled ? 'HSTS enforced behind TLS.' : 'HSTS not enabled (configure the TLS edge).'),
  },
  {
    id: 'contingency_storage',
    control: 'Durable storage',
    framework: 'HIPAA',
    reference: '§164.308(a)(7)',
    evaluate: (i) => i.hasDurableStore,
    detail: (i) => (i.hasDurableStore ? 'Durable Postgres datastore configured.' : 'No durable datastore configured (in-memory).'),
  },
  {
    id: 'authentication',
    control: 'Person/entity authentication',
    framework: 'SOC2',
    reference: 'CC6.1',
    evaluate: (i) => i.hasSessionSecret,
    detail: (i) => (i.hasSessionSecret ? 'Signed session secret configured.' : 'Session-signing secret not configured.'),
  },
  {
    id: 'no_insecure_bypass',
    control: 'Logical access — no bypass',
    framework: 'SOC2',
    reference: 'CC6.1',
    evaluate: (i) => !i.insecureWalletHeader,
    detail: (i) => (i.insecureWalletHeader
      ? 'Insecure wallet-address header bypass is ENABLED.'
      : 'Identity is established only by a signed session.'),
  },
];

/** Pure: evaluate every control against the live inputs into a report. */
export function buildComplianceReport(inputs: ComplianceInputs, now: number): ComplianceReport {
  const checks: ComplianceCheck[] = CONTROLS.map((spec) => {
    const ok = spec.evaluate(inputs);
    const status: ControlStatus = ok ? 'pass' : (inputs.isProduction ? 'fail' : 'advisory');
    return {
      id: spec.id,
      control: spec.control,
      framework: spec.framework,
      reference: spec.reference,
      status,
      detail: spec.detail(inputs),
    };
  });

  const passing = checks.filter((c) => c.status === 'pass').length;
  const failing = checks.filter((c) => c.status === 'fail').length;
  const advisory = checks.filter((c) => c.status === 'advisory').length;
  const total = checks.length;

  const frameworkNames = Array.from(new Set(checks.map((c) => c.framework)));
  const frameworks = frameworkNames.map((framework) => ({
    framework,
    total: checks.filter((c) => c.framework === framework).length,
    passing: checks.filter((c) => c.framework === framework && c.status === 'pass').length,
  }));

  return {
    generatedAt: now,
    environment: inputs.environment,
    posture: { total, passing, failing, advisory, score: Math.round((passing / total) * 100) },
    frameworks,
    checks,
    maturity: inputs.maturity,
  };
}

/** Generate the live compliance report from current system state. */
export async function generateComplianceReport(): Promise<ComplianceReport> {
  const audit = await getAuditLog().verify();
  return buildComplianceReport(
    {
      environment: serverEnv.nodeEnv,
      isProduction: serverEnv.isProduction,
      hasDataKey: hasConfiguredDataKey(),
      hasDurableStore: hasDurableDatastore(),
      hasSessionSecret: serverEnv.hasConfiguredSessionSecret,
      hstsEnabled: serverEnv.enableHsts,
      insecureWalletHeader: serverEnv.allowInsecureWalletHeader,
      auditValid: audit.valid,
      auditLength: audit.length,
      maturity: maturitySummary(),
    },
    Date.now(),
  );
}
