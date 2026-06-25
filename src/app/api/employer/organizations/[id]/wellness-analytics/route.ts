// ============================================================
// Shiora on Aethelred — Employer Wellness Analytics API
// GET /api/employer/organizations/[id]/wellness-analytics
//   — participation and completion across all of an org's programs
//   (employer-admin audience; caller must own the organization)
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse, notFoundResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { getOrganization } from '@/lib/api/employer-service';
import { orgWellnessAnalytics } from '@/lib/api/wellness-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'manage_org_members');
  if ('status' in auth) return auth;

  const { id } = await context.params;
  const organization = await getOrganization(auth.walletAddress!, id);
  if (!organization) {
    return notFoundResponse('Organization', id);
  }

  return successResponse(await orgWellnessAnalytics(id));
}
