/**
 * GET  /api/v1/notifications/settings  — fetch tenant channel settings + active provider
 * PUT  /api/v1/notifications/settings  — update a channel setting
 * Requires notifications:configure permission.
 *
 * This route is the write side of the NotificationSettingsService source of truth.
 * Every successful PUT invalidates the service cache so subsequent reads are fresh.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/middleware/require-permission'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { notificationSettingsService } from '@/lib/notifications/settings-service'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission('notifications:configure')(request)
  if (authCheck instanceof NextResponse) return authCheck

  const { tenantId } = authCheck

  try {
    const configs = await notificationSettingsService.getAllChannelConfigs(tenantId)
    return NextResponse.json({ success: true, data: configs })
  } catch (error) {
    logger.error('GET /api/v1/notifications/settings failed', error as Error, { tenantId, feature: 'notifications' })
    return NextResponse.json({ success: false, error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const authCheck = await requirePermission('notifications:configure')(request)
  if (authCheck instanceof NextResponse) return authCheck

  const { tenantId } = authCheck

  const body = await request.json() as {
    channel_code: string
    is_enabled?: boolean
    quiet_hours_enabled?: boolean
    quiet_hours_start?: string | null
    quiet_hours_end?: string | null
    quiet_hours_tz?: string | null
    daily_limit?: number | null
  }

  if (!body.channel_code) {
    return NextResponse.json({ success: false, error: 'channel_code is required' }, { status: 400 })
  }

  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('org_ntf_settings_cf')
    .upsert(
      {
        tenant_org_id: tenantId,
        channel_code:  body.channel_code,
        ...(body.is_enabled             !== undefined && { is_enabled:            body.is_enabled }),
        ...(body.quiet_hours_enabled    !== undefined && { quiet_hours_enabled:   body.quiet_hours_enabled }),
        ...(body.quiet_hours_start      !== undefined && { quiet_hours_start:     body.quiet_hours_start }),
        ...(body.quiet_hours_end        !== undefined && { quiet_hours_end:       body.quiet_hours_end }),
        ...(body.quiet_hours_tz         !== undefined && { quiet_hours_tz:        body.quiet_hours_tz }),
        ...(body.daily_limit            !== undefined && { daily_limit:           body.daily_limit }),
        updated_at: new Date().toISOString(),
        rec_status: 1,
        is_active:  true,
        created_by: 'system',
      },
      { onConflict: 'tenant_org_id,channel_code' }
    )
    .select()
    .single()

  if (error) {
    logger.error('PUT /api/v1/notifications/settings failed', new Error(error.message), { tenantId, feature: 'notifications' })
    return NextResponse.json({ success: false, error: 'Failed to update setting' }, { status: 500 })
  }

  // Invalidate cache so the next read from the service reflects this change immediately.
  notificationSettingsService.invalidateChannel(tenantId)

  return NextResponse.json({ success: true, data })
}
