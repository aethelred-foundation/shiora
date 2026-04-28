/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
const enableHsts = process.env.SHIORA_ENABLE_HSTS === 'true';

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  typescript: {
    ignoreBuildErrors: false,
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.mainnet.aethelred.org',
    NEXT_PUBLIC_SHIORA_API_URL:
      process.env.NEXT_PUBLIC_SHIORA_API_URL || 'https://api.shiora.health',
    NEXT_PUBLIC_IPFS_GATEWAY:
      process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.ipfs.io/ipfs/',
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
  webpack: (config, { isServer }) => {
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
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'X-Download-Options', value: 'noopen' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          { key: 'Referrer-Policy', value: 'strict-origin' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
          { key: 'Origin-Agent-Cluster', value: '?1' },
          {
            key: 'Content-Security-Policy',
            value: [
              `default-src 'self'`,
              `base-uri 'self'`,
              `frame-ancestors 'none'`,
              `frame-src 'none'`,
              `child-src 'none'`,
              `object-src 'none'`,
              `manifest-src 'self'`,
              `media-src 'self'`,
              `worker-src 'self' blob:`,
              `img-src 'self' data: https:`,
              `font-src 'self' data: https:`,
              `style-src 'self' 'unsafe-inline'`,
              `script-src-attr 'none'`,
              `script-src 'self'${isDev ? " 'unsafe-eval'" : ''} 'unsafe-inline'`,
              `connect-src 'self' https: wss:`,
              `form-action 'self'`,
              ...(isProduction ? [`upgrade-insecure-requests`] : []),
            ].join('; '),
          },
          ...(enableHsts
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=31536000; includeSubDomains',
                },
              ]
            : []),
          {
            key: 'Permissions-Policy',
            value:
              'accelerometer=(), autoplay=(), camera=(), clipboard-read=(), clipboard-write=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), picture-in-picture=(), usb=()',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
