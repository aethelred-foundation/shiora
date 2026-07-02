// ============================================================
// Shiora on Aethelred — Attestation verifier (composition root)
//
// Ties the pieces into one honest verdict: pinned trust root → cert chain →
// report signature → freshness (nonce) → measurement policy. Any failure yields
// a machine-stable `verified: false` with a reason — never a fabricated pass.
// ============================================================

import { createHash } from 'node:crypto';

import { parseSnpReport, verifySnpSignature } from './snp-report';
import { getTrustRoots } from './trust-roots';
import type {
  AttestationDocument,
  AttestationPlatform,
  AttestationPolicy,
  AttestationResult,
} from './types';
import { verifyCertChain } from './x509-chain';

function fail(
  platform: AttestationPlatform,
  reason: Extract<AttestationResult, { verified: false }>['reason'],
  detail: string,
): AttestationResult {
  return { verified: false, platform, reason, detail };
}

/** Constant-time-ish prefix match: report_data must begin with the nonce. */
function reportDataBindsNonce(reportDataHex: string, expectedNonceHex: string): boolean {
  const nonce = expectedNonceHex.toLowerCase();
  if (nonce.length === 0 || nonce.length % 2 !== 0 || nonce.length > reportDataHex.length) {
    return false;
  }
  // The nonce occupies the leading bytes of report_data; the remainder is
  // enclave-chosen and not constrained here.
  return reportDataHex.toLowerCase().startsWith(nonce);
}

/**
 * Verify an attestation document against a policy. Fails closed for any
 * platform without a pinned trust root, and for any cryptographic or policy
 * check that does not pass.
 */
export function verifyAttestation(
  doc: AttestationDocument,
  policy: AttestationPolicy,
): AttestationResult {
  const now = policy.now ?? new Date();

  // Only SEV-SNP has a real report parser today; other platforms are declared
  // but reject honestly until their vendor adapter lands.
  if (doc.platform !== 'amd-sev-snp') {
    return fail(
      doc.platform,
      'adapter-pending',
      `${doc.platform} quote parser not yet implemented`,
    );
  }

  const roots = getTrustRoots(doc.platform);
  if (roots.length === 0) {
    return fail(doc.platform, 'no-trust-root', `no pinned trust root for ${doc.platform}`);
  }

  // Buffer.from(..., 'base64') is lenient (never throws); a bad report is
  // caught by parseSnpReport returning null below.
  const report = Buffer.from(doc.report, 'base64');
  const fields = parseSnpReport(report);
  if (!fields) {
    return fail(doc.platform, 'malformed-report', 'report too short or malformed');
  }

  const chain = verifyCertChain(doc.certChainPem, roots, now);
  if (!chain.ok) {
    return fail(doc.platform, chain.reason, chain.detail);
  }

  if (!verifySnpSignature(fields, chain.leafPublicKey)) {
    return fail(doc.platform, 'report-signature-invalid', 'report signature does not verify');
  }

  if (!reportDataBindsNonce(fields.reportData, policy.expectedNonce)) {
    return fail(doc.platform, 'nonce-mismatch', 'report_data does not bind the expected nonce');
  }

  if (policy.allowedMeasurements && policy.allowedMeasurements.length > 0) {
    const allowed = policy.allowedMeasurements.map((m) => m.toLowerCase());
    if (!allowed.includes(fields.measurement.toLowerCase())) {
      return fail(doc.platform, 'measurement-not-allowed', 'measurement not in allowlist');
    }
  }

  return {
    verified: true,
    platform: doc.platform,
    measurement: fields.measurement,
    reportData: fields.reportData,
    trustRootFingerprint: chain.rootFingerprint,
    verifiedAt: now.getTime(),
  };
}

/**
 * A stable, non-reversible reference for a verified attestation — suitable for
 * storing in a record's `attestation` field or anchoring on-chain. Binds the
 * platform, measurement, report_data, and trust root so it cannot be conflated
 * with a different enclave or request.
 */
export function attestationReference(
  result: Extract<AttestationResult, { verified: true }>,
): string {
  return createHash('sha256')
    .update(
      [result.platform, result.measurement, result.reportData, result.trustRootFingerprint].join(
        '|',
      ),
    )
    .digest('hex');
}
