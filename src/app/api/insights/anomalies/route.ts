// ============================================================
// Shiora on Aethelred — Anomalies API
// GET /api/insights/anomalies — List detected anomalies
// ============================================================

import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { AnomalyListQuerySchema, parseSearchParams } from '@/lib/api/validation';
import { paginatedResponse, validationError } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { generateMockAnomalies } from '@/lib/api/mock-data';

// ────────────────────────────────────────────────────────────
// GET /api/insights/anomalies
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const query = parseSearchParams(AnomalyListQuerySchema, request.nextUrl.searchParams);

    let anomalies = generateMockAnomalies();

    // Filter by severity
    if (query.severity) {
      anomalies = anomalies.filter((a) => a.severity === query.severity);
    }

    // Filter by resolved status
    if (query.resolved !== undefined) {
      anomalies = anomalies.filter((a) => a.resolved === query.resolved);
    }

    // Sort by detected time descending
    anomalies = [...anomalies].sort((a, b) => b.detectedAt - a.detectedAt);

    const total = anomalies.length;
    const start = (query.page - 1) * query.limit;
    const paged = anomalies.slice(start, start + query.limit);

    return paginatedResponse(paged, total, query.page, query.limit, {
      summary: {
        total: generateMockAnomalies().length,
        active: generateMockAnomalies().filter((a) => !a.resolved).length,
        resolved: generateMockAnomalies().filter((a) => a.resolved).length,
        bySeverity: {
          high: generateMockAnomalies().filter((a) => a.severity === 'High').length,
          medium: generateMockAnomalies().filter((a) => a.severity === 'Medium').length,
          low: generateMockAnomalies().filter((a) => a.severity === 'Low').length,
        },
      },
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
