/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return {
    ...actual,
    runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)),
  };
});

const actualUtils = jest.requireActual('@/lib/utils');
const mockSeededInt = jest.fn(actualUtils.seededInt);
jest.mock('@/lib/utils', () => ({
  ...jest.requireActual('@/lib/utils'),
  seededInt: (...args: unknown[]) => mockSeededInt(...args),
}));

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as getSessions, POST as createSession } from '@/app/api/mpc/sessions/route';
import { GET as getSession } from '@/app/api/mpc/sessions/[id]/route';
import { GET as getDatasets } from '@/app/api/mpc/datasets/route';
import { GET as getResults } from '@/app/api/mpc/results/route';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
  mockSeededInt.mockImplementation(actualUtils.seededInt);
});

describe('/api/mpc/sessions', () => {
  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await getSessions(new NextRequest('http://localhost:3000/api/mpc/sessions'));
    expect(res.status).toBe(403);
  });

  it('POST returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await createSession(
      new NextRequest('http://localhost:3000/api/mpc/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test', protocol: 'secure_sum' }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('GET returns MPC sessions', async () => {
    const res = await getSessions(new NextRequest('http://localhost:3000/api/mpc/sessions'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].id).toMatch(/^mpc-/);
    expect(body.data[0].protocol).toBeDefined();
    expect(body.data[0].status).toBeDefined();
  });

  it('POST creates a new MPC session', async () => {
    const res = await createSession(
      new NextRequest('http://localhost:3000/api/mpc/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test MPC Session',
          protocol: 'secure_sum',
          description: 'A test session for secure computation.',
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Test MPC Session');
    expect(body.data.protocol).toBe('secure_sum');
    expect(body.data.status).toBe('setup');
    expect(body.data.participants).toEqual([]);
  });

  it('POST creates a session without optional fields (defaults applied)', async () => {
    const res = await createSession(
      new NextRequest('http://localhost:3000/api/mpc/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Minimal Session',
          protocol: 'federated_learning',
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.description).toBe('');
    expect(body.data.minParticipants).toBe(3);
    expect(body.data.maxParticipants).toBe(10);
    expect(body.data.privacyBudgetTotal).toBe(5.0);
  });

  it('POST creates a session with custom optional fields', async () => {
    const res = await createSession(
      new NextRequest('http://localhost:3000/api/mpc/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Custom Session',
          protocol: 'secure_sum',
          description: 'Custom description',
          minParticipants: 5,
          maxParticipants: 20,
          privacyBudget: 10.0,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.description).toBe('Custom description');
    expect(body.data.minParticipants).toBe(5);
    expect(body.data.maxParticipants).toBe(20);
    expect(body.data.privacyBudgetTotal).toBe(10.0);
  });

  it('POST returns 400 for missing name', async () => {
    const res = await createSession(
      new NextRequest('http://localhost:3000/api/mpc/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocol: 'secure_sum' }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('POST returns 400 for missing protocol', async () => {
    const res = await createSession(
      new NextRequest('http://localhost:3000/api/mpc/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test' }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('POST returns 400 for invalid JSON body', async () => {
    const res = await createSession(
      new NextRequest('http://localhost:3000/api/mpc/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe('/api/mpc/sessions/[id]', () => {
  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await getSession(new NextRequest('http://localhost:3000/api/mpc/sessions/any-id'), {
      params: Promise.resolve({ id: 'any-id' }),
    });
    expect(res.status).toBe(403);
  });

  it('GET returns session detail with convergence data', async () => {
    // Get a valid session ID from the list
    const listRes = await getSessions(new NextRequest('http://localhost:3000/api/mpc/sessions'));
    const listBody = await listRes.json();
    const sessionId = listBody.data[0]?.id;
    expect(sessionId).toBeDefined();

    const res = await getSession(
      new NextRequest(`http://localhost:3000/api/mpc/sessions/${sessionId}`),
      { params: Promise.resolve({ id: sessionId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(sessionId);
    expect(body.data.convergence).toBeDefined();
  });

  it('GET returns convergence data for all sessions (covers currentRound branches)', async () => {
    const listRes = await getSessions(new NextRequest('http://localhost:3000/api/mpc/sessions'));
    const listBody = await listRes.json();
    for (const session of listBody.data) {
      const res = await getSession(
        new NextRequest(`http://localhost:3000/api/mpc/sessions/${session.id}`),
        { params: Promise.resolve({ id: session.id }) },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.convergence).toBeDefined();
    }
  });

  it('GET uses totalRounds when currentRound is 0 (|| fallback on line 138)', async () => {
    // Force seededInt to return 0 when min=0 (the currentRound generation call)
    mockSeededInt.mockImplementation((seed: number, min: number, max: number) => {
      if (min === 0 && max > 2) return 0; // Force currentRound = 0 for non-completed/non-failed
      return actualUtils.seededInt(seed, min, max);
    });
    // Get the first session (status='setup', currentRound will be forced to 0)
    const listRes = await getSessions(new NextRequest('http://localhost:3000/api/mpc/sessions'));
    const listBody = await listRes.json();
    const setupSession = listBody.data.find((s: { currentRound: number }) => s.currentRound === 0);
    expect(setupSession).toBeDefined();
    const res = await getSession(
      new NextRequest(`http://localhost:3000/api/mpc/sessions/${setupSession.id}`),
      { params: Promise.resolve({ id: setupSession.id }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // convergence should have totalRounds points (not 0)
    expect(body.data.convergence.length).toBeGreaterThan(0);
  });

  it('GET returns 404 for nonexistent session', async () => {
    const res = await getSession(
      new NextRequest('http://localhost:3000/api/mpc/sessions/mpc-nonexistent'),
      { params: Promise.resolve({ id: 'mpc-nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });
});

describe('/api/mpc/datasets', () => {
  afterEach(() => {
    mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
      const actual = jest.requireActual('@/lib/api/middleware');
      return actual.runMiddleware(...args);
    });
  });

  it('GET returns MPC datasets', async () => {
    const res = await getDatasets(new NextRequest('http://localhost:3000/api/mpc/datasets'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await getDatasets(new NextRequest('http://localhost:3000/api/mpc/datasets'));
    expect(res.status).toBe(403);
  });
});

describe('/api/mpc/results', () => {
  afterEach(() => {
    mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
      const actual = jest.requireActual('@/lib/api/middleware');
      return actual.runMiddleware(...args);
    });
  });

  it('GET returns MPC results', async () => {
    const res = await getResults(new NextRequest('http://localhost:3000/api/mpc/results'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await getResults(new NextRequest('http://localhost:3000/api/mpc/results'));
    expect(res.status).toBe(403);
  });
});
