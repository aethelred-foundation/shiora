// ============================================================
// Shiora on Aethelred — Minimal CBOR decoder (GAP-12)
//
// WebAuthn encodes the attestation object and the COSE public key in CBOR.
// Rather than take a heavyweight dependency, this decodes exactly the subset
// WebAuthn uses (RFC 8949): unsigned/negative integers, byte and text strings,
// arrays, and maps, with the standard 1/2/4/8-byte length encodings. Anything
// outside that subset (floats, tags, indefinite lengths) throws — we never
// expect it here, and failing closed is safer than guessing.
// ============================================================

export type CborValue =
  | number
  | bigint
  | string
  | Uint8Array
  | CborValue[]
  | Map<CborValue, CborValue>;

interface Decoded {
  value: CborValue;
  offset: number;
}

function readLength(bytes: Uint8Array, offset: number, info: number): { length: number; offset: number } {
  if (info < 24) return { length: info, offset };
  if (info === 24) return { length: bytes[offset], offset: offset + 1 };
  if (info === 25) return { length: (bytes[offset] << 8) | bytes[offset + 1], offset: offset + 2 };
  if (info === 26) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 4);
    return { length: view.getUint32(0), offset: offset + 4 };
  }
  // 8-byte lengths (info 27) are legal CBOR but never used by WebAuthn keys/
  // attestation of any realistic size.
  throw new Error('Unsupported CBOR length encoding');
}

function decodeItem(bytes: Uint8Array, start: number): Decoded {
  const initial = bytes[start];
  const major = initial >> 5;
  const info = initial & 0x1f;
  const offset = start + 1;

  switch (major) {
    case 0: { // unsigned integer
      const { length, offset: o } = readLength(bytes, offset, info);
      return { value: length, offset: o };
    }
    case 1: { // negative integer: -1 - n
      const { length, offset: o } = readLength(bytes, offset, info);
      return { value: -1 - length, offset: o };
    }
    case 2: { // byte string
      const { length, offset: o } = readLength(bytes, offset, info);
      return { value: bytes.slice(o, o + length), offset: o + length };
    }
    case 3: { // text string
      const { length, offset: o } = readLength(bytes, offset, info);
      return { value: new TextDecoder().decode(bytes.slice(o, o + length)), offset: o + length };
    }
    case 4: { // array
      const { length, offset: o } = readLength(bytes, offset, info);
      const arr: CborValue[] = [];
      let cur = o;
      for (let i = 0; i < length; i++) {
        const item = decodeItem(bytes, cur);
        arr.push(item.value);
        cur = item.offset;
      }
      return { value: arr, offset: cur };
    }
    case 5: { // map
      const { length, offset: o } = readLength(bytes, offset, info);
      const map = new Map<CborValue, CborValue>();
      let cur = o;
      for (let i = 0; i < length; i++) {
        const key = decodeItem(bytes, cur);
        const val = decodeItem(bytes, key.offset);
        map.set(key.value, val.value);
        cur = val.offset;
      }
      return { value: map, offset: cur };
    }
    default:
      throw new Error(`Unsupported CBOR major type ${major}`);
  }
}

/** Decode a single top-level CBOR item; trailing bytes are ignored. */
export function decodeCbor(bytes: Uint8Array): CborValue {
  offsetGuard(bytes);
  return decodeItem(bytes, 0).value;
}

function offsetGuard(bytes: Uint8Array): void {
  if (bytes.length === 0) {
    throw new Error('Empty CBOR input');
  }
}
