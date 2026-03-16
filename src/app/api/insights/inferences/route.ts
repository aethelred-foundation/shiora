// ============================================================
// Shiora on Aethelred — Inference History API
// GET /api/insights/inferences — List AI inference history
// ============================================================

import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { InferenceListQuerySchema, parseSearchParams } from '@/lib/api/validation';
import { paginatedResponse, validationError } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { generateMockInferences } from '@/lib/api/mock-data';

// ────────────────────────────────────────────────────────────
// GET /api/insights/inferences
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const query = parseSearchParams(
      InferenceListQuerySchema,
      request.nextUrl.searchParams,
    );

    let inferences = generateMockInferences();

    // Filter by model
    if (query.model) {
      inferences = inferences.filter((inf) => inf.model.id === query.model);
    }

    // Sort by timestamp descending
    inferences = [...inferences].sort((a, b) => b.timestamp - a.timestamp);

    const total = inferences.length;
    const start = (query.page - 1) * query.limit;
    const paged = inferences.slice(start, start + query.limit);

    return paginatedResponse(paged, total, query.page, query.limit, {
      modelBreakdown: {
        lstm: generateMockInferences().filter((i) => i.model.id === 'lstm').length,
        anomaly: generateMockInferences().filter((i) => i.model.id === 'anomaly').length,
        fertility: generateMockInferences().filter((i) => i.model.id === 'fertility').length,
        insights: generateMockInferences().filter((i) => i.model.id === 'insights').length,
      },
      totalAnomaliesDetected: generateMockInferences().filter(
        (i) => i.result === 'Anomaly Detected',
      ).length,
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
