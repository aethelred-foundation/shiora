/** @jest-environment node */

import { decodeCbor } from '@/lib/crypto/cbor-lite';

const hex = (h: string) => new Uint8Array(Buffer.from(h, 'hex'));

describe('decodeCbor (RFC 8949 subset)', () => {
  it('decodes unsigned integers across length encodings', () => {
    expect(decodeCbor(hex('00'))).toBe(0);
    expect(decodeCbor(hex('17'))).toBe(23);
    expect(decodeCbor(hex('1818'))).toBe(24); // 1-byte
    expect(decodeCbor(hex('1903e8'))).toBe(1000); // 2-byte
    expect(decodeCbor(hex('1a000f4240'))).toBe(1000000); // 4-byte
  });

  it('decodes negative integers', () => {
    expect(decodeCbor(hex('20'))).toBe(-1);
    expect(decodeCbor(hex('29'))).toBe(-10);
    expect(decodeCbor(hex('3903e7'))).toBe(-1000);
  });

  it('decodes byte strings (empty and with a 1-byte length)', () => {
    expect(decodeCbor(hex('40'))).toEqual(new Uint8Array([]));
    expect(decodeCbor(hex('4401020304'))).toEqual(new Uint8Array([1, 2, 3, 4]));
    const big = '58' + '20' + '00'.repeat(32); // 32-byte string
    expect(decodeCbor(hex(big))).toEqual(new Uint8Array(32));
  });

  it('decodes text strings', () => {
    expect(decodeCbor(hex('60'))).toBe('');
    expect(decodeCbor(hex('6161'))).toBe('a');
    expect(decodeCbor(hex('6449455446'))).toBe('IETF');
  });

  it('decodes arrays, including nested', () => {
    expect(decodeCbor(hex('83010203'))).toEqual([1, 2, 3]);
    expect(decodeCbor(hex('8301820203820405'))).toEqual([1, [2, 3], [4, 5]]);
  });

  it('decodes maps with integer and text keys', () => {
    const m = decodeCbor(hex('a201020304')) as Map<number, number>;
    expect(m.get(1)).toBe(2);
    expect(m.get(3)).toBe(4);

    const m2 = decodeCbor(hex('a26161016162820203')) as Map<string, unknown>;
    expect(m2.get('a')).toBe(1);
    expect(m2.get('b')).toEqual([2, 3]);
  });

  it('decodes a COSE-shaped map with negative keys and byte-string values', () => {
    // {1:2, 3:-7, -1:1, -2:h'aa..', -3:h'bb..'}
    const x = 'aa'.repeat(32);
    const y = 'bb'.repeat(32);
    const cbor = 'a5' + '0102' + '0326' + '2001' + '215820' + x + '225820' + y;
    const map = decodeCbor(hex(cbor)) as Map<number, unknown>;
    expect(map.get(1)).toBe(2);
    expect(map.get(3)).toBe(-7);
    expect(map.get(-1)).toBe(1);
    expect(map.get(-2)).toEqual(new Uint8Array(Buffer.from(x, 'hex')));
    expect(map.get(-3)).toEqual(new Uint8Array(Buffer.from(y, 'hex')));
  });

  it('throws on empty input and unsupported encodings', () => {
    expect(() => decodeCbor(hex(''))).toThrow(/Empty/);
    expect(() => decodeCbor(hex('f90000'))).toThrow(/major type/); // float16
    expect(() => decodeCbor(hex('1b0000000000000001'))).toThrow(/length encoding/); // 8-byte length
  });
});
