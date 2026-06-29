/** @jest-environment node */

// ============================================================
// Honesty invariant (audit Finding F3): the simulation label may ONLY ever be
// applied to features the registry marks `simulated`. This is a static guard
// over the real route source — it fails CI if any production/pilot feature is
// ever dressed up as a simulated response (over-claiming in reverse), or if a
// simulated feature silently loses its label (under-claiming / a reverted F1).
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { FEATURE_MATURITY, isSimulated, type FeatureKey } from '@/lib/api/maturity';

const API_DIR = path.join(process.cwd(), 'src', 'app', 'api');

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...routeFiles(full));
    } else if (entry.name === 'route.ts') {
      out.push(full);
    }
  }
  return out;
}

const ALL_ROUTE_SOURCE = routeFiles(API_DIR)
  .map((f) => fs.readFileSync(f, 'utf8'))
  .join('\n/* ---FILE BOUNDARY--- */\n');

const allKeys = Object.keys(FEATURE_MATURITY) as FeatureKey[];

/** A simulation label applied to `key` somewhere in the route layer. */
function isLabelledSimulated(key: FeatureKey): boolean {
  // `simulatedResponse(data, 'key', ...)` — key is the 2nd+ argument.
  const asResponse = new RegExp(`simulatedResponse\\([^;]*,\\s*['"]${key}['"]`);
  // `simulationMeta('key')` — key is the 1st argument.
  const asMeta = new RegExp(`simulationMeta\\(\\s*['"]${key}['"]`);
  return asResponse.test(ALL_ROUTE_SOURCE) || asMeta.test(ALL_ROUTE_SOURCE);
}

describe('maturity honesty invariant (F3)', () => {
  it('discovers route handlers to inspect', () => {
    expect(routeFiles(API_DIR).length).toBeGreaterThan(100);
  });

  it('never labels a production or pilot feature as simulated', () => {
    const mislabelled = allKeys
      .filter((key) => !isSimulated(key))
      .filter((key) => isLabelledSimulated(key));
    expect(mislabelled).toEqual([]);
  });

  it.each([
    'clinical_decision_support',
    'explainable_ai',
    'genomics',
    'digital_twin',
    'emergency',
    'compliance_reports',
    'tee_attestation',
    'blockchain_anchoring',
  ] as const)('keeps simulated feature %s labelled at the route layer', (key) => {
    expect(isSimulated(key)).toBe(true);
    expect(isLabelledSimulated(key)).toBe(true);
  });
});
