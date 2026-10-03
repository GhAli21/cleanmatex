/**
 * Auth config API client (feature-owned).
 *
 * Talks to `GET|PUT /api/settings/auth-config`. Tenant is resolved server-side from the session —
 * never sent from the client.
 */

import type { AuthConfigChange, AuthConfigItem } from '@/lib/types/auth-admin-config'

/** Effective config + whether this plan/user may edit it. */
export interface AuthConfigPayload {
  items: AuthConfigItem[]
  /** Plan-level capability (flag session_timeout_control). The user's own permission is checked separately. */
  canEdit: boolean
}

/** API failure carrying the server's machine code (e.g. INVALID_VALUE) and the offending item. */
export class AuthConfigApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly configCode?: string,
    public readonly status?: number
  ) {
    super(message)
    this.name = 'AuthConfigApiError'
  }
}

interface Envelope {
  success?: boolean
  data?: AuthConfigPayload
  error?: string
  code?: string
  config_code?: string
}

async function parse(res: Response): Promise<AuthConfigPayload> {
  const body = (await res.json().catch(() => ({}))) as Envelope
  if (!res.ok || !body.data) {
    throw new AuthConfigApiError(body.error ?? 'Request failed', body.code, body.config_code, res.status)
  }
  return body.data
}

/** Load the effective auth config for the current tenant. */
export async function fetchAuthConfig(): Promise<AuthConfigPayload> {
  return parse(await fetch('/api/settings/auth-config', { credentials: 'same-origin' }))
}

/**
 * Save tenant overrides / resets.
 *
 * @param changes - Items to change; `value: null` resets to the platform value
 * @returns The refreshed effective config
 * @throws AuthConfigApiError with code FEATURE_NOT_ENABLED | NOT_TENANT_EDITABLE | INVALID_VALUE | UNKNOWN_ITEM | SAVE_FAILED
 */
export async function saveAuthConfig(changes: AuthConfigChange[]): Promise<AuthConfigPayload> {
  return parse(
    await fetch('/api/settings/auth-config', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changes: changes.map((c) => ({ config_code: c.configCode, value: c.value })),
      }),
    })
  )
}
