/**
 * POST /api/users/[userId]/password — an administrator sets a new (temporary) password for a user of the same tenant.
 *
 * Permission: users:reset_password. Body: { newPassword, mustChange? (default true) }.
 * Ends every session of the user, optionally forces a change at next sign-in, audits PASSWORD_RESET_BY_ADMIN and
 * notifies the owner. The password is never emailed — to let the user choose their own, use …/password/link.
 * `[userId]` is the auth user id (same convention as the Users detail page). Tenant comes from the session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/middleware/require-permission'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { adminSetPassword, loadTargetUser } from '@/lib/services/auth/password/admin-password'
import { buildAdminActor, passwordErrorResponse } from '@/lib/services/auth/password/admin-route-helpers'
import { logger } from '@/lib/utils/logger'

const paramsSchema = z.object({ userId: z.string().uuid() })
const bodySchema = z
  .object({
    newPassword: z.string().min(1).max(256),
    mustChange: z.boolean().default(true),
  })
  .strict()

type RouteContext = { params: Promise<{ userId: string }> }

/**
 * @param request - Incoming request carrying the new password
 * @param context - Route context carrying the dynamic `userId` segment
 */
export async function POST(request: NextRequest, context: RouteContext) {
  // ─── Authorization ────────────────────────────────────────────────────────
  const auth = await requirePermission('users:reset_password')(request)
  if (auth instanceof NextResponse) return auth

  // ─── Input Validation ─────────────────────────────────────────────────────
  const params = paramsSchema.safeParse(await context.params)
  if (!params.success) return NextResponse.json({ success: false, error: 'Invalid user id' }, { status: 400 })

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }
  const body = bodySchema.safeParse(json)
  if (!body.success) return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })

  try {
    const admin = createAdminSupabaseClient()
    // Tenant-scoped lookup: users of other tenants are indistinguishable from missing ones.
    const target = await loadTargetUser(admin, auth.tenantId, params.data.userId)
    if (!target) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })

    const result = await adminSetPassword(admin, buildAdminActor(request, auth), target, body.data)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const mapped = passwordErrorResponse(error)
    if (mapped) return mapped
    logger.error('Admin password set failed', error as Error, {
      feature: 'users',
      action: 'admin_set_password',
      tenantId: auth.tenantId,
    })
    return NextResponse.json({ success: false, error: 'Failed to set password' }, { status: 500 })
  }
}
