import { NextRequest } from 'next/server';
import { successResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;
  const { id } = await context.params;
  return successResponse({ id, acknowledgedAt: Date.now(), status: 'acknowledged' }, HTTP.OK);
}
