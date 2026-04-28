import type { ConsentGrant, DataListing } from '@/types';
import type { MockAccessGrant, MockHealthRecord } from '@/lib/api/mock-data';
import { serverEnv } from '@/lib/api/env';
import * as demoStore from '@/lib/api/store';
import * as postgresStore from '@/lib/api/postgres-store';

function usesPostgresStore(): boolean {
  return serverEnv.storeBackend === 'postgres';
}

export async function listRecords(ownerAddress: string): Promise<MockHealthRecord[]> {
  return usesPostgresStore()
    ? postgresStore.listRecords(ownerAddress)
    : demoStore.listRecords(ownerAddress);
}

export async function getRecord(
  ownerAddress: string,
  id: string,
): Promise<MockHealthRecord | undefined> {
  return usesPostgresStore()
    ? postgresStore.getRecord(ownerAddress, id)
    : demoStore.getRecord(ownerAddress, id);
}

export async function createRecord(
  ownerAddress: string,
  record: MockHealthRecord,
): Promise<MockHealthRecord> {
  return usesPostgresStore()
    ? postgresStore.createRecord(ownerAddress, record)
    : demoStore.createRecord(ownerAddress, record);
}

export async function updateRecord(
  ownerAddress: string,
  id: string,
  updates: Partial<MockHealthRecord>,
): Promise<MockHealthRecord | undefined> {
  return usesPostgresStore()
    ? postgresStore.updateRecord(ownerAddress, id, updates)
    : demoStore.updateRecord(ownerAddress, id, updates);
}

export async function softDeleteRecord(
  ownerAddress: string,
  id: string,
): Promise<MockHealthRecord | undefined> {
  return usesPostgresStore()
    ? postgresStore.softDeleteRecord(ownerAddress, id)
    : demoStore.softDeleteRecord(ownerAddress, id);
}

export async function listAccessGrants(ownerAddress: string): Promise<MockAccessGrant[]> {
  return usesPostgresStore()
    ? postgresStore.listAccessGrants(ownerAddress)
    : demoStore.listAccessGrants(ownerAddress);
}

export async function getAccessGrant(
  ownerAddress: string,
  id: string,
): Promise<MockAccessGrant | undefined> {
  return usesPostgresStore()
    ? postgresStore.getAccessGrant(ownerAddress, id)
    : demoStore.getAccessGrant(ownerAddress, id);
}

export async function createAccessGrant(
  ownerAddress: string,
  grant: MockAccessGrant,
): Promise<MockAccessGrant> {
  return usesPostgresStore()
    ? postgresStore.createAccessGrant(ownerAddress, grant)
    : demoStore.createAccessGrant(ownerAddress, grant);
}

export async function updateAccessGrant(
  ownerAddress: string,
  id: string,
  updates: Partial<MockAccessGrant>,
): Promise<MockAccessGrant | undefined> {
  return usesPostgresStore()
    ? postgresStore.updateAccessGrant(ownerAddress, id, updates)
    : demoStore.updateAccessGrant(ownerAddress, id, updates);
}

export async function listConsents(ownerAddress: string): Promise<ConsentGrant[]> {
  return usesPostgresStore()
    ? postgresStore.listConsents(ownerAddress)
    : demoStore.listConsents(ownerAddress);
}

export async function getConsent(
  ownerAddress: string,
  id: string,
): Promise<ConsentGrant | undefined> {
  return usesPostgresStore()
    ? postgresStore.getConsent(ownerAddress, id)
    : demoStore.getConsent(ownerAddress, id);
}

export async function createConsent(
  ownerAddress: string,
  consent: ConsentGrant,
): Promise<ConsentGrant> {
  return usesPostgresStore()
    ? postgresStore.createConsent(ownerAddress, consent)
    : demoStore.createConsent(ownerAddress, consent);
}

export async function updateConsent(
  ownerAddress: string,
  id: string,
  updates: Partial<ConsentGrant>,
): Promise<ConsentGrant | undefined> {
  return usesPostgresStore()
    ? postgresStore.updateConsent(ownerAddress, id, updates)
    : demoStore.updateConsent(ownerAddress, id, updates);
}

export async function listMarketplaceListings(walletAddress?: string): Promise<DataListing[]> {
  return usesPostgresStore()
    ? postgresStore.listMarketplaceListings(walletAddress)
    : demoStore.listMarketplaceListings();
}

export async function getMarketplaceListing(
  id: string,
  walletAddress?: string,
): Promise<DataListing | undefined> {
  return usesPostgresStore()
    ? postgresStore.getMarketplaceListing(id, walletAddress)
    : demoStore.getMarketplaceListing(id);
}

export async function createMarketplaceListing(listing: DataListing): Promise<DataListing> {
  return usesPostgresStore()
    ? postgresStore.createMarketplaceListing(listing)
    : demoStore.createMarketplaceListing(listing);
}

export async function updateMarketplaceListing(
  id: string,
  updates: Partial<DataListing>,
  walletAddress?: string,
): Promise<DataListing | undefined> {
  return usesPostgresStore()
    ? postgresStore.updateMarketplaceListing(id, updates, walletAddress)
    : demoStore.updateMarketplaceListing(id, updates);
}

export const buildMarketplaceListingFromInput = demoStore.buildMarketplaceListingFromInput;
export const buildPurchaseReceipt = demoStore.buildPurchaseReceipt;
