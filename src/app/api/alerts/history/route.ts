// ============================================================
// Shiora on Aethelred — Alert History API
// GET /api/alerts/history — List alert history entries
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededInt, seededHex, seededPick, formatDateTime } from '@/lib/utils';
import type { AlertHistory } from '@/types';

// ────────────────────────────────────────────────────────────
// Mock Data
// ────────────────────────────────────────────────────────────

const SEED = 1200;

function generateMockHistory(): AlertHistory[] {
  const actions: AlertHistory['action'][] = ['triggered', 'acknowledged', 'resolved', 'escalated'];
  const actors = ['Patient', 'Dr. Sarah Chen', 'AI System', 'Auto-resolve'];
  const notes = [
    'Reviewed and acknowledged. Monitoring closely.',
    'Resolved after medication adjustment.',
    'Escalated to provider for follow-up.',
    'Auto-resolved: metric returned to normal range.',
    'Patient confirmed symptom improvement.',
  ];

  return Array.from({ length: 25 }, (_, i) => {
    const s = SEED + 800 + i * 11;
    return {
      id: `hist-${seededHex(s, 12)}`,
      alertId: `alert-${seededHex(SEED + 500 + (i % 15) * 13 + 5, 12)}`,
      action: seededPick(s + 1, actions),
      timestamp: Date.now() - seededInt(s + 3, 0, 168) * 3600000,
      actor: seededPick(s + 5, actors),
      notes: seededInt(s + 7, 0, 1) > 0 ? seededPick(s + 9, notes) : undefined,
    };
  }).sort((a, b) => b.timestamp - a.timestamp);
}

// ────────────────────────────────────────────────────────────
// GET /api/alerts/history
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const alertId = request.nextUrl.searchParams.get('alertId');
  let history = generateMockHistory();

  if (alertId) {
    history = history.filter((h) => h.alertId === alertId);
  }

  return successResponse(history, HTTP.OK, { total: history.length });
}
