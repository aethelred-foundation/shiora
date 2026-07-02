/** @jest-environment node */

import { buildNotificationStream } from '@/lib/api/notification-stream';
import { notify, __resetNotificationsForTests } from '@/lib/api/notification-service';
import { seededAddress } from '@/lib/utils';

const ADDR = seededAddress(2200);
const decoder = new TextDecoder();

afterEach(() => __resetNotificationsForTests());

/** Read SSE frames until `predicate` is satisfied or a deadline passes. */
async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  predicate: (all: string) => boolean,
  timeoutMs = 2000,
): Promise<string> {
  let acc = '';
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    acc += decoder.decode(value);
    if (predicate(acc)) return acc;
  }
  return acc;
}

describe('buildNotificationStream (GAP-22)', () => {
  it('emits a retry hint and the initial unread count on connect', async () => {
    await notify(ADDR, { type: 'consent', title: 'Old', body: 'unread' });
    const stream = buildNotificationStream(ADDR, { pollMs: 10, heartbeatMs: 10_000 });
    const reader = stream.getReader();

    const text = await readUntil(reader, (all) => all.includes('event: unread'));
    expect(text).toContain('retry:');
    expect(text).toContain('event: unread');
    expect(text).toContain('"count":1');

    await reader.cancel();
  });

  it('pushes a notification event when one is created after connect', async () => {
    const stream = buildNotificationStream(ADDR, { pollMs: 10, heartbeatMs: 10_000 });
    const reader = stream.getReader();
    // Drain the initial unread frame first.
    await readUntil(reader, (all) => all.includes('event: unread'));

    // Create a notification; the poll should pick it up and push it.
    await new Promise((r) => setTimeout(r, 5)); // ensure createdAt > watermark
    await notify(ADDR, { type: 'clinical_note', title: 'New result', body: 'Your labs are in' });

    const text = await readUntil(reader, (all) => all.includes('event: notification'));
    expect(text).toContain('event: notification');
    expect(text).toContain('"title":"New result"');
    expect(text).toContain('"type":"clinical_note"');

    await reader.cancel();
  });

  it('delivers multiple notifications, oldest-first', async () => {
    const stream = buildNotificationStream(ADDR, { pollMs: 20, heartbeatMs: 10_000 });
    const reader = stream.getReader();
    await readUntil(reader, (all) => all.includes('event: unread'));

    // Distinct createdAt so ordering is deterministic.
    await new Promise((r) => setTimeout(r, 3));
    await notify(ADDR, { type: 'consent', title: 'AlphaOne', body: 'a' });
    await new Promise((r) => setTimeout(r, 5));
    await notify(ADDR, { type: 'consent', title: 'BetaTwo', body: 'b' });

    const text = await readUntil(reader, (all) => all.includes('AlphaOne') && all.includes('BetaTwo'));
    expect(text.indexOf('AlphaOne')).toBeGreaterThan(-1);
    expect(text.indexOf('AlphaOne')).toBeLessThan(text.indexOf('BetaTwo')); // oldest-first

    await reader.cancel();
  });

  it('uses default poll/heartbeat intervals when none are given', async () => {
    const stream = buildNotificationStream(ADDR); // defaults
    const reader = stream.getReader();
    const text = await readUntil(reader, (all) => all.includes('event: unread'));
    expect(text).toContain('event: unread');
    await reader.cancel();
  });

  it('emits heartbeat comments on the heartbeat interval', async () => {
    const stream = buildNotificationStream(ADDR, { pollMs: 10_000, heartbeatMs: 10 });
    const reader = stream.getReader();

    const text = await readUntil(reader, (all) => all.includes(': heartbeat'));
    expect(text).toContain(': heartbeat');

    await reader.cancel();
  });

  it('stops its timers on cancel (no further work)', async () => {
    const stream = buildNotificationStream(ADDR, { pollMs: 10, heartbeatMs: 10 });
    const reader = stream.getReader();
    await readUntil(reader, (all) => all.includes('event: unread'));
    await expect(reader.cancel()).resolves.toBeUndefined();
  });
});
