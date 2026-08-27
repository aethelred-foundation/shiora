// ============================================================
// Shiora on Aethelred — X.509 chain verification (attestation trust anchor)
//
// Verifies that a certificate chain (leaf → intermediates) is cryptographically
// signed link-by-link and terminates at one of the PINNED trust roots, with
// every certificate inside its validity window. Uses only Node's built-in
// X509Certificate (no third-party ASN.1/PKI dependency in the trust path).
// ============================================================

import { X509Certificate, type KeyObject } from 'node:crypto';

export interface ChainOk {
  ok: true;
  /** Public key of the leaf (report-signing) certificate. */
  leafPublicKey: KeyObject;
  /** SHA-256 fingerprint of the trust root the chain terminated at. */
  rootFingerprint: string;
}

export interface ChainErr {
  ok: false;
  reason: 'malformed-cert-chain' | 'cert-chain-untrusted' | 'cert-expired';
  detail: string;
}

export type ChainResult = ChainOk | ChainErr;

/** Split a concatenated PEM bundle into individual X509Certificate objects. */
export function parseCertBundle(pemBundle: string): X509Certificate[] | null {
  const matches = pemBundle.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  if (!matches || matches.length === 0) {
    return null;
  }
  try {
    return matches.map((pem) => new X509Certificate(pem));
  } catch {
    return null;
  }
}

function withinValidity(cert: X509Certificate, now: Date): boolean {
  // `validFrom`/`validTo` are OpenSSL-formatted strings (e.g. "Jul  2 15:04:05
  // 2026 GMT"); Date parses them. Use these rather than the newer
  // validFromDate/validToDate getters for broader lib-type compatibility.
  const from = Date.parse(cert.validFrom);
  const to = Date.parse(cert.validTo);
  // An unparseable date yields NaN, and every NaN comparison is false, so this
  // fails closed (treats the certificate as out-of-window) without a guard.
  return from <= now.getTime() && now.getTime() <= to;
}

/** True iff `cert` was issued by `issuer` (subject/issuer match AND signature). */
function issuedBy(cert: X509Certificate, issuer: X509Certificate): boolean {
  return cert.checkIssued(issuer) && cert.verify(issuer.publicKey);
}

/**
 * Verify a leaf→intermediates chain against pinned trust roots.
 *
 * @param pemBundle Concatenated PEM: leaf first, then intermediates (no root).
 * @param roots     Pinned, trusted root certificates.
 * @param now       Clock for validity checks.
 */
export function verifyCertChain(
  pemBundle: string,
  roots: readonly X509Certificate[],
  now: Date,
): ChainResult {
  const certs = parseCertBundle(pemBundle);
  if (!certs) {
    return { ok: false, reason: 'malformed-cert-chain', detail: 'no valid certificates in bundle' };
  }

  // Every certificate must be inside its validity window.
  for (const cert of certs) {
    if (!withinValidity(cert, now)) {
      return {
        ok: false,
        reason: 'cert-expired',
        detail: `certificate ${cert.subject} outside validity window`,
      };
    }
  }

  // Each certificate (except the last) must be issued by the next.
  for (let i = 0; i < certs.length - 1; i++) {
    if (!issuedBy(certs[i], certs[i + 1])) {
      return {
        ok: false,
        reason: 'cert-chain-untrusted',
        detail: `broken link: ${certs[i].subject} not issued by ${certs[i + 1].subject}`,
      };
    }
  }

  // The top of the chain must be signed by (or equal to) a pinned root. A
  // pinned root is a trust anchor: it is trusted by virtue of being pinned, so
  // its own validity window is a deploy-time concern, not a per-verify gate
  // (re-gating on it would self-inflict an outage as a long-lived root ages).
  const top = certs[certs.length - 1];
  for (const root of roots) {
    const anchored =
      top.fingerprint256 === root.fingerprint256 || // chain already includes the pinned root
      issuedBy(top, root); // ...or the top is directly issued by it
    if (anchored) {
      return { ok: true, leafPublicKey: certs[0].publicKey, rootFingerprint: root.fingerprint256 };
    }
  }

  return {
    ok: false,
    reason: 'cert-chain-untrusted',
    detail: 'chain does not terminate at a pinned trust root',
  };
}
