/** @jest-environment node */

import { ZodError, z } from 'zod';
import {
  HTTP,
  successResponse,
  paginatedResponse,
  errorResponse,
  validationError,
  notFoundResponse,
  securityHeaders,
} from '@/lib/api/responses';

describe('HTTP constants', () => {
  it('has standard status codes', () => {
    expect(HTTP.OK).toBe(200);
    expect(HTTP.CREATED).toBe(201);
    expect(HTTP.BAD_REQUEST).toBe(400);
    expect(HTTP.UNAUTHORIZED).toBe(401);
    expect(HTTP.FORBIDDEN).toBe(403);
    expect(HTTP.NOT_FOUND).toBe(404);
    expect(HTTP.CONFLICT).toBe(409);
    expect(HTTP.UNPROCESSABLE).toBe(422);
    expect(HTTP.TOO_MANY_REQUESTS).toBe(429);
    expect(HTTP.INTERNAL).toBe(500);
  });
});

describe('successResponse', () => {
  it('returns 200 with data', async () => {
    const res = successResponse({ foo: 'bar' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.foo).toBe('bar');
  });

  it('supports custom status code', async () => {
    const res = successResponse({ id: 1 }, 201);
    expect(res.status).toBe(201);
  });

  it('includes meta when provided', async () => {
    const res = successResponse({ id: 1 }, 200, { message: 'Created' });
    const body = await res.json();
    expect(body.meta?.message).toBe('Created');
  });

  it('omits meta when not provided', async () => {
    const res = successResponse({ id: 1 });
    const body = await res.json();
    expect(body.meta).toBeUndefined();
  });

  it('includes the hardened security header set', () => {
    const res = successResponse({ id: 1 });
    expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    expect(res.headers.get('Pragma')).toBe('no-cache');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(res.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    expect(res.headers.get('X-Permitted-Cross-Domain-Policies')).toBe('none');
    expect(res.headers.get('Permissions-Policy')).toContain('camera=()');
  });

  it('allows callers to override a default header', () => {
    const res = successResponse({ id: 1 }, 200, undefined, { 'X-Frame-Options': 'SAMEORIGIN' });
    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
  });
});

describe('securityHeaders', () => {
  it('omits HSTS when SHIORA_ENABLE_HSTS is not enabled (default test env)', () => {
    // The default test environment runs over http with HSTS disabled.
    expect(securityHeaders()['Strict-Transport-Security']).toBeUndefined();
  });

  it('emits a preload-eligible HSTS policy when SHIORA_ENABLE_HSTS=true', () => {
    jest.resetModules();
    const originalEnv = { ...process.env };
    process.env.SHIORA_ENABLE_HSTS = 'true';

    try {
      const { securityHeaders: withHsts } = require('@/lib/api/responses');
      const hsts = withHsts()['Strict-Transport-Security'];
      expect(hsts).toBe('max-age=63072000; includeSubDomains; preload');
    } finally {
      process.env = originalEnv;
      jest.resetModules();
    }
  });
});

describe('paginatedResponse', () => {
  it('returns paginated structure', async () => {
    const items = [1, 2, 3];
    const res = paginatedResponse(items, 10, 1, 3);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([1, 2, 3]);
    expect(body.pagination).toEqual({
      page: 1,
      limit: 3,
      total: 10,
      totalPages: 4,
      hasNext: true,
      hasPrev: false,
    });
  });

  it('handles last page', async () => {
    const res = paginatedResponse([10], 10, 10, 1);
    const body = await res.json();
    expect(body.pagination.hasNext).toBe(false);
    expect(body.pagination.hasPrev).toBe(true);
  });
});

describe('errorResponse', () => {
  it('returns error structure', async () => {
    const res = errorResponse('TEST_ERROR', 'Something went wrong', 400);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('TEST_ERROR');
    expect(body.error.message).toBe('Something went wrong');
  });

  it('includes details when provided', async () => {
    const res = errorResponse('ERR', 'msg', 400, { field: 'email' });
    const body = await res.json();
    expect(body.error.details).toEqual({ field: 'email' });
  });

  it('defaults to 400 status', async () => {
    const res = errorResponse('ERR', 'msg');
    expect(res.status).toBe(400);
  });
});

describe('validationError', () => {
  it('returns 422 with Zod field errors', async () => {
    const schema = z.object({ name: z.string().min(1), age: z.number() });
    let zodError: ZodError;
    try {
      schema.parse({ name: '', age: 'not-a-number' });
      throw new Error('Should not reach here');
    } catch (e) {
      zodError = e as ZodError;
    }
    const res = validationError(zodError!);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeDefined();
  });
});

describe('notFoundResponse', () => {
  it('returns 404 with resource info', async () => {
    const res = notFoundResponse('Record', 'abc-123');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toContain('Record');
    expect(body.error.message).toContain('abc-123');
  });
});
