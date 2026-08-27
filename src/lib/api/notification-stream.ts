// ============================================================
// Shiora on Aethelred — Notification SSE stream (GAP-22)
//
// Builds the ReadableStream backing GET /api/notifications/stream. On connect
// it pushes the current unread count, then polls for notifications newer than a
// moving watermark and pushes each as an `notification` event, with periodic
// heartbeats to keep intermediaries from closing an idle connection. Timers are
// cleared on cancel (client disconnect), so nothing leaks.
//
// Reconnection is lossless: every frame carries the notification id, the
// browser echoes the last one back as Last-Event-ID, and the stream REPLAYS
// everything newer than that id from the durable notification store before
// resuming live polling. The database record is the source of truth — the
// stream is only a delivery accelerator, so a dropped connection, restart, or
// failover to another replica never silently loses a notification
// (at-least-once; clients de-duplicate by id).
//
// HONEST SCOPE: this is server-side polling behind an SSE facade — real-time
// enough for in-app notifications without a message broker.
// ============================================================

import { listNotifications, type Notification } from '@/lib/api/notification-service';
import { formatSse } from '@/lib/api/sse';

export interface NotificationStreamOptions {
  /** How often to poll for new notifications (ms). */
  pollMs?: number;
  /** How often to emit a heartbeat comment (ms). */
  heartbeatMs?: number;
  /**
   * The Last-Event-ID a reconnecting client echoed. Missed notifications
   * (newer than that id) are replayed from the durable store on connect; an
   * unknown id replays the full history (at-least-once, client de-duplicates).
   */
  lastEventId?: string;
}

const DEFAULT_POLL_MS = 5_000;
const DEFAULT_HEARTBEAT_MS = 25_000;

/**
 * A ReadableStream of SSE frames for a subject's notifications. Emits:
 *  - `unread` once on connect with the current unread count,
 *  - `notification` for each notification created after connect,
 *  - heartbeat comments on the heartbeat interval.
 */
export function buildNotificationStream(
  address: string,
  options: NotificationStreamOptions = {},
): ReadableStream<Uint8Array> {
  const pollMs = options.pollMs ?? DEFAULT_POLL_MS;
  const heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
  const encoder = new TextEncoder();

  // Fresh connections surface only notifications newer than the moment of
  // connection; reconnections resume from the acknowledged event (set in
  // start() once the durable store has been consulted).
  let watermark = Date.now();
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

  // clearInterval tolerates undefined, so no guards are needed even if the
  // client cancels before start() finished setting the timers.
  function stop(): void {
    clearInterval(pollTimer);
    clearInterval(heartbeatTimer);
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (frame: Parameters<typeof formatSse>[0]) => {
        controller.enqueue(encoder.encode(formatSse(frame)));
      };

      // Push every stored notification newer than the watermark, oldest first,
      // advancing the watermark past each. Shared by the reconnect replay and
      // the live poll — both read the same durable source of truth.
      const pushNewerThanWatermark = async () => {
        const fresh = (await listNotifications(address))
          .filter((n: Notification) => n.createdAt > watermark)
          .sort((a, b) => a.createdAt - b.createdAt);
        for (const notification of fresh) {
          watermark = Math.max(watermark, notification.createdAt);
          send({
            event: 'notification',
            id: notification.id,
            data: {
              id: notification.id,
              type: notification.type,
              title: notification.title,
              body: notification.body,
              createdAt: notification.createdAt,
            },
          });
        }
      };

      // Advise the client's reconnect delay, then the initial unread snapshot.
      send({ retry: Math.max(1000, pollMs) });
      const unread = (await listNotifications(address, { unreadOnly: true })).length;
      send({ event: 'unread', data: { count: unread } });

      // Reconnect replay: resume just after the acknowledged event. An id the
      // store no longer knows replays the full history rather than guessing a
      // cutoff — at-least-once beats silently-dropped.
      if (options.lastEventId !== undefined) {
        const all = await listNotifications(address);
        const acknowledged = all.find((n) => n.id === options.lastEventId);
        watermark = acknowledged ? acknowledged.createdAt : 0;
        await pushNewerThanWatermark();
      }

      pollTimer = setInterval(() => {
        void pushNewerThanWatermark();
      }, pollMs);

      heartbeatTimer = setInterval(() => {
        send({ comment: 'heartbeat' });
      }, heartbeatMs);

      // Never keep the process alive on account of these timers.
      pollTimer.unref?.();
      heartbeatTimer.unref?.();
    },
    cancel() {
      stop();
    },
  });
}
