/**
 * Bind the pending sign-in to one eligible membership.
 *
 * POST /api/auth/choose-tenant
 * Body: { orgUserId }. The tenant is read from that membership in the database.
 */

import { after, NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient, createAdminSupabaseClient, SB_REMEMBER_ME_COOKIE } from '@/lib/supabase/server'
import { getCSRFTokenFromHeader, getCSRFTokenFromRequest, validateCSRFToken } from '@/lib/security/csrf'
import { SESSION_ERROR_CODES, SESSION_REGISTER_STATUS } from '@/lib/constants/auth-session'
import { getSessionLifetime } from '@/lib/services/auth/session/auth-session.repository'
import { notifyNewDeviceSignIn } from '@/lib/services/auth/session/use-cases/new-device-alert'
import { emitNotificationEvent } from '@lib/notifications/event-emitter'
import { selectSessionTenant } from '@/lib/auth/session-tenant'
import { logger } from '@/lib/utils/logger'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * @param request - Choose request. Only `orgUserId` is read.
 */
export async function POST(request: NextRequest) {
  const headerToken = getCSRFTokenFromHeader(request.headers)
  const cookieToken = getCSRFTokenFromRequest(request)
  if (!validateCSRFToken(headerToken, cookieToken)) {
    return NextResponse.json({ error: 'Invalid or missing CSRF token. Please refresh the page and try again.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const orgUserId = typeof body.orgUserId === 'string' ? body.orgUserId : ''
  if (!UUID_PATTERN.test(orgUserId)) {
    return NextResponse.json({ error: 'Choose one organization.', code: 'NO_MEMBERSHIP' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: chosen, error } = await supabase.rpc('fn_auth_session_choose_tenant', {
    p_org_user_id: orgUserId,
  })
  if (error) {
    logger.error('Tenant choice failed', new Error(error.message), { feature: 'auth', action: 'choose_tenant' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const row = chosen?.[0]
  if (!row || row.result_status !== SESSION_REGISTER_STATUS.REGISTERED || !row.tenant_org_id) {
    const status = row?.result_status
    if (status === SESSION_REGISTER_STATUS.BLOCKED_SESSION_LIMIT) {
      return NextResponse.json(
        { error: 'Maximum number of active sessions reached.', code: SESSION_ERROR_CODES.SESSION_LIMIT_REACHED },
        { status: 409 },
      )
    }
    if (status === SESSION_REGISTER_STATUS.LOCKED) {
      return NextResponse.json({ error: 'This sign-in is locked.', code: SESSION_REGISTER_STATUS.LOCKED }, { status: 423 })
    }
    return NextResponse.json({ error: 'That organization is not available.', code: 'NO_MEMBERSHIP' }, { status: 403 })
  }

  const { data: tenantsResult, error: tenantsError } = await supabase.rpc('get_user_tenants')
  const tenant = selectSessionTenant(tenantsResult ?? [], row.tenant_org_id)
  if (tenantsError || !tenant?.is_active) {
    return NextResponse.json({ error: 'That organization is not available.', code: 'NO_MEMBERSHIP' }, { status: 403 })
  }

  const admin = createAdminSupabaseClient()
  const lifetime = row.session_row_id
    ? await getSessionLifetime(admin, { tenantOrgId: row.tenant_org_id, sessionRowId: row.session_row_id })
    : null
  const cookieStore = await cookies()
  const effectiveRememberMe = Boolean(lifetime?.isRememberMe)
  cookieStore.set(SB_REMEMBER_ME_COOKIE, effectiveRememberMe ? '1' : '0', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    ...(effectiveRememberMe && lifetime
      ? { maxAge: Math.max(60, Math.floor((new Date(lifetime.expiresAt).getTime() - Date.now()) / 1000)) }
      : {}),
  })

  const { data: userData } = await supabase.auth.getUser()
  if (userData.user && row.new_device) {
    after(() =>
      notifyNewDeviceSignIn(
        {
          status: 'REGISTERED',
          sessionRowId: row.session_row_id,
          tenantOrgId: row.tenant_org_id,
          newDevice: true,
          alertNewDevice: Boolean(row.alert_new_device),
          idleTimeoutSec: row.idle_timeout_sec ?? 0,
          idleWarningSec: row.idle_warning_sec ?? 0,
          expiresAt: row.expires_at,
          endedSessions: row.ended_sessions ?? 0,
        },
        {
          authUserId: userData.user.id,
          deviceLabel: null,
          ipAddress: null,
          signedInAt: new Date(),
        },
        emitNotificationEvent,
      ),
    )
  }

  return NextResponse.json({
    tenantOrgId: row.tenant_org_id,
    tenants: [tenant],
  })
}
