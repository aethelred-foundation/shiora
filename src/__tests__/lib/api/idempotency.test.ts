/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { withIdempotency, IDEMPOTENCY_TTL_MS } from '@/lib/api/idempotency';
import { __resetIdempotencyStoreForTests } from '@/lib/persistence/idempotency-store';
import { successResponse, HTTP } from '@/lib/api/responses';

const SCOPE = 'aeth1caller';

afterEach(() => __resetIdempotencyStoreForTests());

function req(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/records', { method: 'POST', headers });
}

describe('withIdempotency', () => {
  it('runs the handler directly when no Idempotency-Key is supplied', async () => {
    const handler = jest.fn(async () => successResponse({ id: 'a' }, HTTP.CREATED));
    const res = await withIdempotency(req(), SCOPE, handler);
    expect(res.status).toBe(201);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('executes once and replays the recorded response on retry', async () => {
    let calls = 0;
    const handler = jest.fn(async () => successResponse({ id: `rec-${++calls}` }, HTTP.CREATED));

    const first = await withIdempotency(req({ 'idempotency-key': 'abc' }), SCOPE, handler);
    expect(first.status).toBe(201);
    expect((await first.json()).data.id).toBe('rec-1');
    expect(first.headers.get('Idempotent-Replayed')).toBeNull();

    const retry = await withIdempotency(req({ 'idempotency-key': 'abc' }), SCOPE, handler);
    expect(retry.status).toBe(201);
    expect(retry.headers.get('Idempotent-Replayed')).toBe('true');
    // The handler ran only once; the retry got the SAME body.
    expect(handler).toHaveBeenCalledTimes(1);
    expect((await retry.json()).data.id).toBe('rec-1');
  });

  it('scopes keys per caller — the same key for another caller runs fresh', async () => {
    const handler = jest.fn(async () => successResponse({ ok: true }, HTTP.CREATED));
    await withIdempotency(req({ 'idempotency-key': 'shared' }), 'aeth1a', handler);
    await withIdempotency(req({ 'idempotency-key': 'shared' }), 'aeth1b', handler);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('rejects the same key reused for a different endpoint (422)', async () => {
    const handler = jest.fn(async () => successResponse({ ok: true }, HTTP.CREATED));
    await withIdempotency(
      new NextRequest('http://localhost:3000/api/records', { method: 'POST', headers: { 'idempotency-key': 'k' } }),
      SCOPE, handler,
    );
    const res = await withIdempotency(
      new NextRequest('http://localhost:3000/api/access', { method: 'POST', headers: { 'idempotency-key': 'k' } }),
      SCOPE, handler,
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('returns 409 while the first request is still in flight', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => { release = r; });
    const slow = jest.fn(async () => { await gate; return successResponse({ ok: true }, HTTP.CREATED); });

    const inflight = withIdempotency(req({ 'idempotency-key': 'busy' }), SCOPE, slow);
    // A retry arriving before the first completes is told to wait.
    const conflict = await withIdempotency(req({ 'idempotency-key': 'busy' }), SCOPE, slow);
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error.code).toBe('IDEMPOTENCY_IN_PROGRESS');

    release();
    expect((await inflight).status).toBe(201);
  });

  it('exposes a 24h replay TTL', () => {
    expect(IDEMPOTENCY_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });
});
