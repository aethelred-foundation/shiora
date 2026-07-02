/** @jest-environment node */

import { createLogger, logger } from '@/lib/observability/logger';

const ORIGINAL_LEVEL = process.env.SHIORA_LOG_LEVEL;

function lastJson(spy: jest.SpyInstance): Record<string, unknown> {
  const call = spy.mock.calls[spy.mock.calls.length - 1];
  return JSON.parse(call[0] as string);
}

afterEach(() => {
  if (ORIGINAL_LEVEL === undefined) {
    delete process.env.SHIORA_LOG_LEVEL;
  } else {
    process.env.SHIORA_LOG_LEVEL = ORIGINAL_LEVEL;
  }
  jest.restoreAllMocks();
});

describe('structured logger', () => {
  it('emits a single JSON line with ts, level, msg and context', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    createLogger().info('hello', { requestId: 'r-1' });

    const line = lastJson(spy);
    expect(line.level).toBe('info');
    expect(line.msg).toBe('hello');
    expect(line.requestId).toBe('r-1');
    expect(typeof line.ts).toBe('string');
    expect(() => new Date(line.ts as string)).not.toThrow();
  });

  it('routes warn and error through their console channels', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    logger.warn('careful');
    logger.error('broken');

    expect(lastJson(warnSpy).level).toBe('warn');
    expect(lastJson(errorSpy).level).toBe('error');
  });

  it('suppresses debug at the default (info) threshold', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    logger.debug('invisible');
    expect(spy).not.toHaveBeenCalled();
  });

  it('emits debug when SHIORA_LOG_LEVEL=debug', () => {
    process.env.SHIORA_LOG_LEVEL = 'debug';
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    logger.debug('now visible', { detail: 42 });
    expect(lastJson(spy)).toMatchObject({ level: 'debug', msg: 'now visible', detail: 42 });
  });

  it('suppresses info below an error threshold', () => {
    process.env.SHIORA_LOG_LEVEL = 'error';
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('quiet');
    expect(spy).not.toHaveBeenCalled();
  });

  it('falls back to info for an unrecognized level value', () => {
    process.env.SHIORA_LOG_LEVEL = 'verbose';
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    logger.debug('suppressed');
    logger.info('shown');
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('child loggers bind context and can be nested, with call-site override', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const child = createLogger({ subsystem: 'auth' }).child({ requestId: 'r-9' });
    child.info('bound', { requestId: 'r-override', extra: true });

    expect(lastJson(spy)).toMatchObject({
      subsystem: 'auth',
      requestId: 'r-override',
      extra: true,
    });
  });

  it('serializes Error values into plain name/message/stack fields', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('failed', { err: new Error('boom') });

    const line = lastJson(spy);
    expect(line.err).toMatchObject({ name: 'Error', message: 'boom' });
    expect(typeof (line.err as { stack: string }).stack).toBe('string');
  });
});
