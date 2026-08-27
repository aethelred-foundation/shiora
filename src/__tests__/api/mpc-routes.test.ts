/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as getSessions, POST as createSession } from '@/app/api/mpc/sessions/route';
import { GET as getSession } from '@/app/api/mpc/sessions/[id]/route';
import { GET as getDatasets } from '@/app/api/mpc/datasets/route';
import { GET as getResults } from '@/app/api/mpc/results/route';
import { assignRole, __resetRolesForTests } from '@/lib/api/roles-service';
import { __resetMpcForTests } from '@/lib/api/mpc-service';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

const RESEARCHER = seededAddress(200);
const OUTSIDER = seededAddress(201);
const researcherToken = createSessionToken(RESEARCHER).token;
const outsiderToken = createSessionToken(OUTSIDER).token;

beforeEach(async () => {
  __resetRolesForTests();
  __resetMpcForTests();
  await assignRole(RESEARCHER, 'researcher');
});

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
  __resetMpcForTests();
});

const SESSIONS = 'http://localhost:3000/api/mpc/sessions';
const blocked = () => mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));

function authed(url: string, init: RequestInit = {}, token: string = researcherToken): NextRequest {
  return new NextRequest(url, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` } });
}

function jsonPost(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) };
}

const sumBody = { name: 'Vitals pooling', protocol: 'secure_sum', threshold: 2, contributions: [3, 5, 7] };

async function runOne(): Promise<string> {
  const res = await createSession(authed(SESSIONS, jsonPost(sumBody)));
  return (await res.json()).data.id;
}

describe('POST /api/mpc/sessions (researcher-gated)', () => {
  it('returns the middleware error when blocked', async () => {
    blocked();
    expect((await createSession(authed(SESSIONS, jsonPost(sumBody)))).status).toBe(403);
  });

  it('returns 403 for a non-researcher', async () => {
    expect((await createSession(authed(SESSIONS, jsonPost(sumBody), outsiderToken))).status).toBe(403);
  });

  it('runs a real secure aggregation and returns only the result', async () => {
    const res = await createSession(authed(SESSIONS, jsonPost(sumBody)));
    expect(res.status).toBe(201);
    const data = (await res.json()).data;
    expect(data.result).toBe(15); // exact secure sum
    expect(data.participantCount).toBe(3);
  });

  it('returns 422 when the threshold exceeds the number of contributions', async () => {
    const bad = { ...sumBody, threshold: 9 };
    expect((await createSession(authed(SESSIONS, jsonPost(bad)))).status).toBe(422);
  });

  it('rethrows a non-Zod error (invalid JSON body)', async () => {
    await expect(createSession(authed(SESSIONS, jsonPost('not-json')))).rejects.toThrow();
  });
});

describe('GET /api/mpc/sessions', () => {
  it('returns the middleware error when blocked', async () => {
    blocked();
    expect((await getSessions(authed(SESSIONS))).status).toBe(403);
  });

  it('returns 403 for a non-researcher', async () => {
    expect((await getSessions(authed(SESSIONS, {}, outsiderToken))).status).toBe(403);
  });

  it('lists the researcher\'s sessions, newest first', async () => {
    await runOne();
    await runOne(); // two so the sort comparator runs
    const body = await (await getSessions(authed(SESSIONS))).json();
    expect(body.data.total).toBe(2);
    expect(body.data.sessions[0].result).toBe(15);
  });
});

describe('GET /api/mpc/sessions/[id]', () => {
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  it('returns the middleware error when blocked', async () => {
    blocked();
    expect((await getSession(authed(`${SESSIONS}/x`), ctx('x'))).status).toBe(403);
  });

  it('returns 403 for a non-researcher', async () => {
    expect((await getSession(authed(`${SESSIONS}/x`, {}, outsiderToken), ctx('x'))).status).toBe(403);
  });

  it('returns an owned session', async () => {
    const id = await runOne();
    const res = await getSession(authed(`${SESSIONS}/${id}`), ctx(id));
    expect(res.status).toBe(200);
    expect((await res.json()).data.result).toBe(15);
  });

  it('returns 404 for an unknown session', async () => {
    expect((await getSession(authed(`${SESSIONS}/nope`), ctx('nope'))).status).toBe(404);
  });
});

describe('GET /api/mpc/datasets and /results', () => {
  const DATASETS = 'http://localhost:3000/api/mpc/datasets';
  const RESULTS = 'http://localhost:3000/api/mpc/results';

  it('datasets returns the supported protocol catalog', async () => {
    const body = await (await getDatasets(authed(DATASETS))).json();
    expect(body.data.protocols.map((p: { protocol: string }) => p.protocol))
      .toEqual(expect.arrayContaining(['secure_sum', 'federated_averaging', 'secure_count']));
  });

  it('datasets returns the middleware error when blocked', async () => {
    blocked();
    expect((await getDatasets(authed(DATASETS))).status).toBe(403);
  });

  it('datasets returns 403 for a non-researcher', async () => {
    expect((await getDatasets(authed(DATASETS, {}, outsiderToken))).status).toBe(403);
  });

  it('results returns the caller\'s aggregate results, newest first', async () => {
    await runOne();
    await runOne(); // two so the sort comparator runs
    const body = await (await getResults(authed(RESULTS))).json();
    expect(body.data.total).toBe(2);
    expect(body.data.results[0].result).toBe(15);
  });

  it('results returns the middleware error when blocked', async () => {
    blocked();
    expect((await getResults(authed(RESULTS))).status).toBe(403);
  });

  it('results returns 403 for a non-researcher', async () => {
    expect((await getResults(authed(RESULTS, {}, outsiderToken))).status).toBe(403);
  });
});
