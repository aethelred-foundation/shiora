/** @jest-environment node */

jest.mock('@/lib/api/preflight', () => ({ hasDurableDatastore: jest.fn(() => false) }));
jest.mock('@/lib/persistence/sql-client', () => ({ getPgClient: jest.fn() }));

import { runRetention, runDurableRetention, retentionDays } from '@/lib/maintenance/retention';
import { InMemoryDocumentStore, type StoredDocument } from '@/lib/persistence/document-store';
import { InMemoryRecordStore, type StoredRecord } from '@/lib/persistence/record-store';
import { documentAad } from '@/lib/persistence/encrypted-documents';
import { recordPhiAad } from '@/lib/persistence/encrypted-records';
import { sealJson, isShredded, shredEnvelope } from '@/lib/crypto/envelope';
import { hasDurableDatastore } from '@/lib/api/preflight';

const mockDurable = hasDurableDatastore as jest.Mock;
const DAY = 24 * 60 * 60 * 1000;
const NOW = 2_000_000_000_000;

let logSpy: jest.SpyInstance;

beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  delete process.env.SHIORA_RETENTION_DAYS;
});
afterEach(() => {
  logSpy.mockRestore();
  delete process.env.SHIORA_RETENTION_DAYS;
  jest.clearAllMocks();
});

function doc(id: string, over: Partial<StoredDocument> = {}): StoredDocument {
  return {
    collection: 'consent', ownerKey: 'aeth1a', id,
    sealed: sealJson({ id, secret: 's' }, documentAad('consent', 'aeth1a', id)),
    deleted: false, ...over,
  };
}
function rec(id: string, over: Partial<StoredRecord> = {}): StoredRecord {
  return {
    id, ownerAddress: 'aeth1a', type: 'lab', date: 1, uploadDate: 1, cid: '', txHash: '',
    attestation: '', size: 1, provider: 'p', status: 'Verified', ipfsNodes: 1, blockHeight: 1,
    encryption: 'AES-256-GCM',
    sealedPhi: sealJson({ label: 'L', description: '', tags: [] }, recordPhiAad('aeth1a', id)),
    deleted: false, ...over,
  };
}

describe('retentionDays', () => {
  it('parses a positive integer, else null (disabled)', () => {
    process.env.SHIORA_RETENTION_DAYS = '90';
    expect(retentionDays()).toBe(90);
    process.env.SHIORA_RETENTION_DAYS = '0';
    expect(retentionDays()).toBeNull();
    process.env.SHIORA_RETENTION_DAYS = 'nope';
    expect(retentionDays()).toBeNull();
    delete process.env.SHIORA_RETENTION_DAYS;
    expect(retentionDays()).toBeNull();
  });
});

describe('runRetention', () => {
  it('crypto-shreds rows soft-deleted before the cutoff, keeping recent and live ones', async () => {
    const documents = new InMemoryDocumentStore();
    const records = new InMemoryRecordStore();

    await documents.put(doc('old', { deleted: true, deletedAt: NOW - 100 * DAY })); // purge
    await documents.put(doc('recent', { deleted: true, deletedAt: NOW - 10 * DAY })); // keep (within window)
    await documents.put(doc('live')); // not deleted → keep
    await documents.put(doc('already', { deleted: true, deletedAt: NOW - 100 * DAY, sealed: shredEnvelope() })); // already shredded
    await records.put(rec('old-rec', { deleted: true, deletedAt: NOW - 100 * DAY })); // purge
    await records.put(rec('recent-rec', { deleted: true, deletedAt: NOW - 5 * DAY })); // keep
    await records.put(rec('live-rec')); // not deleted → keep
    await records.put(rec('legacy-rec', { deleted: true })); // no deletedAt → keep
    await records.put(rec('shredded-rec', { deleted: true, deletedAt: NOW - 100 * DAY, sealedPhi: shredEnvelope() }));

    const report = await runRetention({ documents, records }, 90, NOW);

    expect(report).toMatchObject({ retentionDays: 90, documentsPurged: 1, recordsPurged: 1 });
    expect(isShredded((await documents.findById('consent', 'aeth1a', 'old'))!.sealed)).toBe(true);
    expect(isShredded((await documents.findById('consent', 'aeth1a', 'recent'))!.sealed)).toBe(false);
    expect(isShredded((await documents.findById('consent', 'aeth1a', 'live'))!.sealed)).toBe(false);
    expect(isShredded((await records.findById('aeth1a', 'old-rec'))!.sealedPhi)).toBe(true);
  });

  it('defaults the window from SHIORA_RETENTION_DAYS when not passed', async () => {
    const documents = new InMemoryDocumentStore();
    const records = new InMemoryRecordStore();
    await documents.put(doc('old', { deleted: true, deletedAt: 1 })); // ancient
    process.env.SHIORA_RETENTION_DAYS = '30';
    const report = await runRetention({ documents, records }); // days/now/batch default
    expect(report.retentionDays).toBe(30);
    expect(report.documentsPurged).toBe(1);
  });

  it('is a no-op when retention is disabled (days null)', async () => {
    const documents = new InMemoryDocumentStore();
    const records = new InMemoryRecordStore();
    await documents.put(doc('old', { deleted: true, deletedAt: NOW - 999 * DAY }));

    const report = await runRetention({ documents, records }, null, NOW);
    expect(report).toMatchObject({ retentionDays: null, documentsPurged: 0, recordsPurged: 0 });
    expect(isShredded((await documents.findById('consent', 'aeth1a', 'old'))!.sealed)).toBe(false);
  });

  it('skips soft-deleted rows with no deletedAt (legacy)', async () => {
    const documents = new InMemoryDocumentStore();
    const records = new InMemoryRecordStore();
    await documents.put(doc('legacy', { deleted: true })); // no deletedAt

    const report = await runRetention({ documents, records }, 1, NOW);
    expect(report.documentsPurged).toBe(0);
  });
});

describe('runDurableRetention', () => {
  it('is a no-op on an in-memory deployment', async () => {
    mockDurable.mockReturnValue(false);
    process.env.SHIORA_RETENTION_DAYS = '30';
    const report = await runDurableRetention();
    expect(report).toMatchObject({ durable: false, retentionDays: 30, documentsPurged: 0 });
  });

  it('runs against durable stores when present', async () => {
    mockDurable.mockReturnValue(true);
    process.env.SHIORA_RETENTION_DAYS = '30';
    const { getPgClient } = jest.requireMock('@/lib/persistence/sql-client');
    getPgClient.mockReturnValue({ query: jest.fn(async () => ({ rows: [] })) });

    const report = await runDurableRetention();
    expect(report.durable).toBe(true);
    expect(report.documentsPurged).toBe(0);
  });
});
