/**
 * POST /api/notifications/process-campaigns
 * Internal-only campaign scheduler/processor. Called by pg_cron every minute via pg_net.
 * Authorization: Bearer {NOTIFICATIONS_OUTBOX_SECRET}
 *
 * Two-phase processing per invocation:
 *   Phase A — Activate: find APPROVED/SCHEDULED campaigns due to start → RUNNING, create targets
 *   Phase B — Dispatch: for each RUNNING campaign, process a batch of PENDING targets
 *                       → check marketing_consent → enqueue outbox or skip
 *                       → if no PENDING remain → complete campaign
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'

const ACTIVATE_BATCH   = 10  // campaigns to activate per run
const DISPATCH_BATCH   = 50  // targets to process per running campaign per run

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.NOTIFICATIONS_OUTBOX_SECRET
  if (!secret) return false
  const authHeader = request.headers.get('authorization') ?? ''
  return authHeader === `Bearer ${secret}`
}

type Campaign = {
  id:             string
  tenant_org_id:  string
  name:           string
  description:    string | null
  channel_code:   string
  template_code:  string | null
  target_segment: Record<string, unknown> | null
  skip_count:     number
  sent_count:     number
}

type TargetRow = {
  id:                 string
  tenant_org_id:      string
  campaign_id:        string
  recipient_user_id:  string | null
  recipient_address:  string | null
}

// ---------------------------------------------------------------------------
// Phase A helpers
// ---------------------------------------------------------------------------

async function activateCampaign(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  campaign: Campaign,
  now: string
): Promise<{ targetsCreated: number; reason?: string }> {
  const userIds: string[] = Array.isArray(campaign.target_segment?.user_ids)
    ? (campaign.target_segment.user_ids as string[])
    : []

  if (userIds.length === 0) {
    await supabase
      .from('org_ntf_campaigns_mst')
      .update({
        status:     'FAILED',
        updated_at: now,
      })
      .eq('id', campaign.id)
      .eq('tenant_org_id', campaign.tenant_org_id)

    void supabase.from('org_ntf_audit_dtl').insert({
      tenant_org_id: campaign.tenant_org_id,
      entity_type:   'CAMPAIGN',
      entity_id:     campaign.id,
      action_code:   'ACTIVATION_FAILED',
      old_value:     { status: 'APPROVED' },
      new_value:     { status: 'FAILED', reason: 'No user_ids in target_segment' },
      performed_by:  'system',
      performed_at:  now,
      rec_status:    1,
      is_active:     true,
    })

    return { targetsCreated: 0, reason: 'target_segment.user_ids is empty or missing' }
  }

  // Create one target row per user
  const targetRows = userIds.map(uid => ({
    tenant_org_id:    campaign.tenant_org_id,
    campaign_id:      campaign.id,
    recipient_user_id: uid,
    status:           'PENDING',
    rec_status:       1,
    is_active:        true,
    created_by:       'system',
  }))

  const { error: insertErr } = await supabase
    .from('org_ntf_camp_targets_dtl')
    .insert(targetRows)

  if (insertErr) {
    logger.error('process-campaigns: failed to insert targets', new Error(insertErr.message), {
      campaignId: campaign.id, tenantId: campaign.tenant_org_id, feature: 'notifications-campaigns',
    })
    return { targetsCreated: 0, reason: `DB error: ${insertErr.message}` }
  }

  // Transition campaign to RUNNING
  await supabase
    .from('org_ntf_campaigns_mst')
    .update({
      status:        'RUNNING',
      started_at:    now,
      total_targets: userIds.length,
      updated_at:    now,
    })
    .eq('id', campaign.id)
    .eq('tenant_org_id', campaign.tenant_org_id)

  void supabase.from('org_ntf_audit_dtl').insert({
    tenant_org_id: campaign.tenant_org_id,
    entity_type:   'CAMPAIGN',
    entity_id:     campaign.id,
    action_code:   'STATUS_CHANGED',
    old_value:     { status: 'APPROVED' },
    new_value:     { status: 'RUNNING', total_targets: userIds.length },
    performed_by:  'system',
    performed_at:  now,
    rec_status:    1,
    is_active:     true,
  })

  logger.info('process-campaigns: campaign activated', {
    campaignId:     campaign.id,
    tenantId:       campaign.tenant_org_id,
    targetsCreated: userIds.length,
    feature:        'notifications-campaigns',
  })

  return { targetsCreated: userIds.length }
}

// ---------------------------------------------------------------------------
// Phase B helpers
// ---------------------------------------------------------------------------

async function dispatchTargets(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  campaign: Campaign,
  now: string
): Promise<{ queued: number; skipped: number; done: boolean }> {
  // Fetch a batch of PENDING targets for this campaign
  const { data: targets, error: fetchErr } = await supabase
    .from('org_ntf_camp_targets_dtl')
    .select('id, tenant_org_id, campaign_id, recipient_user_id, recipient_address')
    .eq('campaign_id', campaign.id)
    .eq('tenant_org_id', campaign.tenant_org_id)
    .eq('status', 'PENDING')
    .limit(DISPATCH_BATCH)

  if (fetchErr) {
    logger.error('process-campaigns: failed to fetch PENDING targets', new Error(fetchErr.message), {
      campaignId: campaign.id, tenantId: campaign.tenant_org_id, feature: 'notifications-campaigns',
    })
    return { queued: 0, skipped: 0, done: false }
  }

  // No PENDING targets in this batch — campaign may be complete
  if (!targets?.length) {
    const { count } = await supabase
      .from('org_ntf_camp_targets_dtl')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('tenant_org_id', campaign.tenant_org_id)
      .eq('status', 'PENDING')

    if ((count ?? 0) === 0) {
      await completeCampaign(supabase, campaign, now)
      return { queued: 0, skipped: 0, done: true }
    }
    return { queued: 0, skipped: 0, done: false }
  }

  const rows = targets as TargetRow[]
  const userIds = rows.map(r => r.recipient_user_id).filter(Boolean) as string[]

  // Bulk-fetch marketing consent for all target users in one query
  const { data: prefs } = await supabase
    .from('org_ntf_user_prefs_dtl')
    .select('user_id, marketing_consent, is_enabled')
    .eq('tenant_org_id', campaign.tenant_org_id)
    .eq('channel_code', campaign.channel_code)
    .is('event_code', null)       // global channel-level pref (NULL event_code)
    .in('user_id', userIds)

  // Build consent lookup: user_id → true/false (missing row = no consent)
  const consentMap = new Map<string, boolean>(
    (prefs ?? []).map(p => [p.user_id as string, Boolean(p.marketing_consent) && Boolean(p.is_enabled)])
  )

  let queued   = 0
  let skipped  = 0

  for (const target of rows) {
    const uid        = target.recipient_user_id
    const hasConsent = uid ? (consentMap.get(uid) ?? false) : false

    if (!hasConsent) {
      await supabase
        .from('org_ntf_camp_targets_dtl')
        .update({ status: 'SKIPPED', skip_reason: 'NO_MARKETING_CONSENT', processed_at: now, updated_at: now })
        .eq('id', target.id)
      skipped++
      continue
    }

    try {
      let outboxId: string | null = null

      if (campaign.channel_code === 'IN_APP') {
        // IN_APP: write directly to inbox (outbox processor skips IN_APP rows)
        const { data: inboxRow, error: inboxErr } = await supabase
          .from('org_ntf_inbox_mst')
          .insert({
            tenant_org_id:      campaign.tenant_org_id,
            recipient_user_id:  uid,
            event_code:         'campaign.send',
            title:              campaign.name,
            body:               campaign.description ?? campaign.name,
            channel_code:       'IN_APP',
            priority:           'NORMAL',
            source_entity_type: 'campaign',
            source_entity_id:   campaign.id,
            idempotency_key:    `campaign:${campaign.id}:target:${target.id}`,
            rec_status:         1,
          })
          .select('id')
          .single()

        if (inboxErr) throw new Error(inboxErr.message)
        outboxId = inboxRow?.id ?? null
      } else {
        // EMAIL / SMS / WHATSAPP / PUSH: write to outbox
        const { data: outboxRow, error: outboxErr } = await supabase
          .from('org_ntf_outbox_dtl')
          .insert({
            tenant_org_id:     campaign.tenant_org_id,
            recipient_user_id: uid,
            channel_code:      campaign.channel_code,
            event_code:        'campaign.send',
            rendered_body:     campaign.description ?? campaign.name,
            rendered_subject:  campaign.name,
            status:            'QUEUED',
            scheduled_at:      now,
            retry_count:       0,
            max_retries:       3,
            rec_status:        1,
            idempotency_key:   `campaign:${campaign.id}:target:${target.id}`,
          })
          .select('id')
          .single()

        if (outboxErr) throw new Error(outboxErr.message)
        outboxId = outboxRow?.id ?? null
      }

      await supabase
        .from('org_ntf_camp_targets_dtl')
        .update({ status: 'QUEUED', outbox_id: outboxId, processed_at: now, updated_at: now })
        .eq('id', target.id)

      queued++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('process-campaigns: target dispatch failed', err instanceof Error ? err : new Error(msg), {
        targetId: target.id, campaignId: campaign.id, feature: 'notifications-campaigns',
      })
      await supabase
        .from('org_ntf_camp_targets_dtl')
        .update({ status: 'FAILED', skip_reason: msg, processed_at: now, updated_at: now })
        .eq('id', target.id)
    }
  }

  // Update campaign counters
  if (queued > 0 || skipped > 0) {
    await supabase
      .from('org_ntf_campaigns_mst')
      .update({
        sent_count:  campaign.sent_count  + queued,
        skip_count:  campaign.skip_count  + skipped,
        updated_at:  now,
      })
      .eq('id', campaign.id)
      .eq('tenant_org_id', campaign.tenant_org_id)
  }

  // Check if this was the last batch
  const { count: remaining } = await supabase
    .from('org_ntf_camp_targets_dtl')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaign.id)
    .eq('tenant_org_id', campaign.tenant_org_id)
    .eq('status', 'PENDING')

  const done = (remaining ?? 0) === 0
  if (done) await completeCampaign(supabase, campaign, now)

  return { queued, skipped, done }
}

async function completeCampaign(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  campaign: Campaign,
  now: string
): Promise<void> {
  await supabase
    .from('org_ntf_campaigns_mst')
    .update({ status: 'COMPLETED', completed_at: now, updated_at: now })
    .eq('id', campaign.id)
    .eq('tenant_org_id', campaign.tenant_org_id)

  void supabase.from('org_ntf_audit_dtl').insert({
    tenant_org_id: campaign.tenant_org_id,
    entity_type:   'CAMPAIGN',
    entity_id:     campaign.id,
    action_code:   'STATUS_CHANGED',
    old_value:     { status: 'RUNNING' },
    new_value:     { status: 'COMPLETED' },
    performed_by:  'system',
    performed_at:  now,
    rec_status:    1,
    is_active:     true,
  })

  logger.info('process-campaigns: campaign completed', {
    campaignId: campaign.id, tenantId: campaign.tenant_org_id, feature: 'notifications-campaigns',
  })
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminSupabaseClient()
  const now      = new Date().toISOString()

  const stats = {
    activated:         0,
    activationFailed:  0,
    targetsQueued:     0,
    targetsSkipped:    0,
    campaignsCompleted: 0,
    errors:            0,
  }

  // ── Phase A: Activate campaigns due to start ─────────────────────────────

  // Activate APPROVED campaigns whose schedule has arrived (or immediate) + SCHEDULED past their time.
  // Supabase .or() with compound predicates — three branches:
  //   1. APPROVED + no scheduled_at (run immediately)
  //   2. APPROVED + scheduled_at in the past (run on time)
  //   3. SCHEDULED + scheduled_at in the past
  const orFilter = [
    `and(status.eq.APPROVED,scheduled_at.is.null)`,
    `and(status.eq.APPROVED,scheduled_at.lte.${now})`,
    `and(status.eq.SCHEDULED,scheduled_at.lte.${now})`,
  ].join(',')

  const { data: campaignsToActivate, error: activateErr } = await supabase
    .from('org_ntf_campaigns_mst')
    .select('id, tenant_org_id, name, description, channel_code, template_code, target_segment, skip_count, sent_count')
    .or(orFilter)
    .eq('is_active', true)
    .limit(ACTIVATE_BATCH)

  if (activateErr) {
    logger.error('process-campaigns: failed to fetch campaigns to activate', new Error(activateErr.message), {
      feature: 'notifications-campaigns',
    })
  } else {
    const approvedReady = campaignsToActivate ?? []

    for (const campaign of approvedReady) {
      try {
        const result = await activateCampaign(supabase, campaign as Campaign, now)
        if (result.reason) {
          stats.activationFailed++
        } else {
          stats.activated++
        }
      } catch (err) {
        stats.errors++
        logger.error('process-campaigns: activation threw', err instanceof Error ? err : new Error(String(err)), {
          campaignId: campaign.id, feature: 'notifications-campaigns',
        })
      }
    }
  }

  // ── Phase B: Dispatch PENDING targets for RUNNING campaigns ──────────────

  const { data: runningCampaigns, error: runningErr } = await supabase
    .from('org_ntf_campaigns_mst')
    .select('id, tenant_org_id, name, description, channel_code, template_code, target_segment, skip_count, sent_count')
    .eq('status', 'RUNNING')
    .eq('is_active', true)
    .limit(ACTIVATE_BATCH)  // process up to same batch size of concurrent campaigns

  if (runningErr) {
    logger.error('process-campaigns: failed to fetch RUNNING campaigns', new Error(runningErr.message), {
      feature: 'notifications-campaigns',
    })
  } else {
    for (const campaign of (runningCampaigns ?? [])) {
      try {
        const result = await dispatchTargets(supabase, campaign as Campaign, now)
        stats.targetsQueued    += result.queued
        stats.targetsSkipped   += result.skipped
        if (result.done) stats.campaignsCompleted++
      } catch (err) {
        stats.errors++
        logger.error('process-campaigns: dispatch threw', err instanceof Error ? err : new Error(String(err)), {
          campaignId: campaign.id, feature: 'notifications-campaigns',
        })
      }
    }
  }

  logger.info('process-campaigns: run complete', { ...stats, feature: 'notifications-campaigns' })

  return NextResponse.json({ success: true, ...stats })
}
