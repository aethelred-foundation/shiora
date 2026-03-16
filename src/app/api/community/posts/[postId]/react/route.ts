import { NextRequest } from 'next/server';
import { successResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';

interface RouteContext { params: Promise<{ postId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;
  const { postId } = await context.params;
  const body = await request.json();
  return successResponse({ postId, reaction: body.reaction ?? 'heart', count: 1 }, HTTP.OK);
}
