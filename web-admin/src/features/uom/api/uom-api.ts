/**
 * Browser client for /api/v1/uom/*. Every call unwraps `{ success, data }` and throws a
 * UomApiError that carries the rule code, so screens show `uom.errors.<code>` instead of raw text.
 */
import type { UomConversion, UomUnit } from '@/lib/types/uom';

const BASE = '/api/v1/uom';

/** A failed UoM API call; `code` is the rule code (UOM_IN_USE, ...) or VALIDATION / HTTP_<status>. */
export class UomApiError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const json = (await res.json().catch(() => null)) as { data?: T; error?: { code?: string } } | null;
  if (!res.ok) throw new UomApiError(json?.error?.code ?? `HTTP_${res.status}`, res.status);
  return json?.data as T;
}

const send = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

/** System unit still available to add. */
export type AddableUnit = Pick<UomUnit, 'code' | 'name' | 'name2' | 'symbol' | 'dimension' | 'qtyDecimals' | 'isBaseUnit'>;

export const uomApi = {
  listUnits: (activeOnly = true) => call<UomUnit[]>(`/units?active_only=${activeOnly}`),
  listAddable: () => call<AddableUnit[]>('/catalog'),
  addSystemUnits: (codes: string[]) => call<{ added: number }>('/units', send('POST', { kind: 'system', codes })),
  createUnit: (body: Record<string, unknown>) => call<UomUnit>('/units', send('POST', { kind: 'custom', ...body })),
  updateUnit: (code: string, body: Record<string, unknown>) => call<UomUnit>(`/units/${encodeURIComponent(code)}`, send('PATCH', body)),
  resetUnit: (code: string) => call<void>(`/units/${encodeURIComponent(code)}/reset`, send('POST')),
  listConversions: (productId?: string) => call<UomConversion[]>(`/conversions${productId ? `?product_id=${productId}` : ''}`),
  createConversion: (body: Record<string, unknown>) => call<UomConversion>('/conversions', send('POST', body)),
  updateConversion: (id: string, body: Record<string, unknown>) => call<UomConversion>(`/conversions/${id}`, send('PATCH', body)),
  resetConversion: (id: string) => call<void>(`/conversions/${id}/reset`, send('POST')),
};
