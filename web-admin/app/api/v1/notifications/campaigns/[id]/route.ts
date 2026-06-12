/**
 * GET /api/v1/notifications/campaigns/[id]
 * Campaign detail: header + delivery stats + recent targets sample.
 *
 * Requires: notifications:manage permission.
 * Tenant isolation enforced: only returns campaigns owned by the caller's tenant.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/middleware/require-permission'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requirePermission('notifications:manage')(request)
  if (authCheck instanceof NextResponse) return authCheck

  const { tenantId } = authCheck
  const { id } = await params

  const supabase = createAdminSupabaseClient()

  // Fetch campaign header
  const { data: campaign, error: campaignError } = await supabase
    .from('org_notification_campaigns_mst')
    .select('*')
    .eq('id', id)
    .eq('tenant_org_id', tenantId)
    .eq('is_active', true)
    .single()

  if (campaignError || !campaign) {
    if (campaignError?.code === 'PGRST116') {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
    }
    logger.error('GET /api/v1/notifications/campaigns/[id] failed', new Error(campaignError?.message ?? 'Not found'), {
      tenantId, campaignId: id, feature: 'notifications-campaigns',
    })
    return NextResponse.json({ success: false, error: 'Failed to fetch campaign' }, { status: 500 })
  }

  // Fetch delivery stats breakdown (status counts for targets)
  const { data: targetStats } = await supabase
    .from('org_notif_campaign_targets_dtl')
    .select('status')
    .eq('campaign_id', id)
    .eq('tenant_org_id', tenantId)

  const statsBreakdown = (targetStats ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1
    return acc
  }, {})

  // Fetch a sample of recent failed/skipped targets for diagnostics (max 10)
  const { data: failedSample } = await supabase
    .from('org_notif_campaign_targets_dtl')
    .select('id, recipient_address, status, skip_reason, processed_at')
    .eq('campaign_id', id)
    .eq('tenant_org_id', tenantId)
    .in('status', ['FAILED', 'SKIPPED'])
    .order('processed_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    success: true,
    data: {
      ...campaign,
      stats_breakdown: statsBreakdown,
      failed_sample: failedSample ?? [],
    },
  })
}
