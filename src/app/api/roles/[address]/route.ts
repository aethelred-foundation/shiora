// ============================================================
// Shiora on Aethelred — Roles Lookup API
// GET /api/roles/[address] — the roles held by a specific address (admin only)
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireAdmin } from '@/lib/api/rbac';
import { ROLE_LABELS } from '@/lib/api/roles';
import { getRoles } from '@/lib/api/roles-service';

interface RouteContext {
  params: Promise<{ address: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireAdmin(request);
  if ('status' in auth) return auth;

  const { address } = await context.params;
  const roles = await getRoles(address);

  return successResponse({
    address,
    roles,
    labels: roles.map((role) => ROLE_LABELS[role]),
  });
}
