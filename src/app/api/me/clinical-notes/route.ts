// ============================================================
// Shiora on Aethelred — Patient Clinical Notes View API
// GET /api/me/clinical-notes — every clinical note about the caller
//   (individual audience; the patient owns the record about them)
// ============================================================

import { NextRequest } from 'next/server';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/responses';
import { listClinicalNotesForPatient } from '@/lib/api/clinical-notes-service';
import { getProfile } from '@/lib/api/profile-service';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const notes = await listClinicalNotesForPatient(auth.walletAddress!);

  // Enrich each authoring provider (the note and every amendment) with their
  // display name, so the patient sees who wrote each note rather than only a
  // wallet address.
  const enriched = await Promise.all(notes.map(async (note) => ({
    ...note,
    providerName: (await getProfile(note.providerAddress)).displayName,
    amendments: await Promise.all(note.amendments.map(async (amendment) => ({
      ...amendment,
      providerName: (await getProfile(amendment.providerAddress)).displayName,
    }))),
  })));

  return successResponse({ total: enriched.length, notes: enriched });
}
