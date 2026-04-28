// ============================================================
// Shiora on Aethelred — Single Community Circle API
// GET  /api/community/circles/[id] — Get a single circle
// POST /api/community/circles/[id] — Join or leave a circle
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';

// ────────────────────────────────────────────────────────────
// GET /api/community/circles/[id]
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const { id } = await params;

  const circle = {
    id,
    name: `Circle ${id}`,
    category: 'general_wellness',
    description: 'A supportive community circle.',
    memberCount: 450,
    postCount: 120,
    createdAt: Date.now() - 90 * 86400000,
    isJoined: false,
    requiresZKP: false,
  };

  return successResponse(circle);
}

// ────────────────────────────────────────────────────────────
// POST /api/community/circles/[id] — Join or leave
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const { id } = await params;

  try {
    const body = await request.json();
    const { action } = body;

    if (!['join', 'leave'].includes(action)) {
      return errorResponse(
        'VALIDATION_ERROR',
        'action must be "join" or "leave"',
        HTTP.UNPROCESSABLE,
      );
    }

    return successResponse(
      {
        circleId: id,
        action,
        timestamp: Date.now(),
      },
      HTTP.OK,
      {
        message: action === 'join' ? 'Successfully joined circle.' : 'Left circle.',
      },
    );
  } catch {
    return errorResponse('INVALID_REQUEST', 'Invalid request body', HTTP.BAD_REQUEST);
  }
}
