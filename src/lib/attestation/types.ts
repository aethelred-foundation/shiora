// ============================================================
// Shiora on Aethelred — Hardware attestation: shared types
//
// Real, cryptographically-enforced attestation verification for confidential
// health computation. The security model is vendor-neutral: an enclave's
// signing key is certified by a chain that terminates at a PINNED vendor root
// (AMD ARK, Intel Root CA, AWS Nitro root), and the enclave signs a report that
// carries the launch measurement and a freshness nonce. Verification proves,
// without trusting Shiora's own servers, that a specific measured enclave — not
// a rogue key — produced the report for this exact request.
//
// This is NOT a UI badge or a stored self-claim (contrast the legacy
// `ShioraTEEVerifier` self-signed model). When no attestation document is
// supplied (no provisioned enclave) or no vendor root is pinned, verification
// FAILS CLOSED — never a fabricated "verified".
// ============================================================

/** Confidential-compute platforms. `amd-sev-snp` is fully implemented; the
 *  others are declared for the typed seam and reject as `adapter-pending`
 *  until their vendor quote parser lands (see docs/ATTESTATION.md). */
export type AttestationPlatform = 'amd-sev-snp' | 'intel-tdx' | 'intel-sgx-dcap' | 'aws-nitro';

/** A raw vendor attestation document to verify. */
export interface AttestationDocument {
  platform: AttestationPlatform;
  /** Base64 of the raw vendor report. For SEV-SNP this is the 1184-byte
   *  ATTESTATION_REPORT (the embedded ECDSA-P384 signature is verified). */
  report: string;
  /** PEM bundle certifying the report signer: leaf (e.g. VCEK) first, then any
   *  intermediates (e.g. ASK). The trust root is NOT included — it is pinned
   *  via {@link registerTrustRoot}. */
  certChainPem: string;
}

/** What the caller requires of an attestation to accept it. */
export interface AttestationPolicy {
  /** Freshness nonce (hex, up to 64 bytes) that must equal the report's
   *  report_data prefix. Binds the attestation to this specific request and
   *  defeats replay of an old quote. */
  expectedNonce: string;
  /** Optional allowlist of acceptable launch measurements (hex). When set, the
   *  report's measurement must be one of these known-good enclave images. */
  allowedMeasurements?: readonly string[];
  /** Injectable clock for certificate-validity checks (defaults to now). */
  now?: Date;
}

/** The result of verifying an attestation document against a policy. */
export type AttestationResult =
  | {
      verified: true;
      platform: AttestationPlatform;
      /** Launch measurement of the attested enclave (hex). */
      measurement: string;
      /** The report_data field (hex) the enclave bound — includes the nonce. */
      reportData: string;
      /** SHA-256 fingerprint of the pinned trust root the chain terminated at. */
      trustRootFingerprint: string;
      verifiedAt: number;
    }
  | {
      verified: false;
      platform: AttestationPlatform;
      /** Machine-stable reason the attestation was rejected. */
      reason: AttestationFailure;
      /** Human detail (never contains secrets). */
      detail: string;
    };

/** Machine-stable rejection reasons. */
export type AttestationFailure =
  | 'no-trust-root'
  | 'malformed-report'
  | 'malformed-cert-chain'
  | 'cert-chain-untrusted'
  | 'cert-expired'
  | 'report-signature-invalid'
  | 'nonce-mismatch'
  | 'measurement-not-allowed'
  | 'adapter-pending';
