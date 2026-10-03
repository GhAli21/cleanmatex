/**
 * Logout API Route
 * 
 * POST /api/auth/logout
 * Handles server-side logout including cache invalidation
 * 
 * Body: { reason?: 'user' | 'session_expired' | 'security' | 'timeout' | 'unknown' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient, createClient, SB_REMEMBER_ME_COOKIE } from '@/lib/supabase/server'
import { getSessionIdFromToken } from '@/lib/auth/jwt-claims'
import { forgetSessionValidation } from '@/lib/auth/session-guard'
import { endOwnSession } from '@/lib/services/auth/session/use-cases/session-lifecycle'
import { onLogoutInvalidate } from '@/lib/auth/on-logout-invalidate'
import { logger } from '@/lib/utils/logger'

type LogoutReason = 'user' | 'session_expired' | 'security' | 'timeout' | 'unknown'

/**
 *
 * @param request
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    // If no user, still return success (already logged out) — and make sure this browser's auth cookies
    // are cleared (a stale/expired token can still be sitting in them).
    if (!user || authError) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
      return NextResponse.json(
        { success: true, message: 'Already logged out' },
        { status: 200 }
      )
    }

    const userId = user.id
    const tenantId = user.user_metadata?.tenant_org_id as string | undefined

    // Get logout reason from request body
    let reason: LogoutReason = 'user'
    try {
      const body = await request.json().catch(() => ({}))
      reason = body.reason || 'user'
    } catch {
      // Default to 'user' if body parsing fails
    }

    // Invalidate server-side caches (permission cache when tenant-scoped,
    // plus any global caches listed in onLogoutInvalidate).
    await onLogoutInvalidate(userId, tenantId)

    logger.info('User logged out', {
      feature: 'auth',
      action: 'logout',
      userId,
      tenantId,
      reason,
    })

    // ─── End the session on the server ────────────────────────────────────────
    // The session id comes from the caller's own verified token (never from the request body), so a user can
    // only ever end their own session here. Ending also deletes the Supabase session (kills refresh) and
    // writes the audit event. Logout must never fail because of a bookkeeping error, so errors are logged only.
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const authSessionId = getSessionIdFromToken(session?.access_token)
      if (authSessionId) {
        await endOwnSession(createAdminSupabaseClient(), { authSessionId, userId, reason })
        forgetSessionValidation(authSessionId)
      }
    } catch (endError) {
      logger.error('Failed to end session on logout', endError as Error, {
        feature: 'auth',
        action: 'logout',
        userId,
      })
    }

    // Clear this browser's Supabase auth cookies (local scope: other devices are NOT signed out).
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)

    const res = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    })
    // Clear remember-me preference so next login defaults to session-only
    res.cookies.set(SB_REMEMBER_ME_COOKIE, '', { path: '/', maxAge: 0 })
    return res
  } catch (error) {
    logger.error('Error in logout API', error as Error, {
      feature: 'auth',
      action: 'logout',
    })

    // Return success even on error to prevent blocking client-side logout
    return NextResponse.json(
      {
        success: true,
        message: 'Logout processed (some cleanup may have failed)',
      },
      { status: 200 }
    )
  }
}

