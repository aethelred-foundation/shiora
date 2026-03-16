// ============================================================
// Shiora on Aethelred — Wearables API
// GET /api/wearables — List connected wearable devices
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededHex, seededInt, seededRandom } from '@/lib/utils';
import { WEARABLE_PROVIDERS } from '@/lib/constants';

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const SEED = 1000;
  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view');

  // Return data points when requested
  if (view === 'data-points') {
    const metric = searchParams.get('metric') ?? 'heart_rate';
    const METRICS: Record<string, { unit: string; min: number; max: number }> = {
      heart_rate: { unit: 'bpm', min: 55, max: 120 },
      hrv: { unit: 'ms', min: 20, max: 80 },
      sleep_duration: { unit: 'hours', min: 5, max: 9 },
      temperature: { unit: '°F', min: 97, max: 99 },
      steps: { unit: 'steps', min: 100, max: 15000 },
      spo2: { unit: '%', min: 94, max: 100 },
      calories: { unit: 'kcal', min: 50, max: 800 },
      respiratory_rate: { unit: 'brpm', min: 12, max: 22 },
    };
    const cfg = METRICS[metric] ?? METRICS.heart_rate;
    const now = Date.now();
    const dataPoints = Array.from({ length: 50 }, (_, i) => ({
      id: `dp-${seededHex(SEED + 2000 + i * 7, 12)}`,
      deviceId: `device-${seededHex(SEED, 12)}`,
      metric,
      value: parseFloat((seededRandom(SEED + 2000 + i * 13) * (cfg.max - cfg.min) + cfg.min).toFixed(1)),
      unit: cfg.unit,
      timestamp: now - (50 - i) * 1800000 + seededInt(SEED + i * 3, 0, 600000),
      source: 'apple_health',
    }));
    return successResponse(dataPoints);
  }

  const devices = WEARABLE_PROVIDERS.map((provider, i) => {
    const connected = i < 3;
    return {
      id: `device-${seededHex(SEED + i * 100, 12)}`,
      provider: provider.id,
      deviceName: provider.name,
      status: connected ? (seededRandom(SEED + i * 3) > 0.8 ? 'syncing' : 'connected') : 'disconnected',
      lastSync: connected ? Date.now() - seededInt(SEED + i * 5, 1, 48) * 3600000 : 0,
      dataPointsSynced: connected ? seededInt(SEED + i * 7, 1000, 50000) : 0,
      batteryLevel: connected ? seededInt(SEED + i * 9, 20, 100) : null,
      firmwareVersion: `v${seededInt(SEED + i * 11, 1, 5)}.${seededInt(SEED + i * 13, 0, 9)}.${seededInt(SEED + i * 15, 0, 9)}`,
      connectedAt: connected ? Date.now() - seededInt(SEED + i * 17, 30, 365) * 86400000 : null,
    };
  });

  return successResponse(devices);
}
