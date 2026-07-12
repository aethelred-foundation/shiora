/** @jest-environment node */

jest.mock('@/lib/api/preflight', () => ({ hasDurableDatastore: jest.fn(() => false) }));
jest.mock('@/lib/persistence/sql-client', () => ({ getPgClient: jest.fn() }));

import {
  runKekReseal,
  runDurableKekReseal,
  DEFAULT_RESEAL_BATCH,
} from '@/lib/maintenance/kek-reseal';
import { InMemoryDocumentStore, type StoredDocument } from '@/lib/persistence/document-store';
import { InMemoryRecordStore, type StoredRecord } from '@/lib/persistence/record-store';
import { documentAad } from '@/lib/persistence/encrypted-documents';
import { recordPhiAad } from '@/lib/persistence/encrypted-records';
import {
  sealJson, openString, shredEnvelope, isShredded, type SealedEnvelope,
} from '@/lib/crypto/envelope';
import { __resetDekWrapperForTests } from '@/lib/crypto/dek-wrapper';
import { __resetKeyProviderForTests } from '@/lib/crypto/key-provider';
import { hasDurableDatastore } from '@/lib/api/preflight';
import {
  clearTransitEnv, configureTransitEnv, installFakeTransit, sealLegacyJson,
} from '@/__tests__/helpers/envelope-fixtures';

const mockDurable = hasDurableDatastore as jest.Mock;
const key1 = Buffer.alloc(32, 11).toString('base64');
const key2 = Buffer.alloc(32, 22).toString('base64');

let logSpy: jest.SpyInstance;

beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  process.env.SHIORA_DATA_ENCRYPTION_KEY = key1;
  delete process.env.SHIORA_DATA_ENCRYPTION_KEY_VERSION;
  delete process.env.SHIORA_DATA_ENCRYPTION_KEY_V1;
  clearTransitEnv();
  __resetDekWrapperForTests();
  __resetKeyProviderForTests();
});

afterEach(() => {
  logSpy.mockRestore();
  ['SHIORA_DATA_ENCRYPTION_KEY', 'SHIORA_DATA_ENCRYPTION_KEY_VERSION', 'SHIORA_DATA_ENCRYPTION_KEY_V1']
    .forEach((k) => delete process.env[k]);
  clearTransitEnv();
  __resetDekWrapperForTests();
  __resetKeyProviderForTests();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

async function seededDoc(collection: string, owner: string, id: string, secret: string): Promise<StoredDocument> {
  return {
    collection, ownerKey: owner, id,
    sealed: await sealJson({ id, secret }, documentAad(collection, owner, id)),
    deleted: false,
  };
}

async function seededRecord(owner: string, id: string, label: string): Promise<StoredRecord> {
  return {
    id, ownerAddress: owner, type: 'lab', date: 1, uploadDate: 1, cid: 'c', txHash: 't',
    attestation: 'a', size: 1, provider: 'p', status: 'Verified', ipfsNodes: 1, blockHeight: 1,
    encryption: 'AES-256-GCM',
    sealedPhi: await sealJson({ label, description: '', tags: [] }, recordPhiAad(owner, id)),
    deleted: false,
  };
}

function rotateToV2(): void {
  process.env.SHIORA_DATA_ENCRYPTION_KEY_VERSION = '2';
  process.env.SHIORA_DATA_ENCRYPTION_KEY = key2;
  process.env.SHIORA_DATA_ENCRYPTION_KEY_V1 = key1;
  __resetKeyProviderForTests();
}

describe('runKekReseal', () => {
  it('bounds each scan batch by a sane default', () => {
    expect(DEFAULT_RESEAL_BATCH).toBe(200);
  });

  it('re-seals every stale envelope under the current version, preserving plaintext', async () => {
    const documents = new InMemoryDocumentStore();
    const records = new InMemoryRecordStore();
    // Seal two docs + two records under v1.
    await documents.put(await seededDoc('consent', 'aeth1a', 'd1', 's1'));
    await documents.put(await seededDoc('vault-symptom', 'aeth1b', 'd2', 's2'));
    await records.put(await seededRecord('aeth1a', 'rec-1', 'BRCA1'));
    await records.put(await seededRecord('aeth1b', 'rec-2', 'Lipids'));

    rotateToV2();
    const report = await runKekReseal({ documents, records }, 1); // batch size 1 → multi-page

    expect(report).toMatchObject({
      durable: true, backend: 'local-kek', currentVersion: 2,
      documentsScanned: 2, documentsResealed: 2,
      recordsScanned: 2, recordsResealed: 2,
    });

    // Every row is now v2 and still opens to its original plaintext.
    const d1 = (await documents.findById('consent', 'aeth1a', 'd1'))!.sealed as SealedEnvelope;
    expect(d1.v).toBe(2);
    expect(JSON.parse(await openString(d1, documentAad('consent', 'aeth1a', 'd1'))).secret).toBe('s1');

    const r1 = (await records.findById('aeth1a', 'rec-1'))!.sealedPhi as SealedEnvelope;
    expect(r1.v).toBe(2);
    expect(JSON.parse(await openString(r1, recordPhiAad('aeth1a', 'rec-1'))).label).toBe('BRCA1');

    // The v1 key can now be retired: a re-run (default batch size) is a no-op.
    delete process.env.SHIORA_DATA_ENCRYPTION_KEY_V1;
    __resetKeyProviderForTests();
    const rerun = await runKekReseal({ documents, records }); // default DEFAULT_RESEAL_BATCH
    expect(rerun.documentsResealed).toBe(0);
    expect(rerun.recordsResealed).toBe(0);
  });

  it('skips shredded tombstones and already-current envelopes', async () => {
    const documents = new InMemoryDocumentStore();
    const records = new InMemoryRecordStore();
    await documents.put(await seededDoc('consent', 'aeth1a', 'd1', 's1')); // v1, will be stale
    await documents.put({ // a shred tombstone — nothing to re-seal
      collection: 'consent', ownerKey: 'aeth1a', id: 'gone',
      sealed: shredEnvelope(), deleted: true,
    });
    await records.put({ // shredded record
      ...await seededRecord('aeth1a', 'rec-gone', 'x'), sealedPhi: shredEnvelope(), deleted: true,
    });

    rotateToV2();
    const report = await runKekReseal({ documents, records });

    expect(report.documentsScanned).toBe(2);
    expect(report.documentsResealed).toBe(1); // only the non-shredded stale doc
    expect(report.recordsResealed).toBe(0);
    // The tombstone stays a tombstone.
    expect(isShredded((await documents.findById('consent', 'aeth1a', 'gone'))!.sealed)).toBe(true);
  });

  it('migrates legacy pre-adoption envelopes into the custody seam format at the same key version', async () => {
    const documents = new InMemoryDocumentStore();
    const records = new InMemoryRecordStore();
    await documents.put({
      collection: 'consent', ownerKey: 'aeth1a', id: 'old',
      sealed: sealLegacyJson({ id: 'old', secret: 'pre-seam' }, documentAad('consent', 'aeth1a', 'old')),
      deleted: false,
    });
    await documents.put(await seededDoc('consent', 'aeth1a', 'new', 's')); // already seam-format

    const report = await runKekReseal({ documents, records });
    expect(report.documentsResealed).toBe(1); // only the legacy row is rewritten

    const migrated = (await documents.findById('consent', 'aeth1a', 'old'))!.sealed as SealedEnvelope;
    expect(migrated.wrap).toBe('local-kek');
    expect(JSON.parse(await openString(migrated, documentAad('consent', 'aeth1a', 'old'))).secret).toBe('pre-seam');
  });

  it('migrates the corpus into Vault Transit custody after a cut-over', async () => {
    const documents = new InMemoryDocumentStore();
    const records = new InMemoryRecordStore();
    // Local-custody rows, sealed before Transit was configured.
    await documents.put(await seededDoc('consent', 'aeth1a', 'd1', 'secret-1'));
    await records.put(await seededRecord('aeth1a', 'rec-1', 'BRCA1'));

    configureTransitEnv();
    __resetDekWrapperForTests();
    installFakeTransit(4);

    const report = await runKekReseal({ documents, records });
    expect(report).toMatchObject({
      backend: 'vault-transit', currentVersion: 4,
      documentsResealed: 1, recordsResealed: 1,
    });

    // Every row is now Vault-wrapped and still opens to its original plaintext.
    const d1 = (await documents.findById('consent', 'aeth1a', 'd1'))!.sealed as SealedEnvelope;
    expect(d1.wrap).toBe('vault-transit');
    expect(d1.dek).toMatch(/^vault:v4:/);
    expect(JSON.parse(await openString(d1, documentAad('consent', 'aeth1a', 'd1'))).secret).toBe('secret-1');

    const r1 = (await records.findById('aeth1a', 'rec-1'))!.sealedPhi as SealedEnvelope;
    expect(r1.wrap).toBe('vault-transit');
    expect(JSON.parse(await openString(r1, recordPhiAad('aeth1a', 'rec-1'))).label).toBe('BRCA1');
  });
});

describe('runDurableKekReseal', () => {
  it('is a no-op on an in-memory deployment', async () => {
    mockDurable.mockReturnValue(false);
    const report = await runDurableKekReseal();
    expect(report).toMatchObject({
      durable: false, backend: 'local-kek', documentsResealed: 0, recordsResealed: 0,
    });
  });

  it('runs against the durable stores when a datastore is present', async () => {
    mockDurable.mockReturnValue(true);
    // getPgClient is mocked; Pg*Store.scanForReseal will query it → empty pages.
    const { getPgClient } = jest.requireMock('@/lib/persistence/sql-client');
    getPgClient.mockReturnValue({ query: jest.fn(async () => ({ rows: [] })) });

    const report = await runDurableKekReseal();
    expect(report.durable).toBe(true);
    expect(report.documentsScanned).toBe(0);
    expect(report.recordsScanned).toBe(0);
  });
});
