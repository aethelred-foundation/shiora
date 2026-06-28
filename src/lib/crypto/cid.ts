// ============================================================
// Shiora on Aethelred — IPFS Content Identifier (CIDv1)
//
// Computes a REAL, spec-compliant IPFS CIDv1 from content bytes — a self-
// certifying, content-derived address. This replaces the prior placeholder
// (`generateCID(seed)`, a random string unrelated to any content). Because the
// CID is the multibase-encoded multihash of the bytes, re-deriving it from
// retrieved content proves integrity: a CID that still matches has not been
// tampered with.
//
// Format: CIDv1 ‖ raw codec (0x55) ‖ sha2-256 multihash, multibase base32
// (the `bafkrei…` form). This is exactly the CID an IPFS node assigns to a raw
// block of these bytes (`ipfs add --cid-version=1 --raw-leaves`). Content larger
// than a single block uses UnixFS/dag-pb chunking and a different CID — out of
// scope here; the platform stores single encrypted blobs addressed as raw.
// ============================================================

import { createHash } from 'node:crypto';

const CID_V1 = 0x01;
const CODEC_RAW = 0x55;
const HASH_SHA2_256 = 0x12;
const SHA2_256_LENGTH = 0x20; // 32 bytes

// RFC 4648 base32 lowercase alphabet (multibase prefix 'b').
const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

/** RFC 4648 base32 (lowercase, no padding). Exported for direct test coverage. */
export function base32NoPad(data: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < data.length; i++) {
    value = (value << 8) | data[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/** The real CIDv1 (raw codec, sha2-256) for the given content bytes. */
export function computeCidV1(content: Uint8Array): string {
  const digest = createHash('sha256').update(content).digest();
  const cidBytes = new Uint8Array(4 + digest.length);
  cidBytes[0] = CID_V1;
  cidBytes[1] = CODEC_RAW;
  cidBytes[2] = HASH_SHA2_256;
  cidBytes[3] = SHA2_256_LENGTH;
  cidBytes.set(digest, 4);
  return `b${base32NoPad(cidBytes)}`;
}

/** Whether `content` actually hashes to `cid` (content-addressing integrity check). */
export function verifyCid(cid: string, content: Uint8Array): boolean {
  return computeCidV1(content) === cid;
}
