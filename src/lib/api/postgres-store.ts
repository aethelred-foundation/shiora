import crypto from 'node:crypto';

import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

import type { ConsentGrant, DataListing, ListingStatus, MarketplaceCategory } from '@/types';
import type { MockAccessGrant, MockHealthRecord } from '@/lib/api/mock-data';
import { serverEnv } from '@/lib/api/env';

type StoreAuditOperation =
  | 'record.create'
  | 'record.update'
  | 'record.delete'
  | 'accessGrant.create'
  | 'accessGrant.update'
  | 'consent.create'
  | 'consent.update'
  | 'marketplace.create'
  | 'marketplace.update';

type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<T>>;
};

const STORE_AUDIT_SCHEMA_VERSION = 1;
const STORE_AUDIT_GENESIS_HASH = crypto
  .createHash('sha256')
  .update('shiora-store-audit-genesis-v1')
  .digest('hex');

const PHI_FIELD_NAMES = new Set(['description', 'label', 'notes', 'patientName']);

const globalPool = globalThis as typeof globalThis & {
  __SHIORA_POSTGRES_POOL__?: Pool;
};

let testClient: Queryable | null = null;

export function __setPostgresStoreClientForTests(client: Queryable | null): void {
  testClient = client;
}

export async function __closePostgresStorePoolForTests(): Promise<void> {
  if (globalPool.__SHIORA_POSTGRES_POOL__) {
    await globalPool.__SHIORA_POSTGRES_POOL__.end();
    delete globalPool.__SHIORA_POSTGRES_POOL__;
  }
}

function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required when SHIORA_STORE_BACKEND=postgres.');
  }

  if (!globalPool.__SHIORA_POSTGRES_POOL__) {
    globalPool.__SHIORA_POSTGRES_POOL__ = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.SHIORA_PG_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl:
        process.env.PGSSLMODE === 'disable'
          ? false
          : process.env.PGSSLMODE === 'require'
            ? { rejectUnauthorized: true }
            : undefined,
    });
  }

  return globalPool.__SHIORA_POSTGRES_POOL__;
}

function isAdminWallet(walletAddress?: string | null): boolean {
  if (!walletAddress) return false;
  return serverEnv.adminWallets.includes(walletAddress.toLowerCase());
}

async function applyRlsSession(client: Queryable, walletAddress?: string | null): Promise<void> {
  await client.query('SELECT set_config($1, $2, true)', [
    'app.wallet_address',
    walletAddress?.toLowerCase() ?? '',
  ]);
  await client.query('SELECT set_config($1, $2, true)', [
    'app.is_admin',
    String(isAdminWallet(walletAddress)),
  ]);
}

async function withStoreSession<T>(
  walletAddress: string | null | undefined,
  work: (client: Queryable) => Promise<T>,
): Promise<T> {
  if (testClient) {
    await applyRlsSession(testClient, walletAddress);
    return work(testClient);
  }

  const client: PoolClient = await getPool().connect();
  try {
    await client.query('BEGIN');
    await applyRlsSession(client, walletAddress);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function sanitizeChangedFields(fields: string[]): string[] {
  const sanitized = Array.from(
    new Set(fields.filter((field) => !PHI_FIELD_NAMES.has(field))),
  ).sort();
  return sanitized.length > 0 ? sanitized : ['encryptedMetadata'];
}

function hashAuditPayload(payload: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function appendAuditEntry(
  client: Queryable,
  input: {
    operation: StoreAuditOperation;
    ownerAddress?: string;
    entityId: string;
    changedFields: string[];
    txHash?: string | null;
  },
): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('shiora_store_audit_log'))");
  const previous = await client.query<{ entry_hash: string }>(
    'SELECT entry_hash FROM shiora_store_audit_log ORDER BY sequence DESC LIMIT 1',
  );
  const previousHash = previous.rows[0]?.entry_hash ?? STORE_AUDIT_GENESIS_HASH;
  const changedFields = sanitizeChangedFields(input.changedFields);
  const payload = {
    schemaVersion: STORE_AUDIT_SCHEMA_VERSION,
    operation: input.operation,
    ownerAddress: input.ownerAddress,
    entityId: input.entityId,
    changedFields,
    txHash: input.txHash ?? undefined,
    previousHash,
  };
  const entryHash = hashAuditPayload(payload);

  await client.query(
    `INSERT INTO shiora_store_audit_log (
      schema_version,
      operation,
      owner_address,
      entity_id,
      changed_fields,
      tx_hash,
      previous_hash,
      entry_hash
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      STORE_AUDIT_SCHEMA_VERSION,
      input.operation,
      input.ownerAddress ?? null,
      input.entityId,
      changedFields,
      input.txHash ?? null,
      previousHash,
      entryHash,
    ],
  );
}

interface HealthRecordRow extends QueryResultRow {
  id: string;
  owner_address: string;
  record_type: string;
  provider: string | null;
  encrypted: boolean;
  encryption: string;
  cid: string | null;
  tx_hash: string | null;
  attestation: string | null;
  status: string;
  tags: string[];
  deleted: boolean;
  payload: {
    date?: number;
    uploadDate?: number;
    size?: number;
    ipfsNodes?: number;
    blockHeight?: number;
  } | null;
  created_at: Date | string;
}

function rowTimestamp(row: { created_at: Date | string }): number {
  return row.created_at instanceof Date
    ? row.created_at.getTime()
    : new Date(row.created_at).getTime();
}

function healthRecordFromRow(row: HealthRecordRow): MockHealthRecord {
  const payload = row.payload ?? {};
  const createdAt = rowTimestamp(row);
  return {
    id: row.id,
    type: row.record_type,
    label: `Encrypted ${row.record_type.replace(/_/g, ' ')} record`,
    description:
      'Encrypted record metadata is retained client-side; server stores routing data only.',
    date: payload.date ?? createdAt,
    uploadDate: payload.uploadDate ?? createdAt,
    encrypted: row.encrypted,
    encryption: row.encryption,
    cid: row.cid ?? '',
    txHash: row.tx_hash ?? '',
    attestation: row.attestation ?? '',
    size: payload.size ?? 0,
    provider: row.provider ?? 'Encrypted provider',
    status: row.status as MockHealthRecord['status'],
    ipfsNodes: payload.ipfsNodes ?? 0,
    tags: row.tags ?? [],
    deleted: row.deleted,
    ownerAddress: row.owner_address,
    blockHeight: payload.blockHeight ?? 0,
  };
}

function recordPayload(record: MockHealthRecord): HealthRecordRow['payload'] {
  return {
    date: record.date,
    uploadDate: record.uploadDate,
    size: record.size,
    ipfsNodes: record.ipfsNodes,
    blockHeight: record.blockHeight,
  };
}

export async function listRecords(ownerAddress: string): Promise<MockHealthRecord[]> {
  return withStoreSession(ownerAddress, async (client) => {
    const result = await client.query<HealthRecordRow>(
      `SELECT *
       FROM shiora_health_records
       WHERE lower(owner_address) = lower($1) AND deleted = FALSE
       ORDER BY updated_at DESC`,
      [ownerAddress],
    );
    return result.rows.map(healthRecordFromRow);
  });
}

export async function getRecord(
  ownerAddress: string,
  id: string,
): Promise<MockHealthRecord | undefined> {
  return withStoreSession(ownerAddress, async (client) => {
    const result = await client.query<HealthRecordRow>(
      `SELECT *
       FROM shiora_health_records
       WHERE id = $1 AND lower(owner_address) = lower($2) AND deleted = FALSE
       LIMIT 1`,
      [id, ownerAddress],
    );
    return result.rows[0] ? healthRecordFromRow(result.rows[0]) : undefined;
  });
}

export async function createRecord(
  ownerAddress: string,
  record: MockHealthRecord,
): Promise<MockHealthRecord> {
  return withStoreSession(ownerAddress, async (client) => {
    const result = await client.query<HealthRecordRow>(
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        record.id,
        ownerAddress,
        record.type,
        record.provider,
        record.encrypted,
        record.encryption,
        record.cid,
        record.txHash,
        record.attestation,
        record.status,
        record.tags,
        record.deleted,
        recordPayload(record),
      ],
    );

    await appendAuditEntry(client, {
      operation: 'record.create',
      ownerAddress,
      entityId: record.id,
      changedFields: Object.keys(record),
      txHash: record.txHash,
    });

    return healthRecordFromRow(result.rows[0]);
  });
}

export async function updateRecord(
  ownerAddress: string,
  id: string,
  updates: Partial<MockHealthRecord>,
  auditOperation: StoreAuditOperation = 'record.update',
): Promise<MockHealthRecord | undefined> {
  return withStoreSession(ownerAddress, async (client) => {
    const setClauses = ['updated_at = now()'];
    const values: unknown[] = [];

    function setColumn(column: string, value: unknown): void {
      values.push(value);
      setClauses.push(`${column} = $${values.length}`);
    }

    if (updates.status !== undefined) setColumn('status', updates.status);
    if (updates.tags !== undefined) setColumn('tags', updates.tags);
    if (updates.deleted !== undefined) setColumn('deleted', updates.deleted);
    if (updates.provider !== undefined) setColumn('provider', updates.provider);
    if (updates.encryption !== undefined) setColumn('encryption', updates.encryption);
    if (updates.cid !== undefined) setColumn('cid', updates.cid);
    if (updates.txHash !== undefined) setColumn('tx_hash', updates.txHash);
    if (updates.attestation !== undefined) setColumn('attestation', updates.attestation);

    const payloadUpdates: HealthRecordRow['payload'] = {};
    if (updates.date !== undefined) payloadUpdates.date = updates.date;
    if (updates.uploadDate !== undefined) payloadUpdates.uploadDate = updates.uploadDate;
    if (updates.size !== undefined) payloadUpdates.size = updates.size;
    if (updates.ipfsNodes !== undefined) payloadUpdates.ipfsNodes = updates.ipfsNodes;
    if (updates.blockHeight !== undefined) payloadUpdates.blockHeight = updates.blockHeight;
    if (Object.keys(payloadUpdates).length > 0) {
      setColumn('payload', payloadUpdates);
    }

    values.push(id, ownerAddress);
    const result = await client.query<HealthRecordRow>(
      `UPDATE shiora_health_records
       SET ${setClauses.join(', ')}
       WHERE id = $${values.length - 1}
         AND lower(owner_address) = lower($${values.length})
         AND deleted = FALSE
       RETURNING *`,
      values,
    );

    const updated = result.rows[0];
    if (!updated) return undefined;

    await appendAuditEntry(client, {
      operation: auditOperation,
      ownerAddress,
      entityId: id,
      changedFields: Object.keys(updates),
      txHash: updated.tx_hash,
    });

    return healthRecordFromRow(updated);
  });
}

export async function softDeleteRecord(
  ownerAddress: string,
  id: string,
): Promise<MockHealthRecord | undefined> {
  return updateRecord(ownerAddress, id, { deleted: true }, 'record.delete');
}

interface AccessGrantRow extends QueryResultRow {
  id: string;
  owner_address: string;
  provider_address: string;
  provider_name: string | null;
  specialty: string | null;
  status: string;
  scope: string;
  granted_at: number | string;
  expires_at: number | string;
  last_access: number | string | null;
  access_count: number;
  can_view: boolean;
  can_download: boolean;
  can_share: boolean;
  tx_hash: string | null;
  attestation: string | null;
}

function toNumber(value: number | string | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  return typeof value === 'number' ? value : Number(value);
}

function accessGrantFromRow(row: AccessGrantRow): MockAccessGrant {
  return {
    id: row.id,
    provider: row.provider_name ?? 'Unknown provider',
    specialty: row.specialty ?? 'Unknown specialty',
    address: row.provider_address,
    status: row.status as MockAccessGrant['status'],
    scope: row.scope,
    grantedAt: toNumber(row.granted_at),
    expiresAt: toNumber(row.expires_at),
    lastAccess: row.last_access === null ? null : toNumber(row.last_access),
    accessCount: row.access_count,
    txHash: row.tx_hash ?? '',
    attestation: row.attestation ?? '',
    canView: row.can_view,
    canDownload: row.can_download,
    canShare: row.can_share,
    ownerAddress: row.owner_address,
  };
}

export async function listAccessGrants(ownerAddress: string): Promise<MockAccessGrant[]> {
  return withStoreSession(ownerAddress, async (client) => {
    const result = await client.query<AccessGrantRow>(
      `SELECT *
       FROM shiora_access_grants
       WHERE lower(owner_address) = lower($1)
       ORDER BY granted_at DESC`,
      [ownerAddress],
    );
    return result.rows.map(accessGrantFromRow);
  });
}

export async function getAccessGrant(
  ownerAddress: string,
  id: string,
): Promise<MockAccessGrant | undefined> {
  return withStoreSession(ownerAddress, async (client) => {
    const result = await client.query<AccessGrantRow>(
      `SELECT *
       FROM shiora_access_grants
       WHERE id = $1 AND lower(owner_address) = lower($2)
       LIMIT 1`,
      [id, ownerAddress],
    );
    return result.rows[0] ? accessGrantFromRow(result.rows[0]) : undefined;
  });
}

export async function createAccessGrant(
  ownerAddress: string,
  grant: MockAccessGrant,
): Promise<MockAccessGrant> {
  return withStoreSession(ownerAddress, async (client) => {
    const result = await client.query<AccessGrantRow>(
      `INSERT INTO shiora_access_grants (
        id,
        owner_address,
        provider_address,
        provider_name,
        specialty,
        status,
        scope,
        granted_at,
        expires_at,
        last_access,
        access_count,
        can_view,
        can_download,
        can_share,
        tx_hash,
        attestation
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        grant.id,
        ownerAddress,
        grant.address,
        grant.provider,
        grant.specialty,
        grant.status,
        grant.scope,
        grant.grantedAt,
        grant.expiresAt,
        grant.lastAccess,
        grant.accessCount,
        grant.canView,
        grant.canDownload,
        grant.canShare,
        grant.txHash,
        grant.attestation,
      ],
    );

    await appendAuditEntry(client, {
      operation: 'accessGrant.create',
      ownerAddress,
      entityId: grant.id,
      changedFields: Object.keys(grant),
      txHash: grant.txHash,
    });

    return accessGrantFromRow(result.rows[0]);
  });
}

export async function updateAccessGrant(
  ownerAddress: string,
  id: string,
  updates: Partial<MockAccessGrant>,
): Promise<MockAccessGrant | undefined> {
  return withStoreSession(ownerAddress, async (client) => {
    const setClauses = ['updated_at = now()'];
    const values: unknown[] = [];
    const columns: Array<[keyof MockAccessGrant, string]> = [
      ['provider', 'provider_name'],
      ['specialty', 'specialty'],
      ['address', 'provider_address'],
      ['status', 'status'],
      ['scope', 'scope'],
      ['expiresAt', 'expires_at'],
      ['lastAccess', 'last_access'],
      ['accessCount', 'access_count'],
      ['canView', 'can_view'],
      ['canDownload', 'can_download'],
      ['canShare', 'can_share'],
      ['txHash', 'tx_hash'],
      ['attestation', 'attestation'],
    ];

    for (const [key, column] of columns) {
      if (updates[key] !== undefined) {
        values.push(updates[key]);
        setClauses.push(`${column} = $${values.length}`);
      }
    }

    values.push(id, ownerAddress);
    const result = await client.query<AccessGrantRow>(
      `UPDATE shiora_access_grants
       SET ${setClauses.join(', ')}
       WHERE id = $${values.length - 1} AND lower(owner_address) = lower($${values.length})
       RETURNING *`,
      values,
    );

    const updated = result.rows[0];
    if (!updated) return undefined;

    await appendAuditEntry(client, {
      operation: 'accessGrant.update',
      ownerAddress,
      entityId: id,
      changedFields: Object.keys(updates),
      txHash: updated.tx_hash,
    });

    return accessGrantFromRow(updated);
  });
}

interface ConsentGrantRow extends QueryResultRow {
  id: string;
  patient_address: string;
  provider_address: string;
  provider_name: string | null;
  scopes: string[];
  status: string;
  granted_at: number | string;
  expires_at: number | string;
  revoked_at: number | string | null;
  tx_hash: string | null;
  attestation: string | null;
  policy_id: string;
  auto_renew: boolean;
}

function consentFromRow(row: ConsentGrantRow): ConsentGrant {
  return {
    id: row.id,
    patientAddress: row.patient_address,
    providerAddress: row.provider_address,
    providerName: row.provider_name ?? 'Unknown provider',
    scopes: row.scopes as ConsentGrant['scopes'],
    status: row.status as ConsentGrant['status'],
    grantedAt: toNumber(row.granted_at),
    expiresAt: toNumber(row.expires_at),
    revokedAt: row.revoked_at === null ? undefined : toNumber(row.revoked_at),
    txHash: row.tx_hash ?? '',
    attestation: row.attestation ?? '',
    policyId: row.policy_id,
    autoRenew: row.auto_renew,
  };
}

export async function listConsents(ownerAddress: string): Promise<ConsentGrant[]> {
  return withStoreSession(ownerAddress, async (client) => {
    const result = await client.query<ConsentGrantRow>(
      `SELECT *
       FROM shiora_consent_grants
       WHERE lower(patient_address) = lower($1)
       ORDER BY granted_at DESC`,
      [ownerAddress],
    );
    return result.rows.map(consentFromRow);
  });
}

export async function getConsent(
  ownerAddress: string,
  id: string,
): Promise<ConsentGrant | undefined> {
  return withStoreSession(ownerAddress, async (client) => {
    const result = await client.query<ConsentGrantRow>(
      `SELECT *
       FROM shiora_consent_grants
       WHERE id = $1 AND lower(patient_address) = lower($2)
       LIMIT 1`,
      [id, ownerAddress],
    );
    return result.rows[0] ? consentFromRow(result.rows[0]) : undefined;
  });
}

export async function createConsent(
  ownerAddress: string,
  consent: ConsentGrant,
): Promise<ConsentGrant> {
  return withStoreSession(ownerAddress, async (client) => {
    const result = await client.query<ConsentGrantRow>(
      `INSERT INTO shiora_consent_grants (
        id,
        patient_address,
        provider_address,
        provider_name,
        scopes,
        status,
        granted_at,
        expires_at,
        revoked_at,
        policy_id,
        auto_renew,
        tx_hash,
        attestation
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        consent.id,
        ownerAddress,
        consent.providerAddress,
        consent.providerName,
        consent.scopes,
        consent.status,
        consent.grantedAt,
        consent.expiresAt,
        consent.revokedAt ?? null,
        consent.policyId,
        consent.autoRenew,
        consent.txHash,
        consent.attestation,
      ],
    );

    await appendAuditEntry(client, {
      operation: 'consent.create',
      ownerAddress,
      entityId: consent.id,
      changedFields: Object.keys(consent),
      txHash: consent.txHash,
    });

    return consentFromRow(result.rows[0]);
  });
}

export async function updateConsent(
  ownerAddress: string,
  id: string,
  updates: Partial<ConsentGrant>,
): Promise<ConsentGrant | undefined> {
  return withStoreSession(ownerAddress, async (client) => {
    const setClauses = ['updated_at = now()'];
    const values: unknown[] = [];
    const columns: Array<[keyof ConsentGrant, string]> = [
      ['providerAddress', 'provider_address'],
      ['providerName', 'provider_name'],
      ['scopes', 'scopes'],
      ['status', 'status'],
      ['expiresAt', 'expires_at'],
      ['revokedAt', 'revoked_at'],
      ['policyId', 'policy_id'],
      ['autoRenew', 'auto_renew'],
      ['txHash', 'tx_hash'],
      ['attestation', 'attestation'],
    ];

    for (const [key, column] of columns) {
      if (updates[key] !== undefined) {
        values.push(updates[key]);
        setClauses.push(`${column} = $${values.length}`);
      }
    }

    values.push(id, ownerAddress);
    const result = await client.query<ConsentGrantRow>(
      `UPDATE shiora_consent_grants
       SET ${setClauses.join(', ')}
       WHERE id = $${values.length - 1} AND lower(patient_address) = lower($${values.length})
       RETURNING *`,
      values,
    );

    const updated = result.rows[0];
    if (!updated) return undefined;

    await appendAuditEntry(client, {
      operation: 'consent.update',
      ownerAddress,
      entityId: id,
      changedFields: Object.keys(updates),
      txHash: updated.tx_hash,
    });

    return consentFromRow(updated);
  });
}

interface MarketplaceListingRow extends QueryResultRow {
  id: string;
  seller_address: string;
  buyer_address: string | null;
  seller_reputation: number;
  category: string;
  title: string;
  description: string;
  data_points: number;
  date_range_start: number | string;
  date_range_end: number | string;
  quality_score: number;
  anonymization_level: string;
  price: number | string;
  currency: 'AETHEL';
  status: string;
  tee_verified: boolean;
  attestation: string | null;
  created_at_epoch: number | string;
  expires_at_epoch: number | string;
  purchase_count: number;
}

function listingFromRow(row: MarketplaceListingRow): DataListing {
  return {
    id: row.id,
    seller: row.seller_address,
    sellerReputation: row.seller_reputation,
    category: row.category as MarketplaceCategory,
    title: row.title,
    description: row.description,
    dataPoints: row.data_points,
    dateRange: {
      start: toNumber(row.date_range_start),
      end: toNumber(row.date_range_end),
    },
    qualityScore: row.quality_score,
    anonymizationLevel: row.anonymization_level as DataListing['anonymizationLevel'],
    price: Number(row.price),
    currency: row.currency,
    status: row.status as ListingStatus,
    teeVerified: row.tee_verified,
    attestation: row.attestation ?? '',
    createdAt: toNumber(row.created_at_epoch),
    expiresAt: toNumber(row.expires_at_epoch),
    purchaseCount: row.purchase_count,
  };
}

function applyMarketplaceListingUpdates(
  listing: DataListing,
  updates: Partial<DataListing>,
): DataListing {
  const nextListing: DataListing = {
    ...listing,
    dateRange: { ...listing.dateRange },
  };

  if (updates.sellerReputation !== undefined) {
    nextListing.sellerReputation = updates.sellerReputation;
  }
  if (updates.category !== undefined) nextListing.category = updates.category;
  if (updates.title !== undefined) nextListing.title = updates.title;
  if (updates.description !== undefined) nextListing.description = updates.description;
  if (updates.dataPoints !== undefined) nextListing.dataPoints = updates.dataPoints;
  if (updates.dateRange !== undefined) {
    nextListing.dateRange = { ...updates.dateRange };
  }
  if (updates.qualityScore !== undefined) nextListing.qualityScore = updates.qualityScore;
  if (updates.anonymizationLevel !== undefined) {
    nextListing.anonymizationLevel = updates.anonymizationLevel;
  }
  if (updates.price !== undefined) nextListing.price = updates.price;
  if (updates.status !== undefined) nextListing.status = updates.status;
  if (updates.teeVerified !== undefined) nextListing.teeVerified = updates.teeVerified;
  if (updates.attestation !== undefined) nextListing.attestation = updates.attestation;
  if (updates.expiresAt !== undefined) nextListing.expiresAt = updates.expiresAt;
  if (updates.purchaseCount !== undefined) nextListing.purchaseCount = updates.purchaseCount;

  return nextListing;
}

export async function listMarketplaceListings(walletAddress?: string): Promise<DataListing[]> {
  return withStoreSession(walletAddress, async (client) => {
    const result = await client.query<MarketplaceListingRow>(
      'SELECT * FROM shiora_marketplace_listings ORDER BY created_at_epoch DESC',
    );
    return result.rows.map(listingFromRow);
  });
}

export async function getMarketplaceListing(
  id: string,
  walletAddress?: string,
): Promise<DataListing | undefined> {
  return withStoreSession(walletAddress, async (client) => {
    const result = await client.query<MarketplaceListingRow>(
      'SELECT * FROM shiora_marketplace_listings WHERE id = $1 LIMIT 1',
      [id],
    );
    return result.rows[0] ? listingFromRow(result.rows[0]) : undefined;
  });
}

export async function createMarketplaceListing(listing: DataListing): Promise<DataListing> {
  return withStoreSession(listing.seller, async (client) => {
    const result = await client.query<MarketplaceListingRow>(
      `INSERT INTO shiora_marketplace_listings (
        id,
        seller_address,
        seller_reputation,
        category,
        title,
        description,
        data_points,
        date_range_start,
        date_range_end,
        quality_score,
        anonymization_level,
        price,
        currency,
        status,
        tee_verified,
        attestation,
        created_at_epoch,
        expires_at_epoch,
        purchase_count
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
      RETURNING *`,
      [
        listing.id,
        listing.seller,
        listing.sellerReputation,
        listing.category,
        listing.title,
        listing.description,
        listing.dataPoints,
        listing.dateRange.start,
        listing.dateRange.end,
        listing.qualityScore,
        listing.anonymizationLevel,
        listing.price,
        listing.currency,
        listing.status,
        listing.teeVerified,
        listing.attestation,
        listing.createdAt,
        listing.expiresAt,
        listing.purchaseCount,
      ],
    );

    await appendAuditEntry(client, {
      operation: 'marketplace.create',
      ownerAddress: listing.seller,
      entityId: listing.id,
      changedFields: Object.keys(listing),
    });

    return listingFromRow(result.rows[0]);
  });
}

export async function updateMarketplaceListing(
  id: string,
  updates: Partial<DataListing>,
  walletAddress?: string,
): Promise<DataListing | undefined> {
  return withStoreSession(walletAddress, async (client) => {
    const existingResult = await client.query<MarketplaceListingRow>(
      'SELECT * FROM shiora_marketplace_listings WHERE id = $1 LIMIT 1',
      [id],
    );
    const existing = existingResult.rows[0];
    if (!existing) return undefined;
    const currentWallet = walletAddress?.toLowerCase();
    const isBuyerPurchaseTransition =
      currentWallet !== undefined &&
      currentWallet !== existing.seller_address.toLowerCase() &&
      updates.status === 'sold' &&
      updates.purchaseCount === Number(existing.purchase_count) + 1 &&
      Object.keys(updates).every((field) => field === 'status' || field === 'purchaseCount');

    const setClauses = ['updated_at = now()'];
    const values: unknown[] = [];

    function setColumn(column: string, value: unknown): void {
      values.push(value);
      setClauses.push(`${column} = $${values.length}`);
    }

    if (updates.sellerReputation !== undefined) {
      setColumn('seller_reputation', updates.sellerReputation);
    }
    if (updates.category !== undefined) setColumn('category', updates.category);
    if (updates.title !== undefined) setColumn('title', updates.title);
    if (updates.description !== undefined) setColumn('description', updates.description);
    if (updates.dataPoints !== undefined) setColumn('data_points', updates.dataPoints);
    if (updates.dateRange !== undefined) {
      setColumn('date_range_start', updates.dateRange.start);
      setColumn('date_range_end', updates.dateRange.end);
    }
    if (updates.qualityScore !== undefined) setColumn('quality_score', updates.qualityScore);
    if (updates.anonymizationLevel !== undefined) {
      setColumn('anonymization_level', updates.anonymizationLevel);
    }
    if (updates.price !== undefined) setColumn('price', updates.price);
    if (updates.status !== undefined) setColumn('status', updates.status);
    if (updates.teeVerified !== undefined) setColumn('tee_verified', updates.teeVerified);
    if (updates.attestation !== undefined) setColumn('attestation', updates.attestation);
    if (updates.expiresAt !== undefined) setColumn('expires_at_epoch', updates.expiresAt);
    if (updates.purchaseCount !== undefined) setColumn('purchase_count', updates.purchaseCount);
    if (isBuyerPurchaseTransition) setColumn('buyer_address', currentWallet);

    values.push(id);
    const result = await client.query<MarketplaceListingRow>(
      `UPDATE shiora_marketplace_listings
       SET ${setClauses.join(', ')}
       WHERE id = $${values.length}`,
      values,
    );

    if (result.rowCount === 0) return undefined;

    await appendAuditEntry(client, {
      operation: 'marketplace.update',
      ownerAddress: walletAddress ?? existing.seller_address,
      entityId: id,
      changedFields: Object.keys(updates),
    });

    return applyMarketplaceListingUpdates(listingFromRow(existing), updates);
  });
}
