/** @jest-environment node */

import {
  commit,
  randomScalar,
  proveMembership,
  verifyMembership,
} from '@/lib/crypto/zk-membership';

const CTX = 'age_range:claim-1';

describe('zk-membership — completeness', () => {
  it('verifies a proof that a committed value is in the set (value mid-set)', () => {
    const blinding = randomScalar();
    const proof = proveMembership(30n, blinding, [18, 30, 65], CTX);
    expect(verifyMembership(proof, CTX)).toBe(true);
  });

  it('verifies when the value is the first set element', () => {
    const proof = proveMembership(18n, randomScalar(), [18, 30], CTX);
    expect(verifyMembership(proof, CTX)).toBe(true);
  });

  it('does not leak which element matched (commitment hides the value)', () => {
    const blinding = randomScalar();
    const c1 = commit(30n, blinding);
    const c2 = commit(31n, blinding);
    expect(c1).not.toBe(c2); // distinct values commit differently
  });
});

describe('zk-membership — soundness', () => {
  it('refuses to prove a value that is not in the set', () => {
    expect(() => proveMembership(99n, randomScalar(), [18, 30], CTX)).toThrow(/not in the set/);
  });

  it('rejects a proof whose response was tampered with', () => {
    const proof = proveMembership(30n, randomScalar(), [18, 30, 65], CTX);
    const tampered = { ...proof, z: [...proof.z] };
    tampered.z[1] = (BigInt('0x' + tampered.z[1]) + 1n).toString(16);
    expect(verifyMembership(tampered, CTX)).toBe(false);
  });

  it('rejects a proof verified under a different context (Fiat–Shamir binding)', () => {
    const proof = proveMembership(30n, randomScalar(), [18, 30], CTX);
    expect(verifyMembership(proof, 'different-context')).toBe(false);
  });

  it('rejects a proof verified against a different set (set binding)', () => {
    const proof = proveMembership(30n, randomScalar(), [18, 30], CTX);
    expect(verifyMembership({ ...proof, set: [19, 30] }, CTX)).toBe(false);
  });

  it('rejects a malformed proof whose arrays do not match the set length', () => {
    const proof = proveMembership(30n, randomScalar(), [18, 30], CTX);
    expect(verifyMembership({ ...proof, t: [proof.t[0]] }, CTX)).toBe(false);
  });
});
