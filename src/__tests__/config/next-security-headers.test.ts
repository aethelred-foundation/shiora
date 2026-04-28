/** @jest-environment node */

const CONFIG_PATH = '../../../next.config.js';

function loadConfig(env: Record<string, string | undefined> = {}) {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalHsts = process.env.SHIORA_ENABLE_HSTS;

  jest.resetModules();

  if (env.NODE_ENV !== undefined) {
    process.env.NODE_ENV = env.NODE_ENV;
  }

  if (env.SHIORA_ENABLE_HSTS !== undefined) {
    process.env.SHIORA_ENABLE_HSTS = env.SHIORA_ENABLE_HSTS;
  } else {
    delete process.env.SHIORA_ENABLE_HSTS;
  }

  const config = require(CONFIG_PATH);

  return {
    config,
    restore() {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalHsts === undefined) {
        delete process.env.SHIORA_ENABLE_HSTS;
      } else {
        process.env.SHIORA_ENABLE_HSTS = originalHsts;
      }
      jest.resetModules();
    },
  };
}

async function getGlobalHeaderMap(config: { headers: () => Promise<unknown[]> }) {
  const entries = (await config.headers()) as Array<{
    source: string;
    headers: Array<{ key: string; value: string }>;
  }>;
  const global = entries.find((entry) => entry.source === '/:path*');
  expect(global).toBeDefined();
  return new Map(global!.headers.map((header) => [header.key, header.value]));
}

describe('next security headers', () => {
  it('disables framework fingerprinting and build-time TypeScript bypasses', () => {
    const loaded = loadConfig();
    try {
      expect(loaded.config.poweredByHeader).toBe(false);
      expect(loaded.config.typescript.ignoreBuildErrors).toBe(false);
    } finally {
      loaded.restore();
    }
  });

  it('ships a hardened browser security header baseline', async () => {
    const loaded = loadConfig({ NODE_ENV: 'production', SHIORA_ENABLE_HSTS: 'true' });
    try {
      const headers = await getGlobalHeaderMap(loaded.config);
      const csp = headers.get('Content-Security-Policy') ?? '';

      expect(headers.get('X-Frame-Options')).toBe('DENY');
      expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(headers.get('X-DNS-Prefetch-Control')).toBe('off');
      expect(headers.get('X-Download-Options')).toBe('noopen');
      expect(headers.get('X-Permitted-Cross-Domain-Policies')).toBe('none');
      expect(headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
      expect(headers.get('Cross-Origin-Resource-Policy')).toBe('same-site');
      expect(headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
      expect(headers.get('Permissions-Policy')).toContain('clipboard-read=()');

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("frame-src 'none'");
      expect(csp).toContain("child-src 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("script-src-attr 'none'");
      expect(csp).toContain('upgrade-insecure-requests');
    } finally {
      loaded.restore();
    }
  });

  it('does not send HSTS unless explicitly enabled', async () => {
    const loaded = loadConfig({ NODE_ENV: 'production' });
    try {
      const headers = await getGlobalHeaderMap(loaded.config);
      expect(headers.has('Strict-Transport-Security')).toBe(false);
    } finally {
      loaded.restore();
    }
  });
});
