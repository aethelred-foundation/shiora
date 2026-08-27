/** @jest-environment node */

import { formatSse, SSE_HEADERS } from '@/lib/api/sse';

describe('formatSse', () => {
  it('formats a named event with a JSON payload', () => {
    expect(formatSse({ event: 'notification', data: { id: 'n1' } }))
      .toBe('event: notification\ndata: {"id":"n1"}\n\n');
  });

  it('formats an id, retry, and string data', () => {
    expect(formatSse({ id: 'abc', retry: 3000, data: 'hello' }))
      .toBe('id: abc\nretry: 3000\ndata: hello\n\n');
  });

  it('prefixes every line of a multi-line payload with data:', () => {
    expect(formatSse({ data: 'line1\nline2' })).toBe('data: line1\ndata: line2\n\n');
  });

  it('formats a heartbeat comment', () => {
    expect(formatSse({ comment: 'heartbeat' })).toBe(': heartbeat\n\n');
  });

  it('emits just the terminator for an empty frame', () => {
    expect(formatSse({})).toBe('\n\n');
  });

  it('exposes the standard SSE headers', () => {
    expect(SSE_HEADERS['Content-Type']).toContain('text/event-stream');
    expect(SSE_HEADERS['Cache-Control']).toContain('no-store');
    expect(SSE_HEADERS['X-Accel-Buffering']).toBe('no');
  });
});
