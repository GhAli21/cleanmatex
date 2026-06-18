/**
 * Provider configuration API for the Notification Hub.
 *
 * GET  /api/v1/notifications/settings/providers          — list all provider configs for tenant
 * POST /api/v1/notifications/settings/providers          — add a new provider config for a channel
 * PUT  /api/v1/notifications/settings/providers/activate — set one provider as active for a channel
 * DELETE /api/v1/notifications/settings/providers        — remove a provider config row
 *
 * All endpoints require notifications:configure permission.
 * All writes invalidate the NotificationSettingsService cache.
 *
 * SECURITY: config JSONB may only contain non-secret fields.
 *           API keys/secrets must stay in environment variables.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/middleware/require-permission'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { notificationSettingsService } from '@/lib/notifications/settings-service'
import { logger } from '@/lib/utils/logger'
import type { Json } from '@/types/database'

// ---------------------------------------------------------------------------
// GET — list all provider configs for the tenant
// ---------------------------------------------------------------------------

/**
 *
 * @param request
 */
export async function GET(request: NextRequest) {
  const authCheck = await requirePermission('notifications:configure')(request)
  if (authCheck instanceof NextResponse) return authCheck

  const { tenantId } = authCheck
  const { searchParams } = new URL(request.url)
  const channelCode = searchParams.get('channel_code')

  //jhfgf

  const supabase = createAdminSupabaseClient()

  let query = supabase
    .from('org_ntf_channel_provider_cf')
    .select('id, channel_code, provider_code, display_name, config, is_active, created_at, updated_at')
    .eq('tenant_org_id', tenantId)
    .eq('is_rec_active', true)
    .order('channel_code')
    .order('is_active', { ascending: false })

  if (channelCode) query = query.eq('channel_code', channelCode)

  const { data, error } = await query

  if (error) {
    logger.error('GET /api/v1/notifications/settings/providers failed', new Error(error.message), { tenantId, feature: 'notifications' })
    return NextResponse.json({ success: false, error: 'Failed to fetch provider configs' }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: data ?? [] })
}

// ---------------------------------------------------------------------------
// POST — add a new provider config for a channel
// ---------------------------------------------------------------------------

/**
 *
 * @param request
 */
export async function POST(request: NextRequest) {
  const authCheck = await requirePermission('notifications:configure')(request)
  if (authCheck instanceof NextResponse) return authCheck

  const { tenantId } = authCheck

  const body = await request.json() as {
    channel_code: string
    provider_code: string
    display_name?: string
    config?: Record<string, unknown>
  }

  if (!body.channel_code || !body.provider_code) {
    return NextResponse.json({ success: false, error: 'channel_code and provider_code are required' }, { status: 400 })
  }

  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('org_ntf_channel_provider_cf')
    .insert({
      tenant_org_id: tenantId,
      channel_code:  body.channel_code,
      provider_code: body.provider_code,
      display_name:  body.display_name ?? null,
      config:        (body.config ?? null) as unknown as Json,
      is_active:     false,
      is_rec_active: true,
      rec_status:    1,
      created_by:    'system',
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ success: false, error: 'This provider is already configured for this channel' }, { status: 409 })
    }
    logger.error('POST /api/v1/notifications/settings/providers failed', new Error(error.message), { tenantId, feature: 'notifications' })
    return NextResponse.json({ success: false, error: 'Failed to add provider config' }, { status: 500 })
  }

  notificationSettingsService.invalidateChannel(tenantId)

  return NextResponse.json({ success: true, data }, { status: 201 })
}

// ---------------------------------------------------------------------------
// PUT — activate a provider for a channel (deactivates all others)
//
// Body: { channel_code, provider_code }
// This is an atomic two-step operation:
//   1. Deactivate all providers for (tenant, channel)
//   2. Activate the target provider
// The partial unique index on (tenant_org_id, channel_code) WHERE is_active=true
// enforces the invariant at DB level.
// ---------------------------------------------------------------------------

/**
 *
 * @param request
 */
export async function PUT(request: NextRequest) {
  const authCheck = await requirePermission('notifications:configure')(request)
  if (authCheck instanceof NextResponse) return authCheck

  const { tenantId } = authCheck

  const body = await request.json() as {
    channel_code: string
    provider_code: string
    config?: Record<string, unknown>
    display_name?: string
  }

  if (!body.channel_code || !body.provider_code) {
    return NextResponse.json({ success: false, error: 'channel_code and provider_code are required' }, { status: 400 })
  }

  const supabase = createAdminSupabaseClient()

  // Step 1: deactivate all providers for this tenant + channel
  const { error: deactivateError } = await supabase
    .from('org_ntf_channel_provider_cf')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('tenant_org_id', tenantId)
    .eq('channel_code', body.channel_code)

  if (deactivateError) {
    logger.error('PUT providers: deactivate step failed', new Error(deactivateError.message), { tenantId, feature: 'notifications' })
    return NextResponse.json({ success: false, error: 'Failed to activate provider' }, { status: 500 })
  }

  // Step 2: activate the target provider (also update config/display_name if provided)
  const updatePayload: {
    is_active: boolean;
    updated_at: string;
    config?: Json;
    display_name?: string;
  } = {
    is_active:  true,
    updated_at: new Date().toISOString(),
  }
  if (body.config       !== undefined) updatePayload.config       = body.config as unknown as Json
  if (body.display_name !== undefined) updatePayload.display_name = body.display_name

  const { data, error: activateError } = await supabase
    .from('org_ntf_channel_provider_cf')
    .update(updatePayload)
    .eq('tenant_org_id', tenantId)
    .eq('channel_code', body.channel_code)
    .eq('provider_code', body.provider_code)
    .select()
    .single()

  if (activateError) {
    logger.error('PUT providers: activate step failed', new Error(activateError.message), { tenantId, feature: 'notifications' })
    return NextResponse.json({ success: false, error: 'Failed to activate provider' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ success: false, error: 'Provider config not found — add it via POST first' }, { status: 404 })
  }

  notificationSettingsService.invalidateChannel(tenantId)

  return NextResponse.json({ success: true, data })
}

// ---------------------------------------------------------------------------
// DELETE — remove a provider config row (soft-delete via is_rec_active = false)
// Query params: channel_code, provider_code
// ---------------------------------------------------------------------------

/**
 *
 * @param request
 */
export async function DELETE(request: NextRequest) {
  const authCheck = await requirePermission('notifications:configure')(request)
  if (authCheck instanceof NextResponse) return authCheck

  const { tenantId } = authCheck
  const { searchParams } = new URL(request.url)
  const channelCode  = searchParams.get('channel_code')
  const providerCode = searchParams.get('provider_code')

  if (!channelCode || !providerCode) {
    return NextResponse.json({ success: false, error: 'channel_code and provider_code query params are required' }, { status: 400 })
  }

  const supabase = createAdminSupabaseClient()

  // Safety: prevent deleting the currently active provider
  const { data: existing } = await supabase
    .from('org_ntf_channel_provider_cf')
    .select('is_active')
    .eq('tenant_org_id', tenantId)
    .eq('channel_code', channelCode)
    .eq('provider_code', providerCode)
    .single()

  if (existing?.is_active) {
    return NextResponse.json(
      { success: false, error: 'Cannot delete the active provider. Activate another provider first.' },
      { status: 409 }
    )
  }

  const { error } = await supabase
    .from('org_ntf_channel_provider_cf')
    .update({ is_rec_active: false, is_active: false, updated_at: new Date().toISOString() })
    .eq('tenant_org_id', tenantId)
    .eq('channel_code', channelCode)
    .eq('provider_code', providerCode)

  if (error) {
    logger.error('DELETE /api/v1/notifications/settings/providers failed', new Error(error.message), { tenantId, feature: 'notifications' })
    return NextResponse.json({ success: false, error: 'Failed to remove provider config' }, { status: 500 })
  }

  notificationSettingsService.invalidateChannel(tenantId)

  return NextResponse.json({ success: true })
}
