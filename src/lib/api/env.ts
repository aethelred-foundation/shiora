import { z } from 'zod';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3001',
  'https://shiora.health',
  'https://app.shiora.health',
] as const;

const RuntimeEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SHIORA_ALLOWED_ORIGINS: z.string().optional(),
  SHIORA_SESSION_SECRET: z.string().min(32).optional(),
  SHIORA_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  SHIORA_ENABLE_HSTS: z.enum(['true', 'false']).default('false'),
  SHIORA_ALLOW_INSECURE_WALLET_HEADER: z.enum(['true', 'false']).optional(),
  // Number of trusted reverse proxies in front of the app. The real client IP
  // is taken as the (N+1)-th X-Forwarded-For entry from the right; the last N
  // entries are appended by our own infrastructure and are the only ones that
  // are trustworthy. Default 1 (a standard TLS-terminating reverse proxy). Set
  // to 0 to ignore X-Forwarded-For entirely (it is client-supplied, spoofable).
  SHIORA_TRUSTED_PROXY_COUNT: z.coerce.number().int().min(0).max(10).default(1),
  // Bearer token that authorizes a metrics scraper (Prometheus) to read
  // GET /api/system/metrics without a wallet session. Unset = admin-only.
  SHIORA_METRICS_TOKEN: z.string().min(16).optional(),
});

const parsedEnv = RuntimeEnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  SHIORA_TRUSTED_PROXY_COUNT: process.env.SHIORA_TRUSTED_PROXY_COUNT,
  SHIORA_ALLOWED_ORIGINS: process.env.SHIORA_ALLOWED_ORIGINS,
  SHIORA_SESSION_SECRET: process.env.SHIORA_SESSION_SECRET,
  SHIORA_SESSION_TTL_HOURS: process.env.SHIORA_SESSION_TTL_HOURS,
  SHIORA_ENABLE_HSTS: process.env.SHIORA_ENABLE_HSTS,
  SHIORA_ALLOW_INSECURE_WALLET_HEADER: process.env.SHIORA_ALLOW_INSECURE_WALLET_HEADER,
  SHIORA_METRICS_TOKEN: process.env.SHIORA_METRICS_TOKEN,
});

const allowedOrigins = parsedEnv.SHIORA_ALLOWED_ORIGINS
  ? parsedEnv.SHIORA_ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  : [...DEFAULT_ALLOWED_ORIGINS];

// Lazy session-secret accessor: in production, the first call will throw
// if SHIORA_SESSION_SECRET is not configured. Using a getter keeps the check
// off the module-load path so `next build` can collect pages, while every
// real runtime code path that touches the secret still fails immediately.
export const serverEnv = {
  nodeEnv: parsedEnv.NODE_ENV,
  isProduction: parsedEnv.NODE_ENV === 'production',
  isDevelopment: parsedEnv.NODE_ENV === 'development',
  isTest: parsedEnv.NODE_ENV === 'test',
  allowedOrigins,
  hasConfiguredSessionSecret: !!parsedEnv.SHIORA_SESSION_SECRET,
  get sessionSecret(): string {
    if (!parsedEnv.SHIORA_SESSION_SECRET && parsedEnv.NODE_ENV === 'production') {
      throw new Error(
        'SHIORA_SESSION_SECRET must be set in production. '
        + 'Generate one with: openssl rand -base64 48',
      );
    }
    return parsedEnv.SHIORA_SESSION_SECRET
      ?? 'shiora-dev-session-secret-change-me-before-production';
  },
  sessionTtlHours: parsedEnv.SHIORA_SESSION_TTL_HOURS,
  trustedProxyCount: parsedEnv.SHIORA_TRUSTED_PROXY_COUNT,
  metricsToken: parsedEnv.SHIORA_METRICS_TOKEN ?? null,
  enableHsts: parsedEnv.SHIORA_ENABLE_HSTS === 'true',
  allowInsecureWalletHeader:
    parsedEnv.SHIORA_ALLOW_INSECURE_WALLET_HEADER === 'true'
    || parsedEnv.SHIORA_ALLOW_INSECURE_WALLET_HEADER === undefined
    && parsedEnv.NODE_ENV !== 'production',
};

export type ServerEnv = typeof serverEnv;
