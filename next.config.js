/** @type {import('next').NextConfig} */
const enableHsts = process.env.SHIORA_ENABLE_HSTS === 'true';

// Release provenance (docs/RELEASE_PROCESS.md): stamp the exact commit and
// build time into the bundle so GET /api/system/release can self-report them.
// CI may override via SHIORA_GIT_SHA; outside a git checkout we stamp 'unknown'
// rather than fail the build.
function resolveGitSha() {
  if (process.env.SHIORA_GIT_SHA) return process.env.SHIORA_GIT_SHA;
  try {
    return require('node:child_process')
      .execFileSync('git', ['rev-parse', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

const nextConfig = {
  env: {
    SHIORA_GIT_SHA: resolveGitSha(),
    SHIORA_BUILD_TIME: new Date().toISOString(),
  },

  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,

  typescript: {
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: false,
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'aethelred.org',
      },
      {
        protocol: 'https',
        hostname: 'shiora.health',
      },
      {
        protocol: 'https',
        hostname: 'app.shiora.health',
      },
    ],
  },

  // Webpack configuration
  webpack: (config, { webpack, nextRuntime }) => {
    // key-provider.ts imports `node:crypto`. Next compiles instrumentation.ts for
    // the edge runtime too, where the `node:` URI scheme is unhandled and 500s the
    // whole app. Rewrite `node:*` -> bare specifier so every bundle builds; the
    // node-only key-custody path is guarded by NEXT_RUNTIME and never runs on edge.
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
        resource.request = resource.request.replace(/^node:/, '');
      }),
    );
    // The edge runtime bundles instrumentation.ts but never executes its node-only
    // paths (NEXT_RUNTIME-guarded). Stub `crypto` (key custody) and alias the
    // whole `pg` driver to an empty module (store-maintenance boot wiring pulls
    // it via sql-client) so the edge build resolves; none of this runs on edge.
    if (nextRuntime === 'edge') {
      config.resolve.fallback = { ...config.resolve.fallback, crypto: false };
      config.resolve.alias = { ...config.resolve.alias, pg: false };
    }
    return config;
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
          { key: 'Origin-Agent-Cluster', value: '?1' },
          // Content-Security-Policy is set per-request in src/middleware.ts with a
          // script nonce (audit M-01); defining it here too would make browsers
          // enforce the intersection of both policies.
          ...(enableHsts
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains; preload',
                },
              ]
            : []),
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
