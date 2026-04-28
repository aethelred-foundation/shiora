/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET as getProvider, POST as postReview } from '@/app/api/providers/[address]/route';
import { GET as getReputation } from '@/app/api/providers/reputation/route';
import { seededAddress } from '@/lib/utils';

describe('/api/providers/[address]', () => {
  const knownAddr = seededAddress(1800);

  it('GET returns provider details for a known address', async () => {
    const res = await getProvider(
      new NextRequest(`http://localhost:3000/api/providers/${knownAddr}`),
      { params: Promise.resolve({ address: knownAddr }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.provider).toBeDefined();
    expect(body.data.provider.address).toBe(knownAddr);
    expect(body.data.reviews).toBeDefined();
    expect(Array.isArray(body.data.reviews)).toBe(true);
  });

  it('GET returns 404 for unknown address', async () => {
    const res = await getProvider(
      new NextRequest('http://localhost:3000/api/providers/aeth1unknown'),
      { params: Promise.resolve({ address: 'aeth1unknown' }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('POST submits a review for a known provider', async () => {
    const res = await postReview(
      new NextRequest(`http://localhost:3000/api/providers/${knownAddr}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: 5,
          categories: { communication: 5, dataHandling: 4, timeliness: 5, professionalism: 5 },
          comment: 'Excellent provider.',
        }),
      }),
      { params: Promise.resolve({ address: knownAddr }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.providerAddress).toBe(knownAddr);
    expect(body.data.rating).toBe(5);
  });

  it('POST returns 400 for missing required fields', async () => {
    const res = await postReview(
      new NextRequest(`http://localhost:3000/api/providers/${knownAddr}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 5 }),
      }),
      { params: Promise.resolve({ address: knownAddr }) },
    );
    expect(res.status).toBe(400);
  });

  it('POST returns 404 for review on unknown provider', async () => {
    const res = await postReview(
      new NextRequest('http://localhost:3000/api/providers/aeth1unknown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: 5,
          categories: { communication: 5, dataHandling: 4, timeliness: 5, professionalism: 5 },
          comment: 'Test.',
        }),
      }),
      { params: Promise.resolve({ address: 'aeth1unknown' }) },
    );
    expect(res.status).toBe(404);
  });

  it('POST returns 500 for invalid JSON body', async () => {
    const res = await postReview(
      new NextRequest(`http://localhost:3000/api/providers/${knownAddr}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
      { params: Promise.resolve({ address: knownAddr }) },
    );
    expect(res.status).toBe(500);
  });
});

describe('/api/providers/reputation', () => {
  it('GET returns reputation data', async () => {
    const res = await getReputation(
      new NextRequest('http://localhost:3000/api/providers/reputation'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].overallScore).toBeDefined();
    expect(body.data[0].trustLevel).toBeDefined();
  });

  it('GET filters by trustLevel', async () => {
    const res = await getReputation(
      new NextRequest('http://localhost:3000/api/providers/reputation?trustLevel=gold'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    body.data.forEach((p: { trustLevel: string }) => {
      expect(p.trustLevel).toBe('gold');
    });
  });

  it('GET filters by search', async () => {
    const res = await getReputation(
      new NextRequest('http://localhost:3000/api/providers/reputation?search=health'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
