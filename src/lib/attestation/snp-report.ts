// ============================================================
// Shiora on Aethelred — AMD SEV-SNP ATTESTATION_REPORT verification
//
// Parses the real fixed-layout SEV-SNP attestation report (AMD SEV-SNP ABI,
// report v2, 1184 bytes) and verifies its embedded ECDSA-P384 signature with
// the VCEK public key (the leaf of the attestation cert chain). Field offsets
// follow the AMD spec; the signature covers the first 0x2A0 bytes and is stored
// as little-endian r‖s in 72-byte fields.
// ============================================================

import { verify as cryptoVerify, type KeyObject } from 'node:crypto';

/** SEV-SNP ATTESTATION_REPORT field offsets (bytes). */
const OFF = {
  REPORT_DATA: 0x050, // 64 bytes — includes the freshness nonce
  MEASUREMENT: 0x090, // 48 bytes — launch measurement of the guest
  SIGNATURE: 0x2a0, // ECDSA-P384: r at 0x2a0, s at 0x2e8, each a 72-byte LE field
} as const;

const REPORT_DATA_LEN = 64;
const MEASUREMENT_LEN = 48;
/** The signature covers everything before the signature field. */
const SIGNED_LEN = OFF.SIGNATURE;
/** P-384 scalars are 48 bytes; the report zero-pads each to a 72-byte LE field. */
const SIG_FIELD_LEN = 72;
const P384_SCALAR_LEN = 48;
/** Minimum length to contain the signed body + both signature scalar fields. */
const MIN_REPORT_LEN = OFF.SIGNATURE + 2 * SIG_FIELD_LEN;

export interface SnpFields {
  /** Launch measurement (hex). */
  measurement: string;
  /** report_data field (hex). */
  reportData: string;
  /** The bytes the signature covers. */
  signedBytes: Buffer;
  /** IEEE P1363 signature (r‖s, big-endian, 96 bytes) for Node's verify(). */
  signatureP1363: Buffer;
}

/**
 * Convert a little-endian, zero-padded SNP signature field to a big-endian
 * fixed-width scalar (P1363 form).
 */
function leFieldToBeScalar(field: Buffer): Buffer {
  // The value occupies the low `P384_SCALAR_LEN` bytes (LE); reverse to BE.
  const le = field.subarray(0, P384_SCALAR_LEN);
  return Buffer.from(le).reverse();
}

/** Parse a raw SEV-SNP attestation report. Returns null on a malformed report. */
export function parseSnpReport(report: Buffer): SnpFields | null {
  if (report.length < MIN_REPORT_LEN) {
    return null;
  }
  const measurement = report.subarray(OFF.MEASUREMENT, OFF.MEASUREMENT + MEASUREMENT_LEN);
  const reportData = report.subarray(OFF.REPORT_DATA, OFF.REPORT_DATA + REPORT_DATA_LEN);
  const rField = report.subarray(OFF.SIGNATURE, OFF.SIGNATURE + SIG_FIELD_LEN);
  const sField = report.subarray(OFF.SIGNATURE + SIG_FIELD_LEN, OFF.SIGNATURE + 2 * SIG_FIELD_LEN);
  const signatureP1363 = Buffer.concat([leFieldToBeScalar(rField), leFieldToBeScalar(sField)]);

  return {
    measurement: measurement.toString('hex'),
    reportData: reportData.toString('hex'),
    signedBytes: Buffer.from(report.subarray(0, SIGNED_LEN)),
    signatureP1363,
  };
}

/**
 * Verify the report's ECDSA-P384 signature with the VCEK public key.
 * SEV-SNP signs SHA-384 over the report body with the endorsement key.
 */
export function verifySnpSignature(fields: SnpFields, vcekPublicKey: KeyObject): boolean {
  try {
    return cryptoVerify(
      'sha384',
      fields.signedBytes,
      { key: vcekPublicKey, dsaEncoding: 'ieee-p1363' },
      fields.signatureP1363,
    );
  } catch {
    return false;
  }
}

/** Field offsets and lengths, exported for the report-builder used in tests. */
export const SNP_LAYOUT = {
  OFF,
  REPORT_DATA_LEN,
  MEASUREMENT_LEN,
  SIGNED_LEN,
  SIG_FIELD_LEN,
  P384_SCALAR_LEN,
  MIN_REPORT_LEN,
  REPORT_LEN: 0x4a0, // full v2 report size (1184 bytes)
} as const;
