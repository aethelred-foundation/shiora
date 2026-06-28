/** @jest-environment node */

import {
  FEATURE_MATURITY,
  simulationMeta,
  simulatedResponse,
  maturityOf,
  isSimulated,
  featureList,
  maturitySummary,
} from '@/lib/api/maturity';

describe('feature maturity registry', () => {
  it('reports the maturity of a feature', () => {
    expect(maturityOf('phi_records')).toBe('production');
    expect(maturityOf('tee_attestation')).toBe('simulated');
    expect(maturityOf('wearables')).toBe('pilot');
  });

  it('flags only simulated features as simulated', () => {
    expect(isSimulated('tee_attestation')).toBe(true);
    expect(isSimulated('phi_records')).toBe(false);
    expect(isSimulated('wearables')).toBe(false);
  });

  it('builds a labelled simulation meta block', () => {
    const meta = simulationMeta('zk_proofs');
    expect(meta.mode).toBe('simulation');
    expect(meta.feature).toBe('zk_proofs');
    expect(meta.notice).toMatch(/simulated subsystem/i);
  });

  it('wraps a payload in a labelled simulated response', async () => {
    const res = simulatedResponse({ valid: true }, 'tee_attestation', 200, { queriedAt: 'now' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ valid: true });
    expect(body.meta.mode).toBe('simulation');
    expect(body.meta.feature).toBe('tee_attestation');
    expect(body.meta.queriedAt).toBe('now'); // extra meta is preserved
  });

  it('defaults the simulated response status and omits extra meta', async () => {
    const res = simulatedResponse([{ id: 1 }], 'secure_mpc');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.feature).toBe('secure_mpc');
  });

  it('lists every feature with its key', () => {
    const list = featureList();
    expect(list).toHaveLength(Object.keys(FEATURE_MATURITY).length);
    expect(list.every((f) => typeof f.key === 'string' && typeof f.title === 'string')).toBe(true);
    expect(list.find((f) => f.key === 'phi_records')?.maturity).toBe('production');
  });

  it('summarises counts by maturity tier that sum to the registry size', () => {
    const summary = maturitySummary();
    const total = summary.production + summary.pilot + summary.simulated;
    expect(total).toBe(Object.keys(FEATURE_MATURITY).length);
    expect(summary.production).toBeGreaterThan(0);
    expect(summary.simulated).toBeGreaterThan(0);
    expect(summary.pilot).toBeGreaterThan(0);
  });

  it('keeps the real PHI-bearing data paths in the production tier', () => {
    for (const key of [
      'phi_records',
      'consent',
      'access_grants',
      'rbac',
      'audit_log',
      'gdpr_rights',
    ] as const) {
      expect(maturityOf(key)).toBe('production');
    }
  });

  it('keeps unbacked external subsystems in the simulated tier', () => {
    for (const key of [
      'tee_attestation',
      'blockchain_anchoring',
      'ai_assistant',
    ] as const) {
      expect(maturityOf(key)).toBe('simulated');
    }
  });
});
