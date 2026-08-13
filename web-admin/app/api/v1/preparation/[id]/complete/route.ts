/**
 * Preparation: Complete preparation for an order
 * POST /api/v1/preparation/[id]/complete
 *
 * Uses WorkflowEngine COMPLETE_PREPARATION (processing, not sorting).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { completePreparation } from '@/lib/db/orders';
import { isPreparationEnabled } from '@/lib/config/features';
import { requireTenantAuth } from '@/lib/middleware/tenant-guard';
import { validateCSRF } from '@/lib/middleware/csrf';
import {
  WorkflowEngineError,
  executeAction,
  listAvailableActions,
} from '@/lib/services/workflow/workflow-engine.service';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

export const runtime = 'nodejs';

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
  try {
    const csrfResponse = await validateCSRF(request);
    if (csrfResponse) {
      return csrfResponse;
    }

    if (!isPreparationEnabled()) {
      return NextResponse.json({ success: false, error: 'Feature disabled' }, { status: 403 });
    }

    const auth = await requireTenantAuth('orders:update')(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { tenantId, userId } = auth;
    const { id: orderId } = await params;
    const body = await request.json().catch(() => ({}));
    const { readyByOverride, internalNotes } = body || {};

    const supabase = await createClient();
    const { data: order, error: fetchError } = await supabase
      .from('org_orders_mst')
      .select('id')
      .eq('id', orderId)
      .eq('tenant_org_id', tenantId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Domain prep completion (photos/notes/ready_by) — always
    await completePreparation(tenantId, orderId, userId, {
      readyByOverride: readyByOverride ? new Date(readyByOverride) : undefined,
      internalNotes,
    });

    const idempotencyKey =
      request.headers.get('Idempotency-Key')?.trim() ||
      (typeof body?.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '') ||
      `prep-complete:${orderId}:${userId}`;

    const available = await listAvailableActions({
      tenantId,
      orderId,
      screen: 'preparation',
    });

    const expectedStateVersion =
      typeof body?.expectedStateVersion === 'number'
        ? body.expectedStateVersion
        : available.stateVersion;

    const result = await executeAction({
      tenantId,
      orderId,
      screen: 'preparation',
      actionCode: WORKFLOW_ACTIONS.COMPLETE_PREPARATION,
      expectedStateVersion,
      actorUserId: userId,
      input: {
        readyByOverride: readyByOverride ?? null,
        internalNotes: internalNotes ?? null,
      },
      idempotencyKey,
    });

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        status: result.currentStatus,
        currentStatus: result.currentStatus,
        stateVersion: result.stateVersion,
        preparation_status: 'completed',
        engine: 'workflow_v2',
      },
    });
  } catch (error) {
    if (error instanceof WorkflowEngineError) {
      const status =
        error.code === 'NOT_FOUND'
          ? 404
          : error.code === 'VERSION_CONFLICT' || error.code === 'IDEMPOTENCY_CONFLICT'
            ? 409
            : error.code === 'GATE_FAILED'
              ? 422
              : error.code === 'ACTION_NOT_ALLOWED'
                ? 403
                : 400;
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          blockedReasons: error.blockedReasons,
        },
        { status },
      );
    }

    console.error('POST /api/v1/preparation/[id]/complete error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
