/** @jest-environment node */

jest.mock('@/lib/constants', () => ({
  ...jest.requireActual('@/lib/constants'),
  REWARD_ACTIONS: [
    ...jest.requireActual('@/lib/constants').REWARD_ACTIONS,
    { id: 'unknown_action', label: 'Unknown Action', aethel: 1, icon: 'Circle' },
  ],
}));

import { NextRequest } from 'next/server';
import { GET as getRewards } from '@/app/api/rewards/route';
import { GET as getHistory, POST as claimReward } from '@/app/api/rewards/history/route';

describe('/api/rewards', () => {
  it('GET returns rewards list', async () => {
    const res = await getRewards(new NextRequest('http://localhost:3000/api/rewards'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].id).toMatch(/^rwd-/);
    expect(body.data[0].action).toBeDefined();
    expect(body.data[0].amount).toBeDefined();
  });

  it('GET filters by action', async () => {
    const res = await getRewards(
      new NextRequest('http://localhost:3000/api/rewards?action=data_upload'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    body.data.forEach((r: { action: string }) => {
      expect(r.action).toBe('data_upload');
    });
  });

  it('GET filters by claimed=true', async () => {
    const res = await getRewards(new NextRequest('http://localhost:3000/api/rewards?claimed=true'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    body.data.forEach((r: { claimedAt?: number }) => {
      expect(r.claimedAt).toBeDefined();
    });
  });

  it('GET filters by claimed=false', async () => {
    const res = await getRewards(
      new NextRequest('http://localhost:3000/api/rewards?claimed=false'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    body.data.forEach((r: { claimedAt?: number }) => {
      expect(r.claimedAt).toBeUndefined();
    });
  });
});

describe('/api/rewards/history', () => {
  it('GET returns rewards history', async () => {
    const res = await getHistory();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST claims a reward', async () => {
    const res = await claimReward(
      new NextRequest('http://localhost:3000/api/rewards/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'rwd-test',
          action: 'data_upload',
          description: 'Uploaded lab results',
          amount: 10,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('rwd-test');
    expect(body.data.claimedAt).toBeDefined();
    expect(body.data.txHash).toBeDefined();
  });

  it('POST claims a reward without description (defaults to "Reward claimed")', async () => {
    const res = await claimReward(
      new NextRequest('http://localhost:3000/api/rewards/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'rwd-no-desc',
          action: 'wearable_sync',
          amount: 5,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.description).toBe('Reward claimed');
  });

  it('POST returns 400 for missing required fields', async () => {
    const res = await claimReward(
      new NextRequest('http://localhost:3000/api/rewards/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'rwd-test' }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('POST returns 500 for invalid JSON body', async () => {
    const res = await claimReward(
      new NextRequest('http://localhost:3000/api/rewards/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(500);
  });
});
