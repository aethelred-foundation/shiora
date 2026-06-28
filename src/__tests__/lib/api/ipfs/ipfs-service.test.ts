/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });
jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

const mockBlocks = new Map<string, Uint8Array>();
jest.mock('@/lib/api/ipfs/ipfs-store', () => {
  const { computeCidV1 } = jest.requireActual('@/lib/crypto/cid');
  return {
    getIPFSStore: () => ({
      put: async (content: Uint8Array) => {
        const cid = computeCidV1(content);
        mockBlocks.set(cid, content);
        return cid;
      },
      get: async (cid: string) => mockBlocks.get(cid),
    }),
  };
});

import {
  storeObject,
  resolveObject,
  listObjects,
  eraseObjects,
  __resetIpfsForTests,
} from '@/lib/api/ipfs/ipfs-service';
import { getAuditLog, __resetAuditLogForTests } from '@/lib/api/audit-log';
import { seededAddress } from '@/lib/utils';

const USER = seededAddress(300);
const original = process.env.DATABASE_URL;
const content = () => new TextEncoder().encode('a small clinical attachment');

beforeEach(() => {
  delete process.env.DATABASE_URL;
  mockBlocks.clear();
  __resetIpfsForTests();
  __resetAuditLogForTests();
});

afterEach(() => {
  if (original === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = original;
  __resetIpfsForTests();
  jest.clearAllMocks();
});

describe('ipfs-service', () => {
  it('encrypts then addresses: real CID, ciphertext-at-rest, resolvable+decryptable, audited', async () => {
    const object = await storeObject(USER, content(), 'lab.pdf', 'application/pdf');

    expect(object.cid).toMatch(/^bafkrei[a-z2-7]+$/); // real CIDv1
    expect(object.size).toBe(content().length);

    // what's stored is sealed ciphertext, not the plaintext
    const stored = new TextDecoder().decode(mockBlocks.get(object.cid)!);
    expect(stored).not.toMatch(/clinical attachment/);
    expect(stored).toMatch(/"ct"|"iv"|"v"/); // a SealedEnvelope

    const resolved = await resolveObject(USER, object.cid);
    expect(resolved?.integrityVerified).toBe(true);
    expect(Buffer.from(resolved!.content!, 'base64').toString('utf8')).toBe('a small clinical attachment');

    const audits = await getAuditLog().list({ action: 'IPFS_STORE', actor: USER });
    expect(audits).toHaveLength(1);
  });

  it('returns undefined when the caller does not own the CID', async () => {
    const object = await storeObject(USER, content(), 'lab.pdf', 'application/pdf');
    expect(await resolveObject(seededAddress(301), object.cid)).toBeUndefined();
  });

  it('returns undefined when the content is no longer retrievable', async () => {
    const object = await storeObject(USER, content(), 'lab.pdf', 'application/pdf');
    mockBlocks.delete(object.cid); // metadata remains, blob gone
    expect(await resolveObject(USER, object.cid)).toBeUndefined();
  });

  it('reports an integrity failure when stored bytes do not match the CID', async () => {
    const object = await storeObject(USER, content(), 'lab.pdf', 'application/pdf');
    mockBlocks.set(object.cid, new TextEncoder().encode('tampered')); // corrupt the blob
    const resolved = await resolveObject(USER, object.cid);
    expect(resolved?.integrityVerified).toBe(false);
    expect(resolved?.content).toBeNull();
  });

  it('lists and erases the owner\'s objects', async () => {
    await storeObject(USER, content(), 'a.pdf', 'application/pdf');
    await storeObject(USER, new TextEncoder().encode('second'), 'b.txt', 'text/plain');
    expect(await listObjects(USER)).toHaveLength(2);
    expect(await eraseObjects(USER)).toBe(2);
    expect(await listObjects(USER)).toEqual([]);
  });

  it('selects the Postgres store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetIpfsForTests();
    expect(await listObjects(USER)).toEqual([]);
    expect(pgQuery).toHaveBeenCalled();
  });
});
