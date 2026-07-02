// ============================================================
// Shiora on Aethelred — Server-Sent Events helpers (GAP-22)
//
// SSE gives clients real-time push over a single long-lived HTTP response,
// with the browser's EventSource reconnecting automatically. These helpers
// format frames per the spec (text/event-stream) and expose the standard
// response headers. Kept pure so the wire format is unit-testable.
// ============================================================

export interface SseFrame {
  /** Named event type (EventSource `addEventListener(event, …)`). */
  event?: string;
  /** Payload; objects are JSON-encoded. */
  data?: unknown;
  /** Last-Event-ID the client echoes on reconnect. */
  id?: string;
  /** Comment line (`:` prefix) — used for heartbeats; ignored by clients. */
  comment?: string;
  /** Reconnection delay hint in ms. */
  retry?: number;
}

/** Serialize an SSE frame to its on-the-wire text. */
export function formatSse(frame: SseFrame): string {
  const lines: string[] = [];
  if (frame.comment !== undefined) {
    lines.push(`: ${frame.comment}`);
  }
  if (frame.id !== undefined) {
    lines.push(`id: ${frame.id}`);
  }
  if (frame.event !== undefined) {
    lines.push(`event: ${frame.event}`);
  }
  if (frame.retry !== undefined) {
    lines.push(`retry: ${frame.retry}`);
  }
  if (frame.data !== undefined) {
    const payload = typeof frame.data === 'string' ? frame.data : JSON.stringify(frame.data);
    // Multi-line payloads must prefix each line with `data:`.
    for (const line of payload.split('\n')) {
      lines.push(`data: ${line}`);
    }
  }
  return lines.join('\n') + '\n\n';
}

/** Standard headers for an SSE response. */
export const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-store, no-transform',
  Connection: 'keep-alive',
  // Disable proxy buffering (nginx) so events flush immediately.
  'X-Accel-Buffering': 'no',
};
