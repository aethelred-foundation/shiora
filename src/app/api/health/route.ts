// ============================================================
// Shiora on Aethelred — Health Check Endpoint
// GET /api/health
// ============================================================

import { NextRequest } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/responses';

const startTime = Date.now();

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const uptimeMs = Date.now() - startTime;
  const uptimeSeconds = Math.floor(uptimeMs / 1000);

  return successResponse({
    status: 'healthy',
    version: '1.0.0',
    apiVersion: 'v1',
    service: 'Shiora on Aethelred API',
    chain: 'Aethelred',
    uptime: {
      seconds: uptimeSeconds,
      human: formatUptime(uptimeSeconds),
    },
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'development',
    features: {
      teeVerification: true,
      ipfsStorage: true,
      e2eEncryption: true,
      blockchainAudit: true,
    },
  });
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}
