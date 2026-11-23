/**
 * PATCH /api/v1/notifications/campaigns/[id]/status
 * Campaign state machine transitions.
 *
 * Allowed transitions:
 *   DRAFT             → PENDING_APPROVAL   (notifications:manage)
 *   DRAFT             → CANCELLED          (notifications:manage)
 *   PENDING_APPROVAL  → APPROVED           (notifications:configure — admin only)
 *   PENDING_APPROVAL  → DRAFT              (notifications:configure — admin sends back)
 *   PENDING_APPROVAL  → CANCELLED          (notifications:configure)
 *   APPROVED          → RUNNING            (notifications:configure — start immediately)
 *   APPROVED          → SCHEDULED          (notifications:configure — schedule for later)
 *   APPROVED          → CANCELLED          (notifications:configure)
 *   SCHEDULED         → CANCELLED          (notifications:configure)
 *   RUNNING           → PAUSED             (notifications:configure)
 *   PAUSED            → RUNNING            (notifications:configure — resume)
 *   PAUSED            → CANCELLED          (notifications:configure)
 *
 * COMPLETED, FAILED, CANCELLED are terminal — no transitions allowed.
 *
 * APPROVED, SCHEDULED and RUNNING (start now or resume) queue an `ntf.campaign_start` job in the same
 * transaction as the status change (cmx-workers sends the campaign; Background Jobs STEP5_PLAN item 4).
 */

import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { withTenantContext } from '@/lib/db/tenant-context'
import { queueCampaignStartTx } from '@/lib/notifications/campaign-jobs.service'
import { requirePermission } from '@/lib/middleware/require-permission'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'

const TERMINAL_STATES = new Set(['COMPLETED', 'FAILED', 'CANCELLED'])
/** Statuses that hand the campaign to the sender (cmx-workers ntf.campaign_start). */
const START_STATES = new Set(['APPROVED', 'SCHEDULED', 'RUNNING'])

// Transitions any role with notifications:manage can make
const MANAGE_TRANSITIONS: Record<string, string[]> = {
  DRAFT:            ['PENDING_APPROVAL', 'CANCELLED'],
}

// Transitions requiring notifications:configure (admin)
const CONFIGURE_TRANSITIONS: Record<string, string[]> = {
  PENDING_APPROVAL: ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED:         ['RUNNING', 'SCHEDULED', 'CANCELLED'],
  SCHEDULED:        ['CANCELLED'],
  RUNNING:          ['PAUSED'],
  PAUSED:           ['RUNNING', 'CANCELLED'],
}

const statusTransitionSchema = z.object({
  status:          z.string(),
  approval_notes:  z.string().optional(),
  scheduled_at:    z.string().datetime().optional(),
})

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // All status transitions require at minimum notifications:manage
  const authCheck = await requirePermission('notifications:manage')(request)
  if (authCheck instanceof NextResponse) return authCheck

  const { tenantId, userId } = authCheck
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = statusTransitionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { status: targetStatus, approval_notes, scheduled_at } = parsed.data

  const supabase = createAdminSupabaseClient()

  // Fetch current campaign state
  const { data: campaign, error: fetchError } = await supabase
    .from('org_ntf_campaigns_mst')
    .select('id, status, tenant_org_id, scheduled_at')
    .eq('id', id)
    .eq('tenant_org_id', tenantId)
    .eq('is_active', true)
    .single()

  if (fetchError || !campaign) {
    return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
  }

  const currentStatus = campaign.status as string

  if (TERMINAL_STATES.has(currentStatus)) {
    return NextResponse.json(
      { success: false, error: `Campaign is in terminal state ${currentStatus} — no further transitions allowed` },
      { status: 409 }
    )
  }

  // Determine which permission level is required for this transition
  const isManageTransition   = (MANAGE_TRANSITIONS[currentStatus]    ?? []).includes(targetStatus)
  const isConfigureTransition = (CONFIGURE_TRANSITIONS[currentStatus] ?? []).includes(targetStatus)

  if (!isManageTransition && !isConfigureTransition) {
    return NextResponse.json(
      { success: false, error: `Transition from ${currentStatus} to ${targetStatus} is not allowed` },
      { status: 422 }
    )
  }

  // Configure transitions require elevated permission — check separately
  if (isConfigureTransition) {
    const configCheck = await requirePermission('notifications:configure')(request)
    if (configCheck instanceof NextResponse) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions — notifications:configure required for this transition' },
        { status: 403 }
      )
    }
  }

  // Build the update payload
  const now = new Date()
  const updatePayload: Prisma.org_ntf_campaigns_mstUpdateManyMutationInput = {
    status:     targetStatus,
    updated_at: now,
    updated_by: userId,
  }

  if (targetStatus === 'APPROVED') {
    updatePayload.approved_by   = userId
    updatePayload.approved_at   = now
    updatePayload.approval_notes = approval_notes ?? null
  }
  if (targetStatus === 'RUNNING' && currentStatus !== 'PAUSED') {
    updatePayload.started_at = now // a resume keeps the first start time
  }
  if (targetStatus === 'SCHEDULED') {
    if (!scheduled_at) {
      return NextResponse.json(
        { success: false, error: 'scheduled_at is required when transitioning to SCHEDULED' },
        { status: 400 }
      )
    }
    updatePayload.scheduled_at = new Date(scheduled_at)
  }
  if (targetStatus === 'PAUSED') {
    updatePayload.paused_at = now
  }
  if (targetStatus === 'CANCELLED') {
    updatePayload.cancelled_at = now
  }

  // Status change, start job and audit row commit together. The update only applies while the status
  // is still the one read above, so two concurrent transitions cannot both win.
  let changed: boolean
  try {
    changed = await withTenantContext(tenantId, () => prisma.$transaction(async (tx) => {
      const { count } = await tx.org_ntf_campaigns_mst.updateMany({
        where: { id, tenant_org_id: tenantId, status: currentStatus, is_active: true },
        data:  updatePayload,
      })
      if (count !== 1) return false
      if (START_STATES.has(targetStatus)) {
        const sendAt = targetStatus === 'RUNNING' ? null
          : targetStatus === 'SCHEDULED' ? new Date(scheduled_at as string)
          : campaign.scheduled_at ? new Date(campaign.scheduled_at.endsWith('Z') ? campaign.scheduled_at : `${campaign.scheduled_at}Z`) : null // stored as UTC without zone
        await queueCampaignStartTx(tx, tenantId, id, sendAt)
      }
      await tx.org_ntf_audit_dtl.create({
        data: {
          tenant_org_id: tenantId,
          entity_type:   'CAMPAIGN',
          entity_id:     id,
          action_code:   'STATUS_CHANGED',
          old_value:     { status: currentStatus },
          new_value:     { status: targetStatus },
          change_reason: approval_notes ?? null,
          performed_by:  userId,
          performed_at:  now,
          rec_status:    1,
          is_active:     true,
        },
      })
      return true
    }))
  } catch (err) {
    logger.error('PATCH /api/v1/notifications/campaigns/[id]/status failed', err instanceof Error ? err : new Error(String(err)), {
      tenantId, campaignId: id, from: currentStatus, to: targetStatus, feature: 'notifications-campaigns',
    })
    return NextResponse.json({ success: false, error: 'Failed to update campaign status' }, { status: 500 })
  }
  if (!changed) {
    return NextResponse.json({ success: false, error: 'Campaign status changed meanwhile — reload and try again' }, { status: 409 })
  }

  const { data: updated } = await supabase
    .from('org_ntf_campaigns_mst')
    .select('*')
    .eq('id', id)
    .eq('tenant_org_id', tenantId)
    .single()

  return NextResponse.json({ success: true, data: updated })
}
