/**
 * Auth admin config use-cases — business rules over the repository.
 *
 * - getEffectiveAuthConfig: catalog + tenant overrides + editability for the Security settings screen.
 * - updateTenantAuthConfig: validated, all-or-nothing-per-validation batch of overrides / resets.
 *
 * Tenant is always passed in (resolved server-side from the authenticated session by the API route).
 * The plan flag `session_timeout_control` gates tenant EDITING; reading is always allowed.
 */

import type { createAdminSupabaseClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/services/feature-flags.service'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'
import { AUTH_CONFIG_ERROR_CODES, type AuthConfigErrorCode } from '@/lib/constants/auth-admin-config'
import { validateAuthConfigValue } from '@/lib/auth/auth-config-validation'
import type { AuthConfigChange, AuthConfigItem } from '@/lib/types/auth-admin-config'
import {
  AuthConfigRepositoryError,
  fetchEffectiveAuthConfig,
  resetTenantOverride,
  upsertTenantOverride,
} from './auth-admin-config.repository'

type AdminClient = ReturnType<typeof createAdminSupabaseClient>

/** Business-rule failure carrying a stable machine code for the API layer. */
export class AuthConfigError extends Error {
  constructor(
    public readonly code: AuthConfigErrorCode,
    message: string,
    /** config_code the failure relates to, when item-specific. */
    public readonly configCode?: string
  ) {
    super(message)
    this.name = 'AuthConfigError'
  }
}

/** Effective config plus whether this tenant may edit it right now. */
export interface EffectiveAuthConfigResult {
  items: AuthConfigItem[]
  /** false when the plan lacks session_timeout_control — the UI renders read-only with an upgrade hint. */
  canEdit: boolean
}

/**
 * Load the effective auth config for a tenant.
 *
 * @param admin - Service-role Supabase client
 * @param tenantId - Tenant resolved server-side from the session
 * @returns Items and the plan-level edit capability
 */
export async function getEffectiveAuthConfig(
  admin: AdminClient,
  tenantId: string
): Promise<EffectiveAuthConfigResult> {
  const [items, canEdit] = await Promise.all([
    fetchEffectiveAuthConfig(admin, tenantId),
    canAccess(tenantId, FEATURE_FLAG_KEYS.SESSION_TIMEOUT_CONTROL),
  ])
  return { items, canEdit }
}

/**
 * Apply a batch of tenant overrides (`value`) and resets (`value: null`).
 *
 * Everything is validated up front against the live catalog (unknown item, platform-managed item,
 * type/range/allowed values); nothing is written if any change is invalid. The DB triggers re-check
 * the same rules as the final gate.
 *
 * @param admin - Service-role Supabase client
 * @param params.tenantId - Tenant resolved server-side from the session
 * @param params.actorId - Auth user id of the admin
 * @param params.changes - Requested changes (null value = reset to platform default)
 * @returns The refreshed effective config
 * @throws AuthConfigError FEATURE_NOT_ENABLED | UNKNOWN_ITEM | NOT_TENANT_EDITABLE | INVALID_VALUE | SAVE_FAILED
 */
export async function updateTenantAuthConfig(
  admin: AdminClient,
  params: { tenantId: string; actorId: string; changes: AuthConfigChange[] }
): Promise<EffectiveAuthConfigResult> {
  const { tenantId, actorId, changes } = params

  // ─── Plan gate ────────────────────────────────────────────────────────────
  if (!(await canAccess(tenantId, FEATURE_FLAG_KEYS.SESSION_TIMEOUT_CONTROL))) {
    throw new AuthConfigError(
      AUTH_CONFIG_ERROR_CODES.FEATURE_NOT_ENABLED,
      'Security settings customization is not enabled for this plan'
    )
  }

  // ─── Validate everything before writing anything ──────────────────────────
  const items = await fetchEffectiveAuthConfig(admin, tenantId)
  const byCode = new Map(items.map((item) => [item.configCode, item]))
  const plan: Array<{ configCode: string; value: string | null }> = []

  for (const change of changes) {
    const item = byCode.get(change.configCode)
    if (!item) {
      throw new AuthConfigError(AUTH_CONFIG_ERROR_CODES.UNKNOWN_ITEM, `Unknown item ${change.configCode}`, change.configCode)
    }
    if (!item.isAllowTenantChange) {
      throw new AuthConfigError(
        AUTH_CONFIG_ERROR_CODES.NOT_TENANT_EDITABLE,
        `${change.configCode} is managed by the platform`,
        change.configCode
      )
    }
    if (change.value === null) {
      plan.push({ configCode: change.configCode, value: null })
      continue
    }
    const checked = validateAuthConfigValue(item, change.value)
    if (!checked.ok || checked.value === undefined) {
      throw new AuthConfigError(
        AUTH_CONFIG_ERROR_CODES.INVALID_VALUE,
        `Invalid value for ${change.configCode} (${checked.reason ?? 'type'})`,
        change.configCode
      )
    }
    plan.push({ configCode: change.configCode, value: checked.value })
  }

  // ─── Apply ────────────────────────────────────────────────────────────────
  try {
    for (const step of plan) {
      if (step.value === null) {
        await resetTenantOverride(admin, { tenantId, configCode: step.configCode, actorId })
      } else {
        await upsertTenantOverride(admin, { tenantId, configCode: step.configCode, value: step.value, actorId })
      }
    }
  } catch (error) {
    if (error instanceof AuthConfigRepositoryError) {
      if (error.kind === 'not_editable') {
        throw new AuthConfigError(AUTH_CONFIG_ERROR_CODES.NOT_TENANT_EDITABLE, error.message)
      }
      if (error.kind === 'invalid') {
        throw new AuthConfigError(AUTH_CONFIG_ERROR_CODES.INVALID_VALUE, error.message)
      }
    }
    throw new AuthConfigError(AUTH_CONFIG_ERROR_CODES.SAVE_FAILED, 'Failed to save security settings')
  }

  return { items: await fetchEffectiveAuthConfig(admin, tenantId), canEdit: true }
}
