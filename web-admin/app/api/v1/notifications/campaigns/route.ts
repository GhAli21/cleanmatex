/**
 * GET  /api/v1/notifications/campaigns — paginated campaign list for the tenant
 * POST /api/v1/notifications/campaigns — create a new campaign (status = DRAFT)
 *
 * Requires: notifications:manage permission
 * Feature flag: campaign_notifications_enabled (checked by feature-flags util)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/middleware/require-permission'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import type { Json } from '@/types/database'

const PAGE_SIZE_MAX = 50

const createCampaignSchema = z.object({
  name:            z.string().min(1).max(500),
  name2:           z.string().max(500).optional(),
  description:     z.string().optional(),
  description2:    z.string().optional(),
  channel_code:    z.enum(['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH']),
  template_code:   z.string().max(200).optional(),
  target_segment:  z.record(z.string(), z.unknown()).optional(),
  scheduled_at:    z.string().datetime().optional(),
})

// ---------------------------------------------------------------------------
// GET — campaign list, paginated
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission('notifications:manage')(request)
  if (authCheck instanceof NextResponse) return authCheck

  const { tenantId } = authCheck
  const { searchParams } = request.nextUrl

  const page   = Math.max(1, parseInt(searchParams.get('page')   ?? '1',  10))
  const limit  = Math.min(PAGE_SIZE_MAX, parseInt(searchParams.get('limit') ?? '20', 10))
  const status = searchParams.get('status')
  const from   = (page - 1) * limit
  const to     = from + limit - 1

  const supabase = createAdminSupabaseClient()

  let query = supabase
    .from('org_notification_campaigns_mst')
    .select(
      'id, name, name2, status, channel_code, scheduled_at, started_at, completed_at, ' +
      'total_targets, sent_count, failed_count, skip_count, created_at, updated_at',
      { count: 'exact' }
    )
    .eq('tenant_org_id', tenantId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status) query = query.eq('status', status)

  const { data, count, error } = await query

  if (error) {
    logger.error('GET /api/v1/notifications/campaigns failed', new Error(error.message), {
      tenantId, feature: 'notifications-campaigns',
    })
    return NextResponse.json({ success: false, error: 'Failed to fetch campaigns' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: data ?? [],
    pagination: {
      page,
      limit,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / limit),
    },
  })
}

// ---------------------------------------------------------------------------
// POST — create campaign (status = DRAFT)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const authCheck = await requirePermission('notifications:manage')(request)
  if (authCheck instanceof NextResponse) return authCheck

  const { tenantId, userId } = authCheck

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createCampaignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const {
    name, name2, description, description2,
    channel_code, template_code, target_segment, scheduled_at,
  } = parsed.data

  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('org_notification_campaigns_mst')
    .insert({
      tenant_org_id:  tenantId,
      name,
      name2:          name2          ?? null,
      description:    description    ?? null,
      description2:   description2   ?? null,
      status:         'DRAFT',
      channel_code,
      template_code:  template_code  ?? null,
      target_segment: (target_segment ?? null) as unknown as Json,
      scheduled_at:   scheduled_at   ?? null,
      total_targets:  0,
      sent_count:     0,
      failed_count:   0,
      skip_count:     0,
      created_by:     userId,
      rec_status:     1,
      is_active:      true,
    })
    .select()
    .single()

  if (error) {
    logger.error('POST /api/v1/notifications/campaigns failed', new Error(error.message), {
      tenantId, feature: 'notifications-campaigns',
    })
    return NextResponse.json({ success: false, error: 'Failed to create campaign' }, { status: 500 })
  }

  return NextResponse.json({ success: true, data }, { status: 201 })
}
