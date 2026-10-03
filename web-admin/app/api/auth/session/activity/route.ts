/**
 * POST /api/auth/session/activity — session heartbeat / status for the signed-in caller.
 *
 * Body: { touch?: boolean }  (default true)
 *   touch=true   records REAL user activity: extends the idle window (client sends it only after genuine
 *                input — pointer/keyboard/touch — or when the user clicks "Stay signed in").
 *   touch=false  read-only status check (tab regained focus, another tab was active, post-sleep check).
 *
 * Any authenticated session may call it (no permission needed — it only concerns the caller's own session).
 * Tenant and session are resolved server-side from the caller's verified token. Fail closed: if the session
 * cannot be validated the response is 401 SESSION_ENDED / 503, never a silent "ok".
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { guardSession, isSessionActive, sessionEndedResponse } from '@/lib/auth/session-guard'
import { readRequestMeta } from '@/lib/services/auth/session/request-meta'
import { DEVICE_COOKIE_NAME } from '@/lib/constants/auth-session'
import { logger } from '@/lib/utils/logger'

const bodySchema = z.object({ touch: z.boolean().optional() }).strict()

/**
 * @param request - Incoming request carrying optional `{ touch }`
 */
export async function POST(request: NextRequest) {
  // ─── Input Validation ─────────────────────────────────────────────────────
  let touch = true
  try {
    const text = await request.text()
    if (text) {
      const parsed = bodySchema.safeParse(JSON.parse(text))
      if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
      touch = parsed.data.touch ?? true
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    // ─── Authentication + session validation (server-side) ─────────────────
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'SESSION_ENDED', reason: null }, { status: 401 })
    }

    const validation = await guardSession(
      supabase,
      readRequestMeta(request.headers, request.cookies.get(DEVICE_COOKIE_NAME)?.value),
      { touch }
    )
    if (!isSessionActive(validation)) return sessionEndedResponse(validation)

    return NextResponse.json({
      success: true,
      data: {
        state: validation.state,
        idleRemainingSec: validation.idleRemainingSec,
        absoluteRemainingSec: validation.absoluteRemainingSec,
        idleWarningSec: validation.idleWarningSec,
      },
    })
  } catch (error) {
    logger.error('Session heartbeat failed', error as Error, { feature: 'auth', action: 'session_activity' })
    return NextResponse.json(
      { error: 'Session validation unavailable', code: 'SESSION_VALIDATION_UNAVAILABLE' },
      { status: 503 }
    )
  }
}
