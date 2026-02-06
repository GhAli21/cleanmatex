import { getTraceId } from './request-context.storage';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const traceId = getTraceId();
  const payload = {
    level,
    message,
    traceId,
    ...meta,
    timestamp: new Date().toISOString(),
  };
  return JSON.stringify(payload);
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    console.debug(formatMessage('debug', message, meta));
  },
  info(message: string, meta?: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    console.info(formatMessage('info', message, meta));
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    console.warn(formatMessage('warn', message, meta));
  },
  error(message: string, meta?: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    console.error(formatMessage('error', message, meta));
  },
};
