// ============================================================
// Shiora on Aethelred — Community Posts API
// GET  /api/community/posts — List posts, optionally by circle
// POST /api/community/posts — Create a new anonymous post
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededInt, seededHex, seededRandom, seededPick } from '@/lib/utils';

const SEED = 1500;

// ────────────────────────────────────────────────────────────
// GET /api/community/posts
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const circleId = request.nextUrl.searchParams.get('circleId');

  const posts = Array.from({ length: 20 }, (_, i) => ({
    id: `post-${seededHex(SEED + i * 200, 8)}`,
    circleId: circleId ?? `circle-${seededHex(SEED + (i % 8) * 100, 8)}`,
    anonymousId: `anon-${seededHex(SEED + i * 201, 6)}`,
    content: `Community post content #${i + 1}`,
    timestamp: Date.now() - seededInt(SEED + i * 202, 1, 72) * 3600000,
    reactions: [
      { emoji: 'heart', count: seededInt(SEED + i * 203, 1, 20) },
      { emoji: 'clap', count: seededInt(SEED + i * 204, 1, 15) },
    ],
    replyCount: seededInt(SEED + i * 205, 0, 10),
    zkpVerified: seededRandom(SEED + i * 206) > 0.3,
    tags: ['wellness', 'support'],
  }));

  return successResponse(posts);
}

// ────────────────────────────────────────────────────────────
// POST /api/community/posts
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const { circleId, content } = body;

    if (!circleId || !content) {
      return errorResponse('VALIDATION_ERROR', 'circleId and content are required', HTTP.UNPROCESSABLE);
    }

    const seed = Date.now();
    const post = {
      id: `post-${seededHex(seed, 8)}`,
      circleId,
      anonymousId: `anon-${seededHex(SEED + 9999, 6)}`,
      content,
      timestamp: Date.now(),
      reactions: [],
      replyCount: 0,
      zkpVerified: true,
      tags: [],
    };

    return successResponse(post, HTTP.CREATED, {
      message: 'Post created anonymously with ZKP verification.',
    });
  } catch {
    return errorResponse('INVALID_REQUEST', 'Invalid request body', HTTP.BAD_REQUEST);
  }
}
