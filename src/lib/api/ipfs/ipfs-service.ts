// ============================================================
// Shiora on Aethelred — IPFS Object Service (encrypt-then-address)
//
// Stores content on the content-addressed store and tracks an owner-scoped,
// encrypted index of what each user uploaded. The flow is encrypt-then-address:
// content is sealed with the platform's envelope encryption (AAD-bound to the
// owner) BEFORE it is stored, so the CID addresses ciphertext — PHI never lands
// in a content-addressed store in the clear. Retrieval re-derives the CID from
// the stored bytes (tamper-evidence) before decrypting.
//
// HONEST SCOPE: a content-addressed store is immutable — erasure removes the
// owner's object index, but a blob on a real IPFS network can only be unpinned,
// not force-deleted. See the `ipfs_storage` maturity entry.
// ============================================================

import { getAuditLog } from '@/lib/api/audit-log';
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';
import { sealString, openString, type SealedEnvelope } from '@/lib/crypto/envelope';
import { verifyCid } from '@/lib/crypto/cid';
import { getIPFSStore } from '@/lib/api/ipfs/ipfs-store';

const COLLECTION = 'ipfs-object';

export interface IpfsObject {
  id: string; // the CID
  ownerAddress: string;
  cid: string;
  filename: string;
  contentType: string;
  size: number;
  createdAt: number;
}

export interface ResolvedObject {
  object: IpfsObject;
  integrityVerified: boolean;
  content: string | null; // base64 of the decrypted content, or null when integrity fails
}

let repository: EncryptedDocumentRepository<IpfsObject> | null = null;

function createStore(): DocumentStorePort {
  if (shouldUsePostgres()) {
    return new PgDocumentStore(getPgClient());
  }
  return new InMemoryDocumentStore();
}

function repo(): EncryptedDocumentRepository<IpfsObject> {
  if (!repository) {
    repository = new EncryptedDocumentRepository<IpfsObject>(
      createStore(),
      getAuditLog(),
      COLLECTION,
      { create: 'IPFS_STORE', update: 'IPFS_STORE' },
    );
  }
  return repository;
}

function aad(owner: string): string {
  return `ipfs:${owner}`;
}

/** Encrypt content, store it content-addressed, and index it for the owner. */
export async function storeObject(
  ownerAddress: string,
  content: Uint8Array,
  filename: string,
  contentType: string,
): Promise<IpfsObject> {
  const sealed = sealString(Buffer.from(content).toString('base64'), aad(ownerAddress));
  const ciphertext = new TextEncoder().encode(JSON.stringify(sealed));
  const cid = await getIPFSStore().put(ciphertext);

  const object: IpfsObject = {
    id: cid,
    ownerAddress,
    cid,
    filename,
    contentType,
    size: content.length,
    createdAt: Date.now(),
  };

  await repo().create(ownerAddress, object); // also records the IPFS_STORE audit
  return object;
}

/**
 * Resolve a CID the caller owns: fetch the stored ciphertext, re-derive its CID
 * (integrity), and decrypt. Returns undefined when the caller does not own the
 * CID or the content is not retrievable.
 */
export async function resolveObject(
  ownerAddress: string,
  cid: string,
): Promise<ResolvedObject | undefined> {
  const object = await repo().get(ownerAddress, cid);
  if (!object) {
    return undefined;
  }

  const ciphertext = await getIPFSStore().get(cid);
  if (!ciphertext) {
    return undefined;
  }

  if (!verifyCid(cid, ciphertext)) {
    // The retrieved bytes do not hash to the claimed CID — tampered.
    return { object, integrityVerified: false, content: null };
  }

  const sealed = JSON.parse(new TextDecoder().decode(ciphertext)) as SealedEnvelope;
  const content = openString(sealed, aad(ownerAddress));
  return { object, integrityVerified: true, content };
}

export function listObjects(ownerAddress: string): Promise<IpfsObject[]> {
  return repo().list(ownerAddress);
}

/** Soft-delete the owner's object index (the content-addressed blob is immutable). */
export async function eraseObjects(ownerAddress: string): Promise<number> {
  const objects = await repo().list(ownerAddress);
  await Promise.all(objects.map((object) => repo().softDelete(ownerAddress, object.id)));
  return objects.length;
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetIpfsForTests(): void {
  repository = null;
}
