// ============================================================
// Shiora on Aethelred — OpenAPI 3.1 contract (GAP-19)
//
// A machine-readable description of the stable, supported public API so
// integrators (e.g. the MBZUAI IEC venture) generate clients instead of
// hand-writing them. The manifest below is the source of truth; buildOpenApiSpec
// assembles it into a valid OpenAPI 3.1 document served at GET /api/openapi.
//
// This documents the SUPPORTED surface, not every internal route. A drift test
// asserts every documented endpoint really exists (path + method), so the
// published spec can never reference a route that was renamed or removed.
// ============================================================

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface RouteDoc {
  /** OpenAPI path, using {param} for dynamic segments. */
  path: string;
  method: HttpMethod;
  summary: string;
  tags: string[];
  /** Whether a wallet session (bearer/cookie) is required. */
  auth: boolean;
}

/** The supported public API surface. Keep alphabetical within a tag. */
export const ROUTE_MANIFEST: readonly RouteDoc[] = [
  // Authentication
  { path: '/api/wallet/challenge', method: 'get', summary: 'Request a signing challenge for a wallet address', tags: ['Authentication'], auth: false },
  { path: '/api/wallet/connect', method: 'get', summary: 'Check the current session', tags: ['Authentication'], auth: true },
  { path: '/api/wallet/connect', method: 'post', summary: 'Authenticate a wallet by verifying a signed challenge', tags: ['Authentication'], auth: false },
  { path: '/api/wallet/connect', method: 'delete', summary: 'Sign out (revoke the presented session)', tags: ['Authentication'], auth: true },

  // Multi-factor
  { path: '/api/mfa/enroll', method: 'post', summary: 'Begin TOTP enrolment', tags: ['MFA'], auth: true },
  { path: '/api/mfa/verify', method: 'post', summary: 'Confirm TOTP enrolment with a code', tags: ['MFA'], auth: true },
  { path: '/api/mfa/step-up', method: 'post', summary: 'Exchange a TOTP code for a short-lived step-up assertion', tags: ['MFA'], auth: true },

  // Sessions
  { path: '/api/me/sessions', method: 'get', summary: 'List the caller\'s active sessions', tags: ['Sessions'], auth: true },
  { path: '/api/me/sessions/{jti}', method: 'delete', summary: 'Revoke a single session (device)', tags: ['Sessions'], auth: true },
  { path: '/api/me/sessions/revoke-all', method: 'post', summary: 'Sign out of all other sessions', tags: ['Sessions'], auth: true },

  // Identity
  { path: '/api/me', method: 'get', summary: 'The caller\'s roles and capabilities', tags: ['Identity'], auth: true },
  { path: '/api/me/profile', method: 'get', summary: 'Get the caller\'s profile', tags: ['Identity'], auth: true },
  { path: '/api/me/profile', method: 'put', summary: 'Update the caller\'s profile', tags: ['Identity'], auth: true },

  // Records
  { path: '/api/records', method: 'get', summary: 'List health records (paginated, filterable)', tags: ['Records'], auth: true },
  { path: '/api/records', method: 'post', summary: 'Create a health record (supports Idempotency-Key)', tags: ['Records'], auth: true },
  { path: '/api/records/{id}', method: 'get', summary: 'Get a record with its version (ETag)', tags: ['Records'], auth: true },
  { path: '/api/records/{id}', method: 'patch', summary: 'Update a record (supports If-Match optimistic concurrency)', tags: ['Records'], auth: true },
  { path: '/api/records/{id}', method: 'delete', summary: 'Soft-delete a record', tags: ['Records'], auth: true },

  // Access grants
  { path: '/api/access', method: 'get', summary: 'List access grants', tags: ['Access'], auth: true },
  { path: '/api/access', method: 'post', summary: 'Grant a provider access', tags: ['Access'], auth: true },
  { path: '/api/access/{id}', method: 'delete', summary: 'Revoke an access grant', tags: ['Access'], auth: true },

  // Consent
  { path: '/api/consent', method: 'get', summary: 'List consents', tags: ['Consent'], auth: true },
  { path: '/api/consent', method: 'post', summary: 'Record a consent', tags: ['Consent'], auth: true },
  { path: '/api/consent/{id}', method: 'patch', summary: 'Update a consent', tags: ['Consent'], auth: true },

  // Transparency
  { path: '/api/me/activity', method: 'get', summary: 'The caller\'s own audit trail (cursor-paginated)', tags: ['Transparency'], auth: true },
  { path: '/api/me/access-log', method: 'get', summary: 'Who accessed the caller\'s data (cursor-paginated)', tags: ['Transparency'], auth: true },

  // Notifications
  { path: '/api/notifications', method: 'get', summary: 'List notifications', tags: ['Notifications'], auth: true },
  { path: '/api/notifications/{id}', method: 'patch', summary: 'Mark a notification read', tags: ['Notifications'], auth: true },
  { path: '/api/notifications/read-all', method: 'post', summary: 'Mark all notifications read', tags: ['Notifications'], auth: true },
  { path: '/api/notifications/stream', method: 'get', summary: 'Real-time notifications over Server-Sent Events', tags: ['Notifications'], auth: true },

  // Audit
  { path: '/api/audit/export', method: 'get', summary: 'Export a signed WORM audit-chain segment (admin)', tags: ['System'], auth: true },

  // Webhooks
  { path: '/api/webhooks', method: 'get', summary: 'List webhook subscriptions', tags: ['Webhooks'], auth: true },
  { path: '/api/webhooks', method: 'post', summary: 'Create a webhook subscription (returns the signing secret once)', tags: ['Webhooks'], auth: true },
  { path: '/api/webhooks/{id}', method: 'delete', summary: 'Delete a webhook subscription', tags: ['Webhooks'], auth: true },
  { path: '/api/webhooks/{id}/test', method: 'post', summary: 'Send a signed test delivery', tags: ['Webhooks'], auth: true },

  // Passkeys (WebAuthn / FIDO2)
  { path: '/api/webauthn/register/options', method: 'post', summary: 'Begin passkey registration (challenge + options)', tags: ['Passkeys'], auth: true },
  { path: '/api/webauthn/register/verify', method: 'post', summary: 'Complete passkey registration (verify attestation)', tags: ['Passkeys'], auth: true },
  { path: '/api/webauthn/authenticate/options', method: 'post', summary: 'Begin passkey assertion (challenge + allowCredentials)', tags: ['Passkeys'], auth: true },
  { path: '/api/webauthn/authenticate/verify', method: 'post', summary: 'Verify a passkey assertion (challenge/origin/signature/counter)', tags: ['Passkeys'], auth: true },
  { path: '/api/webauthn/credentials', method: 'get', summary: 'List registered passkeys', tags: ['Passkeys'], auth: true },
  { path: '/api/webauthn/credentials/{id}', method: 'delete', summary: 'Remove a registered passkey', tags: ['Passkeys'], auth: true },

  // System
  { path: '/api/health/live', method: 'get', summary: 'Liveness probe', tags: ['System'], auth: false },
  { path: '/api/health/ready', method: 'get', summary: 'Readiness probe (config + datastore)', tags: ['System'], auth: false },
  { path: '/api/system/status', method: 'get', summary: 'Production readiness and feature maturity', tags: ['System'], auth: false },
  { path: '/api/system/release', method: 'get', summary: 'Release provenance manifest (version, git SHA, contract hashes)', tags: ['System'], auth: false },
  { path: '/api/system/metrics', method: 'get', summary: 'Prometheus metrics (scraper token or admin)', tags: ['System'], auth: true },
  { path: '/api/system/maintenance', method: 'post', summary: 'Run durable-store garbage collection (admin)', tags: ['System'], auth: true },
  { path: '/api/system/kek-reseal', method: 'post', summary: 'Re-seal envelopes under the current KEK (admin)', tags: ['System'], auth: true },
  { path: '/api/security/csp-report', method: 'post', summary: 'CSP violation report collector', tags: ['System'], auth: false },
  { path: '/api/openapi', method: 'get', summary: 'This OpenAPI 3.1 document', tags: ['System'], auth: false },
] as const;

const TAG_DESCRIPTIONS: Record<string, string> = {
  Authentication: 'Wallet challenge/response authentication.',
  MFA: 'TOTP multi-factor enrolment and step-up.',
  Passkeys: 'WebAuthn/FIDO2 passkey enrolment and assertion.',
  Sessions: 'Session inventory and revocation.',
  Identity: 'Caller identity, roles, and profile.',
  Records: 'Encrypted health records.',
  Access: 'Provider access grants.',
  Consent: 'Consent records.',
  Transparency: 'Audit trails and access disclosure (GDPR Art. 15).',
  Notifications: 'In-app notifications.',
  Webhooks: 'Signed outbound event delivery.',
  System: 'Operational and platform endpoints.',
};

interface OpenApiSpec {
  openapi: '3.1.0';
  info: Record<string, unknown>;
  servers: { url: string; description: string }[];
  tags: { name: string; description: string }[];
  paths: Record<string, Record<string, unknown>>;
  components: Record<string, unknown>;
}

/** Assemble the manifest into a valid OpenAPI 3.1 document. */
export function buildOpenApiSpec(): OpenApiSpec {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of ROUTE_MANIFEST) {
    const item = paths[route.path] ?? {};
    item[route.method] = {
      summary: route.summary,
      tags: route.tags,
      ...(route.auth ? { security: [{ walletSession: [] }] } : {}),
      responses: {
        '200': { description: 'Success' },
        ...(route.auth ? { '401': { description: 'Authentication required' } } : {}),
      },
    };
    paths[route.path] = item;
  }

  const usedTags = Array.from(new Set(ROUTE_MANIFEST.flatMap((r) => r.tags))).sort();

  return {
    openapi: '3.1.0',
    info: {
      title: 'Shiora on Aethelred API',
      version: '1.0.0',
      description:
        'The supported public API for Shiora — encrypted, owner-controlled, access-audited health data.',
      license: { name: 'Proprietary' },
    },
    servers: [
      { url: 'https://app.shiora.health', description: 'Production' },
      { url: 'http://localhost:3000', description: 'Local development' },
    ],
    // Every tag used in the manifest has a description (asserted by tests).
    tags: usedTags.map((name) => ({ name, description: TAG_DESCRIPTIONS[name] })),
    paths,
    components: {
      securitySchemes: {
        walletSession: {
          type: 'http',
          scheme: 'bearer',
          description:
            'A wallet session token from POST /api/wallet/connect, sent as `Authorization: Bearer <token>` or the __Host-shiora_session cookie.',
        },
      },
    },
  };
}
