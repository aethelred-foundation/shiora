/** @jest-environment node */

import { serverEnv } from '@/lib/api/env';

describe('serverEnv', () => {
  it('exposes nodeEnv as test', () => {
    expect(serverEnv.nodeEnv).toBe('test');
  });

  it('isTest is true', () => {
    expect(serverEnv.isTest).toBe(true);
  });

  it('isProduction is false in test', () => {
    expect(serverEnv.isProduction).toBe(false);
  });

  it('isDevelopment is false in test', () => {
    expect(serverEnv.isDevelopment).toBe(false);
  });

  it('allowedOrigins is an array', () => {
    expect(Array.isArray(serverEnv.allowedOrigins)).toBe(true);
    expect(serverEnv.allowedOrigins.length).toBeGreaterThan(0);
  });

  it('hasConfiguredSessionSecret returns a boolean', () => {
    expect(typeof serverEnv.hasConfiguredSessionSecret).toBe('boolean');
  });

  it('sessionSecret returns dev fallback when not in production', () => {
    // In test env without SHIORA_SESSION_SECRET, should return the dev fallback
    const secret = serverEnv.sessionSecret;
    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThan(0);
  });

  it('sessionTtlHours is a positive number', () => {
    expect(typeof serverEnv.sessionTtlHours).toBe('number');
    expect(serverEnv.sessionTtlHours).toBeGreaterThan(0);
  });

  it('enableHsts is a boolean', () => {
    expect(typeof serverEnv.enableHsts).toBe('boolean');
  });

  it('allowInsecureWalletHeader is a boolean', () => {
    expect(typeof serverEnv.allowInsecureWalletHeader).toBe('boolean');
  });

  describe('SHIORA_ALLOWED_ORIGINS parsing', () => {
    it('allowedOrigins contains default origins when env var not set', () => {
      // When SHIORA_ALLOWED_ORIGINS is not set, defaults are used
      expect(serverEnv.allowedOrigins).toContain('http://localhost:3000');
    });
  });
});

describe('serverEnv with custom SHIORA_ALLOWED_ORIGINS', () => {
  it('parses custom comma-separated origins', () => {
    jest.resetModules();

    const originalEnv = { ...process.env };
    process.env.SHIORA_ALLOWED_ORIGINS = 'https://custom.example.com, https://other.example.com, ';

    try {
      const { serverEnv: customEnv } = require('@/lib/api/env');
      expect(customEnv.allowedOrigins).toContain('https://custom.example.com');
      expect(customEnv.allowedOrigins).toContain('https://other.example.com');
      // Empty entries after filter(Boolean) should be removed
      expect(customEnv.allowedOrigins).not.toContain('');
      // Default origins should NOT be present when custom is set
      expect(customEnv.allowedOrigins).not.toContain('http://localhost:3000');
    } finally {
      process.env = originalEnv;
      jest.resetModules();
    }
  });
});

describe('serverEnv.sessionSecret in production without secret', () => {
  it('throws error when SHIORA_SESSION_SECRET is not set in production', () => {
    jest.resetModules();

    const originalEnv = { ...process.env };
    process.env.NODE_ENV = 'production';
    delete process.env.SHIORA_SESSION_SECRET;

    try {
      const { serverEnv: prodEnv } = require('@/lib/api/env');
      expect(() => prodEnv.sessionSecret).toThrow(
        'SHIORA_SESSION_SECRET must be set in production',
      );
    } finally {
      process.env = originalEnv;
      jest.resetModules();
    }
  });
});

describe('serverEnv.sessionSecret in production with secret', () => {
  it('returns configured secret when SHIORA_SESSION_SECRET is set in production', () => {
    jest.resetModules();

    const originalEnv = { ...process.env };
    process.env.NODE_ENV = 'production';
    process.env.SHIORA_SESSION_SECRET = 'a-very-long-session-secret-that-is-at-least-32-chars';

    try {
      const { serverEnv: prodEnv } = require('@/lib/api/env');
      expect(prodEnv.sessionSecret).toBe('a-very-long-session-secret-that-is-at-least-32-chars');
    } finally {
      process.env = originalEnv;
      jest.resetModules();
    }
  });
});

describe('serverEnv enableHsts and allowInsecureWalletHeader', () => {
  it('enableHsts is true when SHIORA_ENABLE_HSTS=true', () => {
    jest.resetModules();

    const originalEnv = { ...process.env };
    process.env.SHIORA_ENABLE_HSTS = 'true';

    try {
      const { serverEnv: hstsEnv } = require('@/lib/api/env');
      expect(hstsEnv.enableHsts).toBe(true);
    } finally {
      process.env = originalEnv;
      jest.resetModules();
    }
  });

  it('allowInsecureWalletHeader is false in production when not explicitly set', () => {
    jest.resetModules();

    const originalEnv = { ...process.env };
    process.env.NODE_ENV = 'production';
    process.env.SHIORA_SESSION_SECRET = 'a-very-long-session-secret-that-is-at-least-32-chars';
    delete process.env.SHIORA_ALLOW_INSECURE_WALLET_HEADER;

    try {
      const { serverEnv: prodEnv } = require('@/lib/api/env');
      expect(prodEnv.allowInsecureWalletHeader).toBe(false);
    } finally {
      process.env = originalEnv;
      jest.resetModules();
    }
  });

  it('allowInsecureWalletHeader is true when explicitly set to true', () => {
    jest.resetModules();

    const originalEnv = { ...process.env };
    process.env.SHIORA_ALLOW_INSECURE_WALLET_HEADER = 'true';

    try {
      const { serverEnv: explicitEnv } = require('@/lib/api/env');
      expect(explicitEnv.allowInsecureWalletHeader).toBe(true);
    } finally {
      process.env = originalEnv;
      jest.resetModules();
    }
  });

  it('allowInsecureWalletHeader is false when explicitly set to false', () => {
    jest.resetModules();

    const originalEnv = { ...process.env };
    process.env.SHIORA_ALLOW_INSECURE_WALLET_HEADER = 'false';

    try {
      const { serverEnv: explicitEnv } = require('@/lib/api/env');
      expect(explicitEnv.allowInsecureWalletHeader).toBe(false);
    } finally {
      process.env = originalEnv;
      jest.resetModules();
    }
  });
});
