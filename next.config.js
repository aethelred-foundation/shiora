/** @type {import('next').NextConfig} */
const enableHsts = process.env.SHIORA_ENABLE_HSTS === 'true';

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,

  typescript: {
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: false,
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.mainnet.aethelred.org',
    NEXT_PUBLIC_SHIORA_API_URL: process.env.NEXT_PUBLIC_SHIORA_API_URL || 'https://api.shiora.health',
    NEXT_PUBLIC_IPFS_GATEWAY: process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.ipfs.io/ipfs/',
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
    // key-custody path (NEXT_RUNTIME-guarded). Stub node builtins so the edge build
    // resolves instead of failing to find `crypto`.
    if (nextRuntime === 'edge') {
      config.resolve.fallback = { ...config.resolve.fallback, crypto: false };
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
          ...(enableHsts ? [{
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          }] : []),
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
