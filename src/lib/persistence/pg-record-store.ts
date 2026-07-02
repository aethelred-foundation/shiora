// ============================================================
// Shiora on Aethelred — Postgres Record Store
//
// A production RecordStorePort backed by Postgres. PHI is stored only in the
// JSONB `sealed_phi` column as an AES-256-GCM envelope, so the database never
// holds plaintext health information. All access is owner-scoped via the SQL
// predicates. Verified against an in-process Postgres engine; see
// docs/COMPLIANCE.md C-DB-1.
// ============================================================

import type { SealedEnvelope, ShreddedEnvelope } from '@/lib/crypto/envelope';
import { MIGRATIONS } from './schema';
import type { RecordStorePort, StoredRecord } from './record-store';
import { type ResealScanPage, encodeCursor, decodeCursor } from './reseal-cursor';
import type { SqlClient } from './sql-client';

const SELECT_COLUMNS = `
  id, owner_address, type, date, upload_date, cid, tx_hash, attestation,
  size, provider, status, ipfs_nodes, block_height, encryption, sealed_phi, deleted, version, deleted_at
`.trim();

interface RecordRow {
  id: string;
  owner_address: string;
  type: string;
  date: string | number;
  upload_date: string | number;
  cid: string;
  tx_hash: string;
  attestation: string;
  size: number;
  provider: string;
  status: StoredRecord['status'];
  ipfs_nodes: number;
  block_height: string | number;
  encryption: string;
  sealed_phi: SealedEnvelope | ShreddedEnvelope;
  deleted: boolean;
  version: number | string;
  deleted_at: number | string | null;
}

function rowToStored(row: RecordRow): StoredRecord {
  return {
    id: row.id,
    ownerAddress: row.owner_address,
    type: row.type,
    date: Number(row.date),
    uploadDate: Number(row.upload_date),
    cid: row.cid,
    txHash: row.tx_hash,
    attestation: row.attestation,
    size: Number(row.size),
    provider: row.provider,
    status: row.status,
    ipfsNodes: Number(row.ipfs_nodes),
    blockHeight: Number(row.block_height),
    encryption: row.encryption,
    sealedPhi: row.sealed_phi,
    deleted: row.deleted,
    version: Number(row.version),
    ...(row.deleted_at !== null ? { deletedAt: Number(row.deleted_at) } : {}),
  };
}

export class PgRecordStore implements RecordStorePort {
  constructor(private readonly client: SqlClient) {}

  /** Apply the schema. Idempotent — safe to run on every boot. */
  async migrate(): Promise<void> {
    for (const statement of MIGRATIONS) {
      await this.client.query(statement);
    }
  }

  async put(row: StoredRecord): Promise<void> {
    await this.client.query(
      `INSERT INTO health_records
         (id, owner_address, type, date, upload_date, cid, tx_hash, attestation,
          size, provider, status, ipfs_nodes, block_height, encryption, sealed_phi,
          deleted, version, deleted_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18, now())
       ON CONFLICT (id) DO UPDATE SET
         type=EXCLUDED.type, date=EXCLUDED.date, upload_date=EXCLUDED.upload_date,
         cid=EXCLUDED.cid, tx_hash=EXCLUDED.tx_hash, attestation=EXCLUDED.attestation,
         size=EXCLUDED.size, provider=EXCLUDED.provider, status=EXCLUDED.status,
         ipfs_nodes=EXCLUDED.ipfs_nodes, block_height=EXCLUDED.block_height,
         encryption=EXCLUDED.encryption, sealed_phi=EXCLUDED.sealed_phi,
         deleted=EXCLUDED.deleted, version=EXCLUDED.version, deleted_at=EXCLUDED.deleted_at, updated_at=now()`,
      [
        row.id,
        row.ownerAddress,
        row.type,
        row.date,
        row.uploadDate,
        row.cid,
        row.txHash,
        row.attestation,
        row.size,
        row.provider,
        row.status,
        row.ipfsNodes,
        row.blockHeight,
        row.encryption,
        JSON.stringify(row.sealedPhi),
        row.deleted,
        row.version ?? 1,
        row.deletedAt ?? null,
      ],
    );
  }

  async findById(ownerAddress: string, id: string): Promise<StoredRecord | undefined> {
    const { rows } = await this.client.query<RecordRow>(
      `SELECT ${SELECT_COLUMNS} FROM health_records
       WHERE owner_address=$1 AND id=$2`,
      [ownerAddress, id],
    );
    const row = rows[0];
    return row ? rowToStored(row) : undefined;
  }

  async findByOwner(ownerAddress: string): Promise<StoredRecord[]> {
    const { rows } = await this.client.query<RecordRow>(
      `SELECT ${SELECT_COLUMNS} FROM health_records
       WHERE owner_address=$1
       ORDER BY created_at DESC`,
      [ownerAddress],
    );
    return rows.map(rowToStored);
  }

  async scanForReseal(
    cursor: string | null,
    limit: number,
  ): Promise<ResealScanPage<StoredRecord>> {
    const afterId = cursor ? decodeCursor(cursor)[0] : '';
    const { rows } = await this.client.query<RecordRow>(
      `SELECT ${SELECT_COLUMNS} FROM health_records
       WHERE ($1 = '' OR id > $1)
       ORDER BY id
       LIMIT $2`,
      [afterId, limit],
    );
    const records = rows.map(rowToStored);
    const last = records[records.length - 1];
    return {
      rows: records,
      nextCursor: records.length === limit && last ? encodeCursor([last.id]) : null,
    };
  }
}
