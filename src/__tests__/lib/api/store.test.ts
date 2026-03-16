/** @jest-environment node */

import {
  listRecords,
  createRecord,
  getRecord,
  updateRecord,
  softDeleteRecord,
  listAccessGrants,
  createAccessGrant,
  getAccessGrant,
  updateAccessGrant,
  listConsents,
  createConsent,
  getConsent,
  updateConsent,
  listMarketplaceListings,
  getMarketplaceListing,
  createMarketplaceListing,
  updateMarketplaceListing,
  buildMarketplaceListingFromInput,
  buildPurchaseReceipt,
} from '@/lib/api/store';
import { seededAddress } from '@/lib/utils';

const owner = seededAddress(50000);

// Reset state between test suites to ensure clean state
const globalState = globalThis as typeof globalThis & {
  __SHIORA_API_STATE__?: unknown;
};

describe('Records store', () => {
  it('listRecords returns seeded records for new owner', () => {
    const records = listRecords(owner);
    expect(records.length).toBeGreaterThan(0);
  });

  it('createRecord adds a record', () => {
    const record = createRecord(owner, {
      id: 'test-rec-1',
      type: 'lab_result',
      label: 'Test Record',
      description: 'A test',
      provider: 'Test Provider',
      date: Date.now(),
      size: '1KB',
      hash: '0x' + 'ab'.repeat(32),
      status: 'Verified',
      tags: ['test'],
      encryption: 'AES-256-GCM',
      txHash: '0x' + 'cd'.repeat(32),
      attestation: 'attestation-data',
      ownerAddress: owner,
      deleted: false,
    });
    expect(record.id).toBe('test-rec-1');
    expect(record.label).toBe('Test Record');
  });

  it('getRecord retrieves a specific record', () => {
    const record = getRecord(owner, 'test-rec-1');
    expect(record).toBeDefined();
    expect(record!.label).toBe('Test Record');
  });

  it('getRecord returns undefined for nonexistent record', () => {
    expect(getRecord(owner, 'nonexistent')).toBeUndefined();
  });

  it('updateRecord modifies a record', () => {
    const updated = updateRecord(owner, 'test-rec-1', { label: 'Updated Label' });
    expect(updated).toBeDefined();
    expect(updated!.label).toBe('Updated Label');
  });

  it('softDeleteRecord marks a record as deleted', () => {
    const deleted = softDeleteRecord(owner, 'test-rec-1');
    expect(deleted).toBeDefined();
    expect(deleted!.deleted).toBe(true);
    // Deleted records should not appear in list
    const found = getRecord(owner, 'test-rec-1');
    expect(found).toBeUndefined();
  });
});

describe('Access grants store', () => {
  it('listAccessGrants returns seeded grants', () => {
    const grants = listAccessGrants(owner);
    expect(grants.length).toBeGreaterThan(0);
  });

  it('createAccessGrant adds a grant', () => {
    const grant = createAccessGrant(owner, {
      id: 'test-grant-1',
      provider: 'Test Hospital',
      specialty: 'Cardiology',
      address: seededAddress(60000),
      status: 'Pending',
      scope: 'Full Records',
      grantedAt: Date.now(),
      expiresAt: Date.now() + 86400000,
      lastAccess: null,
      accessCount: 0,
      txHash: '0x' + 'aa'.repeat(32),
      attestation: 'attest',
      canView: true,
      canDownload: false,
      canShare: false,
      ownerAddress: owner,
    });
    expect(grant.id).toBe('test-grant-1');
  });

  it('getAccessGrant retrieves a specific grant', () => {
    const grant = getAccessGrant(owner, 'test-grant-1');
    expect(grant).toBeDefined();
    expect(grant!.provider).toBe('Test Hospital');
  });

  it('updateAccessGrant modifies a grant', () => {
    const updated = updateAccessGrant(owner, 'test-grant-1', { status: 'Active' });
    expect(updated).toBeDefined();
    expect(updated!.status).toBe('Active');
  });
});

describe('Consents store', () => {
  const consentOwner = seededAddress(70000);

  it('listConsents returns empty for new owner', () => {
    const consents = listConsents(consentOwner);
    expect(consents).toEqual([]);
  });

  it('createConsent adds a consent', () => {
    const consent = createConsent(consentOwner, {
      id: 'test-consent-1',
      patientAddress: consentOwner,
      providerAddress: seededAddress(80000),
      providerName: 'Dr. Test',
      scopes: ['lab_results'],
      status: 'active',
      grantedAt: Date.now(),
      expiresAt: Date.now() + 86400000 * 30,
      txHash: '0x' + 'bb'.repeat(32),
      attestation: 'attest',
      policyId: 'policy-1',
      autoRenew: false,
    });
    expect(consent.id).toBe('test-consent-1');
  });

  it('getConsent retrieves a specific consent', () => {
    const consent = getConsent(consentOwner, 'test-consent-1');
    expect(consent).toBeDefined();
    expect(consent!.providerName).toBe('Dr. Test');
  });

  it('updateConsent modifies a consent', () => {
    const updated = updateConsent(consentOwner, 'test-consent-1', { status: 'revoked' });
    expect(updated).toBeDefined();
    expect(updated!.status).toBe('revoked');
  });
});

describe('Marketplace store', () => {
  it('listMarketplaceListings returns seeded listings', () => {
    const listings = listMarketplaceListings();
    expect(listings.length).toBeGreaterThan(0);
  });

  it('getMarketplaceListing retrieves by ID', () => {
    const listings = listMarketplaceListings();
    const first = listings[0];
    const retrieved = getMarketplaceListing(first.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(first.id);
  });

  it('getMarketplaceListing returns undefined for nonexistent', () => {
    expect(getMarketplaceListing('nonexistent')).toBeUndefined();
  });

  it('buildMarketplaceListingFromInput creates a listing', () => {
    const listing = buildMarketplaceListingFromInput({
      seller: owner,
      category: 'vitals',
      title: 'Test Dataset',
      description: 'Test desc',
      price: 100,
      expirationDays: 30,
      anonymizationLevel: 'k-anonymity',
    });
    expect(listing.seller).toBe(owner);
    expect(listing.title).toBe('Test Dataset');
    expect(listing.status).toBe('active');
    expect(listing.teeVerified).toBe(true);
  });

  it('createMarketplaceListing adds a listing', () => {
    const before = listMarketplaceListings().length;
    const listing = buildMarketplaceListingFromInput({
      seller: owner,
      category: 'vitals',
      title: 'New Listing',
      description: 'desc',
      price: 50,
      expirationDays: 7,
      anonymizationLevel: 'differential-privacy',
    });
    const created = createMarketplaceListing(listing);
    expect(created.title).toBe('New Listing');
    const after = listMarketplaceListings().length;
    expect(after).toBe(before + 1);
  });

  it('updateMarketplaceListing updates an existing listing', () => {
    const listings = listMarketplaceListings();
    const first = listings[0];
    const updated = updateMarketplaceListing(first.id, { title: 'Updated Title' });
    expect(updated).toBeDefined();
    expect(updated!.title).toBe('Updated Title');
  });

  it('updateMarketplaceListing with dateRange', () => {
    const listings = listMarketplaceListings();
    const first = listings[0];
    const newRange = { start: Date.now() - 86400000, end: Date.now() };
    const updated = updateMarketplaceListing(first.id, { dateRange: newRange });
    expect(updated).toBeDefined();
    expect(updated!.dateRange.start).toBe(newRange.start);
  });

  it('updateMarketplaceListing returns undefined for nonexistent', () => {
    const result = updateMarketplaceListing('nonexistent-id', { title: 'X' });
    expect(result).toBeUndefined();
  });

  it('buildPurchaseReceipt creates a receipt', () => {
    const listing = listMarketplaceListings()[0];
    const receipt = buildPurchaseReceipt(listing, owner);
    expect(receipt.buyer).toBe(owner);
    expect(receipt.seller).toBe(listing.seller);
    expect(receipt.listingId).toBe(listing.id);
    expect(receipt.txHash).toBeDefined();
  });
});

describe('Store edge cases', () => {
  it('updateRecord returns undefined for nonexistent record', () => {
    const result = updateRecord(owner, 'nonexistent-record-id', { label: 'test' });
    expect(result).toBeUndefined();
  });

  it('getAccessGrant returns undefined for nonexistent grant', () => {
    const result = getAccessGrant(owner, 'nonexistent-grant-id');
    expect(result).toBeUndefined();
  });

  it('updateAccessGrant returns undefined for nonexistent grant', () => {
    const result = updateAccessGrant(owner, 'nonexistent-grant-id', { status: 'Active' });
    expect(result).toBeUndefined();
  });

  it('getConsent returns undefined for nonexistent consent', () => {
    const consentOwner = seededAddress(99000);
    const result = getConsent(consentOwner, 'nonexistent-consent-id');
    expect(result).toBeUndefined();
  });

  it('updateConsent returns undefined for nonexistent consent', () => {
    const consentOwner = seededAddress(99001);
    const result = updateConsent(consentOwner, 'nonexistent-consent-id', { status: 'revoked' });
    expect(result).toBeUndefined();
  });

  it('updateRecord preserves existing tags when no new tags provided', () => {
    const testOwner = seededAddress(55000);
    const records = listRecords(testOwner);
    const firstRecord = records[0];
    const updated = updateRecord(testOwner, firstRecord.id, { label: 'New Label' });
    expect(updated).toBeDefined();
    expect(updated!.tags).toEqual(firstRecord.tags);
  });

  it('updateRecord replaces tags when new tags provided', () => {
    const testOwner = seededAddress(55001);
    const records = listRecords(testOwner);
    const firstRecord = records[0];
    const updated = updateRecord(testOwner, firstRecord.id, { tags: ['newtag1', 'newtag2'] });
    expect(updated).toBeDefined();
    expect(updated!.tags).toEqual(['newtag1', 'newtag2']);
  });

  it('updateConsent preserves existing scopes when no new scopes provided', () => {
    const consentOwner = seededAddress(88000);
    const consent = createConsent(consentOwner, {
      id: 'scope-test-consent',
      patientAddress: consentOwner,
      providerAddress: seededAddress(88001),
      providerName: 'Dr. Scope',
      scopes: ['lab_results', 'vitals'],
      status: 'active',
      grantedAt: Date.now(),
      expiresAt: Date.now() + 86400000,
      txHash: '0x' + 'cc'.repeat(32),
      attestation: 'attest',
      policyId: 'policy-scope',
      autoRenew: false,
    });
    const updated = updateConsent(consentOwner, consent.id, { status: 'revoked' });
    expect(updated).toBeDefined();
    expect(updated!.scopes).toEqual(['lab_results', 'vitals']);
  });

  it('updateConsent replaces scopes when new scopes provided', () => {
    const consentOwner = seededAddress(88002);
    const consent = createConsent(consentOwner, {
      id: 'scope-replace-consent',
      patientAddress: consentOwner,
      providerAddress: seededAddress(88003),
      providerName: 'Dr. Replace',
      scopes: ['lab_results'],
      status: 'active',
      grantedAt: Date.now(),
      expiresAt: Date.now() + 86400000,
      txHash: '0x' + 'dd'.repeat(32),
      attestation: 'attest',
      policyId: 'policy-replace',
      autoRenew: false,
    });
    const updated = updateConsent(consentOwner, consent.id, { scopes: ['imaging', 'vitals'] });
    expect(updated).toBeDefined();
    expect(updated!.scopes).toEqual(['imaging', 'vitals']);
  });

  it('listRecords returns cloned records (mutations do not affect store)', () => {
    const testOwner = seededAddress(56000);
    const records = listRecords(testOwner);
    const first = records[0];
    first.label = 'MUTATED_LABEL';
    // Fetch again — should not be mutated
    const fresh = listRecords(testOwner);
    expect(fresh[0].label).not.toBe('MUTATED_LABEL');
  });

  it('updateMarketplaceListing preserves dateRange when no new dateRange', () => {
    const listings = listMarketplaceListings();
    const listing = listings[listings.length - 1]; // pick one we haven't modified
    const originalRange = { ...listing.dateRange };
    const updated = updateMarketplaceListing(listing.id, { title: 'DateRange Test' });
    expect(updated).toBeDefined();
    expect(updated!.dateRange.start).toBe(originalRange.start);
    expect(updated!.dateRange.end).toBe(originalRange.end);
  });
});

describe('Store state initialization', () => {
  it('initializes fresh state when no persisted state exists', () => {
    // Clear global state to force re-initialization
    delete globalState.__SHIORA_API_STATE__;

    // listRecords triggers getState which builds fresh state
    const records = listRecords(seededAddress(99999));
    expect(records.length).toBeGreaterThan(0);
  });

  it('marketplace seed data is generated on fresh state', () => {
    // Clear state to force regeneration
    delete globalState.__SHIORA_API_STATE__;

    const listings = listMarketplaceListings();
    expect(listings.length).toBe(20);
    listings.forEach((l) => {
      expect(l.id).toMatch(/^listing-/);
      expect(l.currency).toBe('AETHEL');
    });
  });

  it('ensureRecords returns cached records for same owner', () => {
    const testOwner = seededAddress(77000);
    const first = listRecords(testOwner);
    const second = listRecords(testOwner);
    // Should be same underlying data (just cloned)
    expect(first.length).toBe(second.length);
    expect(first[0].id).toBe(second[0].id);
  });

  it('ensureGrants returns cached grants for same owner', () => {
    const testOwner = seededAddress(77001);
    const first = listAccessGrants(testOwner);
    const second = listAccessGrants(testOwner);
    expect(first.length).toBe(second.length);
    expect(first[0].id).toBe(second[0].id);
  });

  it('ensureConsents returns cached consents for same owner', () => {
    const testOwner = seededAddress(77002);
    const first = listConsents(testOwner);
    const second = listConsents(testOwner);
    expect(first.length).toBe(second.length);
  });
});

describe('File persistence (mocked)', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('schedulePersist skips in test environment', () => {
    // In test env, schedulePersist is a no-op, so createRecord should not crash
    const testOwner = seededAddress(88888);
    const record = createRecord(testOwner, {
      id: 'persist-test-rec',
      type: 'vitals',
      label: 'Persist Test',
      description: 'Test',
      provider: 'Test',
      date: Date.now(),
      uploadDate: Date.now(),
      encrypted: true,
      encryption: 'AES-256-GCM',
      cid: 'QmTest',
      txHash: '0x' + 'ee'.repeat(32),
      attestation: '0x' + 'ff'.repeat(32),
      size: 1024,
      status: 'Verified',
      ipfsNodes: 10,
      tags: [],
      deleted: false,
      ownerAddress: testOwner,
      blockHeight: 1000,
    });
    expect(record.id).toBe('persist-test-rec');
  });
});

describe('File persistence and serialization internals', () => {
  // To cover ensureDataDir, serializeState, deserializeState, loadPersistedState,
  // and schedulePersist, we need to re-require the module with mocked fs.
  // Since these are internal functions, we test them by manipulating fs behavior
  // and re-initializing state.

  it('loadPersistedState returns deserialized state from file', () => {
    const fs = require('node:fs');

    // Simulate a persisted state file
    const serialized = JSON.stringify({
      recordsByOwner: { 'aeth1test': [{ id: 'r1', type: 'vitals', label: 'Test', description: '', date: 1, uploadDate: 1, encrypted: true, encryption: 'AES-256-GCM', cid: 'Qm', txHash: '0x', attestation: '0x', size: 1, provider: 'P', status: 'Verified', ipfsNodes: 1, tags: ['a'], deleted: false, ownerAddress: 'aeth1test', blockHeight: 1 }] },
      grantsByOwner: {},
      consentsByPatient: {},
      marketplace: [],
    });

    // Mock fs to return a persisted state
    const existsSyncOriginal = fs.existsSync;
    const readFileSyncOriginal = fs.readFileSync;
    fs.existsSync = jest.fn((p: string) => {
      if (p.includes('state.json')) return true;
      return existsSyncOriginal(p);
    });
    fs.readFileSync = jest.fn((p: string, encoding: string) => {
      if (p.includes('state.json')) return serialized;
      return readFileSyncOriginal(p, encoding);
    });

    // Clear state to force re-initialization from file
    delete globalState.__SHIORA_API_STATE__;

    try {
      const records = listRecords('aeth1test');
      // Should have loaded from persisted state
      expect(records.some((r: { id: string }) => r.id === 'r1')).toBe(true);
    } finally {
      fs.existsSync = existsSyncOriginal;
      fs.readFileSync = readFileSyncOriginal;
      delete globalState.__SHIORA_API_STATE__;
    }
  });

  it('loadPersistedState returns null and warns when file read fails', () => {
    const fs = require('node:fs');
    const existsSyncOriginal = fs.existsSync;
    const readFileSyncOriginal = fs.readFileSync;

    fs.existsSync = jest.fn((p: string) => {
      if (p.includes('state.json')) return true;
      return existsSyncOriginal(p);
    });
    fs.readFileSync = jest.fn((p: string, encoding: string) => {
      if (p.includes('state.json')) throw new Error('read error');
      return readFileSyncOriginal(p, encoding);
    });

    delete globalState.__SHIORA_API_STATE__;

    try {
      // Should fall through to fresh state (loadPersistedState returns null)
      const listings = listMarketplaceListings();
      expect(listings.length).toBe(20); // fresh marketplace seed data
    } finally {
      fs.existsSync = existsSyncOriginal;
      fs.readFileSync = readFileSyncOriginal;
      delete globalState.__SHIORA_API_STATE__;
    }
  });

  it('loadPersistedState warns in non-test env on failure', () => {
    const fs = require('node:fs');
    const existsSyncOriginal = fs.existsSync;
    const readFileSyncOriginal = fs.readFileSync;
    const originalEnv = process.env.NODE_ENV;

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    fs.existsSync = jest.fn((p: string) => {
      if (p.includes('state.json')) return true;
      return existsSyncOriginal(p);
    });
    fs.readFileSync = jest.fn((p: string, encoding: string) => {
      if (p.includes('state.json')) throw new Error('disk error');
      return readFileSyncOriginal(p, encoding);
    });
    process.env.NODE_ENV = 'development';

    delete globalState.__SHIORA_API_STATE__;

    try {
      const listings = listMarketplaceListings();
      expect(listings.length).toBe(20);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[shiora-store]'),
        expect.any(Error),
      );
    } finally {
      fs.existsSync = existsSyncOriginal;
      fs.readFileSync = readFileSyncOriginal;
      process.env.NODE_ENV = originalEnv;
      warnSpy.mockRestore();
      delete globalState.__SHIORA_API_STATE__;
    }
  });

  it('schedulePersist runs and writes state in non-test environment', () => {
    const fs = require('node:fs');
    const originalEnv = process.env.NODE_ENV;

    const mkdirSyncOriginal = fs.mkdirSync;
    const writeFileSyncOriginal = fs.writeFileSync;
    const existsSyncOriginal = fs.existsSync;

    let writtenData: string | null = null;
    fs.existsSync = jest.fn((p: string) => {
      if (p.includes('.shiora-data')) return true;
      return existsSyncOriginal(p);
    });
    fs.mkdirSync = jest.fn();
    fs.writeFileSync = jest.fn((_p: string, data: string) => {
      writtenData = data;
    });

    process.env.NODE_ENV = 'development';

    try {
      // Ensure we have state
      delete globalState.__SHIORA_API_STATE__;
      listMarketplaceListings(); // initializes state

      // Use fake timers BEFORE scheduling
      jest.useFakeTimers();

      // createRecord calls schedulePersist, which in non-test env will set a timer
      const testOwner = seededAddress(77777);
      createRecord(testOwner, {
        id: 'persist-fire-rec',
        type: 'vitals',
        label: 'Persist Fire',
        description: 'Test',
        provider: 'Test',
        date: Date.now(),
        uploadDate: Date.now(),
        encrypted: true,
        encryption: 'AES-256-GCM',
        cid: 'QmTest',
        txHash: '0x' + 'ee'.repeat(32),
        attestation: '0x' + 'ff'.repeat(32),
        size: 1024,
        status: 'Verified',
        ipfsNodes: 10,
        tags: [],
        deleted: false,
        ownerAddress: testOwner,
        blockHeight: 1000,
      });

      // Fast-forward timers to trigger the debounced persist
      jest.advanceTimersByTime(3000);
      jest.useRealTimers();

      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(writtenData).not.toBeNull();
      const parsed = JSON.parse(writtenData!);
      expect(parsed).toHaveProperty('marketplace');
      expect(parsed).toHaveProperty('recordsByOwner');
    } finally {
      fs.mkdirSync = mkdirSyncOriginal;
      fs.writeFileSync = writeFileSyncOriginal;
      fs.existsSync = existsSyncOriginal;
      process.env.NODE_ENV = originalEnv;
      delete globalState.__SHIORA_API_STATE__;
    }
  });

  it('schedulePersist handles write failures gracefully in non-test env', () => {
    const fs = require('node:fs');
    const originalEnv = process.env.NODE_ENV;

    const existsSyncOriginal = fs.existsSync;
    const mkdirSyncOriginal = fs.mkdirSync;
    const writeFileSyncOriginal = fs.writeFileSync;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    fs.existsSync = jest.fn((p: string) => {
      if (p.includes('.shiora-data')) return true;
      return existsSyncOriginal(p);
    });
    fs.mkdirSync = jest.fn();
    fs.writeFileSync = jest.fn(() => { throw new Error('write failed'); });

    process.env.NODE_ENV = 'development';

    try {
      delete globalState.__SHIORA_API_STATE__;
      listMarketplaceListings();

      jest.useFakeTimers();

      const testOwner = seededAddress(66666);
      createRecord(testOwner, {
        id: 'persist-fail-rec',
        type: 'vitals',
        label: 'Fail Persist',
        description: 'Test',
        provider: 'Test',
        date: Date.now(),
        uploadDate: Date.now(),
        encrypted: true,
        encryption: 'AES-256-GCM',
        cid: 'QmTest',
        txHash: '0x' + 'ee'.repeat(32),
        attestation: '0x' + 'ff'.repeat(32),
        size: 1024,
        status: 'Verified',
        ipfsNodes: 10,
        tags: [],
        deleted: false,
        ownerAddress: testOwner,
        blockHeight: 1000,
      });

      jest.advanceTimersByTime(3000);
      jest.useRealTimers();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[shiora-store]'),
        expect.any(Error),
      );
    } finally {
      fs.existsSync = existsSyncOriginal;
      fs.mkdirSync = mkdirSyncOriginal;
      fs.writeFileSync = writeFileSyncOriginal;
      process.env.NODE_ENV = originalEnv;
      warnSpy.mockRestore();
      delete globalState.__SHIORA_API_STATE__;
    }
  });

  it('ensureDataDir creates directory when it does not exist', () => {
    const fs = require('node:fs');
    const originalEnv = process.env.NODE_ENV;

    const existsSyncOriginal = fs.existsSync;
    const mkdirSyncOriginal = fs.mkdirSync;
    const writeFileSyncOriginal = fs.writeFileSync;

    let mkdirCalled = false;
    fs.existsSync = jest.fn((p: string) => {
      if (p.includes('.shiora-data')) return false; // directory doesn't exist
      return existsSyncOriginal(p);
    });
    fs.mkdirSync = jest.fn(() => { mkdirCalled = true; });
    fs.writeFileSync = jest.fn();

    process.env.NODE_ENV = 'development';

    try {
      delete globalState.__SHIORA_API_STATE__;
      listMarketplaceListings();

      jest.useFakeTimers();

      const testOwner = seededAddress(55555);
      createRecord(testOwner, {
        id: 'dir-create-rec',
        type: 'vitals',
        label: 'Dir Create',
        description: 'Test',
        provider: 'Test',
        date: Date.now(),
        uploadDate: Date.now(),
        encrypted: true,
        encryption: 'AES-256-GCM',
        cid: 'QmTest',
        txHash: '0x' + 'ee'.repeat(32),
        attestation: '0x' + 'ff'.repeat(32),
        size: 1024,
        status: 'Verified',
        ipfsNodes: 10,
        tags: [],
        deleted: false,
        ownerAddress: testOwner,
        blockHeight: 1000,
      });

      jest.advanceTimersByTime(3000);
      jest.useRealTimers();

      expect(mkdirCalled).toBe(true);
    } finally {
      fs.existsSync = existsSyncOriginal;
      fs.mkdirSync = mkdirSyncOriginal;
      fs.writeFileSync = writeFileSyncOriginal;
      process.env.NODE_ENV = originalEnv;
      delete globalState.__SHIORA_API_STATE__;
    }
  });

  it('ensureDataDir handles errors silently', () => {
    const fs = require('node:fs');
    const originalEnv = process.env.NODE_ENV;

    const existsSyncOriginal = fs.existsSync;
    const mkdirSyncOriginal = fs.mkdirSync;
    const writeFileSyncOriginal = fs.writeFileSync;

    fs.existsSync = jest.fn((p: string) => {
      if (p.includes('.shiora-data')) return false;
      return existsSyncOriginal(p);
    });
    fs.mkdirSync = jest.fn(() => { throw new Error('permission denied'); });
    fs.writeFileSync = jest.fn();

    process.env.NODE_ENV = 'development';

    try {
      delete globalState.__SHIORA_API_STATE__;
      listMarketplaceListings();

      jest.useFakeTimers();

      const testOwner = seededAddress(44444);
      // Should not crash even when mkdir fails
      createRecord(testOwner, {
        id: 'dir-fail-rec',
        type: 'vitals',
        label: 'Dir Fail',
        description: 'Test',
        provider: 'Test',
        date: Date.now(),
        uploadDate: Date.now(),
        encrypted: true,
        encryption: 'AES-256-GCM',
        cid: 'QmTest',
        txHash: '0x' + 'ee'.repeat(32),
        attestation: '0x' + 'ff'.repeat(32),
        size: 1024,
        status: 'Verified',
        ipfsNodes: 10,
        tags: [],
        deleted: false,
        ownerAddress: testOwner,
        blockHeight: 1000,
      });

      jest.advanceTimersByTime(3000);
      jest.useRealTimers();

      // Should not have thrown
      expect(true).toBe(true);
    } finally {
      fs.existsSync = existsSyncOriginal;
      fs.mkdirSync = mkdirSyncOriginal;
      fs.writeFileSync = writeFileSyncOriginal;
      process.env.NODE_ENV = originalEnv;
      delete globalState.__SHIORA_API_STATE__;
    }
  });

  it('schedulePersist returns early when state is null', () => {
    const fs = require('node:fs');
    const originalEnv = process.env.NODE_ENV;

    const existsSyncOriginal = fs.existsSync;
    const writeFileSyncOriginal = fs.writeFileSync;

    fs.existsSync = jest.fn(() => true);
    fs.writeFileSync = jest.fn();

    process.env.NODE_ENV = 'development';

    try {
      delete globalState.__SHIORA_API_STATE__;
      listMarketplaceListings();

      jest.useFakeTimers();

      const testOwner = seededAddress(33333);
      createRecord(testOwner, {
        id: 'null-state-rec',
        type: 'vitals',
        label: 'Null State',
        description: 'Test',
        provider: 'Test',
        date: Date.now(),
        uploadDate: Date.now(),
        encrypted: true,
        encryption: 'AES-256-GCM',
        cid: 'QmTest',
        txHash: '0x' + 'ee'.repeat(32),
        attestation: '0x' + 'ff'.repeat(32),
        size: 1024,
        status: 'Verified',
        ipfsNodes: 10,
        tags: [],
        deleted: false,
        ownerAddress: testOwner,
        blockHeight: 1000,
      });

      // Clear state before timer fires
      delete globalState.__SHIORA_API_STATE__;

      jest.advanceTimersByTime(3000);
      jest.useRealTimers();

      // writeFileSync should not have been called since state was null
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    } finally {
      fs.existsSync = existsSyncOriginal;
      fs.writeFileSync = writeFileSyncOriginal;
      process.env.NODE_ENV = originalEnv;
      delete globalState.__SHIORA_API_STATE__;
    }
  });

  it('deserializeState handles missing fields with defaults', () => {
    const fs = require('node:fs');
    const existsSyncOriginal = fs.existsSync;
    const readFileSyncOriginal = fs.readFileSync;

    // Provide a serialized state with missing fields
    const serialized = JSON.stringify({});

    fs.existsSync = jest.fn((p: string) => {
      if (p.includes('state.json')) return true;
      return existsSyncOriginal(p);
    });
    fs.readFileSync = jest.fn((p: string, encoding: string) => {
      if (p.includes('state.json')) return serialized;
      return readFileSyncOriginal(p, encoding);
    });

    delete globalState.__SHIORA_API_STATE__;

    try {
      // Should gracefully handle undefined fields via ?? defaults
      const listings = listMarketplaceListings();
      expect(listings).toEqual([]);

      const records = listRecords(seededAddress(22222));
      // Starts from empty map but ensureRecords generates seeded records
      expect(records.length).toBeGreaterThan(0);
    } finally {
      fs.existsSync = existsSyncOriginal;
      fs.readFileSync = readFileSyncOriginal;
      delete globalState.__SHIORA_API_STATE__;
    }
  });

  it('schedulePersist debounces multiple calls', () => {
    const fs = require('node:fs');
    const originalEnv = process.env.NODE_ENV;

    const existsSyncOriginal = fs.existsSync;
    const mkdirSyncOriginal = fs.mkdirSync;
    const writeFileSyncOriginal = fs.writeFileSync;

    let writeCount = 0;
    fs.existsSync = jest.fn(() => true);
    fs.mkdirSync = jest.fn();
    fs.writeFileSync = jest.fn(() => { writeCount++; });

    process.env.NODE_ENV = 'development';

    try {
      delete globalState.__SHIORA_API_STATE__;
      listMarketplaceListings();

      jest.useFakeTimers();

      const testOwner = seededAddress(11111);
      // Call createRecord multiple times to trigger multiple schedulePersist calls
      for (let i = 0; i < 5; i++) {
        createRecord(testOwner, {
          id: `debounce-rec-${i}`,
          type: 'vitals',
          label: `Debounce ${i}`,
          description: 'Test',
          provider: 'Test',
          date: Date.now(),
          uploadDate: Date.now(),
          encrypted: true,
          encryption: 'AES-256-GCM',
          cid: 'QmTest',
          txHash: '0x' + 'ee'.repeat(32),
          attestation: '0x' + 'ff'.repeat(32),
          size: 1024,
          status: 'Verified',
          ipfsNodes: 10,
          tags: [],
          deleted: false,
          ownerAddress: testOwner,
          blockHeight: 1000,
        });
      }

      jest.advanceTimersByTime(3000);
      jest.useRealTimers();

      // Only 1 write should happen due to debouncing
      expect(writeCount).toBe(1);
    } finally {
      fs.existsSync = existsSyncOriginal;
      fs.mkdirSync = mkdirSyncOriginal;
      fs.writeFileSync = writeFileSyncOriginal;
      process.env.NODE_ENV = originalEnv;
      delete globalState.__SHIORA_API_STATE__;
    }
  });
});

describe('Marketplace seed data covers all categories', () => {
  it('seed data has expected structure for all 20 listings', () => {
    delete globalState.__SHIORA_API_STATE__;
    const listings = listMarketplaceListings();
    expect(listings.length).toBe(20);

    // Verify active/expired distribution (index < 14 = active, rest = expired)
    const activeCount = listings.filter((l) => l.status === 'active').length;
    const expiredCount = listings.filter((l) => l.status === 'expired').length;
    expect(activeCount).toBe(14);
    expect(expiredCount).toBe(6);

    // Verify all listings have required fields
    listings.forEach((l) => {
      expect(l.id).toMatch(/^listing-/);
      expect(l.seller).toMatch(/^aeth1/);
      expect(l.sellerReputation).toBeGreaterThanOrEqual(72);
      expect(l.sellerReputation).toBeLessThanOrEqual(99);
      expect(l.qualityScore).toBeGreaterThanOrEqual(60);
      expect(l.currency).toBe('AETHEL');
      expect(l.attestation).toMatch(/^0x/);
      expect(typeof l.teeVerified).toBe('boolean');
      expect(l.dateRange.start).toBeLessThan(l.dateRange.end);
    });
  });
});
