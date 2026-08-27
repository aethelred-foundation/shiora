/** @jest-environment node */

import {
  splitSecret,
  reconstructSecret,
  secureSum,
  type Share,
} from '@/lib/crypto/secret-sharing';

describe('Shamir secret sharing', () => {
  it('reconstructs the secret from exactly the threshold of shares', () => {
    const secret = BigInt(424242);
    const shares = splitSecret(secret, 5, 3);
    expect(shares).toHaveLength(5);
    // any 3 of the 5 shares reconstruct
    expect(reconstructSecret([shares[0], shares[2], shares[4]])).toBe(secret);
    expect(reconstructSecret([shares[1], shares[3], shares[4]])).toBe(secret);
  });

  it('reveals nothing with fewer than the threshold (a single share ≠ the secret)', () => {
    const secret = BigInt(1000);
    const shares = splitSecret(secret, 5, 3);
    expect(shares[0].y).not.toBe(secret); // an individual share leaks nothing
    expect(reconstructSecret([shares[0], shares[1]])).not.toBe(secret); // 2 < 3
  });

  it('rejects an invalid threshold', () => {
    expect(() => splitSecret(BigInt(1), 3, 4)).toThrow(/threshold/);
    expect(() => splitSecret(BigInt(1), 3, 0)).toThrow(/threshold/);
  });
});

describe('secure aggregation', () => {
  it('computes the true sum without revealing any input', () => {
    const inputs = [BigInt(3), BigInt(5), BigInt(7), BigInt(11)];
    expect(secureSum(inputs, 3)).toBe(BigInt(26));
  });

  it('works at the maximum threshold and for a single party', () => {
    expect(secureSum([BigInt(10), BigInt(20), BigInt(30)], 3)).toBe(BigInt(60));
    expect(secureSum([BigInt(99)], 1)).toBe(BigInt(99));
  });

  it('the aggregated shares are not equal to any individual input', () => {
    const inputs = [BigInt(40), BigInt(2)];
    // reconstruct the aggregate shares the protocol uses; assert they hide inputs
    const a = splitSecret(inputs[0], 2, 2);
    const b = splitSecret(inputs[1], 2, 2);
    const aggregated: Share[] = a.map((share, i) => ({ x: share.x, y: (share.y + b[i].y) }));
    expect(aggregated[0].y).not.toBe(inputs[0]);
    expect(aggregated[0].y).not.toBe(inputs[1]);
    expect(secureSum(inputs, 2)).toBe(BigInt(42)); // but the total is exact
  });
});
