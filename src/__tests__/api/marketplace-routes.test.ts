/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

jest.mock('@/lib/api/marketplace-service', () => {
  const actual = jest.requireActual('@/lib/api/marketplace-service');
  return {
    ...actual,
    listMarketplaceListings: jest.fn((...args: unknown[]) => actual.listMarketplaceListings(...args)),
    updateMarketplaceListing: jest.fn((...args: unknown[]) => actual.updateMarketplaceListing(...args)),
  };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import {
  listMarketplaceListings as svcList,
  updateMarketplaceListing as svcUpdate,
} from '@/lib/api/marketplace-service';

import { GET as listMarketplace, POST as createListing } from '@/app/api/marketplace/route';
import { GET as getStats } from '@/app/api/marketplace/stats/route';
import { GET as getListing, POST as purchaseListing, DELETE as deleteListing } from '@/app/api/marketplace/[id]/route';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedList = svcList as jest.MockedFunction<typeof svcList>;
const mockedUpdate = svcUpdate as jest.MockedFunction<typeof svcUpdate>;
const actualService = jest.requireActual('@/lib/api/marketplace-service');
const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
  mockedList.mockImplementation((...args: unknown[]) => actualService.listMarketplaceListings(...args));
  mockedUpdate.mockImplementation((...args: unknown[]) => actualService.updateMarketplaceListing(...args));
});

function authed(url: string, init: RequestInit, token: string): NextRequest {
  return new NextRequest(url, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` } });
}

interface ListingPayload {
  category: string;
  title: string;
  description?: string;
  price: number;
  expirationDays?: number;
  anonymizationLevel?: string;
}

async function postListing(token: string, payload: ListingPayload): Promise<{ id: string; seller: string }> {
  const res = await createListing(
    authed('http://localhost:3001/api/marketplace', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }, token),
  );
  return (await res.json()).data;
}

const sellerToken = createSessionToken(seededAddress(700)).token;

describe('/api/marketplace list, filter, search', () => {
  beforeAll(async () => {
    actualService.__resetMarketplaceForTests();
    await postListing(sellerToken, { category: 'menstrual_cycles', title: 'Cycle Cohort Alpha', price: 100 });
    await postListing(sellerToken, { category: 'fertility_data', title: 'Fertility Set Beta', price: 200 });
  });

  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await listMarketplace(new NextRequest('http://localhost:3001/api/marketplace'))).status).toBe(403);
  });

  it('lists the public catalog', async () => {
    const res = await listMarketplace(new NextRequest('http://localhost:3001/api/marketplace?limit=100'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('filters by category', async () => {
    const res = await listMarketplace(new NextRequest('http://localhost:3001/api/marketplace?category=menstrual_cycles&limit=100'));
    const body = await res.json();
    body.data.forEach((l: { category: string }) => expect(l.category).toBe('menstrual_cycles'));
  });

  it('rejects an unsupported category', async () => {
    const res = await listMarketplace(new NextRequest('http://localhost:3001/api/marketplace?category=not_a_category'));
    expect(res.status).toBe(400);
  });

  it('searches by title', async () => {
    const res = await listMarketplace(new NextRequest('http://localhost:3001/api/marketplace?q=alpha&limit=100'));
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].title).toBe('Cycle Cohort Alpha');
  });

  it('searches by category text when the title does not match', async () => {
    const res = await listMarketplace(new NextRequest('http://localhost:3001/api/marketplace?q=menstrual&limit=100'));
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].category).toBe('menstrual_cycles');
  });

  it('returns nothing when the search matches no field', async () => {
    const res = await listMarketplace(new NextRequest('http://localhost:3001/api/marketplace?q=zzznomatch&limit=100'));
    expect((await res.json()).data).toEqual([]);
  });

  it('returns 422 for invalid query params', async () => {
    expect((await listMarketplace(new NextRequest('http://localhost:3001/api/marketplace?page=-1'))).status).toBe(422);
  });

  it('re-throws a non-Zod error from the datastore', async () => {
    mockedList.mockImplementationOnce(() => { throw new Error('DB down'); });
    await expect(listMarketplace(new NextRequest('http://localhost:3001/api/marketplace'))).rejects.toThrow('DB down');
  });
});

describe('/api/marketplace create', () => {
  beforeAll(() => actualService.__resetMarketplaceForTests());

  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await createListing(authed('http://localhost:3001/api/marketplace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, sellerToken))).status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await createListing(new NextRequest('http://localhost:3001/api/marketplace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }))).status).toBe(401);
  });

  it('creates a listing (201, active)', async () => {
    const res = await createListing(
      authed('http://localhost:3001/api/marketplace', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'lab_results', title: 'Lab Cohort', price: 50, anonymizationLevel: 'differential-privacy' }),
      }, sellerToken),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).data.status).toBe('active');
  });

  it('rejects an unsupported category', async () => {
    const res = await createListing(
      authed('http://localhost:3001/api/marketplace', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'not_a_category', title: 'X', price: 50 }),
      }, sellerToken),
    );
    expect(res.status).toBe(400);
  });

  it('returns 422 for an invalid create body', async () => {
    const res = await createListing(
      authed('http://localhost:3001/api/marketplace', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'lab_results', title: '', price: -5 }),
      }, sellerToken),
    );
    expect(res.status).toBe(422);
  });

  it('throws on an invalid JSON body (non-Zod error)', async () => {
    await expect(
      createListing(authed('http://localhost:3001/api/marketplace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'not-json' }, sellerToken)),
    ).rejects.toThrow();
  });
});

describe('/api/marketplace/stats', () => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await getStats(new NextRequest('http://localhost:3001/api/marketplace/stats'))).status).toBe(403);
  });

  it('returns aggregate stats', async () => {
    const res = await getStats(new NextRequest('http://localhost:3001/api/marketplace/stats'));
    expect(res.status).toBe(200);
    expect((await res.json()).data.totalListings).toBeDefined();
  });

  it('returns the revenue time-series when type=revenue', async () => {
    const res = await getStats(new NextRequest('http://localhost:3001/api/marketplace/stats?type=revenue'));
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0]).toHaveProperty('revenue');
  });
});

describe('/api/marketplace/[id] detail, purchase, withdraw', () => {
  const seller = seededAddress(710);
  const sToken = createSessionToken(seller).token;
  const buyerToken = createSessionToken(seededAddress(711)).token;
  let listingId: string;

  beforeAll(async () => {
    actualService.__resetMarketplaceForTests();
    const l = await postListing(sToken, { category: 'lab_results', title: 'For Sale', price: 75 });
    listingId = l.id;
  });

  it('GET returns listing detail', async () => {
    const res = await getListing(new NextRequest(`http://localhost:3001/api/marketplace/${listingId}`), { params: Promise.resolve({ id: listingId }) });
    expect(res.status).toBe(200);
    expect((await res.json()).data.id).toBe(listingId);
  });

  it('GET returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await getListing(new NextRequest(`http://localhost:3001/api/marketplace/${listingId}`), { params: Promise.resolve({ id: listingId }) })).status).toBe(403);
  });

  it('GET returns 404 for a missing listing', async () => {
    const res = await getListing(new NextRequest('http://localhost:3001/api/marketplace/listing-missing'), { params: Promise.resolve({ id: 'listing-missing' }) });
    expect(res.status).toBe(404);
  });

  it('POST purchase returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await purchaseListing(authed(`http://localhost:3001/api/marketplace/${listingId}`, { method: 'POST' }, buyerToken), { params: Promise.resolve({ id: listingId }) })).status).toBe(403);
  });

  it('POST purchase returns 401 when unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await purchaseListing(new NextRequest(`http://localhost:3001/api/marketplace/${listingId}`, { method: 'POST' }), { params: Promise.resolve({ id: listingId }) })).status).toBe(401);
  });

  it('POST purchase returns 404 for a missing listing', async () => {
    const res = await purchaseListing(authed('http://localhost:3001/api/marketplace/listing-missing', { method: 'POST' }, buyerToken), { params: Promise.resolve({ id: 'listing-missing' }) });
    expect(res.status).toBe(404);
  });

  it('POST purchase rejects the seller buying their own listing', async () => {
    const res = await purchaseListing(authed(`http://localhost:3001/api/marketplace/${listingId}`, { method: 'POST' }, sToken), { params: Promise.resolve({ id: listingId }) });
    expect(res.status).toBe(409);
  });

  it('POST purchase succeeds, then a repeat purchase is rejected (not active)', async () => {
    const ok = await purchaseListing(authed(`http://localhost:3001/api/marketplace/${listingId}`, { method: 'POST' }, buyerToken), { params: Promise.resolve({ id: listingId }) });
    expect(ok.status).toBe(201);

    const repeat = await purchaseListing(authed(`http://localhost:3001/api/marketplace/${listingId}`, { method: 'POST' }, buyerToken), { params: Promise.resolve({ id: listingId }) });
    expect(repeat.status).toBe(409);
  });

  it('DELETE withdraw returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await deleteListing(authed(`http://localhost:3001/api/marketplace/${listingId}`, { method: 'DELETE' }, sToken), { params: Promise.resolve({ id: listingId }) })).status).toBe(403);
  });

  it('DELETE withdraw returns 401 when unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await deleteListing(new NextRequest(`http://localhost:3001/api/marketplace/${listingId}`, { method: 'DELETE' }), { params: Promise.resolve({ id: listingId }) })).status).toBe(401);
  });

  it('DELETE withdraw returns 404 for a missing listing', async () => {
    const res = await deleteListing(authed('http://localhost:3001/api/marketplace/listing-missing', { method: 'DELETE' }, sToken), { params: Promise.resolve({ id: 'listing-missing' }) });
    expect(res.status).toBe(404);
  });

  it('DELETE withdraw rejects a non-seller', async () => {
    const fresh = await postListing(sToken, { category: 'lab_results', title: 'Seller Only', price: 60 });
    const res = await deleteListing(authed(`http://localhost:3001/api/marketplace/${fresh.id}`, { method: 'DELETE' }, buyerToken), { params: Promise.resolve({ id: fresh.id }) });
    expect(res.status).toBe(403);
  });

  it('DELETE withdraw succeeds for the seller', async () => {
    const fresh = await postListing(sToken, { category: 'lab_results', title: 'Withdraw Me', price: 60 });
    const res = await deleteListing(authed(`http://localhost:3001/api/marketplace/${fresh.id}`, { method: 'DELETE' }, sToken), { params: Promise.resolve({ id: fresh.id }) });
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe('withdrawn');
  });

  it('DELETE withdraw returns 404 when the datastore update returns nothing', async () => {
    const fresh = await postListing(sToken, { category: 'lab_results', title: 'Update Null', price: 60 });
    mockedUpdate.mockResolvedValueOnce(undefined);
    const res = await deleteListing(authed(`http://localhost:3001/api/marketplace/${fresh.id}`, { method: 'DELETE' }, sToken), { params: Promise.resolve({ id: fresh.id }) });
    expect(res.status).toBe(404);
  });
});
