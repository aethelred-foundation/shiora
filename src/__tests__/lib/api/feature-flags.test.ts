/** @jest-environment node */

import {
  activeProfile,
  featureDisabledReason,
  PILOT_DISABLED_SEGMENTS,
} from '@/lib/api/feature-flags';
import { runMiddleware } from '@/lib/api/middleware';
import { NextRequest } from 'next/server';

const originalProfile = process.env.SHIORA_PROFILE;

afterEach(() => {
  if (originalProfile === undefined) delete process.env.SHIORA_PROFILE;
  else process.env.SHIORA_PROFILE = originalProfile;
});

describe('activeProfile', () => {
  it('defaults to full and only recognizes an exact pilot value', () => {
    expect(activeProfile({})).toBe('full');
    expect(activeProfile({ SHIORA_PROFILE: 'pilot' })).toBe('pilot');
    expect(activeProfile({ SHIORA_PROFILE: 'PILOT' })).toBe('full');
    expect(activeProfile({ SHIORA_PROFILE: 'staging' })).toBe('full');
  });

  it('reads the process environment when no map is supplied', () => {
    process.env.SHIORA_PROFILE = 'pilot';
    expect(activeProfile()).toBe('pilot');
  });
});

describe('featureDisabledReason', () => {
  it('serves everything under the full profile', () => {
    for (const segment of Object.keys(PILOT_DISABLED_SEGMENTS)) {
      expect(featureDisabledReason(`/api/${segment}`, 'full')).toBeNull();
    }
  });

  it('disables every deferred segment under the pilot profile', () => {
    for (const segment of Object.keys(PILOT_DISABLED_SEGMENTS)) {
      expect(featureDisabledReason(`/api/${segment}`, 'pilot')).toBeTruthy();
      expect(featureDisabledReason(`/api/${segment}/anything/nested`, 'pilot')).toBeTruthy();
    }
  });

  it('keeps the pilot corridor open under the pilot profile', () => {
    for (const path of [
      '/api/wallet/challenge', '/api/webauthn/credentials', '/api/mfa',
      '/api/records', '/api/records/abc', '/api/access', '/api/consent',
      '/api/provider/patients', '/api/providers', '/api/me/access-log',
      '/api/notifications', '/api/privacy/erasure', '/api/fhir/import',
      '/api/audit/export', '/api/anchors', '/api/system/status',
      '/api/health/ready', '/api/openapi', '/api/roles', '/api/security/csp-report',
    ]) {
      expect(featureDisabledReason(path, 'pilot')).toBeNull();
    }
  });

  it('matches segments exactly, not by prefix', () => {
    // health-plans is deferred; the health probes must stay up.
    expect(featureDisabledReason('/api/health-plans/care-gaps', 'pilot')).toBeTruthy();
    expect(featureDisabledReason('/api/health/live', 'pilot')).toBeNull();
  });

  it('ignores non-API paths', () => {
    expect(featureDisabledReason('/vault', 'pilot')).toBeNull();
    expect(featureDisabledReason('/', 'pilot')).toBeNull();
  });

  it('uses the active profile when none is given', () => {
    process.env.SHIORA_PROFILE = 'pilot';
    expect(featureDisabledReason('/api/marketplace')).toBeTruthy();
    delete process.env.SHIORA_PROFILE;
    expect(featureDisabledReason('/api/marketplace')).toBeNull();
  });
});

describe('middleware integration', () => {
  it('refuses a deferred surface with 503 FEATURE_DISABLED before any handler logic', async () => {
    process.env.SHIORA_PROFILE = 'pilot';
    const res = await runMiddleware(new NextRequest('http://localhost:3000/api/marketplace'));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(503);
    expect((await res!.json()).error.code).toBe('FEATURE_DISABLED');
  });

  it('passes corridor traffic through under the pilot profile', async () => {
    process.env.SHIORA_PROFILE = 'pilot';
    const res = await runMiddleware(new NextRequest('http://localhost:3000/api/health/live'));
    expect(res).toBeNull();
  });
});
