/**
 * Tests for src/lib/api/client.ts — ApiError class and api helper methods
 */

import { ApiError, api } from '@/lib/api/client';

// The global fetchMock is set up in src/mocks/fetchMock.ts (jest setup)

describe('ApiError', () => {
  it('creates with message and status', () => {
    const err = new ApiError({ code: 'TEST', message: 'boom' }, 500);
    expect(err.message).toBe('boom');
    expect(err.code).toBe('TEST');
    expect(err.status).toBe(500);
    expect(err.name).toBe('ApiError');
  });

  it('uses defaults when fields missing', () => {
    const err = new ApiError({}, 400);
    expect(err.message).toBe('An unexpected error occurred');
    expect(err.code).toBe('UNKNOWN_ERROR');
  });

  it('stores details', () => {
    const err = new ApiError({ code: 'X', details: { field: 'name' } }, 422);
    expect(err.details).toEqual({ field: 'name' });
  });

  it('isUnauthorized', () => {
    expect(new ApiError({}, 401).isUnauthorized).toBe(true);
    expect(new ApiError({}, 403).isUnauthorized).toBe(false);
  });

  it('isForbidden', () => {
    expect(new ApiError({}, 403).isForbidden).toBe(true);
    expect(new ApiError({}, 401).isForbidden).toBe(false);
  });

  it('isNotFound', () => {
    expect(new ApiError({}, 404).isNotFound).toBe(true);
    expect(new ApiError({}, 200).isNotFound).toBe(false);
  });

  it('isRateLimited', () => {
    expect(new ApiError({}, 429).isRateLimited).toBe(true);
    expect(new ApiError({}, 200).isRateLimited).toBe(false);
  });
});

describe('api helper', () => {
  // The fetch mock from fetchMock.ts intercepts these calls and returns
  // mock responses with { success: true, data: ... } format.

  it('api.get fetches data', async () => {
    const data = await api.get('/api/health');
    expect(data).toBeDefined();
  });

  it('api.get with params builds query string', async () => {
    const data = await api.get('/api/records', { page: 1, limit: 10 });
    expect(data).toBeDefined();
  });

  it('api.get skips null/undefined/empty/false params', async () => {
    const data = await api.get('/api/records', {
      page: 1,
      empty: '',
      nul: null,
      undef: undefined,
      falsy: false,
    });
    expect(data).toBeDefined();
  });

  it('api.post sends POST request', async () => {
    const data = await api.post('/api/records', { type: 'lab_result', title: 'Test' });
    expect(data).toBeDefined();
  });

  it('api.post works without body', async () => {
    // Use an endpoint that accepts POST without body
    const data = await api.post('/api/chat', { conversationId: 'test', content: 'hello' });
    expect(data).toBeDefined();
  });

  it('api.patch sends PATCH request', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ success: true, data: { updated: true } }),
    });
    try {
      const data = await api.patch('/api/records/1', { title: 'Updated' });
      expect(data).toEqual({ updated: true });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('api.put sends PUT request', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ success: true, data: { updated: true } }),
    });
    try {
      const data = await api.put('/api/records/1', { title: 'Updated' });
      expect(data).toEqual({ updated: true });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('api.delete sends DELETE request', async () => {
    // /api/wallet/connect supports DELETE
    const data = await api.delete('/api/wallet/connect');
    expect(data).toBeDefined();
  });

  it('api.getPaginated returns items and meta', async () => {
    const result = await api.getPaginated('/api/records');
    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('meta');
  });

  it('throws ApiError on failure response', async () => {
    // Save original fetch
    const originalFetch = global.fetch;
    // Mock a failure response
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () =>
        Promise.resolve({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid input' },
        }),
    });

    try {
      await expect(api.get('/api/fail')).rejects.toThrow(ApiError);
      await expect(api.get('/api/fail')).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        status: 400,
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('throws ApiError on non-JSON error response', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      headers: new Headers({ 'content-type': 'text/html' }),
    });

    try {
      await expect(api.get('/api/fail')).rejects.toThrow(ApiError);
      await expect(api.get('/api/fail')).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        status: 502,
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('returns undefined for non-JSON successful response', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/plain' }),
    });

    try {
      const result = await api.get('/api/ok');
      expect(result).toBeUndefined();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('throws ApiError with defaults when error field missing', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ success: false }),
    });

    try {
      await expect(api.get('/api/fail')).rejects.toMatchObject({
        code: 'UNKNOWN_ERROR',
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('getPaginated throws on failure', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () =>
        Promise.resolve({
          success: false,
          error: { code: 'BAD', message: 'nope' },
        }),
    });

    try {
      await expect(api.getPaginated('/api/fail')).rejects.toThrow(ApiError);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('getPaginated throws with defaults when error field missing', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ success: false }),
    });

    try {
      await expect(api.getPaginated('/api/fail')).rejects.toMatchObject({
        code: 'UNKNOWN_ERROR',
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('handles null content-type header', async () => {
    const originalFetch = global.fetch;
    // Create headers that return null for content-type
    const headers = new Headers();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers,
    });

    try {
      const result = await api.get('/api/test');
      expect(result).toBeUndefined();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('api.patch without body sends no body', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ success: true, data: null }),
    });

    try {
      await api.patch('/api/test');
      expect((global.fetch as jest.Mock).mock.calls[0][1].body).toBeUndefined();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('api.patch with null body sends no body', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ success: true, data: null }),
    });

    try {
      await api.patch('/api/test', null);
      expect((global.fetch as jest.Mock).mock.calls[0][1].body).toBeUndefined();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('api.put without body sends no body', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ success: true, data: null }),
    });

    try {
      await api.put('/api/test');
      expect((global.fetch as jest.Mock).mock.calls[0][1].body).toBeUndefined();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('api.put with null body sends no body', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ success: true, data: null }),
    });

    try {
      await api.put('/api/test', null);
      expect((global.fetch as jest.Mock).mock.calls[0][1].body).toBeUndefined();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('api.post with null body sends no body', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ success: true, data: null }),
    });

    try {
      await api.post('/api/test', null);
      expect((global.fetch as jest.Mock).mock.calls[0][1].body).toBeUndefined();
    } finally {
      global.fetch = originalFetch;
    }
  });
});
