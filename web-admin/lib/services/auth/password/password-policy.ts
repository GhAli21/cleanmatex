/**
 * Password policy — the tenant-resolved PASSWORD items of the auth config catalog (migrations 0570/0581) and the
 * single acceptance check every password flow runs before touching the account.
 *
 * Acceptance order (cheapest first): strength → reuse (DB, bcrypt compare against history) → breach list.
 */

import { validatePassword } from '@/lib/auth/validation'
import { AUTH_CONFIG_CODES } from '@/lib/constants/auth-admin-config'
import { PASSWORD_ERROR_CODES } from '@/lib/constants/auth-session'
import type { AuthConfigItem } from '@/lib/types/auth-admin-config'
import type { createAdminSupabaseClient } from '@/lib/supabase/server'
import { fetchEffectiveAuthConfig } from '@/lib/services/auth/config/auth-admin-config.repository'
import { logger } from '@/lib/utils/logger'
import { isPasswordBreached } from './breach-check'
import { PasswordError } from './password-error'

type AdminClient = ReturnType<typeof createAdminSupabaseClient>

/** Effective password rules for one tenant. */
export interface PasswordPolicy {
  /** Changing the password requires typing the current one. false = new password twice, fresh sign-in only. */
  requireCurrent: boolean
  /** Minutes after sign-in during which the two-field change is allowed (only when requireCurrent is false). */
  freshSigninMin: number
  /** The last N passwords (current included) cannot be reused; 0 = off. */
  historyCount: number
  /** Reject passwords found in public breach lists. */
  breachCheck: boolean
}

/** Secure defaults, used when the catalog cannot be read (mirrors the seed values of migration 0581). */
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  requireCurrent: true,
  freshSigninMin: 15,
  historyCount: 5,
  breachCheck: true,
}

/**
 * Build the policy from resolved catalog items (pure).
 *
 * @param items - Output of fetchEffectiveAuthConfig
 */
export function parsePasswordPolicy(items: Pick<AuthConfigItem, 'configCode' | 'effectiveValue'>[]): PasswordPolicy {
  const value = (code: string) => items.find((i) => i.configCode === code)?.effectiveValue
  const bool = (code: string, fallback: boolean) => {
    const v = value(code)
    return v === undefined ? fallback : v === 'true'
  }
  const int = (code: string, fallback: number) => {
    const n = Number(value(code))
    return Number.isInteger(n) ? n : fallback
  }
  return {
    requireCurrent: bool(AUTH_CONFIG_CODES.PWD_REQUIRE_CURRENT, DEFAULT_PASSWORD_POLICY.requireCurrent),
    freshSigninMin: int(AUTH_CONFIG_CODES.PWD_FRESH_SIGNIN_MIN, DEFAULT_PASSWORD_POLICY.freshSigninMin),
    historyCount: int(AUTH_CONFIG_CODES.PWD_HISTORY_COUNT, DEFAULT_PASSWORD_POLICY.historyCount),
    breachCheck: bool(AUTH_CONFIG_CODES.PWD_BREACH_CHECK, DEFAULT_PASSWORD_POLICY.breachCheck),
  }
}

/**
 * Load the tenant's effective password policy. Falls back to the secure defaults on any error.
 *
 * @param admin - Service-role client
 * @param tenantId - Tenant resolved server-side from the session (never from the request)
 */
export async function loadPasswordPolicy(admin: AdminClient, tenantId: string): Promise<PasswordPolicy> {
  try {
    return parsePasswordPolicy(await fetchEffectiveAuthConfig(admin, tenantId))
  } catch (error) {
    logger.error('Failed to load password policy — using defaults', error as Error, {
      feature: 'auth',
      tenantId,
    })
    return DEFAULT_PASSWORD_POLICY
  }
}

/**
 * Reject a new password that is weak, reused or breached.
 *
 * @param admin - Service-role client (fn_auth_pwd_reuse_check is service_role only)
 * @param policy - Tenant policy
 * @param authUserId - Account whose history is checked
 * @param newPassword - Candidate password (plaintext)
 * @param breachCheck - Injectable for tests
 * @throws PasswordError WEAK_PASSWORD | REUSED_PASSWORD | BREACHED_PASSWORD | UPDATE_FAILED (history unreadable)
 */
export async function assertPasswordAcceptable(
  admin: AdminClient,
  policy: PasswordPolicy,
  authUserId: string,
  newPassword: string,
  breachCheck: (password: string) => Promise<boolean> = isPasswordBreached
): Promise<void> {
  const strength = validatePassword(newPassword)
  if (!strength.isValid) {
    throw new PasswordError(PASSWORD_ERROR_CODES.WEAK_PASSWORD, strength.feedback.join('. '))
  }

  if (policy.historyCount > 0) {
    const { data, error } = await admin.rpc('fn_auth_pwd_reuse_check', {
      p_auth_user_id: authUserId,
      p_new_password: newPassword,
      p_depth: policy.historyCount,
    })
    // Fail closed: the history lives in our own database, so an error here is a real fault.
    if (error) throw new PasswordError(PASSWORD_ERROR_CODES.UPDATE_FAILED, 'Password history check failed')
    if (data === true) {
      throw new PasswordError(
        PASSWORD_ERROR_CODES.REUSED_PASSWORD,
        'This password was used recently. Choose a different one'
      )
    }
  }

  if (policy.breachCheck && (await breachCheck(newPassword))) {
    throw new PasswordError(
      PASSWORD_ERROR_CODES.BREACHED_PASSWORD,
      'This password appears in known data breaches. Choose a different one'
    )
  }
}
