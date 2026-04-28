/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { GET as getCircles } from '@/app/api/community/circles/route';
import { GET as getCircle, POST as joinCircle } from '@/app/api/community/circles/[id]/route';
import { GET as getPosts, POST as createPost } from '@/app/api/community/posts/route';
import { POST as reactToPost } from '@/app/api/community/posts/[postId]/react/route';

const actualMiddleware = jest.requireActual('@/lib/api/middleware');
const actualConstants = jest.requireActual('@/lib/constants');

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return {
    __esModule: true,
    ...actual,
    runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)),
  };
});

let mockCommunityCategories: unknown[] | null = null;

jest.mock('@/lib/constants', () => {
  const actual = jest.requireActual('@/lib/constants');
  return {
    __esModule: true,
    ...actual,
    get COMMUNITY_CATEGORIES() {
      return mockCommunityCategories ?? actual.COMMUNITY_CATEGORIES;
    },
  };
});

import { runMiddleware } from '@/lib/api/middleware';
const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) =>
    actualMiddleware.runMiddleware(...args),
  );
});

describe('/api/community/circles', () => {
  it('GET returns community circles', async () => {
    const res = await getCircles(new NextRequest('http://localhost:3000/api/community/circles'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].id).toMatch(/^circle-/);
    expect(body.data[0].memberCount).toBeDefined();
  });

  it('GET returns blocked when middleware returns a response', async () => {
    const blockedResponse = NextResponse.json({ error: 'blocked' }, { status: 429 });
    mockedRunMiddleware.mockReturnValueOnce(blockedResponse);
    const res = await getCircles(new NextRequest('http://localhost:3000/api/community/circles'));
    expect(res.status).toBe(429);
  });

  it('GET falls back to cat.label when circle name not in CIRCLE_NAMES', async () => {
    mockCommunityCategories = [
      {
        id: 'unknown_category',
        label: 'Unknown Label',
        icon: 'Star',
        color: '#fff',
        description: 'Test',
      },
    ];
    const res = await getCircles(new NextRequest('http://localhost:3000/api/community/circles'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].name).toBe('Unknown Label');
    mockCommunityCategories = null;
  });
});

describe('/api/community/circles/[id]', () => {
  it('GET returns a single circle', async () => {
    const res = await getCircle(
      new NextRequest('http://localhost:3000/api/community/circles/circle-test'),
      { params: Promise.resolve({ id: 'circle-test' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('circle-test');
  });

  it('POST joins a circle', async () => {
    const res = await joinCircle(
      new NextRequest('http://localhost:3000/api/community/circles/circle-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join' }),
      }),
      { params: Promise.resolve({ id: 'circle-test' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.circleId).toBe('circle-test');
    expect(body.data.action).toBe('join');
  });

  it('POST leaves a circle', async () => {
    const res = await joinCircle(
      new NextRequest('http://localhost:3000/api/community/circles/circle-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave' }),
      }),
      { params: Promise.resolve({ id: 'circle-test' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.action).toBe('leave');
  });

  it('POST returns 422 for invalid action', async () => {
    const res = await joinCircle(
      new NextRequest('http://localhost:3000/api/community/circles/circle-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'kick' }),
      }),
      { params: Promise.resolve({ id: 'circle-test' }) },
    );
    expect(res.status).toBe(422);
  });

  it('GET returns blocked when middleware returns a response', async () => {
    const blockedResponse = NextResponse.json({ error: 'blocked' }, { status: 429 });
    mockedRunMiddleware.mockReturnValueOnce(blockedResponse);
    const res = await getCircle(
      new NextRequest('http://localhost:3000/api/community/circles/circle-test'),
      { params: Promise.resolve({ id: 'circle-test' }) },
    );
    expect(res.status).toBe(429);
  });

  it('POST returns 400 for invalid JSON body', async () => {
    const res = await joinCircle(
      new NextRequest('http://localhost:3000/api/community/circles/circle-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
      { params: Promise.resolve({ id: 'circle-test' }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_REQUEST');
  });

  it('POST returns 403 for disallowed origin', async () => {
    const res = await joinCircle(
      new NextRequest('http://localhost:3000/api/community/circles/circle-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'https://evil.example.com',
        },
        body: JSON.stringify({ action: 'join' }),
      }),
      { params: Promise.resolve({ id: 'circle-test' }) },
    );
    expect(res.status).toBe(403);
  });
});

describe('/api/community/posts', () => {
  it('GET returns community posts', async () => {
    const res = await getPosts(new NextRequest('http://localhost:3000/api/community/posts'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('GET filters by circleId', async () => {
    const res = await getPosts(
      new NextRequest('http://localhost:3000/api/community/posts?circleId=circle-test'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    body.data.forEach((p: { circleId: string }) => {
      expect(p.circleId).toBe('circle-test');
    });
  });

  it('POST creates a new post', async () => {
    const res = await createPost(
      new NextRequest('http://localhost:3000/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ circleId: 'circle-test', content: 'Hello community!' }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.circleId).toBe('circle-test');
    expect(body.data.content).toBe('Hello community!');
    expect(body.data.zkpVerified).toBe(true);
  });

  it('POST returns 422 for missing content', async () => {
    const res = await createPost(
      new NextRequest('http://localhost:3000/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ circleId: 'circle-test' }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('POST returns 422 for missing circleId', async () => {
    const res = await createPost(
      new NextRequest('http://localhost:3000/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Missing circle' }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('POST returns 400 for invalid JSON body', async () => {
    const res = await createPost(
      new NextRequest('http://localhost:3000/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_REQUEST');
  });

  it('POST returns 403 for disallowed origin', async () => {
    const res = await createPost(
      new NextRequest('http://localhost:3000/api/community/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'https://evil.example.com',
        },
        body: JSON.stringify({ circleId: 'circle-test', content: 'Hello' }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('GET returns blocked when middleware returns a response', async () => {
    const blockedResponse = NextResponse.json({ error: 'blocked' }, { status: 429 });
    mockedRunMiddleware.mockReturnValueOnce(blockedResponse);
    const res = await getPosts(new NextRequest('http://localhost:3000/api/community/posts'));
    expect(res.status).toBe(429);
  });
});

describe('/api/community/posts/[postId]/react', () => {
  it('POST adds a reaction to a post', async () => {
    const res = await reactToPost(
      new NextRequest('http://localhost:3000/api/community/posts/post-123/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction: 'heart' }),
      }),
      { params: Promise.resolve({ postId: 'post-123' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.postId).toBe('post-123');
    expect(body.data.reaction).toBe('heart');
  });

  it('POST defaults reaction to heart', async () => {
    const res = await reactToPost(
      new NextRequest('http://localhost:3000/api/community/posts/post-456/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ postId: 'post-456' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.reaction).toBe('heart');
  });

  it('POST returns 403 for disallowed origin', async () => {
    const res = await reactToPost(
      new NextRequest('http://localhost:3000/api/community/posts/post-123/react', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'https://evil.example.com',
        },
        body: JSON.stringify({ reaction: 'heart' }),
      }),
      { params: Promise.resolve({ postId: 'post-123' }) },
    );
    expect(res.status).toBe(403);
  });
});
