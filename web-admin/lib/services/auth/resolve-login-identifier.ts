/**
 * Resolve a typed sign-in identifier (email or user_code) to the auth account.
 *
 * Server-only. Uses the service-role client because fn_auth_resolve_login_identifier exposes the
 * account email for a user_code and is therefore executable by service_role only (migration 0563).
 * Tenant resolved server-side from the account's single org_users_mst membership.
 */

import type { createAdminSupabaseClient } from '@/lib/supabase/server'
import { normalizeLoginIdentifier } from '@/lib/auth/login-identifier'

/** Account matched by a sign-in identifier. */
export interface ResolvedLoginAccount {
  authUserId: string
  /** auth.users email — passed to signInWithPassword (may be synthetic for users without a real email). */
  email: string
  orgUserId: string
  tenantOrgId: string
  isActive: boolean
  userCode: string
}

/**
 * Look up the account for an identifier.
 *
 * @param adminClient - Service-role Supabase client (createAdminSupabaseClient())
 * @param identifier - Raw text the user typed (email or user_code)
 * @returns The matched account, or `null` when nothing matches (caller must answer generically)
 * @throws Error when the RPC itself fails (infrastructure error, not "unknown user")
 */
export async function resolveLoginIdentifier(
  adminClient: ReturnType<typeof createAdminSupabaseClient>,
  identifier: string
): Promise<ResolvedLoginAccount | null> {
  const value = normalizeLoginIdentifier(identifier)
  if (!value) return null

  const { data, error } = await adminClient.rpc('fn_auth_resolve_login_identifier', {
    p_identifier: value,
  })

  if (error) {
    throw new Error(`fn_auth_resolve_login_identifier failed: ${error.message}`)
  }

  const row = Array.isArray(data) ? data[0] : null
  if (!row) return null

  return {
    authUserId: row.auth_user_id,
    email: row.email,
    orgUserId: row.org_user_id,
    tenantOrgId: row.tenant_org_id,
    isActive: Boolean(row.is_active),
    userCode: row.user_code,
  }
}
