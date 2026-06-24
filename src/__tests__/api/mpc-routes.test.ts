/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
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
import { assignRole, __resetRolesForTests } from '@/lib/api/roles-service';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

const RESEARCHER = seededAddress(200);
const OUTSIDER = seededAddress(201);
const researcherToken = createSessionToken(RESEARCHER).token;
const outsiderToken = createSessionToken(OUTSIDER).token;

beforeEach(async () => {
  __resetRolesForTests();
  await assignRole(RESEARCHER, 'researcher');
});

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
  mockSeededInt.mockImplementation(actualUtils.seededInt);
});

function authed(url: string, init: RequestInit = {}, token: string = researcherToken): NextRequest {
  return new NextRequest(url, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` } });
}

function jsonPost(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) };
}

const SESSIONS = 'http://localhost:3000/api/mpc/sessions';

describe('/api/mpc/sessions (researcher-gated)', () => {
  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await getSessions(authed(SESSIONS))).status).toBe(403);
  });

  it('POST returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await createSession(authed(SESSIONS, jsonPost({ name: 'Test', protocol: 'secure_sum' })))).status).toBe(403);
  });

  it('GET returns 403 for a non-researcher', async () => {
    expect((await getSessions(authed(SESSIONS, {}, outsiderToken))).status).toBe(403);
  });

  it('POST returns 403 for a non-researcher', async () => {
    expect((await createSession(authed(SESSIONS, jsonPost({ name: 'Test', protocol: 'secure_sum' }), outsiderToken))).status).toBe(403);
  });

  it('GET returns MPC sessions for a researcher', async () => {
    const res = await getSessions(authed(SESSIONS));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].id).toMatch(/^mpc-/);
    expect(body.data[0].protocol).toBeDefined();
  });

  it('POST creates a new MPC session', async () => {
    const res = await createSession(authed(SESSIONS, jsonPost({ name: 'Test MPC Session', protocol: 'secure_sum', description: 'A test session.' })));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe('Test MPC Session');
    expect(body.data.status).toBe('setup');
    expect(body.data.participants).toEqual([]);
  });

  it('POST creates a session without optional fields (defaults applied)', async () => {
    const res = await createSession(authed(SESSIONS, jsonPost({ name: 'Minimal Session', protocol: 'federated_learning' })));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.description).toBe('');
    expect(body.data.minParticipants).toBe(3);
    expect(body.data.maxParticipants).toBe(10);
    expect(body.data.privacyBudgetTotal).toBe(5.0);
  });

  it('POST creates a session with custom optional fields', async () => {
    const res = await createSession(authed(SESSIONS, jsonPost({ name: 'Custom Session', protocol: 'secure_sum', description: 'Custom description', minParticipants: 5, maxParticipants: 20, privacyBudget: 10.0 })));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.description).toBe('Custom description');
    expect(body.data.minParticipants).toBe(5);
    expect(body.data.privacyBudgetTotal).toBe(10.0);
  });

  it('POST returns 400 for missing name', async () => {
    expect((await createSession(authed(SESSIONS, jsonPost({ protocol: 'secure_sum' })))).status).toBe(400);
  });

  it('POST returns 400 for missing protocol', async () => {
    expect((await createSession(authed(SESSIONS, jsonPost({ name: 'Test' })))).status).toBe(400);
  });

  it('POST returns 400 for invalid JSON body', async () => {
    expect((await createSession(authed(SESSIONS, jsonPost('not-json')))).status).toBe(400);
  });
});

describe('/api/mpc/sessions/[id] (researcher-gated)', () => {
  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await getSession(authed(`${SESSIONS}/any-id`), { params: Promise.resolve({ id: 'any-id' }) });
    expect(res.status).toBe(403);
  });

  it('GET returns 403 for a non-researcher', async () => {
    const res = await getSession(authed(`${SESSIONS}/any-id`, {}, outsiderToken), { params: Promise.resolve({ id: 'any-id' }) });
    expect(res.status).toBe(403);
  });

  it('GET returns session detail with convergence data', async () => {
    const listBody = await (await getSessions(authed(SESSIONS))).json();
    const sessionId = listBody.data[0]?.id;
    expect(sessionId).toBeDefined();

    const res = await getSession(authed(`${SESSIONS}/${sessionId}`), { params: Promise.resolve({ id: sessionId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(sessionId);
    expect(body.data.convergence).toBeDefined();
  });

  it('GET returns convergence data for all sessions (covers currentRound branches)', async () => {
    const listBody = await (await getSessions(authed(SESSIONS))).json();
    for (const session of listBody.data) {
      const res = await getSession(authed(`${SESSIONS}/${session.id}`), { params: Promise.resolve({ id: session.id }) });
      expect(res.status).toBe(200);
      expect((await res.json()).data.convergence).toBeDefined();
    }
  });

  it('GET uses totalRounds when currentRound is 0 (|| fallback)', async () => {
    mockSeededInt.mockImplementation((seed: number, min: number, max: number) => {
      if (min === 0 && max > 2) return 0;
      return actualUtils.seededInt(seed, min, max);
    });
    const listBody = await (await getSessions(authed(SESSIONS))).json();
    const setupSession = listBody.data.find((s: { currentRound: number }) => s.currentRound === 0);
    expect(setupSession).toBeDefined();
    const res = await getSession(authed(`${SESSIONS}/${setupSession.id}`), { params: Promise.resolve({ id: setupSession.id }) });
    expect(res.status).toBe(200);
    expect((await res.json()).data.convergence.length).toBeGreaterThan(0);
  });

  it('GET returns 404 for a nonexistent session', async () => {
    const res = await getSession(authed(`${SESSIONS}/mpc-nonexistent`), { params: Promise.resolve({ id: 'mpc-nonexistent' }) });
    expect(res.status).toBe(404);
  });
});

describe('/api/mpc/datasets (researcher-gated)', () => {
  it('GET returns MPC datasets for a researcher', async () => {
    const res = await getDatasets(authed('http://localhost:3000/api/mpc/datasets'));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('GET returns 403 for a non-researcher', async () => {
    expect((await getDatasets(authed('http://localhost:3000/api/mpc/datasets', {}, outsiderToken))).status).toBe(403);
  });

  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await getDatasets(authed('http://localhost:3000/api/mpc/datasets'))).status).toBe(403);
  });
});

describe('/api/mpc/results (researcher-gated)', () => {
  it('GET returns MPC results for a researcher', async () => {
    const res = await getResults(authed('http://localhost:3000/api/mpc/results'));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('GET returns 403 for a non-researcher', async () => {
    expect((await getResults(authed('http://localhost:3000/api/mpc/results', {}, outsiderToken))).status).toBe(403);
  });

  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await getResults(authed('http://localhost:3000/api/mpc/results'))).status).toBe(403);
  });
});
