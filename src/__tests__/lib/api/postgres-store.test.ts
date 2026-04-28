/** @jest-environment node */

import type { QueryResult, QueryResultRow } from 'pg';

import {
  __setPostgresStoreClientForTests,
  createRecord,
  updateMarketplaceListing,
} from '@/lib/api/postgres-store';
import type { MockHealthRecord } from '@/lib/api/mock-data';
import { seededAddress } from '@/lib/utils';

type CapturedQuery = {
  text: string;
  values?: readonly unknown[];
};

function result<T extends QueryResultRow>(rows: T[]): QueryResult<T> {
  return {
    command: 'SELECT',
    rowCount: rows.length,
    oid: 0,
    fields: [],
    rows,
  };
}

function marketplaceListingRow(overrides: QueryResultRow = {}): QueryResultRow {
  return {
    id: 'listing-postgres-1',
    seller_address: seededAddress(30303),
    seller_reputation: 95,
    category: 'vitals_timeseries',
    title: 'Synthetic Vitals',
    description: 'An anonymized vitals cohort',
    data_points: 1200,
    date_range_start: 1,
    date_range_end: 2,
    quality_score: 91,
    anonymization_level: 'differential-privacy',
    price: '42.5',
    currency: 'AETHEL',
    status: 'active',
    tee_verified: true,
    attestation: 'attestation',
    created_at_epoch: 10,
    expires_at_epoch: 20,
    purchase_count: 3,
    ...overrides,
  };
}

describe('postgres-store', () => {
  const owner = seededAddress(30303);
  const queries: CapturedQuery[] = [];

  const client = {
    async query<T extends QueryResultRow>(
      text: string,
      values?: readonly unknown[],
    ): Promise<QueryResult<T>> {
      queries.push({ text, values });

      if (text.includes('INSERT INTO shiora_health_records')) {
        return result([
          {
            id: values?.[0],
            owner_address: values?.[1],
            record_type: values?.[2],
            provider: values?.[3],
            encrypted: values?.[4],
            encryption: values?.[5],
            cid: values?.[6],
            tx_hash: values?.[7],
            attestation: values?.[8],
            status: values?.[9],
            tags: values?.[10],
            deleted: values?.[11],
            payload: values?.[12],
            created_at: new Date(0),
          },
        ] as T[]);
      }

      if (text.includes('SELECT entry_hash FROM shiora_store_audit_log')) {
        return result([] as T[]);
      }

      if (text.includes('SELECT * FROM shiora_marketplace_listings')) {
        return result([marketplaceListingRow() as T]);
      }

      if (text.includes('UPDATE shiora_marketplace_listings')) {
        return {
          ...result([] as T[]),
          command: 'UPDATE',
          rowCount: 1,
        };
      }

      return result([] as T[]);
    },
  };

  beforeEach(() => {
    queries.length = 0;
    __setPostgresStoreClientForTests(client);
  });

  afterEach(() => {
    __setPostgresStoreClientForTests(null);
  });

  it('stores health record routing metadata without plaintext labels or descriptions', async () => {
    const record: MockHealthRecord = {
      id: 'rec-postgres-phi',
      type: 'lab_result',
      label: 'Sensitive oncology marker panel',
      description: 'Patient diagnosis details must not be stored as plaintext.',
      provider: 'Zero Knowledge Clinic',
      date: 1_700_000_000_000,
      uploadDate: 1_700_000_100_000,
      encrypted: true,
      encryption: 'AES-256-GCM',
      cid: 'QmEncryptedRecord',
      txHash: `0x${'aa'.repeat(32)}`,
      attestation: `0x${'bb'.repeat(32)}`,
      size: 4096,
      status: 'Verified',
      ipfsNodes: 3,
      tags: ['lab'],
      deleted: false,
      ownerAddress: owner,
      blockHeight: 12345,
    };

    const created = await createRecord(owner, record);

    expect(created.id).toBe(record.id);
    expect(created.label).not.toContain('Sensitive oncology');
    expect(created.description).not.toContain('Patient diagnosis');

    const insert = queries.find((query) =>
      query.text.includes('INSERT INTO shiora_health_records'),
    );
    expect(insert).toBeDefined();
    expect(JSON.stringify(insert!.values?.[12])).not.toContain(record.label);
    expect(JSON.stringify(insert!.values?.[12])).not.toContain(record.description);

    const auditInsert = queries.find((query) =>
      query.text.includes('INSERT INTO shiora_store_audit_log'),
    );
    expect(auditInsert).toBeDefined();
    expect(auditInsert!.values?.[4]).not.toContain('label');
    expect(auditInsert!.values?.[4]).not.toContain('description');
  });

  it('applies wallet-scoped RLS session settings before marketplace updates', async () => {
    const updated = await updateMarketplaceListing(
      'listing-postgres-1',
      { status: 'withdrawn' },
      owner,
    );

    expect(updated?.status).toBe('withdrawn');
    expect(queries[0]).toMatchObject({
      text: 'SELECT set_config($1, $2, true)',
      values: ['app.wallet_address', owner.toLowerCase()],
    });
    expect(queries[1]).toMatchObject({
      text: 'SELECT set_config($1, $2, true)',
      values: ['app.is_admin', 'false'],
    });
    expect(
      queries.some(
        (query) =>
          query.text.includes('UPDATE shiora_marketplace_listings') &&
          query.text.includes('RETURNING'),
      ),
    ).toBe(false);
  });
});
