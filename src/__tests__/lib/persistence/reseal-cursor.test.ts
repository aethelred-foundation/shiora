/** @jest-environment node */

import { encodeCursor, decodeCursor } from '@/lib/persistence/reseal-cursor';

describe('reseal cursor', () => {
  it('round-trips ordering-key parts through an opaque token', () => {
    const cursor = encodeCursor(['vault-symptom', 'rec-123']);
    expect(cursor).not.toContain('vault-symptom'); // opaque, not human-readable
    expect(decodeCursor(cursor)).toEqual(['vault-symptom', 'rec-123']);
  });

  it('handles single-part cursors (records key on id alone)', () => {
    expect(decodeCursor(encodeCursor(['only-id']))).toEqual(['only-id']);
  });

  it('preserves parts containing separators and unicode', () => {
    const parts = ['a::b', 'aeth1xyz', 'مريض'];
    expect(decodeCursor(encodeCursor(parts))).toEqual(parts);
  });
});
