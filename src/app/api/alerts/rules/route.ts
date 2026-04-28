// ============================================================
// Shiora on Aethelred — Alert Rules API
// GET   /api/alerts/rules — List all alert rules
// POST  /api/alerts/rules — Create a new alert rule
// PATCH /api/alerts/rules — Update an existing alert rule
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededRandom, seededInt, seededHex, seededPick } from '@/lib/utils';
import { ALERT_METRICS } from '@/lib/constants';
import type { AlertRule, AlertSeverity, AlertChannel, AlertMetric } from '@/types';

// ────────────────────────────────────────────────────────────
// Mock Data
// ────────────────────────────────────────────────────────────

const SEED = 1200;

function generateMockRules(): AlertRule[] {
  const severities: AlertSeverity[] = ['critical', 'warning', 'info'];
  const channelIds: AlertChannel[] = ['in_app', 'email', 'push', 'sms'];

  return ALERT_METRICS.map((metric, i) => {
    const s = SEED + i * 10;
    const numChannels = seededInt(s + 1, 1, 4);
    const channels: AlertChannel[] = [];
    for (let c = 0; c < numChannels; c++) {
      const ch = seededPick(s + c * 3, channelIds);
      if (!channels.includes(ch)) channels.push(ch);
    }

    return {
      id: `rule-${seededHex(s, 12)}`,
      metric: metric.id as AlertMetric,
      condition: metric.condition as 'above' | 'below' | 'deviation',
      threshold: metric.defaultThreshold,
      unit: metric.unit,
      severity: seededPick(s + 5, severities),
      channels,
      enabled: seededRandom(s + 7) > 0.2,
      cooldownMinutes: seededPick(s + 9, [15, 30, 60, 120]),
      createdAt: Date.now() - seededInt(s + 11, 1, 90) * 86400000,
    };
  });
}

// ────────────────────────────────────────────────────────────
// GET /api/alerts/rules
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const rules = generateMockRules();
  return successResponse(rules, HTTP.OK, { total: rules.length });
}

// ────────────────────────────────────────────────────────────
// POST /api/alerts/rules — Create new rule
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const { metric, condition, threshold, unit, severity, channels, cooldownMinutes } = body;

    if (!metric || !condition || threshold === undefined || !severity) {
      return errorResponse(
        'VALIDATION_ERROR',
        'metric, condition, threshold, and severity are required',
        HTTP.BAD_REQUEST,
      );
    }

    const seed = Date.now();
    const newRule: AlertRule = {
      id: `rule-${seededHex(seed, 12)}`,
      metric,
      condition,
      threshold,
      unit: unit ?? '',
      severity,
      channels: channels ?? ['in_app'],
      enabled: true,
      cooldownMinutes: cooldownMinutes ?? 30,
      createdAt: Date.now(),
    };

    return successResponse(newRule, HTTP.CREATED, {
      message: 'Alert rule created successfully.',
    });
  } catch {
    return errorResponse('INVALID_BODY', 'Invalid JSON body', HTTP.BAD_REQUEST);
  }
}

// ────────────────────────────────────────────────────────────
// PATCH /api/alerts/rules — Update existing rule
// ────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return errorResponse('VALIDATION_ERROR', 'Rule id is required', HTTP.BAD_REQUEST);
    }

    const rules = generateMockRules();
    const existing = rules.find((r) => r.id === id);
    if (!existing) {
      return errorResponse('NOT_FOUND', `Rule with id '${id}' not found`, HTTP.NOT_FOUND);
    }

    const updated = { ...existing, ...updates };
    return successResponse(updated, HTTP.OK, {
      message: 'Alert rule updated successfully.',
    });
  } catch {
    return errorResponse('INVALID_BODY', 'Invalid JSON body', HTTP.BAD_REQUEST);
  }
}
