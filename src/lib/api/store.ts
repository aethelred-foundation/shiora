import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import type { ConsentGrant, DataListing, MarketplaceCategory } from '@/types';
import { MARKETPLACE_CATEGORIES } from '@/lib/constants';
import {
  generateMockGrants,
  generateMockRecords,
  type MockAccessGrant,
  type MockHealthRecord,
} from '@/lib/api/mock-data';
import {
  generateAttestation,
  generateTxHash,
  seededAddress,
  seededHex,
  seededInt,
  seededPick,
  seededRandom,
} from '@/lib/utils';
import { serverEnv } from '@/lib/api/env';

// ---------------------------------------------------------------------------
// Persistence layer (SBP-004 fix) — file-based state durability
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), '.shiora-data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const STATE_TMP_FILE = path.join(DATA_DIR, 'state.json.tmp');
const STORE_AUDIT_FILE = path.join(DATA_DIR, 'store-audit.jsonl');
const STATE_SCHEMA_VERSION = 1;
const STORE_AUDIT_SCHEMA_VERSION = 1;
const STORE_AUDIT_GENESIS_HASH = crypto
  .createHash('sha256')
  .update('shiora-store-audit-genesis-v1')
  .digest('hex');
const DEMO_STORE_KEY_ENV = 'SHIORA_DEMO_STORE_ENCRYPTION_KEY';

function assertDemoStoreAllowed(): void {
  if (serverEnv.storeBackend && serverEnv.storeBackend !== 'demo') {
    throw new Error(
      `The Shiora demo store cannot serve SHIORA_STORE_BACKEND=${serverEnv.storeBackend}. ` +
        'Use the durable store adapter for regulated persistence.',
    );
  }

  if (serverEnv.isProduction && !serverEnv.allowDemoStoreInProduction) {
    throw new Error(
      'The Shiora demo file store is disabled in production. ' +
        'Configure a durable backend before enabling regulated workloads.',
    );
  }

  if (
    serverEnv.isProduction &&
    serverEnv.allowDemoStoreInProduction &&
    !serverEnv.hasDemoStoreEncryptionKey
  ) {
    throw new Error(
      'SHIORA_DEMO_STORE_ENCRYPTION_KEY is required when the demo store is explicitly enabled in production.',
    );
  }
}

/** Debounce timer for persisting state */
let _persistTimer: ReturnType<typeof setTimeout> | null = null;
const PERSIST_DEBOUNCE_MS = 2_000;

interface SerializedState {
  schemaVersion?: number;
  recordsByOwner: Record<string, MockHealthRecord[]>;
  grantsByOwner: Record<string, MockAccessGrant[]>;
  consentsByPatient: Record<string, ConsentGrant[]>;
  marketplace: DataListing[];
}

interface EncryptedSerializedState {
  schemaVersion: number;
  encrypted: true;
  algorithm: 'aes-256-gcm';
  iv: string;
  tag: string;
  ciphertext: string;
}

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

interface StoreAuditEntry {
  schemaVersion: number;
  sequence: number;
  timestamp: string;
  operation: StoreAuditOperation;
  ownerAddress?: string;
  entityId: string;
  changedFields: string[];
  txHash?: string;
  previousHash: string;
  entryHash: string;
}

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // Silently fail in environments without write access (e.g., serverless)
  }
}

function serializeState(state: ApiState): SerializedState {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    recordsByOwner: Object.fromEntries(state.recordsByOwner),
    grantsByOwner: Object.fromEntries(state.grantsByOwner),
    consentsByPatient: Object.fromEntries(state.consentsByPatient),
    marketplace: state.marketplace,
  };
}

function deserializeState(serialized: SerializedState): ApiState {
  return {
    recordsByOwner: new Map(Object.entries(serialized.recordsByOwner ?? {})),
    grantsByOwner: new Map(Object.entries(serialized.grantsByOwner ?? {})),
    consentsByPatient: new Map(Object.entries(serialized.consentsByPatient ?? {})),
    marketplace: serialized.marketplace ?? [],
  };
}

function getDemoStoreEncryptionKey(): Buffer | null {
  const configured = process.env[DEMO_STORE_KEY_ENV]?.trim();
  if (!configured) {
    return null;
  }

  const base64 = Buffer.from(configured, 'base64');
  if (base64.length === 32) {
    return base64;
  }

  const hex = Buffer.from(configured, 'hex');
  if (hex.length === 32) {
    return hex;
  }

  return crypto.createHash('sha256').update(configured).digest();
}

function encodePersistedState(serialized: SerializedState): string {
  const key = getDemoStoreEncryptionKey();
  if (!key) {
    return JSON.stringify(serialized, null, 2);
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = JSON.stringify(serialized);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const encrypted: EncryptedSerializedState = {
    schemaVersion: STATE_SCHEMA_VERSION,
    encrypted: true,
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };

  return JSON.stringify(encrypted, null, 2);
}

function hashAuditPayload(payload: Omit<StoreAuditEntry, 'entryHash'>): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function readLastAuditEntry(): StoreAuditEntry | null {
  if (!fs.existsSync(STORE_AUDIT_FILE)) {
    return null;
  }

  const raw = fs.readFileSync(STORE_AUDIT_FILE, 'utf-8');
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  return JSON.parse(lines[lines.length - 1]) as StoreAuditEntry;
}

function recordStoreMutation(input: {
  operation: StoreAuditOperation;
  ownerAddress?: string;
  entityId: string;
  changedFields?: string[];
  txHash?: string | null;
}): void {
  if (serverEnv.isTest === true) return;

  try {
    ensureDataDir();
    const previous = readLastAuditEntry();
    const payload: Omit<StoreAuditEntry, 'entryHash'> = {
      schemaVersion: STORE_AUDIT_SCHEMA_VERSION,
      sequence: previous ? previous.sequence + 1 : 1,
      timestamp: new Date().toISOString(),
      operation: input.operation,
      ownerAddress: input.ownerAddress,
      entityId: input.entityId,
      changedFields: [...(input.changedFields ?? [])].sort(),
      txHash: input.txHash ?? undefined,
      previousHash: previous?.entryHash ?? STORE_AUDIT_GENESIS_HASH,
    };
    const entry: StoreAuditEntry = {
      ...payload,
      entryHash: hashAuditPayload(payload),
    };

    fs.appendFileSync(STORE_AUDIT_FILE, `${JSON.stringify(entry)}\n`, {
      encoding: 'utf-8',
      mode: 0o600,
    });
  } catch (err) {
    if (serverEnv.isProduction) {
      throw new Error(`Failed to write Shiora demo-store audit journal: ${(err as Error).message}`);
    }

    if (process.env.NODE_ENV !== 'test') {
      console.warn('[shiora-store] Failed to append audit journal entry:', err);
    }
  }
}

function decodePersistedState(raw: string): SerializedState {
  const parsed = JSON.parse(raw) as SerializedState | EncryptedSerializedState;
  if (!('encrypted' in parsed) || !parsed.encrypted) {
    return parsed as SerializedState;
  }

  const key = getDemoStoreEncryptionKey();
  if (!key) {
    throw new Error(`${DEMO_STORE_KEY_ENV} is required to read encrypted demo store state.`);
  }

  const decipher = crypto.createDecipheriv(parsed.algorithm, key, Buffer.from(parsed.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(parsed.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');

  return JSON.parse(plaintext) as SerializedState;
}

function writePersistedState(payload: string): void {
  fs.writeFileSync(STATE_TMP_FILE, payload, { encoding: 'utf-8', mode: 0o600 });
  try {
    fs.renameSync(STATE_TMP_FILE, STATE_FILE);
  } catch (err) {
    // Some test/serverless shims intercept writes without materializing the
    // temporary file. Fall back to a direct write rather than losing state.
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
    fs.writeFileSync(STATE_FILE, payload, { encoding: 'utf-8', mode: 0o600 });
  }
}

/** Load persisted state synchronously (called once during initialization) */
function loadPersistedState(): ApiState | null {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const serialized = decodePersistedState(raw);
      return deserializeState(serialized);
    }
  } catch (err) {
    // A missing state file is normal on first boot or after cleaning runtime data.
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    // Log warning but don't crash — fall back to fresh state
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[shiora-store] Failed to load persisted state:', err);
    }
  }
  return null;
}

/** Persist state to disk (debounced, async) */
function schedulePersist(): void {
  if (process.env.NODE_ENV === 'test') return; // Don't persist in tests

  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => {
    try {
      ensureDataDir();
      const state = globalState.__SHIORA_API_STATE__;
      if (!state) return;
      const serialized = serializeState(state);
      writePersistedState(encodePersistedState(serialized));
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[shiora-store] Failed to persist state:', err);
      }
    }
  }, PERSIST_DEBOUNCE_MS);
}

// ---------------------------------------------------------------------------
// In-memory state with globalThis attachment + file persistence
// ---------------------------------------------------------------------------

interface ApiState {
  recordsByOwner: Map<string, MockHealthRecord[]>;
  grantsByOwner: Map<string, MockAccessGrant[]>;
  consentsByPatient: Map<string, ConsentGrant[]>;
  marketplace: DataListing[];
}

const globalState = globalThis as typeof globalThis & {
  __SHIORA_API_STATE__?: ApiState;
};

function cloneRecord(record: MockHealthRecord): MockHealthRecord {
  return {
    ...record,
    tags: [...record.tags],
  };
}

function cloneGrant(grant: MockAccessGrant): MockAccessGrant {
  return {
    ...grant,
  };
}

function cloneConsent(consent: ConsentGrant): ConsentGrant {
  return {
    ...consent,
    scopes: [...consent.scopes],
  };
}

function cloneListing(listing: DataListing): DataListing {
  return {
    ...listing,
    dateRange: {
      ...listing.dateRange,
    },
  };
}

function buildMarketplaceSeedData(): DataListing[] {
  const seed = 900;
  const categories = MARKETPLACE_CATEGORIES.map((category) => category.id as MarketplaceCategory);

  return Array.from({ length: 20 }, (_, index) => {
    const category = seededPick(seed + index * 7, categories);
    const createdAt = Date.now() - seededInt(seed + index * 33, 1, 60) * 86_400_000;
    const dataPoints = seededInt(seed + index * 13, 500, 50_000);

    return {
      id: `listing-${seededHex(seed + index * 100, 12)}`,
      seller: seededAddress(seed + index * 200),
      sellerReputation: seededInt(seed + index * 17, 72, 99),
      category,
      title: `Health Dataset ${index + 1}`,
      description: `Privacy-preserving ${category.replace(/_/g, ' ')} cohort curated inside a verified TEE.`,
      dataPoints,
      dateRange: {
        start: createdAt - seededInt(seed + index * 3, 30, 365) * 86_400_000,
        end: createdAt,
      },
      qualityScore: seededInt(seed + index * 19, 60, 99),
      anonymizationLevel: seededPick(seed + index * 9, [
        'k-anonymity',
        'l-diversity',
        'differential-privacy',
      ] as const),
      price: parseFloat((seededRandom(seed + index * 23) * 500 + 10).toFixed(2)),
      currency: 'AETHEL',
      status: index < 14 ? 'active' : 'expired',
      teeVerified: seededRandom(seed + index * 27) > 0.15,
      attestation: generateAttestation(seed + index * 41),
      createdAt,
      expiresAt: createdAt + seededInt(seed + index * 5, 30, 180) * 86_400_000,
      purchaseCount: seededInt(seed + index * 29, 0, 15),
    };
  });
}

function getState(): ApiState {
  assertDemoStoreAllowed();

  if (!globalState.__SHIORA_API_STATE__) {
    // Try loading persisted state first (SBP-004)
    const persisted = loadPersistedState();
    if (persisted) {
      globalState.__SHIORA_API_STATE__ = persisted;
    } else {
      globalState.__SHIORA_API_STATE__ = {
        recordsByOwner: new Map(),
        grantsByOwner: new Map(),
        consentsByPatient: new Map(),
        marketplace: buildMarketplaceSeedData(),
      };
    }
  }

  return globalState.__SHIORA_API_STATE__;
}

function ensureRecords(ownerAddress: string): MockHealthRecord[] {
  const state = getState();
  const existing = state.recordsByOwner.get(ownerAddress);
  if (existing) return existing;

  const seededRecords = generateMockRecords().map((record) => ({
    ...cloneRecord(record),
    ownerAddress,
  }));

  state.recordsByOwner.set(ownerAddress, seededRecords);
  return seededRecords;
}

function ensureGrants(ownerAddress: string): MockAccessGrant[] {
  const state = getState();
  const existing = state.grantsByOwner.get(ownerAddress);
  if (existing) return existing;

  const seededGrants = generateMockGrants().map((grant) => ({
    ...cloneGrant(grant),
    ownerAddress,
  }));

  state.grantsByOwner.set(ownerAddress, seededGrants);
  return seededGrants;
}

function ensureConsents(ownerAddress: string): ConsentGrant[] {
  const state = getState();
  const existing = state.consentsByPatient.get(ownerAddress);
  if (existing) return existing;

  const seededConsents: ConsentGrant[] = [];
  state.consentsByPatient.set(ownerAddress, seededConsents);
  return seededConsents;
}

export function listRecords(ownerAddress: string): MockHealthRecord[] {
  return ensureRecords(ownerAddress)
    .filter((record) => !record.deleted)
    .map(cloneRecord);
}

export function getRecord(ownerAddress: string, id: string): MockHealthRecord | undefined {
  const record = ensureRecords(ownerAddress).find((entry) => entry.id === id && !entry.deleted);

  return record ? cloneRecord(record) : undefined;
}

export function createRecord(ownerAddress: string, record: MockHealthRecord): MockHealthRecord {
  const collection = ensureRecords(ownerAddress);
  const nextRecord = cloneRecord(record);
  collection.unshift(nextRecord);
  recordStoreMutation({
    operation: 'record.create',
    ownerAddress,
    entityId: nextRecord.id,
    changedFields: Object.keys(record),
    txHash: nextRecord.txHash,
  });
  schedulePersist();
  return cloneRecord(nextRecord);
}

export function updateRecord(
  ownerAddress: string,
  id: string,
  updates: Partial<MockHealthRecord>,
  auditOperation: StoreAuditOperation = 'record.update',
): MockHealthRecord | undefined {
  const collection = ensureRecords(ownerAddress);
  const index = collection.findIndex((entry) => entry.id === id && !entry.deleted);
  if (index === -1) return undefined;

  collection[index] = {
    ...collection[index],
    ...updates,
    tags: updates.tags ? [...updates.tags] : collection[index].tags,
  };

  recordStoreMutation({
    operation: auditOperation,
    ownerAddress,
    entityId: id,
    changedFields: Object.keys(updates),
    txHash: collection[index].txHash,
  });
  schedulePersist();
  return cloneRecord(collection[index]);
}

export function softDeleteRecord(ownerAddress: string, id: string): MockHealthRecord | undefined {
  return updateRecord(
    ownerAddress,
    id,
    {
      deleted: true,
    },
    'record.delete',
  );
}

export function listAccessGrants(ownerAddress: string): MockAccessGrant[] {
  return ensureGrants(ownerAddress).map(cloneGrant);
}

export function getAccessGrant(ownerAddress: string, id: string): MockAccessGrant | undefined {
  const grant = ensureGrants(ownerAddress).find((entry) => entry.id === id);
  return grant ? cloneGrant(grant) : undefined;
}

export function createAccessGrant(ownerAddress: string, grant: MockAccessGrant): MockAccessGrant {
  const collection = ensureGrants(ownerAddress);
  const nextGrant = cloneGrant(grant);
  collection.unshift(nextGrant);
  recordStoreMutation({
    operation: 'accessGrant.create',
    ownerAddress,
    entityId: nextGrant.id,
    changedFields: Object.keys(grant),
    txHash: nextGrant.txHash,
  });
  schedulePersist();
  return cloneGrant(nextGrant);
}

export function updateAccessGrant(
  ownerAddress: string,
  id: string,
  updates: Partial<MockAccessGrant>,
): MockAccessGrant | undefined {
  const collection = ensureGrants(ownerAddress);
  const index = collection.findIndex((entry) => entry.id === id);
  if (index === -1) return undefined;

  collection[index] = {
    ...collection[index],
    ...updates,
  };

  recordStoreMutation({
    operation: 'accessGrant.update',
    ownerAddress,
    entityId: id,
    changedFields: Object.keys(updates),
    txHash: collection[index].txHash,
  });
  schedulePersist();
  return cloneGrant(collection[index]);
}

export function listConsents(ownerAddress: string): ConsentGrant[] {
  return ensureConsents(ownerAddress).map(cloneConsent);
}

export function getConsent(ownerAddress: string, id: string): ConsentGrant | undefined {
  const consent = ensureConsents(ownerAddress).find((entry) => entry.id === id);
  return consent ? cloneConsent(consent) : undefined;
}

export function createConsent(ownerAddress: string, consent: ConsentGrant): ConsentGrant {
  const collection = ensureConsents(ownerAddress);
  const nextConsent = cloneConsent(consent);
  collection.unshift(nextConsent);
  recordStoreMutation({
    operation: 'consent.create',
    ownerAddress,
    entityId: nextConsent.id,
    changedFields: Object.keys(consent),
    txHash: nextConsent.txHash,
  });
  schedulePersist();
  return cloneConsent(nextConsent);
}

export function updateConsent(
  ownerAddress: string,
  id: string,
  updates: Partial<ConsentGrant>,
): ConsentGrant | undefined {
  const collection = ensureConsents(ownerAddress);
  const index = collection.findIndex((entry) => entry.id === id);
  if (index === -1) return undefined;

  collection[index] = {
    ...collection[index],
    ...updates,
    scopes: updates.scopes ? [...updates.scopes] : collection[index].scopes,
  };

  recordStoreMutation({
    operation: 'consent.update',
    ownerAddress,
    entityId: id,
    changedFields: Object.keys(updates),
    txHash: collection[index].txHash,
  });
  schedulePersist();
  return cloneConsent(collection[index]);
}

export function listMarketplaceListings(): DataListing[] {
  return getState().marketplace.map(cloneListing);
}

export function getMarketplaceListing(id: string): DataListing | undefined {
  const listing = getState().marketplace.find((entry) => entry.id === id);
  return listing ? cloneListing(listing) : undefined;
}

export function createMarketplaceListing(listing: DataListing): DataListing {
  const state = getState();
  const nextListing = cloneListing(listing);
  state.marketplace.unshift(nextListing);
  recordStoreMutation({
    operation: 'marketplace.create',
    ownerAddress: nextListing.seller,
    entityId: nextListing.id,
    changedFields: Object.keys(listing),
  });
  schedulePersist();
  return cloneListing(nextListing);
}

export function updateMarketplaceListing(
  id: string,
  updates: Partial<DataListing>,
): DataListing | undefined {
  const state = getState();
  const index = state.marketplace.findIndex((entry) => entry.id === id);
  if (index === -1) return undefined;

  state.marketplace[index] = {
    ...state.marketplace[index],
    ...updates,
    dateRange: updates.dateRange ? { ...updates.dateRange } : state.marketplace[index].dateRange,
  };

  recordStoreMutation({
    operation: 'marketplace.update',
    ownerAddress: state.marketplace[index].seller,
    entityId: id,
    changedFields: Object.keys(updates),
  });
  schedulePersist();
  return cloneListing(state.marketplace[index]);
}

export function buildMarketplaceListingFromInput(input: {
  seller: string;
  category: MarketplaceCategory;
  title: string;
  description: string;
  price: number;
  expirationDays: number;
  anonymizationLevel: DataListing['anonymizationLevel'];
}): DataListing {
  const seed = Date.now();

  return {
    id: `listing-${seededHex(seed, 12)}`,
    seller: input.seller,
    sellerReputation: seededInt(seed + 1, 78, 99),
    category: input.category,
    title: input.title,
    description: input.description,
    dataPoints: seededInt(seed, 500, 10_000),
    dateRange: {
      start: seed - seededInt(seed + 2, 30, 365) * 86_400_000,
      end: seed,
    },
    qualityScore: seededInt(seed + 3, 70, 99),
    anonymizationLevel: input.anonymizationLevel,
    price: input.price,
    currency: 'AETHEL',
    status: 'active',
    teeVerified: true,
    attestation: generateAttestation(seed),
    createdAt: seed,
    expiresAt: seed + input.expirationDays * 86_400_000,
    purchaseCount: 0,
  };
}

export function buildPurchaseReceipt(listing: DataListing, buyer: string) {
  const seed = Date.now();
  return {
    id: `purchase-${seededHex(seed, 12)}`,
    listingId: listing.id,
    buyer,
    seller: listing.seller,
    price: listing.price,
    purchasedAt: seed,
    txHash: generateTxHash(seed),
    downloadCount: 0,
    category: listing.category,
    title: listing.title,
  };
}
