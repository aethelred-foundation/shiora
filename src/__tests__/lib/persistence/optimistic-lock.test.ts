/** @jest-environment node */

import { OptimisticLockError, isOptimisticLockError, versionOf } from '@/lib/persistence/optimistic-lock';

describe('optimistic-lock helpers', () => {
  it('OptimisticLockError carries expected and actual versions', () => {
    const err = new OptimisticLockError(2, 5);
    expect(err.expected).toBe(2);
    expect(err.actual).toBe(5);
    expect(err.name).toBe('OptimisticLockError');
    expect(err.message).toContain('expected version 2');
    expect(err.message).toContain('found 5');
  });

  it('isOptimisticLockError narrows only its own type', () => {
    expect(isOptimisticLockError(new OptimisticLockError(1, 2))).toBe(true);
    expect(isOptimisticLockError(new Error('other'))).toBe(false);
    expect(isOptimisticLockError('nope')).toBe(false);
  });

  it('versionOf defaults a missing version to 1', () => {
    expect(versionOf({})).toBe(1);
    expect(versionOf({ version: 7 })).toBe(7);
  });
});
