// ============================================================
// Shiora on Aethelred — Content-Addressed Store (IPFS) — port + adapters
//
// A ports-and-adapters seam over content-addressed storage, mirroring the LLM
// and datastore seams. The "node / pinning choice" is therefore a deployment
// config, not a hardcoded vendor:
//   • InMemoryIPFSStore — default. A real, local content-addressed store: bytes
//     are keyed by their genuine CIDv1, retrievable by CID, no network. Honest
//     "local node" mode for development/preview.
//   • HttpIPFSStore — selected when IPFS_API_URL is set. Talks the standard Kubo
//     HTTP API (/api/v0/add, /api/v0/cat), so it works against any compatible
//     IPFS node or pinning gateway without baking in a specific vendor.
//
// Stored content is opaque bytes; the service encrypts before storing, so what
// is addressed by a CID is ciphertext (encrypt-then-address — PHI never lands
// in a content-addressed store in the clear).
// ============================================================

import { computeCidV1 } from '@/lib/crypto/cid';

export interface IPFSStorePort {
  /** Store content and return its content-derived CIDv1. */
  put(content: Uint8Array): Promise<string>;
  /** Retrieve content by CID, or undefined when not present. */
  get(cid: string): Promise<Uint8Array | undefined>;
}

/** Local content-addressed store (real CIDs, retrievable content, no network). */
export class InMemoryIPFSStore implements IPFSStorePort {
  private readonly blocks = new Map<string, Uint8Array>();

  async put(content: Uint8Array): Promise<string> {
    const cid = computeCidV1(content);
    this.blocks.set(cid, content);
    return cid;
  }

  async get(cid: string): Promise<Uint8Array | undefined> {
    return this.blocks.get(cid);
  }
}

/** Adapter over a Kubo-compatible IPFS HTTP API (any node or pinning gateway). */
export class HttpIPFSStore implements IPFSStorePort {
  constructor(
    private readonly apiUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async put(content: Uint8Array): Promise<string> {
    const form = new FormData();
    form.append('file', new Blob([content as unknown as BlobPart]));
    const response = await this.fetchImpl(
      `${this.apiUrl}/api/v0/add?cid-version=1&raw-leaves=true&pin=true`,
      { method: 'POST', body: form },
    );
    if (!response.ok) {
      throw new Error(`IPFS add failed with status ${response.status}`);
    }
    const data = await response.json() as { Hash: string };
    return data.Hash;
  }

  async get(cid: string): Promise<Uint8Array | undefined> {
    const response = await this.fetchImpl(`${this.apiUrl}/api/v0/cat?arg=${encodeURIComponent(cid)}`, {
      method: 'POST',
    });
    if (response.status === 404) {
      return undefined;
    }
    if (!response.ok) {
      throw new Error(`IPFS cat failed with status ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }
}

let localStore: InMemoryIPFSStore | null = null;

/** Select the configured IPFS node when IPFS_API_URL is set, else the local store. */
export function getIPFSStore(): IPFSStorePort {
  const apiUrl = process.env.IPFS_API_URL;
  if (apiUrl) {
    return new HttpIPFSStore(apiUrl);
  }
  if (!localStore) {
    localStore = new InMemoryIPFSStore();
  }
  return localStore;
}

/** Test-only: reset the local content-addressed store. */
export function __resetIPFSStoreForTests(): void {
  localStore = null;
}
