/** @jest-environment node */

import { createPrivateKey, sign as cryptoSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  attestationReference,
  clearTrustRootsForTests,
  getTrustRoots,
  loadTrustRootsFromEnv,
  parseCertBundle,
  parseSnpReport,
  registerTrustRoot,
  SNP_LAYOUT,
  verifyAttestation,
  verifyCertChain,
  verifySnpSignature,
  type AttestationDocument,
  type AttestationPolicy,
} from '@/lib/attestation';

const PKI = resolve(__dirname, '../../../lib/attestation/__testpki__');
const pem = (f: string) => readFileSync(resolve(PKI, f), 'utf8');

const ARK = pem('ark.crt');
const ASK = pem('ask.crt');
const VCEK = pem('vcek.crt');
const VCEK_KEY = pem('vcek.key');
const ROGUE = pem('rogue.crt');

// leaf (VCEK) then intermediate (ASK); the root (ARK) is pinned, not sent.
const CHAIN = `${VCEK}\n${ASK}`;

const NONCE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'; // 16 bytes hex
const MEASUREMENT = Buffer.alloc(SNP_LAYOUT.MEASUREMENT_LEN, 0x42); // 48 bytes

/** Build a real SEV-SNP report signed by the given VCEK private key PEM. */
function buildSnpReport(opts?: {
  keyPem?: string;
  nonceHex?: string;
  measurement?: Buffer;
  tamperMeasurement?: boolean;
}): string {
  const report = Buffer.alloc(SNP_LAYOUT.REPORT_LEN);
  (opts?.measurement ?? MEASUREMENT).copy(report, SNP_LAYOUT.OFF.MEASUREMENT);

  // report_data (64 bytes) carries the nonce in its leading bytes.
  const reportData = Buffer.alloc(SNP_LAYOUT.REPORT_DATA_LEN);
  Buffer.from(opts?.nonceHex ?? NONCE, 'hex').copy(reportData, 0);
  reportData.copy(report, SNP_LAYOUT.OFF.REPORT_DATA);

  // Sign the body [0, SIGNATURE) with ECDSA-P384 / SHA-384 (P1363 r‖s).
  const signed = report.subarray(0, SNP_LAYOUT.OFF.SIGNATURE);
  const sig = cryptoSign('sha384', signed, {
    key: createPrivateKey(opts?.keyPem ?? VCEK_KEY),
    dsaEncoding: 'ieee-p1363',
  });
  // Store as little-endian, zero-padded 72-byte fields (SNP layout).
  Buffer.from(sig.subarray(0, 48)).reverse().copy(report, SNP_LAYOUT.OFF.SIGNATURE);
  Buffer.from(sig.subarray(48, 96))
    .reverse()
    .copy(report, SNP_LAYOUT.OFF.SIGNATURE + SNP_LAYOUT.SIG_FIELD_LEN);

  // Optionally corrupt a signed byte AFTER signing → signature must fail.
  if (opts?.tamperMeasurement) {
    report[SNP_LAYOUT.OFF.MEASUREMENT] ^= 0xff;
  }
  return report.toString('base64');
}

function doc(over?: Partial<AttestationDocument>): AttestationDocument {
  return { platform: 'amd-sev-snp', report: buildSnpReport(), certChainPem: CHAIN, ...over };
}

const policy: AttestationPolicy = { expectedNonce: NONCE };

describe('attestation — trust roots', () => {
  beforeEach(() => clearTrustRootsForTests());

  it('starts with no pinned roots (fail-closed default)', () => {
    expect(getTrustRoots('amd-sev-snp')).toHaveLength(0);
  });

  it('registers a root and deduplicates by fingerprint', () => {
    registerTrustRoot('amd-sev-snp', ARK);
    registerTrustRoot('amd-sev-snp', ARK);
    expect(getTrustRoots('amd-sev-snp')).toHaveLength(1);
  });

  it('rejects a malformed root PEM', () => {
    expect(() => registerTrustRoot('amd-sev-snp', 'not a cert')).toThrow();
  });

  it('loads roots from environment', () => {
    loadTrustRootsFromEnv({ SHIORA_ATTEST_ROOT_AMD_SEV_SNP: ARK } as NodeJS.ProcessEnv);
    expect(getTrustRoots('amd-sev-snp')).toHaveLength(1);
    // Unset variables are ignored.
    loadTrustRootsFromEnv({} as NodeJS.ProcessEnv);
    expect(getTrustRoots('amd-sev-snp')).toHaveLength(1);
  });

  it('ignores a blank environment value', () => {
    loadTrustRootsFromEnv({ SHIORA_ATTEST_ROOT_AMD_SEV_SNP: '   ' } as NodeJS.ProcessEnv);
    expect(getTrustRoots('amd-sev-snp')).toHaveLength(0);
  });

  it('defaults to process.env when called with no argument', () => {
    const prev = process.env.SHIORA_ATTEST_ROOT_AMD_SEV_SNP;
    process.env.SHIORA_ATTEST_ROOT_AMD_SEV_SNP = ARK;
    try {
      loadTrustRootsFromEnv();
      expect(getTrustRoots('amd-sev-snp')).toHaveLength(1);
    } finally {
      if (prev === undefined) delete process.env.SHIORA_ATTEST_ROOT_AMD_SEV_SNP;
      else process.env.SHIORA_ATTEST_ROOT_AMD_SEV_SNP = prev;
    }
  });
});

describe('attestation — full verification', () => {
  beforeEach(() => {
    clearTrustRootsForTests();
    registerTrustRoot('amd-sev-snp', ARK);
  });

  it('verifies a genuine SEV-SNP report chained to the pinned root', () => {
    const res = verifyAttestation(doc(), policy);
    expect(res.verified).toBe(true);
    if (res.verified) {
      expect(res.platform).toBe('amd-sev-snp');
      expect(res.measurement).toBe(MEASUREMENT.toString('hex'));
      expect(res.reportData.startsWith(NONCE)).toBe(true);
      expect(res.trustRootFingerprint).toMatch(/^[A-F0-9:]+$/);
    }
  });

  it('enforces a measurement allowlist (accept)', () => {
    const res = verifyAttestation(doc(), {
      ...policy,
      allowedMeasurements: [MEASUREMENT.toString('hex')],
    });
    expect(res.verified).toBe(true);
  });

  it('rejects a measurement not in the allowlist', () => {
    const res = verifyAttestation(doc(), { ...policy, allowedMeasurements: ['00'.repeat(48)] });
    expect(res).toMatchObject({ verified: false, reason: 'measurement-not-allowed' });
  });

  it('fails closed when no trust root is pinned', () => {
    clearTrustRootsForTests();
    expect(verifyAttestation(doc(), policy)).toMatchObject({
      verified: false,
      reason: 'no-trust-root',
    });
  });

  it('rejects a non-implemented platform as adapter-pending', () => {
    expect(verifyAttestation(doc({ platform: 'intel-tdx' }), policy)).toMatchObject({
      verified: false,
      reason: 'adapter-pending',
    });
  });

  it('rejects a malformed (too-short) report', () => {
    expect(
      verifyAttestation(doc({ report: Buffer.alloc(10).toString('base64') }), policy),
    ).toMatchObject({ verified: false, reason: 'malformed-report' });
  });

  it('rejects a malformed cert chain', () => {
    expect(verifyAttestation(doc({ certChainPem: 'garbage' }), policy)).toMatchObject({
      verified: false,
      reason: 'malformed-cert-chain',
    });
  });

  it('rejects a chain that does not terminate at the pinned root', () => {
    clearTrustRootsForTests();
    registerTrustRoot('amd-sev-snp', ROGUE); // pin the wrong root
    expect(verifyAttestation(doc(), policy)).toMatchObject({
      verified: false,
      reason: 'cert-chain-untrusted',
    });
  });

  it('rejects an out-of-validity chain (future clock → expired)', () => {
    const res = verifyAttestation(doc(), { ...policy, now: new Date('2200-01-01') });
    expect(res).toMatchObject({ verified: false, reason: 'cert-expired' });
  });

  it('rejects a not-yet-valid chain (past clock)', () => {
    const res = verifyAttestation(doc(), { ...policy, now: new Date('2000-01-01') });
    expect(res).toMatchObject({ verified: false, reason: 'cert-expired' });
  });

  it('rejects a report whose signed body was tampered', () => {
    expect(
      verifyAttestation(doc({ report: buildSnpReport({ tamperMeasurement: true }) }), policy),
    ).toMatchObject({ verified: false, reason: 'report-signature-invalid' });
  });

  it('rejects a report signed by the wrong key (not the chained VCEK)', () => {
    const rogueKey = pem('rogue.key');
    expect(
      verifyAttestation(doc({ report: buildSnpReport({ keyPem: rogueKey }) }), policy),
    ).toMatchObject({ verified: false, reason: 'report-signature-invalid' });
  });

  it('rejects a report whose report_data does not bind the nonce', () => {
    expect(
      verifyAttestation(doc({ report: buildSnpReport({ nonceHex: 'deadbeef' }) }), policy),
    ).toMatchObject({ verified: false, reason: 'nonce-mismatch' });
  });

  it.each([
    ['empty nonce', ''],
    ['odd-length nonce', 'abc'],
    ['nonce longer than report_data', 'ab'.repeat(65)],
  ])('rejects a policy with an invalid nonce (%s)', (_label, badNonce) => {
    expect(verifyAttestation(doc(), { ...policy, expectedNonce: badNonce })).toMatchObject({
      verified: false,
      reason: 'nonce-mismatch',
    });
  });

  it('produces a stable attestation reference for a verified result', () => {
    const res = verifyAttestation(doc(), policy);
    expect(res.verified).toBe(true);
    if (res.verified) {
      const ref = attestationReference(res);
      expect(ref).toMatch(/^[0-9a-f]{64}$/);
      expect(attestationReference(res)).toBe(ref); // deterministic
    }
  });
});

describe('attestation — X.509 chain unit', () => {
  it('parses a multi-cert bundle', () => {
    expect(parseCertBundle(CHAIN)).toHaveLength(2);
  });

  it('returns null for a bundle with no certificates', () => {
    expect(parseCertBundle('nope')).toBeNull();
  });

  it('returns null when a PEM block is structurally present but undecodable', () => {
    const junk = '-----BEGIN CERTIFICATE-----\nnot-base64-@@@\n-----END CERTIFICATE-----';
    expect(parseCertBundle(junk)).toBeNull();
  });

  it('rejects a broken link (leaf not issued by the presented intermediate)', () => {
    const arkCert = parseCertBundle(ARK)![0];
    // leaf (VCEK) presented under ROGUE as its "issuer" — not actually issued.
    const res = verifyCertChain(`${VCEK}\n${ROGUE}`, [arkCert], new Date());
    expect(res.ok).toBe(false);
  });
});

describe('attestation — SNP report unit', () => {
  it('returns null for a too-short report', () => {
    expect(parseSnpReport(Buffer.alloc(10))).toBeNull();
  });

  it('verifySnpSignature returns false (not throws) on an invalid key', () => {
    const fields = {
      measurement: '',
      reportData: '',
      signedBytes: Buffer.alloc(SNP_LAYOUT.SIGNED_LEN),
      signatureP1363: Buffer.alloc(96),
    };
    // A corrupt key object makes crypto.verify throw; the guard returns false.
    expect(verifySnpSignature(fields, null as unknown as never)).toBe(false);
  });

  it('exposes the documented layout constants', () => {
    expect(SNP_LAYOUT.OFF.SIGNATURE).toBe(0x2a0);
    expect(SNP_LAYOUT.REPORT_LEN).toBe(0x4a0);
    expect(SNP_LAYOUT.MEASUREMENT_LEN).toBe(48);
  });
});
