/** @jest-environment node */

import { encodeCursor, decodeCursor, pageByCursor } from '@/lib/api/cursor-pagination';

describe('cursor encode/decode', () => {
  it('round-trips numeric and string keys through an opaque token', () => {
    const c = encodeCursor(42);
    expect(c).not.toContain('42'); // opaque
    expect(decodeCursor(c)).toBe('42');
    expect(decodeCursor(encodeCursor('abc'))).toBe('abc');
  });
});

describe('pageByCursor', () => {
  // Descending-key items (e.g. audit seq).
  const items = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((seq) => ({ seq }));
  const keyOf = (i: { seq: number }) => i.seq;

  it('returns the first page and a cursor when more remain', () => {
    const page = pageByCursor(items, keyOf, 3);
    expect(page.items.map(keyOf)).toEqual([10, 9, 8]);
    expect(page.nextCursor).toBe(encodeCursor(8));
  });

  it('resumes strictly after the cursor key', () => {
    const page = pageByCursor(items, keyOf, 3, encodeCursor(8));
    expect(page.items.map(keyOf)).toEqual([7, 6, 5]);
    expect(page.nextCursor).toBe(encodeCursor(5));
  });

  it('ends the walk with a null cursor on the final (short) page', () => {
    const page = pageByCursor(items, keyOf, 4, encodeCursor(4));
    expect(page.items.map(keyOf)).toEqual([3, 2, 1]);
    expect(page.nextCursor).toBeNull();
  });

  it('returns a null cursor when the last page is exactly full', () => {
    const page = pageByCursor(items.slice(0, 3), keyOf, 3);
    expect(page.items.map(keyOf)).toEqual([10, 9, 8]);
    expect(page.nextCursor).toBeNull(); // nothing beyond
  });

  it('returns an empty final page when the cursor is past the end', () => {
    const page = pageByCursor(items, keyOf, 5, encodeCursor(1));
    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });
});
