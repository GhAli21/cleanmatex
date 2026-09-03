import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/server-auth'
import { logger } from '@/lib/utils/logger'
import {
  loadSemanticWorkflowArtifactForOrder,
  SemanticWorkflowArtifactError,
} from '@/lib/services/workflow/semantic-workflow-artifact.service'
import { deriveSemanticWorkflowContext } from '@/lib/services/workflow/semantic-workflow-context.service'
import { WORKFLOW_PROFILE_STAFF_EN } from '@/lib/services/workflow/workflow-profile-error-catalog'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/orders/[id]/workflow-context
 *
 * Session-authenticated, tenant-scoped. Display-only context is projected
 * from the order's live profile-version policy, never from a compiled artifact.
 *
 * Metrics are not loaded here — callers already have order items in UI state.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    // Tenant is resolved server-side from the authenticated session.
    const { tenantId } = await getAuthContext()
    const supabase = await createClient()

    const { data: order, error: orderError } = await supabase
      .from('org_orders_mst')
      .select('id, wf_profile_id, wf_version_no, wf_profile_version_id, wf_profile_artifact_id, wf_profile_revision, wf_profile_checksum, wf_profile_schema_version')
      .eq('id', orderId)
      .eq('tenant_org_id', tenantId)
      .maybeSingle()

    if (orderError) {
      logger.error(
        'workflow-context order lookup failed',
        new Error(orderError.message),
        { tenantId, orderId, feature: 'workflow', action: 'workflow_context' }
      )
      return NextResponse.json({ error: 'Failed to load order' }, { status: 500 })
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    try {
      const artifact = await loadSemanticWorkflowArtifactForOrder({
        wf_profile_id: order.wf_profile_id ?? null,
        wf_version_no: order.wf_version_no ?? null,
        wf_profile_version_id: order.wf_profile_version_id ?? null,
        wf_profile_artifact_id: order.wf_profile_artifact_id ?? null,
        wf_profile_revision: order.wf_profile_revision ?? null,
        wf_profile_checksum: order.wf_profile_checksum ?? null,
        wf_profile_schema_version: order.wf_profile_schema_version ?? null,
      })
      if (artifact) {
        const context = deriveSemanticWorkflowContext(artifact)
        return NextResponse.json({
          orderId,
          flags: {
            template_id: null,
            template_code: null,
            template_name: null,
            template_version_number: null,
            is_tenant_default: false,
            allow_back_steps: false,
            assembly_enabled: context.assemblyEnabled,
            qa_enabled: context.qaEnabled,
            packing_enabled: context.packingEnabled,
            semantic_profile: {
              profile_id: context.profileId,
              profile_version_no: context.profileVersionNo,
              policy_revision: context.policyRevision,
              enabled_screen_keys: context.enabledScreenKeys,
              primary_owner_screen_keys: context.primaryOwnerScreenKeys,
            },
          },
        })
      }
    } catch (error) {
      if (error instanceof SemanticWorkflowArtifactError) {
        logger.error(
          'workflow-context semantic artifact lookup failed',
          error,
          { tenantId, orderId, code: error.code, feature: 'workflow', action: 'workflow_context' },
        )
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: 409 },
        )
      }
      throw error
    }

    return NextResponse.json(
      {
        error: WORKFLOW_PROFILE_STAFF_EN.PROFILE_SNAPSHOT_INCOMPLETE,
        code: 'PROFILE_SNAPSHOT_INCOMPLETE',
      },
      { status: 409 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = /unauthorized/i.test(message) ? 401 : 500
    if (status >= 500) {
      logger.error(
        'GET /api/v1/orders/[id]/workflow-context failed',
        error instanceof Error ? error : new Error(message),
        { feature: 'workflow', action: 'workflow_context' }
      )
    }
    return NextResponse.json(
      { error: status === 401 ? 'Unauthorized' : 'Internal server error' },
      { status }
    )
  }
}
