// ============================================================
// Shiora on Aethelred — Webhook security primitives (GAP-21)
//
// Two hazards specific to outbound webhooks:
//  1. SSRF — a subscriber URL pointed at internal infrastructure (metadata
//     endpoints, private ranges, localhost) turns the platform into a proxy
//     into its own network. assertSafeWebhookUrl rejects those up front.
//  2. Spoofed deliveries — a receiver must know a payload genuinely came from
//     Shiora. Each delivery is signed Stripe-style (t=…,v1=HMAC), and
//     verifyWebhookSignature lets a receiver check it in constant time within
//     a freshness window (replay defence).
//
// HONEST RESIDUAL RISK: the URL guard blocks IP-literal and well-known-name
// targets. A hostname that resolves to a private address (DNS rebinding) needs
// resolve-and-pin at connect time — an outbound egress proxy / allowlist is the
// production control noted in docs. This guard is the application-layer floor.
// ============================================================

import crypto from 'node:crypto';

/** Freshness window for a signed delivery (replay protection). */
export const WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000;

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
]);

// Private / loopback / link-local IPv4 and IPv6 literals.
function isPrivateIpLiteral(host: string): boolean {
  // IPv6 loopback / link-local / unique-local.
  if (host === '::1' || host === '::' || /^\[?::1\]?$/.test(host)) return true;
  if (/^\[?f[cd][0-9a-f]{2}:/i.test(host)) return true; // fc00::/7 unique-local
  if (/^\[?fe80:/i.test(host)) return true; // link-local

  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  return false;
}

/**
 * Validate a subscriber URL. Throws with a clear message when it is not a
 * plain https URL to a public host.
 */
export function assertSafeWebhookUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Webhook URL is not a valid URL.');
  }
  if (url.protocol !== 'https:') {
    throw new Error('Webhook URL must use https.');
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Webhook URL host is not permitted.');
  }
  if (isPrivateIpLiteral(host.replace(/^\[|\]$/g, ''))) {
    throw new Error('Webhook URL must not target a private or loopback address.');
  }
  return url;
}

/** Whether a URL passes the SSRF guard (non-throwing). */
export function isSafeWebhookUrl(raw: string): boolean {
  try {
    assertSafeWebhookUrl(raw);
    return true;
  } catch {
    return false;
  }
}

/** Sign a payload for delivery: `t=<ms>,v1=<hex hmac over "t.payload">`. */
export function signWebhookPayload(secret: string, payload: string, timestamp: number = Date.now()): string {
  const mac = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${mac}`;
}

function timingSafe(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/**
 * Verify a signature header a receiver got, within the freshness window.
 * (Also usable by our own delivery tests and by subscribers implementing
 * receipt verification.)
 */
export function verifyWebhookSignature(
  secret: string,
  payload: string,
  header: string,
  now: number = Date.now(),
): boolean {
  const parts = Object.fromEntries(
    header.split(',').map((kv) => kv.split('=').map((s) => s.trim()) as [string, string]),
  );
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1) {
    return false;
  }
  if (Math.abs(now - t) > WEBHOOK_TOLERANCE_MS) {
    return false; // stale — replay protection
  }
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  return timingSafe(parts.v1, expected);
}
