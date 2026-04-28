/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { GET as getChat, POST as postChat } from '@/app/api/chat/route';
import {
  GET as getConversations,
  POST as postConversation,
} from '@/app/api/chat/conversations/route';
import { GET as getChatById, DELETE as deleteChatById } from '@/app/api/chat/[id]/route';

const actualMiddleware = jest.requireActual('@/lib/api/middleware');

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return {
    __esModule: true,
    ...actual,
    runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)),
  };
});

import { runMiddleware } from '@/lib/api/middleware';
const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) =>
    actualMiddleware.runMiddleware(...args),
  );
});

describe('/api/chat', () => {
  it('GET returns chat messages list', async () => {
    const req = new NextRequest('http://localhost:3000/api/chat');
    const res = await getChat(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('POST sends a message and gets response', async () => {
    const req = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: 'conv-c205925529d6',
        content: 'What are my latest lab results?',
      }),
    });
    const res = await postChat(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('POST returns error for missing content', async () => {
    const req = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await postChat(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('POST returns error for missing conversationId', async () => {
    const req = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hello' }),
    });
    const res = await postChat(req);
    expect(res.status).toBe(400);
  });

  it('POST returns error for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await postChat(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
  });

  it('POST returns 403 for disallowed origin', async () => {
    const req = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'https://evil.example.com',
      },
      body: JSON.stringify({ conversationId: 'conv-1', content: 'test' }),
    });
    const res = await postChat(req);
    expect(res.status).toBe(403);
  });

  it('GET returns blocked response when middleware blocks', async () => {
    const blockedResponse = NextResponse.json({ error: 'blocked' }, { status: 429 });
    mockedRunMiddleware.mockReturnValueOnce(blockedResponse);
    const req = new NextRequest('http://localhost:3000/api/chat');
    const res = await getChat(req);
    expect(res.status).toBe(429);
  });
});

describe('/api/chat/conversations', () => {
  it('GET returns conversations', async () => {
    const req = new NextRequest('http://localhost:3000/api/chat/conversations');
    const res = await getConversations(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST creates a new conversation', async () => {
    const req = new NextRequest('http://localhost:3000/api/chat/conversations', {
      method: 'POST',
    });
    const res = await postConversation(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('New Conversation');
    expect(body.data.messageCount).toBe(0);
  });

  it('GET returns blocked when middleware returns a response', async () => {
    const blockedResponse = NextResponse.json({ error: 'blocked' }, { status: 429 });
    mockedRunMiddleware.mockReturnValueOnce(blockedResponse);
    const req = new NextRequest('http://localhost:3000/api/chat/conversations');
    const res = await getConversations(req);
    expect(res.status).toBe(429);
  });

  it('POST returns 403 for disallowed origin', async () => {
    const req = new NextRequest('http://localhost:3000/api/chat/conversations', {
      method: 'POST',
      headers: { origin: 'https://evil.example.com' },
    });
    const res = await postConversation(req);
    expect(res.status).toBe(403);
  });
});

describe('/api/chat/[id]', () => {
  it('GET returns a specific conversation', async () => {
    const res = await getChatById(
      new NextRequest('http://localhost:3000/api/chat/conv-c205925529d6'),
      { params: Promise.resolve({ id: 'conv-c205925529d6' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns 404 for nonexistent conversation', async () => {
    const res = await getChatById(
      new NextRequest('http://localhost:3000/api/chat/conv-nonexistent'),
      { params: Promise.resolve({ id: 'conv-nonexistent' }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('DELETE deletes an existing conversation', async () => {
    const res = await deleteChatById(
      new NextRequest('http://localhost:3000/api/chat/conv-c205925529d6', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'conv-c205925529d6' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.deleted).toBe(true);
  });

  it('DELETE returns 404 for nonexistent conversation', async () => {
    const res = await deleteChatById(
      new NextRequest('http://localhost:3000/api/chat/conv-nonexistent', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'conv-nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });

  it('DELETE returns 403 for disallowed origin', async () => {
    const res = await deleteChatById(
      new NextRequest('http://localhost:3000/api/chat/conv-c205925529d6', {
        method: 'DELETE',
        headers: { origin: 'https://evil.example.com' },
      }),
      { params: Promise.resolve({ id: 'conv-c205925529d6' }) },
    );
    expect(res.status).toBe(403);
  });

  it('GET returns blocked when middleware returns a response', async () => {
    const blockedResponse = NextResponse.json({ error: 'blocked' }, { status: 429 });
    mockedRunMiddleware.mockReturnValueOnce(blockedResponse);
    const res = await getChatById(
      new NextRequest('http://localhost:3000/api/chat/conv-c205925529d6'),
      { params: Promise.resolve({ id: 'conv-c205925529d6' }) },
    );
    expect(res.status).toBe(429);
  });
});
