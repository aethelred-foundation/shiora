// ============================================================
// Shiora on Aethelred — Patient Clinical Notes View API
// GET /api/me/clinical-notes — every clinical note about the caller
//   (individual audience; the patient owns the record about them)
// ============================================================

import { NextRequest } from 'next/server';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/responses';
import { listClinicalNotesForPatient } from '@/lib/api/clinical-notes-service';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const notes = await listClinicalNotesForPatient(auth.walletAddress!);
  return successResponse({ total: notes.length, notes });
}
