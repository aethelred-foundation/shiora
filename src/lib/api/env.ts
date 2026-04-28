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
  SHIORA_ADMIN_WALLETS: z.string().optional(),
  SHIORA_STORE_BACKEND: z.enum(['demo', 'postgres']).default('demo'),
  SHIORA_ALLOW_DEMO_STORE_IN_PRODUCTION: z.enum(['true', 'false']).optional(),
  SHIORA_DEMO_STORE_ENCRYPTION_KEY: z.string().min(32).optional(),
  DATABASE_URL: z.string().url().optional(),
});

const parsedEnv = RuntimeEnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  SHIORA_ALLOWED_ORIGINS: process.env.SHIORA_ALLOWED_ORIGINS,
  SHIORA_SESSION_SECRET: process.env.SHIORA_SESSION_SECRET,
  SHIORA_SESSION_TTL_HOURS: process.env.SHIORA_SESSION_TTL_HOURS,
  SHIORA_ENABLE_HSTS: process.env.SHIORA_ENABLE_HSTS,
  SHIORA_ALLOW_INSECURE_WALLET_HEADER: process.env.SHIORA_ALLOW_INSECURE_WALLET_HEADER,
  SHIORA_ADMIN_WALLETS: process.env.SHIORA_ADMIN_WALLETS,
  SHIORA_STORE_BACKEND: process.env.SHIORA_STORE_BACKEND,
  SHIORA_ALLOW_DEMO_STORE_IN_PRODUCTION: process.env.SHIORA_ALLOW_DEMO_STORE_IN_PRODUCTION,
  SHIORA_DEMO_STORE_ENCRYPTION_KEY: process.env.SHIORA_DEMO_STORE_ENCRYPTION_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
});

const allowedOrigins = parsedEnv.SHIORA_ALLOWED_ORIGINS
  ? parsedEnv.SHIORA_ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  : [...DEFAULT_ALLOWED_ORIGINS];

const adminWallets = parsedEnv.SHIORA_ADMIN_WALLETS
  ? parsedEnv.SHIORA_ADMIN_WALLETS.split(',')
      .map((wallet) => wallet.trim().toLowerCase())
      .filter(Boolean)
  : [];

function isProductionOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname.toLowerCase();
    return (
      parsed.protocol === 'https:' &&
      hostname !== 'localhost' &&
      hostname !== '127.0.0.1' &&
      hostname !== '::1'
    );
  } catch {
    return false;
  }
}

function getProductionReadinessFailures(): string[] {
  const failures: string[] = [];

  if (parsedEnv.NODE_ENV !== 'production') {
    failures.push('NODE_ENV must be production for regulated deployments.');
  }

  if (!parsedEnv.SHIORA_SESSION_SECRET) {
    failures.push('SHIORA_SESSION_SECRET must be set to a 32+ character secret.');
  }

  if (adminWallets.length === 0) {
    failures.push('SHIORA_ADMIN_WALLETS must include at least one authorized admin wallet.');
  }

  if (parsedEnv.SHIORA_ENABLE_HSTS !== 'true') {
    failures.push('SHIORA_ENABLE_HSTS must be true.');
  }

  if (parsedEnv.SHIORA_ALLOW_INSECURE_WALLET_HEADER === 'true') {
    failures.push('SHIORA_ALLOW_INSECURE_WALLET_HEADER must not be true.');
  }

  if (parsedEnv.SHIORA_ALLOW_DEMO_STORE_IN_PRODUCTION === 'true') {
    failures.push('SHIORA_ALLOW_DEMO_STORE_IN_PRODUCTION must be false for regulated production.');
  }

  if (parsedEnv.SHIORA_STORE_BACKEND !== 'postgres') {
    failures.push('SHIORA_STORE_BACKEND must be postgres for regulated production.');
  }

  if (!parsedEnv.DATABASE_URL) {
    failures.push('DATABASE_URL must point to a durable audited datastore.');
  }

  if (allowedOrigins.length === 0 || !allowedOrigins.every(isProductionOrigin)) {
    failures.push('SHIORA_ALLOWED_ORIGINS must contain only HTTPS non-local origins.');
  }

  return failures;
}

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
  adminWallets,
  hasConfiguredAdminWallets: adminWallets.length > 0,
  hasConfiguredSessionSecret: !!parsedEnv.SHIORA_SESSION_SECRET,
  get sessionSecret(): string {
    if (!parsedEnv.SHIORA_SESSION_SECRET && parsedEnv.NODE_ENV === 'production') {
      throw new Error(
        'SHIORA_SESSION_SECRET must be set in production. ' +
          'Generate one with: openssl rand -base64 48',
      );
    }
    return (
      parsedEnv.SHIORA_SESSION_SECRET ?? 'shiora-dev-session-secret-change-me-before-production'
    );
  },
  sessionTtlHours: parsedEnv.SHIORA_SESSION_TTL_HOURS,
  enableHsts: parsedEnv.SHIORA_ENABLE_HSTS === 'true',
  allowInsecureWalletHeader:
    parsedEnv.SHIORA_ALLOW_INSECURE_WALLET_HEADER === 'true' ||
    (parsedEnv.SHIORA_ALLOW_INSECURE_WALLET_HEADER === undefined &&
      parsedEnv.NODE_ENV !== 'production'),
  storeBackend: parsedEnv.SHIORA_STORE_BACKEND,
  allowDemoStoreInProduction: parsedEnv.SHIORA_ALLOW_DEMO_STORE_IN_PRODUCTION === 'true',
  hasDemoStoreEncryptionKey: !!parsedEnv.SHIORA_DEMO_STORE_ENCRYPTION_KEY,
  hasDatabaseUrl: !!parsedEnv.DATABASE_URL,
  getProductionReadinessFailures,
  assertProductionReady(): void {
    const failures = getProductionReadinessFailures();
    if (failures.length > 0) {
      throw new Error(`Shiora production readiness check failed: ${failures.join(' ')}`);
    }
  },
};

export type ServerEnv = typeof serverEnv;
