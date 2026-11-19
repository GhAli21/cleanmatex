/**
 * Extra Tenant Configuration API client (`GET`/`PUT`/`DELETE /api/v1/settings/extra-config`).
 *
 * @module features/settings/api/extra-config-api
 */

import { getCSRFToken } from '@/lib/utils/csrf-token';
import type {
  ExtraConfigSaveEntry,
  ExtraConfigScreenPayload,
} from '@/lib/types/tenant-extra-config';

/** Structured error thrown by Extra Config endpoints. */
export class ExtraConfigApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly configKey?: string,
    public readonly fieldErrors?: Record<string, string>
  ) {
    super(message);
    this.name = 'ExtraConfigApiError';
  }
}

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = method === 'GET' ? null : await getCSRFToken();
  const res = await fetch(`/api/v1/settings/extra-config${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { 'X-CSRF-Token': token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ExtraConfigApiError(
      json.error ?? `Request failed (${res.status})`,
      json.code,
      json.configKey,
      json.fieldErrors
    );
  }
  return json.data as T;
}

export const extraConfigApi = {
  load: () => send<ExtraConfigScreenPayload>('GET', ''),
  saveBatch: (entries: ExtraConfigSaveEntry[]) =>
    send<ExtraConfigScreenPayload>('PUT', '', { entries }),
  resetKey: (key: string) =>
    send<ExtraConfigScreenPayload>('DELETE', `/${encodeURIComponent(key)}`),
  resetAll: () => send<ExtraConfigScreenPayload>('DELETE', ''),
};
