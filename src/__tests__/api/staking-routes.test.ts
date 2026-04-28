/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return {
    ...actual,
    runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)),
  };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as getStaking, POST as stake } from '@/app/api/staking/route';
import { GET as getRewards, POST as claimRewards } from '@/app/api/staking/rewards/route';
import { POST as unstake } from '@/app/api/staking/[positionId]/unstake/route';
import { POST as withdraw } from '@/app/api/staking/[positionId]/withdraw/route';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

describe('/api/staking', () => {
  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await getStaking(new NextRequest('http://localhost:3000/api/staking'));
    expect(res.status).toBe(403);
  });

  it('POST returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await stake(
      new NextRequest('http://localhost:3000/api/staking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1000 }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('GET returns staking positions', async () => {
    const res = await getStaking(new NextRequest('http://localhost:3000/api/staking'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].id).toMatch(/^stake-/);
    expect(body.data[0].amount).toBeDefined();
  });

  it('GET returns stats view', async () => {
    const res = await getStaking(new NextRequest('http://localhost:3000/api/staking?view=stats'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.totalStaked).toBeDefined();
    expect(body.data.currentAPY).toBeDefined();
    expect(body.data.minStakeAmount).toBe(100);
  });

  it('POST stakes tokens', async () => {
    const res = await stake(
      new NextRequest('http://localhost:3000/api/staking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1000 }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.amount).toBe(1000);
    expect(body.data.status).toBe('staked');
    expect(body.data.txHash).toBeDefined();
  });

  it('POST returns 422 for amount below minimum', async () => {
    const res = await stake(
      new NextRequest('http://localhost:3000/api/staking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 50 }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('POST returns 422 for missing amount', async () => {
    const res = await stake(
      new NextRequest('http://localhost:3000/api/staking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('POST returns 400 for invalid JSON body', async () => {
    const res = await stake(
      new NextRequest('http://localhost:3000/api/staking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe('/api/staking/rewards', () => {
  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await getRewards(new NextRequest('http://localhost:3000/api/staking/rewards'));
    expect(res.status).toBe(403);
  });

  it('POST returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await claimRewards(
      new NextRequest('http://localhost:3000/api/staking/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId: 'test' }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('GET returns staking rewards', async () => {
    const res = await getRewards(new NextRequest('http://localhost:3000/api/staking/rewards'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].id).toMatch(/^reward-/);
  });

  it('POST claims rewards for a position', async () => {
    const res = await claimRewards(
      new NextRequest('http://localhost:3000/api/staking/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId: 'stake-test' }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.positionId).toBe('stake-test');
    expect(body.data.txHash).toBeDefined();
  });

  it('POST returns 422 for missing positionId', async () => {
    const res = await claimRewards(
      new NextRequest('http://localhost:3000/api/staking/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('POST returns 400 for invalid JSON body', async () => {
    const res = await claimRewards(
      new NextRequest('http://localhost:3000/api/staking/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe('/api/staking/[positionId]/unstake', () => {
  afterEach(() => {
    mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
      const actual = jest.requireActual('@/lib/api/middleware');
      return actual.runMiddleware(...args);
    });
  });

  it('POST initiates unstaking for a position', async () => {
    const res = await unstake(
      new NextRequest('http://localhost:3000/api/staking/stake-test-1/unstake', { method: 'POST' }),
      { params: Promise.resolve({ positionId: 'stake-test-1' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.positionId).toBe('stake-test-1');
    expect(body.data.status).toBe('unstaking');
    expect(body.data.txHash).toBeDefined();
    expect(body.data.cooldownEndsAt).toBeDefined();
  });

  it('POST returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await unstake(
      new NextRequest('http://localhost:3000/api/staking/stake-test-1/unstake', { method: 'POST' }),
      { params: Promise.resolve({ positionId: 'stake-test-1' }) },
    );
    expect(res.status).toBe(403);
  });
});

describe('/api/staking/[positionId]/withdraw', () => {
  afterEach(() => {
    mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
      const actual = jest.requireActual('@/lib/api/middleware');
      return actual.runMiddleware(...args);
    });
  });

  it('POST withdraws a staking position', async () => {
    const res = await withdraw(
      new NextRequest('http://localhost:3000/api/staking/stake-test-2/withdraw', {
        method: 'POST',
      }),
      { params: Promise.resolve({ positionId: 'stake-test-2' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.positionId).toBe('stake-test-2');
    expect(body.data.status).toBe('withdrawn');
    expect(body.data.txHash).toBeDefined();
    expect(body.data.withdrawnAt).toBeDefined();
  });

  it('POST returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await withdraw(
      new NextRequest('http://localhost:3000/api/staking/stake-test-2/withdraw', {
        method: 'POST',
      }),
      { params: Promise.resolve({ positionId: 'stake-test-2' }) },
    );
    expect(res.status).toBe(403);
  });
});
