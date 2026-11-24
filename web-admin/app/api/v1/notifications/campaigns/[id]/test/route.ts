/**
 * POST /api/v1/notifications/campaigns/[id]/test
 * Sends this campaign's message to the staff member who asks, and only to them.
 *
 * - Only for campaigns in DRAFT, PENDING_APPROVAL or APPROVED.
 * - Does not change the campaign's state or counters, and skips customer consent: the recipient is
 *   the staff member themselves, not a customer.
 * - IN_APP: the inbox row is the delivery, so it is written here (200).
 * - EMAIL / SMS / WHATSAPP / PUSH: one outbox row and its `ntf.deliver` job (202, `outboxId`), sent by
 *   HQ API like every other message (Background Jobs step 5e). Source `campaign_test` + campaign id:
 *   HQ uses the campaign's WhatsApp template and re-reads the staff member's phone.
 *   The screen follows the row through GET /api/v1/notifications/outbox/[id]/status.
 * Every click is a new message (fresh idempotency key).
 */

import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { requirePermission } from '@/lib/middleware/require-permission'
import { prisma } from '@/lib/db/prisma'
import { withTenantContext } from '@/lib/db/tenant-context'
import { logger } from '@/lib/utils/logger'
import { renderCampaignContent } from '@lib/notifications/campaign-jobs.service'
import { IMMEDIATE_SEND_PRIORITY, queueImmediateSendTx } from '@lib/notifications/immediate-send.service'
import { CAMPAIGN_SEND_EVENT } from '@lib/constants/notification-campaigns'

const TEST_ALLOWED_STATUSES = new Set(['DRAFT', 'APPROVED', 'PENDING_APPROVAL'])
const QUEUED_CHANNELS = new Set(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'])

/** Queues (or, for IN_APP, delivers) one test message of the campaign to the calling staff member. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requirePermission('notifications:manage')(request)
  if (authCheck instanceof NextResponse) return authCheck

  const { tenantId, userId } = authCheck
  const { id } = await params

  const campaign = await prisma.org_ntf_campaigns_mst.findFirst({
    where: { id, tenant_org_id: tenantId, is_active: true },
    select: { status: true, channel_code: true, template_code: true, template_vars: true, name: true, name2: true, description: true, description2: true },
  })
  if (!campaign) {
    return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
  }
  if (!TEST_ALLOWED_STATUSES.has(campaign.status)) {
    return NextResponse.json(
      { success: false, error: `Test send is only available for campaigns in DRAFT, PENDING_APPROVAL, or APPROVED status (current: ${campaign.status})` },
      { status: 422 }
    )
  }

  const channel = campaign.channel_code
  const fail = (error: string) => {
    logger.warn('Campaign test send failed', { tenantId, campaignId: id, channel, userId, reason: error, feature: 'notifications-campaigns' })
    return NextResponse.json({ success: false, error }, { status: 422 })
  }
  if (channel !== 'IN_APP' && !QUEUED_CHANNELS.has(channel)) return fail(`Test send is not supported for channel: ${channel}`)

  const rendered = await renderCampaignContent(campaign)
  const idempotencyKey = `campaign_test:${id}:${userId}:${randomUUID()}`

  if (channel === 'IN_APP') {
    await prisma.org_ntf_inbox_mst.create({
      data: {
        tenant_org_id: tenantId, recipient_user_id: userId, event_code: CAMPAIGN_SEND_EVENT,
        title: rendered.title, title2: rendered.title2 ?? null, body: rendered.body, body2: rendered.body2 ?? null,
        channel_code: 'IN_APP', priority: 'NORMAL', source_entity_type: 'campaign', source_entity_id: id,
        metadata: { ...rendered.metadata, test_send: true } as Prisma.InputJsonValue,
        idempotency_key: idempotencyKey, created_by: userId, rec_status: 1,
      },
    })
    logger.info('Campaign test send delivered in-app', { tenantId, campaignId: id, sentToUser: userId, feature: 'notifications-campaigns' })
    return NextResponse.json({ success: true, data: { delivered: true } })
  }

  // The staff member's own contact details, not a customer's.
  const staffUser = await prisma.org_users_mst.findFirst({
    where: { user_id: userId, tenant_org_id: tenantId },
    select: { email: true, phone: true },
  })
  const address = channel === 'PUSH' ? null
    : channel === 'EMAIL' ? (staffUser?.email?.trim() || null)
    : (staffUser?.phone?.trim() || null)
  if (channel !== 'PUSH' && !address) {
    return fail(channel === 'EMAIL' ? 'Your staff account has no email address on file' : 'Your staff account has no phone number on file')
  }

  const outboxId = await withTenantContext(tenantId, () => prisma.$transaction((tx) => queueImmediateSendTx(tx, {
    tenantOrgId: tenantId,
    channel: channel as 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH',
    recipientAddress: address,
    recipientUserId: userId,
    eventCode: CAMPAIGN_SEND_EVENT,
    sourceEntityType: 'campaign_test',
    sourceEntityId: id,
    idempotencyKey,
    subject: rendered.title,
    body: rendered.body,
    metadata: { ...rendered.metadata, test_send: true },
    maxRetries: 1,
    createdBy: userId,
  }, IMMEDIATE_SEND_PRIORITY.CAMPAIGN_TEST)))

  logger.info('Campaign test send queued', { tenantId, campaignId: id, channel, sentToUser: userId, outboxId, feature: 'notifications-campaigns' })
  return NextResponse.json({ success: true, data: { outboxId } }, { status: 202 })
}
