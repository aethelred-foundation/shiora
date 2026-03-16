import { z } from 'zod';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
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
});

const parsedEnv = RuntimeEnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  SHIORA_ALLOWED_ORIGINS: process.env.SHIORA_ALLOWED_ORIGINS,
  SHIORA_SESSION_SECRET: process.env.SHIORA_SESSION_SECRET,
  SHIORA_SESSION_TTL_HOURS: process.env.SHIORA_SESSION_TTL_HOURS,
  SHIORA_ENABLE_HSTS: process.env.SHIORA_ENABLE_HSTS,
  SHIORA_ALLOW_INSECURE_WALLET_HEADER: process.env.SHIORA_ALLOW_INSECURE_WALLET_HEADER,
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
  enableHsts: parsedEnv.SHIORA_ENABLE_HSTS === 'true',
  allowInsecureWalletHeader:
    parsedEnv.SHIORA_ALLOW_INSECURE_WALLET_HEADER === 'true'
    || parsedEnv.SHIORA_ALLOW_INSECURE_WALLET_HEADER === undefined
    && parsedEnv.NODE_ENV !== 'production',
};

export type ServerEnv = typeof serverEnv;
