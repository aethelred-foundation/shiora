// ============================================================
// Shiora on Aethelred — Account Profile API
// GET /api/me/profile — the caller's account profile
// PUT /api/me/profile — update the caller's profile (partial; only sent fields change)
//   (all audiences; owner-scoped to the caller)
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, validationError } from '@/lib/api/responses';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { getProfile, updateProfile } from '@/lib/api/profile-service';

const ProfileSchema = z.object({
  displayName: z.string().trim().max(100).optional(),
  contactEmail: z.string().trim().max(200).optional(),
  timezone: z.string().trim().max(64).optional(),
  locale: z.string().trim().max(16).optional(),
});

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  return successResponse(await getProfile(auth.walletAddress!));
}

export async function PUT(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  try {
    const input = ProfileSchema.parse(await request.json());
    return successResponse(await updateProfile(auth.walletAddress!, input));
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
