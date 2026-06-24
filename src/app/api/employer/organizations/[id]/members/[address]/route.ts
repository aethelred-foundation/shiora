// ============================================================
// Shiora on Aethelred — Remove Organization Member API
// DELETE /api/employer/organizations/[id]/members/[address]
//   (employer-admin audience; caller must own the organization)
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse, notFoundResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { getOrganization, removeMember } from '@/lib/api/employer-service';

interface RouteContext {
  params: Promise<{ id: string; address: string }>;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'manage_org_members');
  if ('status' in auth) return auth;

  const { id, address } = await context.params;
  const organization = await getOrganization(auth.walletAddress!, id);
  if (!organization) {
    return notFoundResponse('Organization', id);
  }

  const removed = await removeMember(id, address);
  if (!removed) {
    return notFoundResponse('OrgMembership', address);
  }

  return successResponse({ address: removed.address, status: removed.status });
}
