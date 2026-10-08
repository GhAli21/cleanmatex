/**
 * POST /api/users/[userId]/password/link — an administrator emails a user a one-time "choose your own password" link.
 *
 * Permission: users:reset_password. Body: { revokeSessions? (default false) }.
 * Nothing changes until the user opens the link; optionally the user is signed out everywhere right away.
 * Requires a real email (users with a synthetic sign-in address get NO_EMAIL). Audited as PASSWORD_RESET_LINK_SENT.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/middleware/require-permission'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { adminSendResetLink, loadTargetUser } from '@/lib/services/auth/password/admin-password'
import { buildAdminActor, passwordErrorResponse } from '@/lib/services/auth/password/admin-route-helpers'
import { logger } from '@/lib/utils/logger'

const paramsSchema = z.object({ userId: z.string().uuid() })
const bodySchema = z.object({ revokeSessions: z.boolean().default(false) }).strict()

type RouteContext = { params: Promise<{ userId: string }> }

/**
 * @param request - Incoming request
 * @param context - Route context carrying the dynamic `userId` segment
 */
export async function POST(request: NextRequest, context: RouteContext) {
  // ─── Authorization ────────────────────────────────────────────────────────
  const auth = await requirePermission('users:reset_password')(request)
  if (auth instanceof NextResponse) return auth

  // ─── Input Validation ─────────────────────────────────────────────────────
  const params = paramsSchema.safeParse(await context.params)
  if (!params.success) return NextResponse.json({ success: false, error: 'Invalid user id' }, { status: 400 })

  let json: unknown = {}
  try {
    const text = await request.text()
    if (text) json = JSON.parse(text)
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }
  const body = bodySchema.safeParse(json)
  if (!body.success) return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })

  try {
    const admin = createAdminSupabaseClient()
    const target = await loadTargetUser(admin, auth.tenantId, params.data.userId)
    if (!target) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })

    const result = await adminSendResetLink(admin, buildAdminActor(request, auth), target, body.data)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const mapped = passwordErrorResponse(error)
    if (mapped) return mapped
    logger.error('Admin password link failed', error as Error, {
      feature: 'users',
      action: 'admin_password_link',
      tenantId: auth.tenantId,
    })
    return NextResponse.json({ success: false, error: 'Failed to send the link' }, { status: 500 })
  }
}
