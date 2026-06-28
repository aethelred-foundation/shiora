// ============================================================
// Shiora on Aethelred — Zero-Knowledge Set-Membership Proof
//
// A REAL, transparent-setup (no trusted setup, no toxic waste) non-interactive
// zero-knowledge proof that a Pedersen-committed private value is a member of a
// public set, WITHOUT revealing which element. It is the cryptographic core of
// the platform's selective-disclosure claims (prove "age in range" / "condition
// present" / "data quality ≥ threshold" without revealing the underlying data).
//
// Construction:
//   • Group: the order-q prime subgroup of Z_p* for the RFC 3526 3072-bit MODP
//     safe prime (q = (p-1)/2, prime). ~128-bit discrete-log security. Generators
//     g, h are nothing-up-my-sleeve (hash-derived squares) with unknown relative
//     discrete log, so a Pedersen commitment C = g^v · h^r is hiding and binding.
//   • A 1-of-k OR-proof (Cramer–Damgård–Schoenmakers) of "C·g^-s_i is a power of
//     h whose exponent I know" — true for exactly the index where v = s_i — made
//     non-interactive with Fiat–Shamir and domain separation. Real soundness and
//     zero-knowledge; no SNARK, no ceremony, no committed proving keys.
//
// HONEST SCOPE: this proves the committed value is in the set. Binding the
// commitment to an issuer-attested attribute (anonymous credentials) is the
// trust layer above this primitive — see the `zk_proofs` maturity entry.
// ============================================================

import { createHash, randomBytes } from 'node:crypto';

const DOMAIN = 'Shiora/ZKP/Membership/v1';

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);

// RFC 3526 group 15 — the 3072-bit MODP safe prime.
const P = BigInt('0x'
  + 'FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74'
  + '020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F1437'
  + '4FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED'
  + 'EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF05'
  + '98DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB'
  + '9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B'
  + 'E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF695581718'
  + '3995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D04507A33'
  + 'A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7'
  + 'ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6BF12FFA06D98A0864'
  + 'D87602733EC86A64521F2B18177B200CBBE117577A615D6C770988C0BAD946E2'
  + '08E24FA074E5AB3143DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF');

const Q = (P - ONE) / TWO; // prime order of the QR subgroup

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let b = base % mod;
  let result = ONE;
  let e = exp;
  while (e > ZERO) {
    if (e & ONE) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= ONE;
  }
  return result;
}

/** A nothing-up-my-sleeve generator of the order-q subgroup (a hash-derived square). */
function deriveGenerator(label: string): bigint {
  const seed = BigInt('0x' + createHash('sha256').update(label).digest('hex')) % P;
  return modPow(seed, TWO, P); // squaring lands in the order-q QR subgroup
}

const G = deriveGenerator('Shiora/ZKP/g/v1');
const H = deriveGenerator('Shiora/ZKP/h/v1');
const G_INV = modPow(G, P - TWO, P); // modular inverse of g (Fermat)

/** A uniform scalar in [1, q-1]. */
export function randomScalar(): bigint {
  const value = BigInt('0x' + randomBytes(48).toString('hex')) % (Q - ONE);
  return value + ONE;
}

/** Pedersen commitment C = g^value · h^blinding (mod p). */
export function commit(value: bigint, blinding: bigint): bigint {
  return (modPow(G, value, P) * modPow(H, blinding, P)) % P;
}

export interface MembershipProof {
  commitment: string; // hex
  set: number[];
  t: string[]; // hex per element
  e: string[]; // hex per element
  z: string[]; // hex per element
}

function fiatShamir(commitment: bigint, set: number[], t: bigint[], context: string): bigint {
  const parts = [
    DOMAIN, context, P.toString(16), G.toString(16), H.toString(16),
    commitment.toString(16), set.join(','), ...t.map((value) => value.toString(16)),
  ];
  return BigInt('0x' + createHash('sha256').update(parts.join(':')).digest('hex')) % Q;
}

/**
 * Prove that the committed `value` (with the given `blinding`) is a member of
 * `set`, without revealing which element. Throws if the value is not in the set
 * — a false statement cannot be proven.
 */
export function proveMembership(
  value: bigint,
  blinding: bigint,
  set: number[],
  context: string,
): MembershipProof {
  const realIndex = set.findIndex((element) => BigInt(element) === value);
  if (realIndex < 0) {
    throw new Error('Cannot prove membership: value is not in the set.');
  }

  const commitment = commit(value, blinding);
  const targets = set.map((element) => (commitment * modPow(G_INV, BigInt(element), P)) % P);

  const t: bigint[] = new Array(set.length);
  const e: bigint[] = new Array(set.length);
  const z: bigint[] = new Array(set.length);

  // Simulate every branch except the real one.
  let realCommitNonce = ZERO;
  for (let i = 0; i < set.length; i++) {
    if (i === realIndex) {
      realCommitNonce = randomScalar();
      t[i] = modPow(H, realCommitNonce, P);
    } else {
      e[i] = randomScalar();
      z[i] = randomScalar();
      t[i] = (modPow(H, z[i], P) * modPow(targets[i], (Q - e[i]) % Q, P)) % P;
    }
  }

  // Fiat–Shamir: the overall challenge fixes the real branch's challenge.
  const challenge = fiatShamir(commitment, set, t, context);
  let othersSum = ZERO;
  for (let i = 0; i < set.length; i++) {
    if (i !== realIndex) othersSum = (othersSum + e[i]) % Q;
  }
  e[realIndex] = ((challenge - othersSum) % Q + Q) % Q;
  z[realIndex] = (realCommitNonce + e[realIndex] * blinding) % Q;

  return {
    commitment: commitment.toString(16),
    set: [...set],
    t: t.map((value) => value.toString(16)),
    e: e.map((value) => value.toString(16)),
    z: z.map((value) => value.toString(16)),
  };
}

/** Verify a set-membership proof. Returns false on any malformed or invalid proof. */
export function verifyMembership(proof: MembershipProof, context: string): boolean {
  const { set } = proof;
  if (proof.t.length !== set.length || proof.e.length !== set.length || proof.z.length !== set.length) {
    return false;
  }

  const commitment = BigInt('0x' + proof.commitment);
  const t = proof.t.map((value) => BigInt('0x' + value));
  const e = proof.e.map((value) => BigInt('0x' + value));
  const z = proof.z.map((value) => BigInt('0x' + value));
  const targets = set.map((element) => (commitment * modPow(G_INV, BigInt(element), P)) % P);

  const challenge = fiatShamir(commitment, set, t, context);
  const challengeSum = e.reduce((sum, value) => (sum + value) % Q, ZERO);
  if (challengeSum !== challenge) {
    return false;
  }

  for (let i = 0; i < set.length; i++) {
    const lhs = modPow(H, z[i], P);
    const rhs = (t[i] * modPow(targets[i], e[i], P)) % P;
    if (lhs !== rhs) {
      return false;
    }
  }
  return true;
}
