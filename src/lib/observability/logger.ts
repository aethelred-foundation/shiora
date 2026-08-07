// ============================================================
// Shiora on Aethelred — Structured logger (GAP-02)
//
// Zero-dependency JSON-lines logger, safe in every runtime (node, edge,
// jsdom): it writes through console only. Each line is a single JSON object
// with a timestamp, level, message, and any bound context — machine-parseable
// by any log pipeline (CloudWatch, Loki, Datadog) without an agent-side
// log parsing pattern. `child()` binds context (request id, route, subsystem) so
// call sites never re-thread correlation fields by hand.
//
// Level threshold comes from SHIORA_LOG_LEVEL (debug|info|warn|error,
// default info), read lazily so tests and long-lived processes can adjust.
// ============================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export type LogContext = Record<string, unknown>;

function threshold(): number {
  const raw = process.env.SHIORA_LOG_LEVEL;
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
    return LEVEL_RANK[raw];
  }
  return LEVEL_RANK.info;
}

/** Serialize an Error into plain fields; anything else passes through. */
function normalizeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function emit(level: LogLevel, message: string, context: LogContext): void {
  if (LEVEL_RANK[level] < threshold()) {
    return;
  }

  const line: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg: message,
  };
  for (const [key, value] of Object.entries(context)) {
    line[key] = normalizeValue(value);
  }

  const serialized = JSON.stringify(line);
  // Route warn/error through their console channels so platform log
  // collectors classify severity even before parsing the JSON.
  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(serialized);
  } else if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(serialized);
  } else {
    // eslint-disable-next-line no-console
    console.log(serialized);
  }
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  /** New logger with additional bound context (shallow-merged over this one's). */
  child(context: LogContext): Logger;
}

function build(bound: LogContext): Logger {
  return {
    debug: (message, context = {}) => emit('debug', message, { ...bound, ...context }),
    info: (message, context = {}) => emit('info', message, { ...bound, ...context }),
    warn: (message, context = {}) => emit('warn', message, { ...bound, ...context }),
    error: (message, context = {}) => emit('error', message, { ...bound, ...context }),
    child: (context) => build({ ...bound, ...context }),
  };
}

/** Create a logger, optionally with bound context (e.g. { subsystem: 'auth' }). */
export function createLogger(context: LogContext = {}): Logger {
  return build(context);
}

/** Root logger for call sites that need no bound context. */
export const logger = createLogger();
