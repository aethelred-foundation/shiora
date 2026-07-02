// ============================================================
// Shiora on Aethelred — Notification SSE stream (GAP-22)
//
// Builds the ReadableStream backing GET /api/notifications/stream. On connect
// it pushes the current unread count, then polls for notifications newer than a
// moving watermark and pushes each as an `notification` event, with periodic
// heartbeats to keep intermediaries from closing an idle connection. Timers are
// cleared on cancel (client disconnect), so nothing leaks.
//
// HONEST SCOPE: this is server-side polling behind an SSE facade — real-time
// enough for in-app notifications without a message broker. It is per-instance;
// a client reconnects (EventSource does so automatically) if its instance
// recycles.
// ============================================================

import { listNotifications, type Notification } from '@/lib/api/notification-service';
import { formatSse } from '@/lib/api/sse';

export interface NotificationStreamOptions {
  /** How often to poll for new notifications (ms). */
  pollMs?: number;
  /** How often to emit a heartbeat comment (ms). */
  heartbeatMs?: number;
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

  // Only surface notifications newer than the moment of connection.
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

      // Advise the client's reconnect delay, then the initial unread snapshot.
      send({ retry: Math.max(1000, pollMs) });
      const unread = (await listNotifications(address, { unreadOnly: true })).length;
      send({ event: 'unread', data: { count: unread } });

      pollTimer = setInterval(() => {
        void (async () => {
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
        })();
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
