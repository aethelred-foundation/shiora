import { test, expect } from '@playwright/test';

test.describe('operational endpoints', () => {
  test('liveness probe reports the service is up', async ({ request }) => {
    const res = await request.get('/api/health/live');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ data: { status: 'alive' } });
  });

  test('readiness probe returns a structured status', async ({ request }) => {
    const res = await request.get('/api/health/ready');
    // 200 (successResponse → { data }) when ready, 503 (errorResponse → { error })
    // when degraded — both are structured responses, never an unhandled 500.
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(body.data ?? body.error).toBeTruthy();
  });

  test('OpenAPI document is served and self-describes the API', async ({ request }) => {
    const res = await request.get('/api/openapi');
    expect(res.status()).toBe(200);
    const spec = await res.json();
    expect(spec.openapi).toBe('3.1.0');
    // The passkey routes added in GAP-12 are documented.
    expect(spec.paths).toHaveProperty('/api/webauthn/credentials');
  });
});
