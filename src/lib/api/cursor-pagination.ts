// ============================================================
// Shiora on Aethelred — Cursor pagination (GAP-20)
//
// Unbounded lists (the audit log above all) must not be walked by offset:
// page-by-offset skips or repeats rows when the underlying list grows between
// requests, and deep offsets get slower. Cursor pagination pages by a stable,
// strictly-monotonic key (e.g. an append-only sequence number) so results are
// consistent regardless of concurrent appends. The cursor is opaque — callers
// pass it back unchanged and never construct it.
// ============================================================

export interface CursorPage<T> {
  items: T[];
  /** Pass back as `?cursor=` for the next page; null when the list is exhausted. */
  nextCursor: string | null;
}

/** Encode a sort key into an opaque cursor token. */
export function encodeCursor(key: number | string): string {
  return Buffer.from(String(key)).toString('base64url');
}

/** Decode a cursor token back to its raw key string. */
export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString();
}

/**
 * Page a list already sorted by DESCENDING key. `keyOf` extracts each item's
 * strictly-decreasing key. Items with key >= the cursor key are skipped (they
 * belong to earlier pages); a full page yields a nextCursor, a short one ends
 * the walk. A cursor past the end returns an empty final page.
 */
export function pageByCursor<T>(
  sortedDesc: T[],
  keyOf: (item: T) => number,
  limit: number,
  cursor?: string,
): CursorPage<T> {
  let start = 0;
  if (cursor) {
    const after = Number(decodeCursor(cursor));
    start = sortedDesc.findIndex((item) => keyOf(item) < after);
    if (start === -1) {
      return { items: [], nextCursor: null };
    }
  }

  const items = sortedDesc.slice(start, start + limit);
  const hasMore = start + limit < sortedDesc.length;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(keyOf(last)) : null,
  };
}
