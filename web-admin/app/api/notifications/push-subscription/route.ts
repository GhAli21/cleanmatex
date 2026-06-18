/**
 * Push Subscription API
 *
 * POST  /api/notifications/push-subscription  — register or refresh a subscription
 * DELETE /api/notifications/push-subscription  — deregister on logout / permission revoke
 *
 * Upserts into org_ntf_push_subs_dtl keyed on (tenant_org_id, user_id, device_id, provider_code).
 * Idempotent: re-registration refreshes subscription_data and resets failure_count.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/middleware/require-permission'
import { logger } from '@/lib/utils/logger'
import type { Json } from '@/types/database'

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const PROVIDER_CODES = ['FCM', 'VAPID', 'ONESIGNAL'] as const
const PLATFORMS      = ['IOS', 'ANDROID', 'WEB', 'BROWSER'] as const

const registerSchema = z.object({
  device_id:         z.string().min(1).max(200),
  provider_code:     z.enum(PROVIDER_CODES),
  platform:          z.enum(PLATFORMS),
  subscription_data: z.record(z.string(), z.unknown()),
  app_version:       z.string().max(50).optional(),
})

const deregisterSchema = z.object({
  device_id:     z.string().min(1).max(200),
  provider_code: z.enum(PROVIDER_CODES),
})

// ---------------------------------------------------------------------------
// POST — register / refresh subscription
// ---------------------------------------------------------------------------

/**
 *
 * @param request
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authCheck = await requirePermission('notifications:read')(request)
  if (authCheck instanceof NextResponse) return authCheck

  const { tenantId, userId } = authCheck

  try {
    const body = await request.json()
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { device_id, provider_code, platform, subscription_data, app_version } = parsed.data
    const supabase = createAdminSupabaseClient()

    // Upsert: update subscription_data + reset failure state on re-registration
    const { error } = await supabase
      .from('org_ntf_push_subs_dtl')
      .upsert(
        {
          tenant_org_id:    tenantId,
          user_id:          userId,
          device_id,
          provider_code,
          platform,
          subscription_data: subscription_data as unknown as Json,
          app_version:      app_version ?? null,
          is_active:        true,
          failure_count:    0,
          last_verified_at: new Date().toISOString(),
          updated_at:       new Date().toISOString(),
          updated_by:       userId,
        },
        {
          onConflict: 'tenant_org_id,user_id,device_id,provider_code',
        }
      )

    if (error) {
      logger.error('push-subscription POST: upsert failed', new Error(error.message), {
        tenantId, feature: 'notifications',
      })
      return NextResponse.json({ error: 'Failed to register subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('push-subscription POST: unexpected error', err instanceof Error ? err : new Error(String(err)), { feature: 'notifications' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE — deregister (logout or permission revoked)
// ---------------------------------------------------------------------------

/**
 *
 * @param request
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const authCheck = await requirePermission('notifications:read')(request)
  if (authCheck instanceof NextResponse) return authCheck

  const { tenantId, userId } = authCheck

  try {
    const body = await request.json()
    const parsed = deregisterSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { device_id, provider_code } = parsed.data
    const supabase = createAdminSupabaseClient()

    // Soft deactivate — keeps the row for audit; sweep cron will clean up stale rows
    const { error } = await supabase
      .from('org_ntf_push_subs_dtl')
      .update({
        is_active:  false,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('tenant_org_id', tenantId)
      .eq('user_id',       userId)
      .eq('device_id',     device_id)
      .eq('provider_code', provider_code)

    if (error) {
      logger.error('push-subscription DELETE: update failed', new Error(error.message), {
        tenantId, feature: 'notifications',
      })
      return NextResponse.json({ error: 'Failed to deregister subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('push-subscription DELETE: unexpected error', err instanceof Error ? err : new Error(String(err)), { feature: 'notifications' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
