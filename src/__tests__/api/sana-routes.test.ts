/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { POST as sendMessage } from '@/app/api/sana/messages/route';
import { GET as listConversations } from '@/app/api/sana/conversations/route';
import { GET as getConversation } from '@/app/api/sana/conversations/[id]/route';
import { __resetSanaForTests } from '@/lib/api/sana/sana-service';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const USER = seededAddress(500);
const token = createSessionToken(USER).token;

beforeEach(() => {
  delete process.env.ANTHROPIC_API_KEY; // force the deterministic offline stub
  __resetSanaForTests();
});

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
  __resetSanaForTests();
});

const MESSAGES = 'http://localhost:3000/api/sana/messages';
const CONVERSATIONS = 'http://localhost:3000/api/sana/conversations';

function authedPost(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function authedGet(url: string): NextRequest {
  return new NextRequest(url, { headers: { authorization: `Bearer ${token}` } });
}

const blocked = () => mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe('POST /api/sana/messages', () => {
  it('returns the middleware error when blocked', async () => {
    blocked();
    expect((await sendMessage(authedPost(MESSAGES, { message: 'hi' }))).status).toBe(403);
  });

  it('returns 401 when the middleware is bypassed but unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    const req = new NextRequest(MESSAGES, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect((await sendMessage(req)).status).toBe(401);
  });

  it('creates a conversation and returns a disclaimed reply', async () => {
    const res = await sendMessage(authedPost(MESSAGES, { message: 'what is an A1C?' }));
    expect(res.status).toBe(200);
    const data = (await res.json()).data;
    expect(data.conversationId).toMatch(/^sana-/);
    expect(data.reply.content).toMatch(/not a substitute for professional/);
  });

  it('continues an existing conversation by id', async () => {
    const first = await (await sendMessage(authedPost(MESSAGES, { message: 'hello' }))).json();
    const res = await sendMessage(authedPost(MESSAGES, { conversationId: first.data.conversationId, message: 'more' }));
    expect((await res.json()).data.conversationId).toBe(first.data.conversationId);
  });

  it('returns 422 for an empty message', async () => {
    expect((await sendMessage(authedPost(MESSAGES, { message: '' }))).status).toBe(422);
  });

  it('throws on an invalid JSON body', async () => {
    await expect(sendMessage(authedPost(MESSAGES, 'not-json'))).rejects.toThrow();
  });
});

describe('GET /api/sana/conversations', () => {
  it('returns the middleware error when blocked', async () => {
    blocked();
    expect((await listConversations(authedGet(CONVERSATIONS))).status).toBe(403);
  });

  it('returns 401 when bypassed but unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await listConversations(new NextRequest(CONVERSATIONS))).status).toBe(401);
  });

  it('lists the caller\'s conversation summaries, most recently updated first', async () => {
    await sendMessage(authedPost(MESSAGES, { message: 'first conversation' }));
    await sendMessage(authedPost(MESSAGES, { message: 'second conversation' }));

    const body = await (await listConversations(authedGet(CONVERSATIONS))).json();
    expect(body.data.total).toBe(2);
    expect(body.data.conversations[0]).toHaveProperty('messageCount', 2);
    // newest-first ordering (exercises the sort comparator)
    const [a, b] = body.data.conversations;
    expect(a.updatedAt).toBeGreaterThanOrEqual(b.updatedAt);
  });
});

describe('GET /api/sana/conversations/[id]', () => {
  it('returns the middleware error when blocked', async () => {
    blocked();
    expect((await getConversation(authedGet(`${CONVERSATIONS}/x`), ctx('x'))).status).toBe(403);
  });

  it('returns 401 when bypassed but unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await getConversation(new NextRequest(`${CONVERSATIONS}/x`), ctx('x'))).status).toBe(401);
  });

  it('returns the full transcript of a conversation', async () => {
    const created = await (await sendMessage(authedPost(MESSAGES, { message: 'hello' }))).json();
    const id = created.data.conversationId;
    const res = await getConversation(authedGet(`${CONVERSATIONS}/${id}`), ctx(id));
    expect(res.status).toBe(200);
    expect((await res.json()).data.messages).toHaveLength(2);
  });

  it('returns 404 for a missing conversation', async () => {
    expect((await getConversation(authedGet(`${CONVERSATIONS}/nope`), ctx('nope'))).status).toBe(404);
  });
});
