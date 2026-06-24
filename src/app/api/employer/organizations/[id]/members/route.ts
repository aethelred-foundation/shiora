// ============================================================
// Shiora on Aethelred — Organization Members API
// GET  /api/employer/organizations/[id]/members — list active members
// POST /api/employer/organizations/[id]/members — add a member
//   (employer-admin audience; caller must own the organization)
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, notFoundResponse, validationError, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { AethelredAddressSchema } from '@/lib/api/validation';
import { addMember, getOrganization, listMembers } from '@/lib/api/employer-service';

const MemberAddSchema = z.object({
  address: AethelredAddressSchema,
  role: z.string().trim().min(1).max(50).default('member'),
});

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

  return successResponse(await listMembers(id));
}

export async function POST(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'manage_org_members');
  if ('status' in auth) return auth;

  const { id } = await context.params;
  const organization = await getOrganization(auth.walletAddress!, id);
  if (!organization) {
    return notFoundResponse('Organization', id);
  }

  try {
    const input = MemberAddSchema.parse(await request.json());
    const member = await addMember(id, input);
    return successResponse(member, HTTP.CREATED);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
