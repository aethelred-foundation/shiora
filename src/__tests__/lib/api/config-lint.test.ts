/** @jest-environment node */

import { lintProductionConfig, ALLOWED_ANCHOR_CHAIN_IDS } from '@/lib/api/config-lint';

function codes(env: Record<string, string | undefined>): string[] {
  return lintProductionConfig(env).map((p) => p.code);
}

describe('lintProductionConfig', () => {
  it('passes a clean production configuration', () => {
    expect(lintProductionConfig({
      SHIORA_ALLOWED_ORIGINS: 'https://app.shiora.health,https://shiora.health',
      SHIORA_SESSION_SECRET: 'k3kQ0uH2mYb8vTqXo1cRr5wLuJ9aZ4dNfE6gPi7sBt0=',
      SHIORA_VAULT_ADDR: 'https://vault.internal:8200',
      SHIORA_L1_RPC_URL: 'https://rpc.testnet.aethelred.org',
      SHIORA_L1_CHAIN_ID: '7332',
      SHIORA_LOG_LEVEL: 'info',
    })).toEqual([]);
  });

  it('passes an empty environment (nothing configured is nothing wrong)', () => {
    expect(lintProductionConfig({})).toEqual([]);
  });

  it('rejects wildcard and null origins', () => {
    expect(codes({ SHIORA_ALLOWED_ORIGINS: '*' })).toContain('WILDCARD_ORIGIN');
    expect(codes({ SHIORA_ALLOWED_ORIGINS: 'https://a.example,null' })).toContain('WILDCARD_ORIGIN');
    expect(codes({ SHIORA_ALLOWED_ORIGINS: 'https://*.example.com' })).toContain('WILDCARD_ORIGIN');
  });

  it('rejects plaintext http origins except localhost', () => {
    expect(codes({ SHIORA_ALLOWED_ORIGINS: 'http://app.example.com' })).toContain('INSECURE_ORIGIN');
    expect(codes({ SHIORA_ALLOWED_ORIGINS: 'http://localhost:3001,http://127.0.0.1:3001' })).toEqual([]);
    // Unparseable origins are not localhost — they fail closed.
    expect(codes({ SHIORA_ALLOWED_ORIGINS: 'http://not a url' })).toContain('INSECURE_ORIGIN');
  });

  it('rejects debug modes', () => {
    expect(codes({ NODE_OPTIONS: '--inspect=0.0.0.0:9229' })).toContain('DEBUG_INSPECTOR_ENABLED');
    expect(codes({ SHIORA_LOG_LEVEL: 'debug' })).toContain('DEBUG_LOGGING_ENABLED');
  });

  it('rejects placeholder secrets in any secret slot', () => {
    expect(codes({ SHIORA_SESSION_SECRET: 'replace-with-a-long-random-secret-before-production' }))
      .toContain('PLACEHOLDER_SECRET');
    expect(codes({ SHIORA_DATA_ENCRYPTION_KEY: 'example-key-do-not-use-0000000000000000' }))
      .toContain('PLACEHOLDER_SECRET');
    expect(codes({ SHIORA_METRICS_TOKEN: 'changeme-changeme' })).toContain('PLACEHOLDER_SECRET');
  });

  it('rejects plaintext backends except localhost', () => {
    expect(codes({ SHIORA_VAULT_ADDR: 'http://vault.internal:8200' })).toContain('NON_TLS_BACKEND');
    expect(codes({ SHIORA_L1_RPC_URL: 'http://rpc.example.org' })).toContain('NON_TLS_BACKEND');
    expect(codes({ SHIORA_L1_RPC_URL: 'http://localhost:8545' })).toEqual([]);
  });

  it('enforces the Aethelred mainnet gate', () => {
    expect(codes({ SHIORA_L1_RPC_URL: 'https://rpc.mainnet.aethelred.org' }))
      .toContain('MAINNET_TARGET_PROHIBITED');
    expect(codes({ SHIORA_L1_CHAIN_ID: '1' })).toContain('CHAIN_ID_NOT_ALLOWED');
    for (const chainId of ALLOWED_ANCHOR_CHAIN_IDS) {
      expect(codes({ SHIORA_L1_CHAIN_ID: chainId })).toEqual([]);
    }
  });
});
