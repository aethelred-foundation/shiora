/** @jest-environment node */

import fs from 'node:fs';
import path from 'node:path';
import { ROUTE_MANIFEST, buildOpenApiSpec, type HttpMethod } from '@/lib/api/openapi';
import { GET as getOpenApi } from '@/app/api/openapi/route';

const API_ROOT = path.join(process.cwd(), 'src', 'app', 'api');

/** Map an OpenAPI path (/api/records/{id}) to its route file on disk. */
function routeFileFor(apiPath: string): string {
  const rel = apiPath
    .replace(/^\/api\//, '')
    .replace(/\{([^}]+)\}/g, '[$1]'); // {id} → [id]
  return path.join(API_ROOT, rel, 'route.ts');
}

function exportedMethods(file: string): Set<string> {
  const src = fs.readFileSync(file, 'utf8');
  const methods = new Set<string>();
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)) {
    methods.add(m[1].toLowerCase());
  }
  return methods;
}

describe('OpenAPI contract (GAP-19)', () => {
  it('builds a structurally valid OpenAPI 3.1 document', () => {
    const spec = buildOpenApiSpec();
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toContain('Shiora');
    expect(spec.info.version).toBeDefined();
    expect(spec.servers.length).toBeGreaterThan(0);
    expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
    expect(spec.components).toHaveProperty('securitySchemes.walletSession');
  });

  it('marks authenticated operations with the walletSession security scheme', () => {
    const spec = buildOpenApiSpec();
    const connectPost = spec.paths['/api/wallet/connect'].post as { security?: unknown };
    expect(connectPost).not.toHaveProperty('security'); // public
    const recordsPost = spec.paths['/api/records'].post as { security?: unknown };
    expect(recordsPost.security).toEqual([{ walletSession: [] }]);
    const accessChallengePost = spec.paths['/api/access/challenge'].post as { security?: unknown };
    expect(accessChallengePost.security).toEqual([{ walletSession: [] }]);
  });

  it('lists every documented path with its declared tag', () => {
    const spec = buildOpenApiSpec();
    for (const route of ROUTE_MANIFEST) {
      const op = spec.paths[route.path]?.[route.method] as { tags?: string[] } | undefined;
      expect(op).toBeDefined();
      expect(op!.tags).toEqual(route.tags);
    }
  });

  // The drift gate: the published spec must never reference a route that does
  // not exist, so integrators can trust it.
  it('every documented endpoint exists as a real route file + method export', () => {
    const problems: string[] = [];
    for (const route of ROUTE_MANIFEST) {
      const file = routeFileFor(route.path);
      if (!fs.existsSync(file)) {
        problems.push(`${route.method.toUpperCase()} ${route.path} → missing file ${file}`);
        continue;
      }
      const methods = exportedMethods(file);
      if (!methods.has(route.method)) {
        problems.push(`${route.path} exists but does not export ${route.method.toUpperCase()}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('gives every used tag a description', () => {
    const spec = buildOpenApiSpec();
    for (const tag of spec.tags) {
      expect(typeof tag.description).toBe('string');
      expect(tag.description.length).toBeGreaterThan(0);
    }
  });

  it('serves the spec as cacheable JSON from GET /api/openapi', async () => {
    const res = getOpenApi();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    expect(res.headers.get('Cache-Control')).toContain('max-age');
    const body = await res.json();
    expect(body.openapi).toBe('3.1.0');
    expect(body.paths['/api/openapi'].get).toBeDefined(); // self-documenting
  });

  it('documents no duplicate (path, method) pairs', () => {
    const seen = new Set<string>();
    for (const route of ROUTE_MANIFEST) {
      const key = `${route.method} ${route.path}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('uses only valid HTTP methods', () => {
    const valid: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];
    for (const route of ROUTE_MANIFEST) {
      expect(valid).toContain(route.method);
    }
  });
});
