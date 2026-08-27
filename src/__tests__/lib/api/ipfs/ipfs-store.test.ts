/** @jest-environment node */

import {
  InMemoryIPFSStore,
  HttpIPFSStore,
  getIPFSStore,
  __resetIPFSStoreForTests,
} from '@/lib/api/ipfs/ipfs-store';
import { computeCidV1 } from '@/lib/crypto/cid';

const originalUrl = process.env.IPFS_API_URL;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.IPFS_API_URL;
  else process.env.IPFS_API_URL = originalUrl;
  __resetIPFSStoreForTests();
});

function fakeFetch(impl: (url: string, init: RequestInit) => unknown): typeof fetch {
  return ((url: string, init: RequestInit) => Promise.resolve(impl(url, init))) as unknown as typeof fetch;
}

describe('InMemoryIPFSStore', () => {
  it('stores by real CID and retrieves the exact bytes', async () => {
    const store = new InMemoryIPFSStore();
    const content = new TextEncoder().encode('ciphertext blob');
    const cid = await store.put(content);

    expect(cid).toBe(computeCidV1(content)); // content-derived, not random
    expect(await store.get(cid)).toEqual(content);
    expect(await store.get('bafkreimissing')).toBeUndefined();
  });
});

describe('HttpIPFSStore', () => {
  it('adds content and returns the node CID', async () => {
    let sentUrl = '';
    const store = new HttpIPFSStore('http://ipfs:5001', fakeFetch((url) => {
      sentUrl = url;
      return { ok: true, json: async () => ({ Hash: 'bafkreinodecid' }) };
    }));
    expect(await store.put(new Uint8Array([1, 2, 3]))).toBe('bafkreinodecid');
    expect(sentUrl).toContain('/api/v0/add');
  });

  it('throws when add fails', async () => {
    const store = new HttpIPFSStore('http://ipfs:5001', fakeFetch(() => ({ ok: false, status: 500 })));
    await expect(store.put(new Uint8Array([1]))).rejects.toThrow(/500/);
  });

  it('cats content back', async () => {
    const bytes = new Uint8Array([9, 8, 7]);
    const store = new HttpIPFSStore('http://ipfs:5001', fakeFetch(() => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => bytes.buffer,
    })));
    expect(Array.from((await store.get('bafkreix'))!)).toEqual([9, 8, 7]);
  });

  it('returns undefined for a 404 and throws for other errors', async () => {
    const notFound = new HttpIPFSStore('http://ipfs:5001', fakeFetch(() => ({ status: 404, ok: false })));
    expect(await notFound.get('bafkreigone')).toBeUndefined();

    const errored = new HttpIPFSStore('http://ipfs:5001', fakeFetch(() => ({ status: 502, ok: false })));
    await expect(errored.get('bafkreix')).rejects.toThrow(/502/);
  });
});

describe('getIPFSStore', () => {
  it('returns the local store (singleton) when no node is configured', () => {
    delete process.env.IPFS_API_URL;
    __resetIPFSStoreForTests();
    const store = getIPFSStore();
    expect(store).toBeInstanceOf(InMemoryIPFSStore);
    expect(getIPFSStore()).toBe(store); // same instance
  });

  it('returns the HTTP node adapter when IPFS_API_URL is set', () => {
    process.env.IPFS_API_URL = 'http://ipfs:5001';
    expect(getIPFSStore()).toBeInstanceOf(HttpIPFSStore);
  });
});
