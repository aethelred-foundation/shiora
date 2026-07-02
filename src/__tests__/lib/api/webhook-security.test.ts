/** @jest-environment node */

import {
  assertSafeWebhookUrl,
  isSafeWebhookUrl,
  signWebhookPayload,
  verifyWebhookSignature,
  WEBHOOK_TOLERANCE_MS,
} from '@/lib/api/webhook-security';

describe('assertSafeWebhookUrl (SSRF guard)', () => {
  it('accepts a plain public https URL', () => {
    expect(() => assertSafeWebhookUrl('https://hooks.partner.example.com/shiora')).not.toThrow();
    expect(isSafeWebhookUrl('https://hooks.partner.example.com/shiora')).toBe(true);
  });

  it('rejects non-https', () => {
    expect(() => assertSafeWebhookUrl('http://hooks.partner.example.com')).toThrow(/https/);
    expect(isSafeWebhookUrl('ftp://x')).toBe(false);
  });

  it('rejects invalid URLs', () => {
    expect(() => assertSafeWebhookUrl('not a url')).toThrow(/valid URL/);
  });

  it.each([
    'https://localhost/x',
    'https://localhost.localdomain/x',
    'https://foo.local/x',
    'https://svc.internal/x',
    'https://metadata.google.internal/x',
  ])('rejects blocked host %s', (url) => {
    expect(isSafeWebhookUrl(url)).toBe(false);
  });

  it.each([
    'https://127.0.0.1/x',
    'https://10.1.2.3/x',
    'https://172.16.0.1/x',
    'https://172.31.255.255/x',
    'https://192.168.1.1/x',
    'https://169.254.169.254/latest/meta-data', // cloud metadata
    'https://100.64.0.1/x', // CGNAT
    'https://0.0.0.0/x',
    'https://[::1]/x',
    'https://[fd00::1]/x',
    'https://[fe80::1]/x',
  ])('rejects private/loopback/link-local literal %s', (url) => {
    expect(isSafeWebhookUrl(url)).toBe(false);
  });

  it('allows a public IPv4 and public IPv6 literal', () => {
    expect(isSafeWebhookUrl('https://8.8.8.8/x')).toBe(true);
    expect(isSafeWebhookUrl('https://172.15.0.1/x')).toBe(true); // just outside 172.16/12
  });
});

describe('signWebhookPayload / verifyWebhookSignature', () => {
  const secret = 'whsec_test';
  const payload = '{"type":"webhook.test"}';

  it('produces a Stripe-style header that verifies', () => {
    const now = 1_700_000_000_000;
    const header = signWebhookPayload(secret, payload, now);
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    expect(verifyWebhookSignature(secret, payload, header, now)).toBe(true);
  });

  it('defaults the timestamp to now when not supplied', () => {
    const header = signWebhookPayload(secret, payload); // default now
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    expect(verifyWebhookSignature(secret, payload, header)).toBe(true);
  });

  it('rejects a wrong secret, wrong payload, or tampered mac', () => {
    const now = 1_700_000_000_000;
    const header = signWebhookPayload(secret, payload, now);
    expect(verifyWebhookSignature('other', payload, header, now)).toBe(false);
    expect(verifyWebhookSignature(secret, '{"type":"evil"}', header, now)).toBe(false);
    expect(verifyWebhookSignature(secret, payload, header.slice(0, -2) + 'zz', now)).toBe(false);
  });

  it('rejects a stale signature outside the tolerance window (replay)', () => {
    const t = 1_700_000_000_000;
    const header = signWebhookPayload(secret, payload, t);
    expect(verifyWebhookSignature(secret, payload, header, t + WEBHOOK_TOLERANCE_MS + 1)).toBe(false);
    expect(verifyWebhookSignature(secret, payload, header, t + WEBHOOK_TOLERANCE_MS - 1)).toBe(true);
  });

  it('rejects a malformed header', () => {
    expect(verifyWebhookSignature(secret, payload, 'garbage')).toBe(false);
    expect(verifyWebhookSignature(secret, payload, 't=notanumber,v1=abc')).toBe(false);
    expect(verifyWebhookSignature(secret, payload, 't=123')).toBe(false); // no v1
  });
});
