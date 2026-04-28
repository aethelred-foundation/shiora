// ============================================================
// Shiora on Aethelred — TEE Attestations API
// GET /api/tee/attestations — List attestation records
// ============================================================

import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { AttestationListQuerySchema, parseSearchParams } from '@/lib/api/validation';
import { paginatedResponse, validationError } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { generateMockAttestations } from '@/lib/api/mock-data';

// ────────────────────────────────────────────────────────────
// GET /api/tee/attestations
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const query = parseSearchParams(AttestationListQuerySchema, request.nextUrl.searchParams);

    let attestations = generateMockAttestations();

    // Filter by verification status
    if (query.verified !== undefined) {
      attestations = attestations.filter((a) => a.verified === query.verified);
    }

    // Sort by timestamp descending
    attestations = [...attestations].sort((a, b) => b.timestamp - a.timestamp);

    const total = attestations.length;
    const start = (query.page - 1) * query.limit;
    const paged = attestations.slice(start, start + query.limit);

    return paginatedResponse(paged, total, query.page, query.limit, {
      summary: {
        total: generateMockAttestations().length,
        verified: generateMockAttestations().filter((a) => a.verified).length,
        unverified: generateMockAttestations().filter((a) => !a.verified).length,
        platforms: {
          'Intel SGX': generateMockAttestations().filter((a) => a.platform === 'Intel SGX').length,
          'AWS Nitro': generateMockAttestations().filter((a) => a.platform === 'AWS Nitro').length,
          'AMD SEV': generateMockAttestations().filter((a) => a.platform === 'AMD SEV').length,
        },
      },
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
