// ============================================================
// Shiora on Aethelred — ZKP Proof Verification API
// POST /api/zkp/verify — verify a zero-knowledge set-membership proof
//   (public: zero-knowledge proofs are publicly verifiable, so no auth is
//   required — anyone holding the proof + context can check it)
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, validationError, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { verifyProof } from '@/lib/api/zkp-service';

const VerifySchema = z.object({
  context: z.string().min(1).max(200),
  proof: z.object({
    commitment: z.string().min(1),
    set: z.array(z.number().int()),
    t: z.array(z.string()),
    e: z.array(z.string()),
    z: z.array(z.string()),
  }),
});

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request);
  if (blocked) return blocked;

  try {
    const { proof, context } = VerifySchema.parse(await request.json());
    return successResponse({ valid: verifyProof(proof, context) });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    return errorResponse('INVALID_BODY', 'Invalid JSON body', HTTP.BAD_REQUEST);
  }
}
