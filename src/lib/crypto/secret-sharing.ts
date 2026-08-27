// ============================================================
// Shiora on Aethelred — Shamir Secret Sharing + Secure Aggregation
//
// The cryptographic core of the platform's secure multi-party computation: a
// REAL (t, n) Shamir threshold secret-sharing scheme over GF(p), and a secure
// aggregation built on its additive homomorphism. Each party splits its private
// input into shares; summing the same-index shares across parties yields a share
// of the TOTAL, so reconstructing reveals only the aggregate (sum / mean / count)
// and never any individual input. This replaces the prior simulation, where
// "results" were seededRandom numbers computed from no actual contributions.
//
// HONEST SCOPE: the protocol is real and sound. True input privacy additionally
// requires the shares to be held by non-colluding parties; a single coordinator
// that sees every share could reconstruct an input. The platform provides the
// protocol and retains only the aggregate — multi-party, non-colluding
// deployment is the trust model above. See the `secure_mpc` maturity entry.
// ============================================================

import { randomBytes } from 'node:crypto';

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);

// 2^127 - 1 (Mersenne prime) — the prime field. Inputs and their sums must be
// non-negative integers below this bound (ample for health counts and sums).
const P = (ONE << BigInt(127)) - ONE;

export interface Share {
  x: number;
  y: bigint;
}

function mod(value: bigint): bigint {
  const result = value % P;
  return result < ZERO ? result + P : result;
}

function modPow(base: bigint, exp: bigint): bigint {
  let b = mod(base);
  let result = ONE;
  let e = exp;
  while (e > ZERO) {
    if (e & ONE) result = mod(result * b);
    b = mod(b * b);
    e >>= ONE;
  }
  return result;
}

function modInverse(value: bigint): bigint {
  return modPow(value, P - TWO); // Fermat: a^(p-2) mod p
}

function randomFieldElement(): bigint {
  // 32 bytes = 256 bits over a 127-bit field keeps the mod-P bias below
  // 2^-129 (RFC 9380 hash-to-field sizing: ceil((127 + 128) / 8) = 32).
  return BigInt('0x' + randomBytes(32).toString('hex')) % P;
}

/**
 * Split `secret` into `parties` shares such that any `threshold` of them
 * reconstruct it, and any fewer reveal nothing. Shares are points (i, f(i)) on a
 * random degree-(threshold-1) polynomial with f(0) = secret.
 */
export function splitSecret(secret: bigint, parties: number, threshold: number): Share[] {
  if (threshold < 1 || threshold > parties) {
    throw new Error('threshold must be between 1 and the number of parties');
  }
  const coefficients = [mod(secret)];
  for (let i = 1; i < threshold; i++) {
    coefficients.push(randomFieldElement());
  }

  const shares: Share[] = [];
  for (let x = 1; x <= parties; x++) {
    const bx = BigInt(x);
    let y = ZERO;
    let power = ONE;
    for (let c = 0; c < coefficients.length; c++) {
      y = mod(y + coefficients[c] * power);
      power = mod(power * bx);
    }
    shares.push({ x, y });
  }
  return shares;
}

/** Reconstruct the secret from `threshold`-or-more shares via Lagrange interpolation at x=0. */
export function reconstructSecret(shares: Share[]): bigint {
  let secret = ZERO;
  for (let j = 0; j < shares.length; j++) {
    let numerator = ONE;
    let denominator = ONE;
    for (let m = 0; m < shares.length; m++) {
      if (m === j) continue;
      numerator = mod(numerator * BigInt(-shares[m].x));
      denominator = mod(denominator * BigInt(shares[j].x - shares[m].x));
    }
    const lagrange = mod(numerator * modInverse(denominator));
    secret = mod(secret + shares[j].y * lagrange);
  }
  return secret;
}

/**
 * Securely aggregate `inputs` (sum) using secret sharing: each input is split,
 * the same-index shares are summed across all parties, and the aggregate is
 * reconstructed. Reveals only the total — never an individual input.
 */
export function secureSum(inputs: bigint[], threshold: number): bigint {
  const parties = inputs.length;
  const perPartyShares = inputs.map((input) => splitSecret(input, parties, threshold));

  // Sum the share held at each x across all parties → a share of the total.
  const aggregated: Share[] = [];
  for (let x = 0; x < parties; x++) {
    let y = ZERO;
    for (let p = 0; p < parties; p++) {
      y = mod(y + perPartyShares[p][x].y);
    }
    aggregated.push({ x: x + 1, y });
  }

  return reconstructSecret(aggregated.slice(0, threshold));
}
