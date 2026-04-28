/** @jest-environment node */

import fs from 'node:fs';
import path from 'node:path';

import { Pool } from 'pg';

import type { ConsentGrant, DataListing } from '@/types';
import type { MockAccessGrant, MockHealthRecord } from '@/lib/api/mock-data';
import {
  __closePostgresStorePoolForTests,
  createAccessGrant,
  createConsent,
  createMarketplaceListing,
  createRecord,
  getMarketplaceListing,
  getRecord,
  listAccessGrants,
  listMarketplaceListings,
  updateAccessGrant,
  updateConsent,
  updateMarketplaceListing,
  updateRecord,
} from '@/lib/api/postgres-store';
import { buildMarketplaceListingFromInput } from '@/lib/api/store';
import { seededAddress } from '@/lib/utils';

const shouldRun =
  process.env.SHIORA_RUN_POSTGRES_INTEGRATION === 'true' && !!process.env.DATABASE_URL;
const describePostgres = shouldRun ? describe : describe.skip;
const APP_ROLE = 'shiora_app_integration';
const APP_PASSWORD = 'shiora_app_integration_password';

jest.setTimeout(30_000);

function hex(byte: string): string {
  return `0x${byte.repeat(64)}`;
}

async function resetDatabase(pool: Pool): Promise<void> {
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
        EXECUTE 'DROP OWNED BY ${APP_ROLE}';
        EXECUTE 'DROP ROLE ${APP_ROLE}';
      END IF;
    END
    $$;

    DROP TABLE IF EXISTS shiora_store_audit_log CASCADE;
    DROP TABLE IF EXISTS shiora_marketplace_listings CASCADE;
    DROP TABLE IF EXISTS shiora_consent_grants CASCADE;
    DROP TABLE IF EXISTS shiora_access_grants CASCADE;
    DROP TABLE IF EXISTS shiora_health_records CASCADE;
    DROP TABLE IF EXISTS shiora_schema_migrations CASCADE;
    DROP FUNCTION IF EXISTS shiora_guard_marketplace_listing_update() CASCADE;
    DROP FUNCTION IF EXISTS shiora_current_wallet() CASCADE;
    DROP FUNCTION IF EXISTS shiora_is_admin() CASCADE;
  `);

  const migration = fs.readFileSync(
    path.join(process.cwd(), 'db/migrations/001_shiora_core_store.sql'),
    'utf8',
  );
  await pool.query(migration);
}

async function provisionAppRole(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE ROLE ${APP_ROLE}
      LOGIN
      PASSWORD '${APP_PASSWORD}'
      NOSUPERUSER
      NOBYPASSRLS
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT;

    GRANT USAGE ON SCHEMA public TO ${APP_ROLE};
    GRANT SELECT, INSERT, UPDATE ON
      shiora_health_records,
      shiora_access_grants,
      shiora_consent_grants,
      shiora_marketplace_listings,
      shiora_store_audit_log
    TO ${APP_ROLE};
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_ROLE};
  `);
}

async function seedRlsControlRecord(pool: Pool, owner: string): Promise<void> {
  await pool.query(
    `INSERT INTO shiora_health_records (
      id,
      owner_address,
      record_type,
      provider,
      encrypted,
      encryption,
      cid,
      tx_hash,
      attestation,
      status,
      tags,
      deleted,
      payload
    ) VALUES (
      'rec-rls-control',
      $1,
      'lab_result',
      'RLS Control',
      TRUE,
      'AES-256-GCM',
      'QmRlsControl',
      $2,
      $3,
      'Verified',
      ARRAY['control']::TEXT[],
      FALSE,
      '{}'::JSONB
    )`,
    [owner, hex('1'), hex('2')],
  );
}

function appRoleDatabaseUrl(adminUrl: string): string {
  const url = new URL(adminUrl);
  url.username = APP_ROLE;
  url.password = APP_PASSWORD;
  return url.toString();
}

describePostgres('postgres-store integration', () => {
  let pool: Pool;
  let originalDatabaseUrl: string | undefined;
  const owner = seededAddress(40404);
  const provider = seededAddress(50505);
  const buyer = seededAddress(60606);

  beforeAll(async () => {
    originalDatabaseUrl = process.env.DATABASE_URL;
    pool = new Pool({ connectionString: originalDatabaseUrl });
    await resetDatabase(pool);
    await seedRlsControlRecord(pool, owner);
    await provisionAppRole(pool);
    process.env.DATABASE_URL = appRoleDatabaseUrl(originalDatabaseUrl!);
  });

  afterAll(async () => {
    await __closePostgresStorePoolForTests();
    process.env.DATABASE_URL = originalDatabaseUrl;
    await pool.end();
  });

  it('uses a non-superuser app role so row-level security is enforced', async () => {
    const appPool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const role = await appPool.query<{
        rolsuper: boolean;
        rolbypassrls: boolean;
      }>('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user');
      expect(role.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });

      const rls = await appPool.query<{ forced_rls_tables: number }>(
        `SELECT count(*)::int AS forced_rls_tables
         FROM pg_class
         WHERE relname IN (
           'shiora_health_records',
           'shiora_access_grants',
           'shiora_consent_grants',
           'shiora_marketplace_listings',
           'shiora_store_audit_log'
         )
         AND relforcerowsecurity = true`,
      );
      expect(rls.rows[0].forced_rls_tables).toBe(5);

      const bypassAttempt = await appPool.query(
        'SELECT id FROM shiora_health_records WHERE owner_address = $1',
        [owner],
      );
      expect(bypassAttempt.rows).toEqual([]);

      await appPool.query('BEGIN');
      try {
        await appPool.query('SELECT set_config($1, $2, true)', [
          'app.wallet_address',
          owner.toLowerCase(),
        ]);
        await appPool.query('SELECT set_config($1, $2, true)', ['app.is_admin', 'false']);
        const scopedRead = await appPool.query(
          'SELECT id FROM shiora_health_records WHERE owner_address = $1',
          [owner],
        );
        expect(scopedRead.rows).toEqual([{ id: 'rec-rls-control' }]);
        await appPool.query('COMMIT');
      } catch (error) {
        await appPool.query('ROLLBACK');
        throw error;
      }
    } finally {
      await appPool.end();
    }
  });

  it('persists records without plaintext labels/descriptions and writes sanitized audit rows', async () => {
    const record: MockHealthRecord = {
      id: 'rec-live-postgres-1',
      type: 'lab_result',
      label: 'Sensitive oncology panel',
      description: 'Plaintext clinical details must not persist.',
      provider: 'Aethelred Clinic',
      date: 1_700_001_000_000,
      uploadDate: 1_700_001_100_000,
      encrypted: true,
      encryption: 'AES-256-GCM',
      cid: 'QmLivePostgresRecord',
      txHash: hex('a'),
      attestation: hex('b'),
      size: 8192,
      status: 'Verified',
      ipfsNodes: 3,
      tags: ['lab'],
      deleted: false,
      ownerAddress: owner,
      blockHeight: 123456,
    };

    await createRecord(owner, record);
    await updateRecord(owner, record.id, {
      label: 'Updated sensitive label',
      description: 'Updated sensitive description',
      status: 'Pinned',
    });

    const persisted = await getRecord(owner, record.id);
    expect(persisted?.label).toBe('Encrypted lab result record');
    expect(persisted?.description).not.toContain('Plaintext clinical');
    expect(persisted?.status).toBe('Pinned');

    const rows = await pool.query('SELECT payload FROM shiora_health_records WHERE id = $1', [
      record.id,
    ]);
    expect(JSON.stringify(rows.rows[0].payload)).not.toContain(record.label);
    expect(JSON.stringify(rows.rows[0].payload)).not.toContain(record.description);

    const audit = await pool.query(
      'SELECT changed_fields, previous_hash, entry_hash FROM shiora_store_audit_log WHERE entity_id = $1 ORDER BY sequence ASC',
      [record.id],
    );
    expect(audit.rows).toHaveLength(2);
    expect(audit.rows[1].changed_fields).not.toContain('label');
    expect(audit.rows[1].changed_fields).not.toContain('description');
    expect(audit.rows[1].previous_hash).toBe(audit.rows[0].entry_hash);
  });

  it('persists access grants and consent revocation through wallet-scoped RLS', async () => {
    const grant: MockAccessGrant = {
      id: 'grant-live-postgres-1',
      provider: 'Verified Hospital',
      specialty: 'Cardiology',
      address: provider,
      status: 'Pending',
      scope: 'Full Records',
      grantedAt: Date.now(),
      expiresAt: Date.now() + 86_400_000,
      lastAccess: null,
      accessCount: 0,
      txHash: hex('c'),
      attestation: hex('d'),
      canView: true,
      canDownload: false,
      canShare: false,
      ownerAddress: owner,
    };

    await createAccessGrant(owner, grant);
    const activeGrant = await updateAccessGrant(owner, grant.id, { status: 'Active' });
    const grants = await listAccessGrants(owner);
    expect(activeGrant?.status).toBe('Active');
    expect(grants.map((entry) => entry.id)).toContain(grant.id);

    const consent: ConsentGrant = {
      id: 'consent-live-postgres-1',
      patientAddress: owner,
      providerAddress: provider,
      providerName: 'Verified Hospital',
      scopes: ['lab_results'],
      status: 'active',
      grantedAt: Date.now(),
      expiresAt: Date.now() + 86_400_000,
      txHash: hex('e'),
      attestation: hex('f'),
      policyId: 'policy-live-postgres',
      autoRenew: false,
    };

    await createConsent(owner, consent);
    const revoked = await updateConsent(owner, consent.id, {
      status: 'revoked',
      revokedAt: Date.now(),
    });

    expect(revoked?.status).toBe('revoked');
    expect(revoked?.revokedAt).toBeDefined();
  });

  it('allows constrained buyer purchases but rejects non-seller listing tampering', async () => {
    const listing: DataListing = buildMarketplaceListingFromInput({
      seller: owner,
      category: 'vitals_timeseries',
      title: 'Live Postgres Vitals Cohort',
      description: 'An anonymized vitals cohort',
      price: 42,
      expirationDays: 30,
      anonymizationLevel: 'differential-privacy',
    });
    listing.id = 'listing-live-postgres-1';

    await createMarketplaceListing(listing);
    await expect(
      updateMarketplaceListing(listing.id, { title: 'tampered' }, buyer),
    ).rejects.toThrow();

    const purchased = await updateMarketplaceListing(
      listing.id,
      { status: 'sold', purchaseCount: listing.purchaseCount + 1 },
      buyer,
    );
    expect(purchased?.status).toBe('sold');

    const publicListings = await listMarketplaceListings();
    expect(publicListings.map((entry) => entry.id)).not.toContain(listing.id);
    expect(await getMarketplaceListing(listing.id)).toBeUndefined();
    expect((await getMarketplaceListing(listing.id, owner))?.status).toBe('sold');
  });
});
