/**
 * POST /api/users/[userId]/unlock — an administrator clears a user's sign-in lockout.
 *
 * Permission: users:reset_password (credential administration). Resets the failed-attempt counter and the lock
 * of a member of the caller's tenant. Audited as ACCOUNT_UNLOCKED.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/middleware/require-permission'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { adminUnlockAccount, loadTargetUser } from '@/lib/services/auth/password/admin-password'
import { buildAdminActor, passwordErrorResponse } from '@/lib/services/auth/password/admin-route-helpers'
import { logger } from '@/lib/utils/logger'

const paramsSchema = z.object({ userId: z.string().uuid() })

type RouteContext = { params: Promise<{ userId: string }> }

/**
 * @param request - Incoming request
 * @param context - Route context carrying the dynamic `userId` segment
 */
export async function POST(request: NextRequest, context: RouteContext) {
  // ─── Authorization ────────────────────────────────────────────────────────
  const auth = await requirePermission('users:reset_password')(request)
  if (auth instanceof NextResponse) return auth

  const params = paramsSchema.safeParse(await context.params)
  if (!params.success) return NextResponse.json({ success: false, error: 'Invalid user id' }, { status: 400 })

  try {
    const admin = createAdminSupabaseClient()
    const target = await loadTargetUser(admin, auth.tenantId, params.data.userId)
    if (!target) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })

    const result = await adminUnlockAccount(admin, buildAdminActor(request, auth), target)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const mapped = passwordErrorResponse(error)
    if (mapped) return mapped
    logger.error('Admin unlock failed', error as Error, {
      feature: 'users',
      action: 'admin_unlock',
      tenantId: auth.tenantId,
    })
    return NextResponse.json({ success: false, error: 'Failed to unlock the account' }, { status: 500 })
  }
}
