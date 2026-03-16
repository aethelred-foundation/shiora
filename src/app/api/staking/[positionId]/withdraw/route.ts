import { NextRequest } from 'next/server';
import { successResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { generateTxHash } from '@/lib/utils';

interface RouteContext { params: Promise<{ positionId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;
  const { positionId } = await context.params;
  return successResponse({
    positionId,
    status: 'withdrawn',
    withdrawnAt: Date.now(),
    txHash: generateTxHash(Date.now()),
  }, HTTP.OK);
}
