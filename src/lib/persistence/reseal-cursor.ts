// ============================================================
// Shiora on Aethelred — Opaque re-seal scan cursor (GAP-14)
//
// KEK re-sealing walks every sealed row in stable order, in batches, so a run
// can resume after interruption. The cursor is an opaque token the caller
// passes back unchanged; only the store that issued it interprets it.
// ============================================================

/** One page of a re-seal scan. `nextCursor` is null once the scan is exhausted. */
export interface ResealScanPage<Row> {
  rows: Row[];
  nextCursor: string | null;
}

/** Encode ordering-key parts into an opaque cursor. */
export function encodeCursor(parts: string[]): string {
  return Buffer.from(JSON.stringify(parts)).toString('base64url');
}

/** Decode a cursor previously produced by {@link encodeCursor}. */
export function decodeCursor(cursor: string): string[] {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString()) as string[];
}
