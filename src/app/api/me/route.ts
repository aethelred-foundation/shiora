// ============================================================
// Shiora on Aethelred — Identity API
// GET /api/me — the authenticated caller's identity, roles, and capabilities
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse } from '@/lib/api/responses';
import { requireAuth, runMiddleware } from '@/lib/api/middleware';
import { ROLE_LABELS } from '@/lib/api/roles';
import { getRoles } from '@/lib/api/roles-service';
import { capabilitiesFor } from '@/lib/api/capabilities';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const roles = await getRoles(auth.walletAddress!);

  return successResponse({
    address: auth.walletAddress,
    roles,
    labels: roles.map((role) => ROLE_LABELS[role]),
    capabilities: capabilitiesFor(roles),
  });
}
