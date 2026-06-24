// ============================================================
// Shiora on Aethelred — Marketplace Service
//
// The live datastore for marketplace data listings. Unlike records/access/
// consent (owner-scoped), the marketplace is a single global, public catalog,
// so all listings live under one global key in the encrypted document store.
// Listings start empty and accumulate as sellers publish real datasets.
// Postgres when DATABASE_URL is set, otherwise in-memory.
// ============================================================

import { randomUUID } from 'node:crypto';

import { getAuditLog } from '@/lib/api/audit-log';
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { generateAttestation, generateTxHash, seededInt } from '@/lib/utils';
import type { DataListing, MarketplaceCategory } from '@/types';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';

const COLLECTION = 'marketplace';
/** Single global scope: the catalog is public, not per-owner. */
const GLOBAL_KEY = '__global__';

let repository: EncryptedDocumentRepository<DataListing> | null = null;

function createStore(): DocumentStorePort {
  if (shouldUsePostgres()) {
    return new PgDocumentStore(getPgClient());
  }
  return new InMemoryDocumentStore();
}

function repo(): EncryptedDocumentRepository<DataListing> {
  if (!repository) {
    repository = new EncryptedDocumentRepository<DataListing>(
      createStore(),
      getAuditLog(),
      COLLECTION,
      { create: 'MARKETPLACE_LIST', update: 'MARKETPLACE_UPDATE' },
    );
  }
  return repository;
}

export function listMarketplaceListings(): Promise<DataListing[]> {
  return repo().list(GLOBAL_KEY);
}

export function getMarketplaceListing(id: string): Promise<DataListing | undefined> {
  return repo().get(GLOBAL_KEY, id);
}

export function createMarketplaceListing(listing: DataListing): Promise<DataListing> {
  return repo().create(GLOBAL_KEY, listing);
}

export function updateMarketplaceListing(
  id: string,
  patch: Partial<DataListing>,
): Promise<DataListing | undefined> {
  return repo().update(GLOBAL_KEY, id, patch);
}

/** Build a new listing from validated seller input (collision-free id). */
export function buildMarketplaceListingFromInput(input: {
  seller: string;
  category: MarketplaceCategory;
  title: string;
  description: string;
  price: number;
  expirationDays: number;
  anonymizationLevel: DataListing['anonymizationLevel'];
}): DataListing {
  const now = Date.now();
  const seed = now;

  return {
    id: `listing-${randomUUID().replace(/-/g, '')}`,
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
    createdAt: now,
    expiresAt: now + input.expirationDays * 86_400_000,
    purchaseCount: 0,
  };
}

/** Build a purchase receipt for a completed transaction (collision-free id). */
export function buildPurchaseReceipt(listing: DataListing, buyer: string) {
  const now = Date.now();
  return {
    id: `purchase-${randomUUID().replace(/-/g, '')}`,
    listingId: listing.id,
    buyer,
    seller: listing.seller,
    price: listing.price,
    purchasedAt: now,
    txHash: generateTxHash(now),
    downloadCount: 0,
    category: listing.category,
    title: listing.title,
  };
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetMarketplaceForTests(): void {
  repository = null;
}
