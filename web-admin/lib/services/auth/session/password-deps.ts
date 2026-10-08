/**
 * Infrastructure for the password use-cases: real Supabase calls behind the PasswordDeps interface.
 *
 * Server-only. Kept apart from the use-cases so the rules stay unit-testable without a database.
 */

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { createAdminSupabaseClient } from '@/lib/supabase/server'
import { emitNotificationEvent } from '@lib/notifications/event-emitter'
import { assertPasswordAcceptable, loadPasswordPolicy } from '@/lib/services/auth/password/password-policy'
import { notifyPasswordChanged } from '@/lib/services/auth/password/password-notify'
import type { PasswordDeps } from './use-cases/password'

type AdminClient = ReturnType<typeof createAdminSupabaseClient>

/**
 * Build the dependencies for a signed-in caller.
 *
 * @param userClient - Supabase client bound to the caller's session (cookie client)
 * @param admin - Service-role client (lockout RPCs are service-role only)
 * @param meta - Caller IP / User-Agent, recorded on failed attempts
 */
export function createPasswordDeps(
  userClient: SupabaseClient,
  admin: AdminClient,
  meta: { ipAddress: string | null; userAgent: string | null }
): PasswordDeps {
  return {
    async verifyPassword(email, password) {
      // A THROWAWAY client (no cookies, no persistence): signing in with it must never replace the caller's own
      // session. The temporary session it creates is deleted immediately.
      const probe = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
      )
      const { error } = await probe.auth.signInWithPassword({ email, password })
      if (error) return false
      await probe.auth.signOut({ scope: 'local' }).catch(() => undefined)
      return true
    },

    async updatePassword(newPassword) {
      const { error } = await userClient.auth.updateUser({ password: newPassword })
      return { errorMessage: error ? error.message : null }
    },

    async isLocked(email) {
      const { data } = await admin.rpc('is_account_locked', { p_email: email })
      return Boolean(data?.[0]?.is_locked)
    },

    async recordFailure(email) {
      await admin.rpc('record_login_attempt', {
        p_email: email,
        p_success: false,
        p_ip_address: meta.ipAddress ?? undefined,
        p_user_agent: meta.userAgent ?? undefined,
        p_error_message: 'WRONG_CURRENT_PASSWORD',
      })
    },

    loadPolicy: (tenantId) => loadPasswordPolicy(admin, tenantId),

    assertAcceptable: (authUserId, newPassword, policy) =>
      assertPasswordAcceptable(admin, policy, authUserId, newPassword),

    async getSessionAgeMinutes(tenantId, authSessionId) {
      if (!authSessionId) return null
      // Registry row of the caller's own session; the explicit tenant predicate scopes the lookup.
      const { data } = await admin
        .from('sys_auth_user_sessions_mst')
        .select('created_at')
        .eq('tenant_org_id', tenantId)
        .eq('auth_session_id', authSessionId)
        .maybeSingle()
      if (!data?.created_at) return null
      return (Date.now() - new Date(data.created_at).getTime()) / 60_000
    },

    async clearMustChange(tenantId, authUserId) {
      await admin
        .from('org_users_mst')
        .update({ pwd_must_change: false })
        .eq('tenant_org_id', tenantId)
        .eq('user_id', authUserId)
    },

    async notifyChanged({ authUserId, tenantId, actor }) {
      await notifyPasswordChanged(emitNotificationEvent, { authUserId, tenantId, actor, changedAt: new Date() })
    },
  }
}
