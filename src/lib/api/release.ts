// ============================================================
// Shiora on Aethelred — Release provenance manifest (consultant P0)
//
// Self-reports exactly what is running so an auditor can compare the live
// deployment against the release record: application version, git SHA, build
// time, database migration version, and content hashes of the two contracts
// the platform makes to the outside world (the OpenAPI surface and the
// feature-maturity registry). A mismatch between this manifest and the release
// record is an incident.
//
// The git SHA and build timestamp are stamped at build time by next.config.js
// (SHIORA_GIT_SHA / SHIORA_BUILD_TIME); the container digest and chain id are
// supplied by the deployment pipeline when applicable.
// ============================================================

import crypto from 'node:crypto';

import packageJson from '../../../package.json';
import { MIGRATIONS } from '@/lib/persistence/schema';
import { buildOpenApiSpec } from '@/lib/api/openapi';
import { featureList } from '@/lib/api/maturity';

/** The application version, from package.json — the single source. */
export const RELEASE_VERSION: string = packageJson.version;

export interface ReleaseManifest {
  service: 'shiora';
  version: string;
  /** Exact commit the build was produced from ('unknown' outside a git build). */
  gitSha: string;
  /** ISO timestamp stamped when the build was produced. */
  buildTime: string;
  /** Number of schema migrations compiled into this build. */
  migrationVersion: number;
  /** SHA-256 of the OpenAPI 3.1 document this build serves. */
  openapiHash: string;
  /** SHA-256 of the feature-maturity registry this build enforces. */
  maturityHash: string;
  /** Image digest, when the deploy pipeline supplies it. */
  containerDigest: string | null;
  /** L1 anchoring configuration actually in effect (never a mainnet target pre-gate). */
  anchoring: {
    configured: boolean;
    chainId: string | null;
  };
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/** Assemble the provenance manifest for the running build. */
export function buildReleaseManifest(): ReleaseManifest {
  return {
    service: 'shiora',
    version: RELEASE_VERSION,
    gitSha: process.env.SHIORA_GIT_SHA ?? 'unknown',
    buildTime: process.env.SHIORA_BUILD_TIME ?? 'unknown',
    migrationVersion: MIGRATIONS.length,
    openapiHash: sha256(JSON.stringify(buildOpenApiSpec())),
    maturityHash: sha256(JSON.stringify(featureList())),
    containerDigest: process.env.SHIORA_CONTAINER_DIGEST ?? null,
    anchoring: {
      configured: !!process.env.SHIORA_L1_RPC_URL,
      chainId: process.env.SHIORA_L1_CHAIN_ID ?? null,
    },
  };
}
