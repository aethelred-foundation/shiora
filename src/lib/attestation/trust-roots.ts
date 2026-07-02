// ============================================================
// Shiora on Aethelred — Pinned attestation trust roots
//
// The vendor root certificate is the anchor of the whole trust model: an
// attestation is only as trustworthy as the root its signer chains to. Roots
// are PINNED — supplied explicitly by the operator (the real AMD ARK, Intel
// Root CA, or AWS Nitro root at deploy time), never fetched implicitly. With no
// root pinned for a platform, verification for that platform fails closed.
// ============================================================

import { X509Certificate } from 'node:crypto';

import type { AttestationPlatform } from './types';

const roots = new Map<AttestationPlatform, X509Certificate[]>();

/** Environment variable holding the PEM trust root for each platform. */
const ENV_KEYS: Record<AttestationPlatform, string> = {
  'amd-sev-snp': 'SHIORA_ATTEST_ROOT_AMD_SEV_SNP',
  'intel-tdx': 'SHIORA_ATTEST_ROOT_INTEL_TDX',
  'intel-sgx-dcap': 'SHIORA_ATTEST_ROOT_INTEL_SGX_DCAP',
  'aws-nitro': 'SHIORA_ATTEST_ROOT_AWS_NITRO',
};

/**
 * Pin a trust root for a platform. Idempotent per distinct certificate
 * (deduplicated by SHA-256 fingerprint). Throws on a malformed PEM.
 */
export function registerTrustRoot(platform: AttestationPlatform, pem: string): void {
  const cert = new X509Certificate(pem);
  const existing = roots.get(platform) ?? [];
  if (existing.some((c) => c.fingerprint256 === cert.fingerprint256)) {
    return;
  }
  existing.push(cert);
  roots.set(platform, existing);
}

/**
 * Load any trust roots configured via environment (one PEM per platform).
 * Safe to call repeatedly; silently ignores unset variables.
 */
export function loadTrustRootsFromEnv(env: NodeJS.ProcessEnv = process.env): void {
  for (const platform of Object.keys(ENV_KEYS) as AttestationPlatform[]) {
    const pem = env[ENV_KEYS[platform]];
    if (pem && pem.trim().length > 0) {
      registerTrustRoot(platform, pem);
    }
  }
}

/** The pinned trust roots for a platform (empty when none configured). */
export function getTrustRoots(platform: AttestationPlatform): readonly X509Certificate[] {
  return roots.get(platform) ?? [];
}

/** Test-only: drop all pinned roots so a test starts from a known state. */
export function clearTrustRootsForTests(): void {
  roots.clear();
}
