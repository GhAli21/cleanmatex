/**
 * Branding API client: the Organization's saved themes, the HQ catalog and the
 * plan limits (GET /api/v1/settings/branding) and the saved-theme writes.
 * @module features/settings/api/branding-api
 */

import { getCSRFToken } from '@/lib/utils/csrf-token'
import type { OrgThemeInput } from '@/lib/validations/ui-theme'
import type { BrandingCatalog, BrandingPlan } from '@features/settings/ui/branding/theme-editor-form'

/** One saved theme row. */
export interface OrgThemeRow extends Required<OrgThemeInput> {
  id: string
  /** True = the theme in use. */
  is_active: boolean
}

/** Everything the branding screen loads. */
export interface BrandingData {
  themes: OrgThemeRow[]
  catalog: BrandingCatalog
  plan: BrandingPlan
}

/** A refused request; `code` is the server's UiThemeError code when there is one. */
export class BrandingApiError extends Error {
  constructor(message: string, public readonly code?: string, public readonly fieldErrors?: Record<string, string>) {
    super(message)
  }
}

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = method === 'GET' ? null : await getCSRFToken()
  const res = await fetch(`/api/v1/settings/branding${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { 'X-CSRF-Token': token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new BrandingApiError(json.error ?? `Request failed (${res.status})`, json.code, json.fieldErrors)
  return json.data as T
}

export const brandingApi = {
  load: () => send<BrandingData>('GET', ''),
  create: (input: OrgThemeInput) => send<OrgThemeRow>('POST', '/themes', input),
  update: (id: string, input: OrgThemeInput) => send<void>('PATCH', `/themes/${id}`, input),
  activate: (id: string) => send<void>('POST', `/themes/${id}/activate`),
  remove: (id: string) => send<void>('DELETE', `/themes/${id}`),
}
