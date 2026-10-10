/**
 * POST /api/v1/notifications/campaigns/[id]/test
 * Send a test notification from this campaign to the caller only.
 *
 * - Bypasses target_segment entirely — delivers only to the requesting user
 * - Only works when campaign is in DRAFT or APPROVED state
 * - Does NOT advance campaign state or counters
 *
 * Design note (2026-10-10, closes plan item A4(a)): this used to call
 * emitNotificationEvent({ code: 'campaign.test_send', ... }), but
 * 'campaign.test_send' was never seeded into sys_ntf_events_cd. The
 * orchestrator's getEventMeta() resolves eligible channels from
 * sys_ntf_event_chan_map keyed by event code, found nothing for the unknown
 * code, and silently dispatched to zero channels — the button did nothing,
 * with no error surfaced. Fixed by rendering the campaign's real content
 * (same renderTemplateByCode/name+description fallback process-campaigns'
 * dispatchTargets uses) and dispatching directly through the matching
 * channel adapter to the requesting staff user ONLY, bypassing
 * org_ntf_outbox_dtl/org_ntf_inbox_mst's normal queue, campaign counters, and
 * customer marketing-consent/suppression checks — this is an authorized
 * staff action targeting the staff member themselves, not a customer send,
 * so none of that pipeline applies. The channel adapters
 * (deliverEmailOutbox/deliverSmsOutbox/deliverWhatsAppOutbox/
 * deliverPushOutbox) already accept a minimal, non-persisted row shape and
 * contain no outbox-write side effects themselves, so they are reused as-is
 * — no duplication of provider-calling logic. IN_APP has no external
 * provider, so it still writes directly to org_ntf_inbox_mst (the only way
 * to deliver in-app content), tagged `metadata.test_send: true` since there
 * is no dedicated column for it, with a fresh idempotency key per click so
 * repeat test sends each deliver (the orchestrator's stable per-event key
 * format would wrongly dedupe a second test click to the same user).
 */

import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/middleware/require-permission'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { renderTemplateByCode, type RenderedContent } from '@lib/notifications/template-renderer'
import { deliverEmailOutbox, type OutboxEmailRow } from '@lib/notifications/adapters/email'
import { deliverSmsOutbox, type OutboxSmsRow } from '@lib/notifications/adapters/sms'
import { deliverWhatsAppOutbox, type OutboxWhatsAppRow } from '@lib/notifications/adapters/whatsapp'
import { deliverPushOutbox, type OutboxPushRow } from '@lib/notifications/adapters/push'
import type { Json } from '@/types/database'

const TEST_ALLOWED_STATUSES = new Set(['DRAFT', 'APPROVED', 'PENDING_APPROVAL'])

/** Reused across every channel branch so the route returns one consistent shape. */
interface DispatchOutcome {
  delivered: boolean
  error?: string
}

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
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
    .from('org_ntf_campaigns_mst')
    .select('id, status, name, name2, description, description2, channel_code, template_code')
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

  // Resolve the requesting staff user's own contact info — NOT org_customers_mst.
  // org_users_mst.user_id is the auth user id (same identifier requirePermission
  // returns as `userId`), explicitly tenant-scoped per CRITICAL RULE #4.
  const { data: staffUser } = await supabase
    .from('org_users_mst')
    .select('email, phone')
    .eq('user_id', userId)
    .eq('tenant_org_id', tenantId)
    .maybeSingle()

  // Render the campaign's actual content — identical pipeline to
  // process-campaigns.ts's dispatchTargets(): template_code through the real
  // template store when set, otherwise the campaign's own bilingual
  // name/description.
  const rendered: RenderedContent = campaign.template_code
    ? await renderTemplateByCode(campaign.template_code as string, campaign.channel_code as string, {
        campaign_name:         campaign.name as string,
        campaign_name2:        (campaign.name2 as string | null) ?? '',
        campaign_description:  (campaign.description as string | null) ?? '',
        campaign_description2: (campaign.description2 as string | null) ?? '',
      })
    : {
        title:    campaign.name as string,
        title2:   (campaign.name2 as string | null) ?? null,
        body:     (campaign.description as string | null) ?? (campaign.name as string),
        body2:    (campaign.description2 as string | null) ?? null,
        metadata: {},
      }

  const syntheticId = `campaign-test:${id}:${userId}:${Date.now()}`
  let outcome: DispatchOutcome

  switch (campaign.channel_code) {
    case 'IN_APP': {
      const { error: insertErr } = await supabase
        .from('org_ntf_inbox_mst')
        .insert({
          tenant_org_id:      tenantId,
          recipient_user_id:  userId,
          event_code:         'campaign.send',
          title:              rendered.title,
          title2:             rendered.title2,
          body:               rendered.body,
          body2:              rendered.body2,
          channel_code:       'IN_APP',
          priority:           'NORMAL',
          source_entity_type: 'campaign',
          source_entity_id:   id,
          metadata:           { ...rendered.metadata, test_send: true } as unknown as Json,
          idempotency_key:    `campaign_test:${id}:${userId}:${randomUUID()}`,
          created_by:         userId,
          rec_status:         1,
        })
      outcome = insertErr
        ? { delivered: false, error: insertErr.message }
        : { delivered: true }
      break
    }

    case 'EMAIL': {
      if (!staffUser?.email) {
        outcome = { delivered: false, error: 'Your staff account has no email address on file' }
        break
      }
      const row: OutboxEmailRow = {
        id:                 syntheticId,
        tenant_org_id:      tenantId,
        recipient_address:  staffUser.email,
        recipient_user_id:  userId,
        rendered_subject:   rendered.title,
        rendered_body:      rendered.body,
        event_code:         'campaign.send',
        retry_count:        0,
        // Deliberately no source_entity_type/id: resolveCustomerDispatchConsent
        // only applies to 'order'-sourced rows. Leaving these unset means the
        // staff-targeted consent bypass is the module's existing, intended
        // behavior for non-customer recipients — not a special case added here.
      }
      const result = await deliverEmailOutbox(row)
      outcome = result.success
        ? { delivered: true }
        : { delivered: false, error: result.errorMessage ?? 'Email send failed' }
      break
    }

    case 'SMS': {
      if (!staffUser?.phone) {
        outcome = { delivered: false, error: 'Your staff account has no phone number on file' }
        break
      }
      const row: OutboxSmsRow = {
        id:                syntheticId,
        tenant_org_id:     tenantId,
        recipient_address: staffUser.phone,
        rendered_body:     rendered.body,
        event_code:        'campaign.send',
        retry_count:       0,
      }
      const result = await deliverSmsOutbox(row)
      outcome = result.success
        ? { delivered: true }
        : { delivered: false, error: result.errorMessage ?? 'SMS send failed' }
      break
    }

    case 'WHATSAPP': {
      if (!staffUser?.phone) {
        outcome = { delivered: false, error: 'Your staff account has no phone number on file' }
        break
      }
      const row: OutboxWhatsAppRow = {
        id:                syntheticId,
        tenant_org_id:     tenantId,
        recipient_address: staffUser.phone,
        rendered_body:     rendered.body,
        rendered_subject:  rendered.title,
        event_code:        'campaign.send',
        retry_count:       0,
      }
      const result = await deliverWhatsAppOutbox(row)
      outcome = result.success
        ? { delivered: true }
        : { delivered: false, error: result.errorMessage ?? 'WhatsApp send failed' }
      break
    }

    case 'PUSH': {
      const row: OutboxPushRow = {
        id:                syntheticId,
        tenant_org_id:     tenantId,
        recipient_user_id: userId,
        rendered_subject:  rendered.title,
        rendered_body:     rendered.body,
        event_code:        'campaign.send',
        retry_count:       0,
      }
      const result = await deliverPushOutbox(row)
      if (!result.success) {
        outcome = { delivered: false, error: result.errorMessage ?? 'Push send failed' }
      } else if (result.sentCount === 0) {
        // Unlike a real campaign send (where zero subscriptions is a normal
        // no-op), a test send with nothing to deliver to must tell the staff
        // member why they saw nothing, not report false success.
        outcome = { delivered: false, error: 'No active push subscriptions found for your account on this device/browser' }
      } else {
        outcome = { delivered: true }
      }
      break
    }

    default:
      outcome = { delivered: false, error: `Test send is not supported for channel: ${campaign.channel_code}` }
  }

  if (!outcome.delivered) {
    logger.warn('Campaign test send failed', {
      tenantId, campaignId: id, channel: campaign.channel_code, userId,
      reason: outcome.error, feature: 'notifications-campaigns',
    })
    return NextResponse.json({ success: false, error: outcome.error ?? 'Test send failed' }, { status: 422 })
  }

  logger.info('Campaign test send dispatched', {
    tenantId, campaignId: id, channel: campaign.channel_code, sentToUser: userId,
    feature: 'notifications-campaigns',
  })

  return NextResponse.json({
    success: true,
    message: 'Test notification sent to your account.',
  })
}
