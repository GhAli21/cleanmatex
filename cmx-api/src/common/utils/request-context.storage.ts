import { AsyncLocalStorage } from 'async_hooks';
import type { RequestContext } from '../interfaces/request-context.interface';

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export function getTraceId(): string | undefined {
  return getRequestContext()?.traceId;
}
