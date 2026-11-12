/** Tax API client (feature-owned). Every failure throws `TaxApiError` with the server's stable code. */
import { getCSRFToken, getCSRFTokenHeaderName } from '@/lib/utils/csrf-token'
import type {
  TaxClassRow,
  TaxCodeRow,
  TaxConfigView,
  TaxConfirmResponse,
  TaxExplainFacts,
  TaxExplainResponse,
  TaxOptions,
  TaxPackage,
  TaxPage,
  TaxPeriodRow,
  TaxReturnLineRow,
  TaxReturnView,
  TaxRuleRow,
} from '../model/tax-types'

/** A failed tax request; `code` is translated with `taxSetup.errors.<code>`. */
export class TaxApiError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'TaxApiError'
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin', ...init })
  const body = (await res.json().catch(() => ({}))) as { data?: T; code?: string }
  if (!res.ok || body.data === undefined) throw new TaxApiError(body.code ?? 'TAX_REQUEST_FAILED')
  return body.data
}

async function send<T>(method: 'POST' | 'PUT' | 'PATCH', url: string, data: unknown): Promise<T> {
  // The server rejects state changes without a token from this session.
  const token = await getCSRFToken()
  return request<T>(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { [getCSRFTokenHeaderName()]: token } : {}) },
    body: JSON.stringify(data),
  })
}

export interface TaxListParams {
  page: number
  pageSize: number
  search?: string
  includeInactive?: boolean
}

function listUrl(path: string, p: TaxListParams): string {
  const q = new URLSearchParams({ page: String(p.page), pageSize: String(p.pageSize) })
  if (p.search) q.set('search', p.search)
  if (p.includeInactive) q.set('includeInactive', 'true')
  return `${path}?${q}`
}

export const taxApi = {
  config: (signal?: AbortSignal) => request<TaxConfigView>('/api/v1/tax/config', { signal }),
  updateConfig: (data: unknown) => send<{ saved: boolean }>('PUT', '/api/v1/tax/config', data),
  confirm: (note?: string) => send<TaxConfirmResponse>('POST', '/api/v1/tax/config/confirm', { note }),
  packages: (signal?: AbortSignal) => request<TaxPackage[]>('/api/v1/tax/kits', { signal }),
  applyKit: (data: { pkgCode: string; activate: boolean }) => send<unknown>('POST', '/api/v1/tax/kits/apply', data),
  options: (signal?: AbortSignal) => request<TaxOptions>('/api/v1/tax/options', { signal }),
  codes: (p: TaxListParams, signal?: AbortSignal) => request<TaxPage<TaxCodeRow>>(listUrl('/api/v1/tax/codes', p), { signal }),
  createCode: (data: unknown) => send<TaxCodeRow>('POST', '/api/v1/tax/codes', data),
  updateCode: (id: string, data: unknown) => send<TaxCodeRow>('PATCH', `/api/v1/tax/codes/${id}`, data),
  rules: (p: TaxListParams, signal?: AbortSignal) => request<TaxPage<TaxRuleRow>>(listUrl('/api/v1/tax/rules', p), { signal }),
  createRule: (data: unknown) => send<{ id: string }>('POST', '/api/v1/tax/rules', data),
  updateRule: (id: string, data: unknown) => send<unknown>('PATCH', `/api/v1/tax/rules/${id}`, data),
  classes: (includeInactive: boolean, signal?: AbortSignal) =>
    request<TaxClassRow[]>(`/api/v1/tax/item-classes${includeInactive ? '?includeInactive=true' : ''}`, { signal }),
  createClass: (data: unknown) => send<TaxClassRow>('POST', '/api/v1/tax/item-classes', data),
  updateClass: (id: string, data: unknown) => send<TaxClassRow>('PATCH', `/api/v1/tax/item-classes/${id}`, data),
  explain: (facts: TaxExplainFacts) => send<TaxExplainResponse>('POST', '/api/v1/tax/explain', facts),
  periods: (signal?: AbortSignal) => request<TaxPeriodRow[]>('/api/v1/tax/periods', { signal }),
  createPeriod: (data: { periodStart: string; periodEnd: string }) => send<TaxPeriodRow>('POST', '/api/v1/tax/periods', data),
  changePeriod: (id: string, data: { action: 'close' } | { action: 'reopen'; reason: string }) =>
    send<TaxPeriodRow>('PATCH', `/api/v1/tax/periods/${id}`, data),
  taxReturn: (range: { from: string; to: string }, signal?: AbortSignal) =>
    request<TaxReturnView>(`/api/v1/tax/returns?${new URLSearchParams(range)}`, { signal }),
  taxReturnLines: (q: { from: string; to: string; box: string; page: number; pageSize: number }, signal?: AbortSignal) =>
    request<{ items: TaxReturnLineRow[]; total: number }>(
      `/api/v1/tax/returns/lines?${new URLSearchParams({ ...q, page: String(q.page), pageSize: String(q.pageSize) })}`,
      { signal },
    ),
}
