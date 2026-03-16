// ============================================================
// Shiora on Aethelred — Predictive Alerts API
// GET  /api/alerts — List alerts with optional severity/status filter
// POST /api/alerts — Acknowledge an alert
// ============================================================

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  HTTP,
} from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import {
  seededRandom,
  seededInt,
  seededHex,
  seededPick,
  generateAttestation,
} from '@/lib/utils';
import { ALERT_METRICS } from '@/lib/constants';
import type { PredictiveAlert, AlertSeverity, AlertMetric } from '@/types';

// ────────────────────────────────────────────────────────────
// Mock Data
// ────────────────────────────────────────────────────────────

const SEED = 1200;
const AI_MODEL_IDS = ['lstm', 'anomaly', 'fertility', 'insights'];

function generateMockAlerts(): PredictiveAlert[] {
  const severities: AlertSeverity[] = ['critical', 'warning', 'info'];
  const metricIds = ALERT_METRICS.map((m) => m.id as AlertMetric);
  const titles: Record<string, string> = {
    temperature: 'Elevated Body Temperature Detected',
    cycle_length: 'Cycle Length Irregularity',
    heart_rate: 'Elevated Heart Rate',
    hrv: 'Low Heart Rate Variability',
    spo2: 'Low Blood Oxygen',
    blood_pressure: 'Elevated Blood Pressure',
    glucose: 'High Blood Glucose',
    sleep_score: 'Poor Sleep Quality',
  };

  return Array.from({ length: 15 }, (_, i) => {
    const s = SEED + 500 + i * 13;
    const metric = seededPick(s, metricIds);
    const metricDef = ALERT_METRICS.find((m) => m.id === metric)!;
    const severity = seededPick(s + 1, severities);
    const triggeredAt = Date.now() - seededInt(s + 3, 0, 72) * 3600000;
    const isAcknowledged = i >= 5;
    const isResolved = i >= 10;

    return {
      id: `alert-${seededHex(s + 5, 12)}`,
      ruleId: `rule-${seededHex(SEED + (i % 8) * 10, 12)}`,
      metric,
      severity,
      title: titles[metric] ?? 'Health Alert',
      message: `The ${metricDef.label.toLowerCase()} metric has crossed the configured threshold.`,
      currentValue: parseFloat(
        (metricDef.defaultThreshold + (metricDef.condition === 'above' ? 1 : -1) * seededRandom(s + 11) * 10).toFixed(1),
      ),
      threshold: metricDef.defaultThreshold,
      triggeredAt,
      acknowledgedAt: isAcknowledged ? triggeredAt + seededInt(s + 13, 5, 60) * 60000 : undefined,
      resolvedAt: isResolved ? triggeredAt + seededInt(s + 15, 60, 360) * 60000 : undefined,
      modelId: seededPick(s + 17, AI_MODEL_IDS),
      confidence: parseFloat((85 + seededRandom(s + 19) * 14).toFixed(1)),
      attestation: generateAttestation(s + 21),
    };
  });
}

// ────────────────────────────────────────────────────────────
// GET /api/alerts
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const severity = request.nextUrl.searchParams.get('severity') as AlertSeverity | null;
  const status = request.nextUrl.searchParams.get('status');

  let alerts = generateMockAlerts();

  if (severity) {
    alerts = alerts.filter((a) => a.severity === severity);
  }

  if (status === 'active') {
    alerts = alerts.filter((a) => !a.acknowledgedAt && !a.resolvedAt);
  } else if (status === 'acknowledged') {
    alerts = alerts.filter((a) => a.acknowledgedAt && !a.resolvedAt);
  } else if (status === 'resolved') {
    alerts = alerts.filter((a) => !!a.resolvedAt);
  }

  return successResponse(alerts, HTTP.OK, { total: alerts.length });
}

// ────────────────────────────────────────────────────────────
// POST /api/alerts — Acknowledge an alert
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const { alertId, action } = body;

    if (!alertId || !action) {
      return errorResponse('VALIDATION_ERROR', 'alertId and action are required', HTTP.BAD_REQUEST);
    }

    if (!['acknowledge', 'resolve'].includes(action)) {
      return errorResponse('VALIDATION_ERROR', 'action must be "acknowledge" or "resolve"', HTTP.BAD_REQUEST);
    }

    return successResponse(
      {
        alertId,
        action,
        timestamp: Date.now(),
        success: true,
      },
      HTTP.OK,
      { message: `Alert ${action}d successfully.` },
    );
  } catch {
    return errorResponse('INVALID_BODY', 'Invalid JSON body', HTTP.BAD_REQUEST);
  }
}
