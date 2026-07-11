/** @jest-environment node */

import { buildReleaseManifest, RELEASE_VERSION } from '@/lib/api/release';
import { MIGRATIONS } from '@/lib/persistence/schema';
import packageJson from '../../../../package.json';

const PROVENANCE_ENVS = [
  'SHIORA_GIT_SHA',
  'SHIORA_BUILD_TIME',
  'SHIORA_CONTAINER_DIGEST',
  'SHIORA_L1_RPC_URL',
  'SHIORA_L1_CHAIN_ID',
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of PROVENANCE_ENVS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of PROVENANCE_ENVS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('release provenance manifest', () => {
  it('reports the package version as the single source', () => {
    expect(RELEASE_VERSION).toBe(packageJson.version);
    expect(buildReleaseManifest().version).toBe(packageJson.version);
  });

  it('degrades to unknown provenance outside a stamped build', () => {
    const manifest = buildReleaseManifest();
    expect(manifest.service).toBe('shiora');
    expect(manifest.gitSha).toBe('unknown');
    expect(manifest.buildTime).toBe('unknown');
    expect(manifest.containerDigest).toBeNull();
    expect(manifest.anchoring).toEqual({ configured: false, chainId: null });
  });

  it('reports stamped build provenance when present', () => {
    process.env.SHIORA_GIT_SHA = 'a'.repeat(40);
    process.env.SHIORA_BUILD_TIME = '2026-07-11T00:00:00.000Z';
    process.env.SHIORA_CONTAINER_DIGEST = 'sha256:deadbeef';
    const manifest = buildReleaseManifest();
    expect(manifest.gitSha).toBe('a'.repeat(40));
    expect(manifest.buildTime).toBe('2026-07-11T00:00:00.000Z');
    expect(manifest.containerDigest).toBe('sha256:deadbeef');
  });

  it('reports the anchoring configuration in effect', () => {
    process.env.SHIORA_L1_RPC_URL = 'http://localhost:8545';
    process.env.SHIORA_L1_CHAIN_ID = '7332';
    const manifest = buildReleaseManifest();
    expect(manifest.anchoring).toEqual({ configured: true, chainId: '7332' });
  });

  it('pins the migration version to the compiled migration list', () => {
    expect(buildReleaseManifest().migrationVersion).toBe(MIGRATIONS.length);
    expect(MIGRATIONS.length).toBeGreaterThan(0);
  });

  it('produces deterministic contract hashes', () => {
    const a = buildReleaseManifest();
    const b = buildReleaseManifest();
    expect(a.openapiHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.maturityHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.openapiHash).toBe(b.openapiHash);
    expect(a.maturityHash).toBe(b.maturityHash);
    expect(a.openapiHash).not.toBe(a.maturityHash);
  });
});
