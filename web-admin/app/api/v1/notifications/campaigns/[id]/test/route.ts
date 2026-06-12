/**
 * POST /api/v1/notifications/campaigns/[id]/test
 * Send a test notification from this campaign to the caller only.
 *
 * - Bypasses target_segment entirely — delivers only to the requesting user
 * - Only works when campaign is in DRAFT or APPROVED state
 * - Writes a single outbox row; does NOT advance campaign state or counters
 * - Requires: notifications:manage permission
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/middleware/require-permission'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { emitNotificationEvent } from '@/lib/notifications/event-emitter'
import { logger } from '@/lib/utils/logger'

const TEST_ALLOWED_STATUSES = new Set(['DRAFT', 'APPROVED', 'PENDING_APPROVAL'])

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requirePermission('notifications:manage')(request)
  if (authCheck instanceof NextResponse) return authCheck

  const { tenantId, userId } = authCheck
  const { id } = await params

  const supabase = createAdminSupabaseClient()

  // Fetch campaign — must belong to tenant and be in a testable state
  const { data: campaign, error: fetchError } = await supabase
    .from('org_notification_campaigns_mst')
    .select('id, status, name, channel_code, template_code')
    .eq('id', id)
    .eq('tenant_org_id', tenantId)
    .eq('is_active', true)
    .single()

  if (fetchError || !campaign) {
    return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
  }

  if (!TEST_ALLOWED_STATUSES.has(campaign.status as string)) {
    return NextResponse.json(
      {
        success: false,
        error: `Test send is only available for campaigns in DRAFT, PENDING_APPROVAL, or APPROVED status (current: ${campaign.status})`,
      },
      { status: 422 }
    )
  }

  // Fire a test notification to the caller only — fire-and-forget
  void emitNotificationEvent({
    code:             'campaign.test_send',
    tenantOrgId:      tenantId,
    recipientUserIds: [userId],
    sourceEntityType: 'campaign',
    sourceEntityId:   id,
    variables: {
      campaign_name: campaign.name as string,
      channel:       campaign.channel_code as string,
    },
  })

  logger.info?.('Campaign test send dispatched', {
    tenantId, campaignId: id, channel: campaign.channel_code, sentToUser: userId,
    feature: 'notifications-campaigns',
  })

  return NextResponse.json({
    success: true,
    message: 'Test notification dispatched to your account. Allow up to 60 seconds for delivery.',
  })
}
