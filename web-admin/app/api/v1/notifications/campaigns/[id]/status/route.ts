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
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/middleware/require-permission'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'

const TERMINAL_STATES = new Set(['COMPLETED', 'FAILED', 'CANCELLED'])

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
    .select('id, status, tenant_org_id')
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
  const now = new Date().toISOString()
  const updatePayload: Record<string, unknown> = {
    status:     targetStatus,
    updated_at: now,
    updated_by: userId,
  }

  if (targetStatus === 'APPROVED') {
    updatePayload.approved_by   = userId
    updatePayload.approved_at   = now
    updatePayload.approval_notes = approval_notes ?? null
  }
  if (targetStatus === 'RUNNING') {
    updatePayload.started_at = now
  }
  if (targetStatus === 'SCHEDULED') {
    if (!scheduled_at) {
      return NextResponse.json(
        { success: false, error: 'scheduled_at is required when transitioning to SCHEDULED' },
        { status: 400 }
      )
    }
    updatePayload.scheduled_at = scheduled_at
  }
  if (targetStatus === 'PAUSED') {
    updatePayload.paused_at = now
  }
  if (targetStatus === 'CANCELLED') {
    updatePayload.cancelled_at = now
  }

  const { data: updated, error: updateError } = await supabase
    .from('org_ntf_campaigns_mst')
    .update(updatePayload)
    .eq('id', id)
    .eq('tenant_org_id', tenantId)
    .select()
    .single()

  if (updateError) {
    logger.error('PATCH /api/v1/notifications/campaigns/[id]/status failed', new Error(updateError.message), {
      tenantId, campaignId: id, from: currentStatus, to: targetStatus, feature: 'notifications-campaigns',
    })
    return NextResponse.json({ success: false, error: 'Failed to update campaign status' }, { status: 500 })
  }

  // Write to audit log (fire-and-forget — non-blocking)
  void supabase.from('org_ntf_audit_dtl').insert({
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
  })

  return NextResponse.json({ success: true, data: updated })
}
