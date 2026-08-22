import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { ExecuteWorkflowActionRequestSchema } from '@/lib/validations/workflow-schema';
import { httpStatusForWorkflowEngineError } from '@/lib/api/workflow-engine-http';
import {
  WorkflowEngineError,
  executeAction,
} from '@/lib/services/workflow/workflow-engine.service';
import {
  CancelReturnOrchestratorError,
  executeCancelOrReturnAction,
  isCancelOrReturnAction,
} from '@/lib/services/workflow/cancel-return-orchestrator.service';
import {
  STAFF_DELIVERY_STAGE_COMMAND_ERROR,
  isStaffDeliveryBypassAction,
} from '@/lib/services/delivery/staff-delivery-command-guard';

/**
 * POST /api/v1/orders/[id]/actions
 *
 * Execute a workflow action with optimistic concurrency (expectedStateVersion)
 * and mandatory Idempotency-Key header. Requires orders:transition permission.
 * Cancel/return go through Fin-aware orchestrator.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authCheck = await requirePermission('orders:transition')(request);
    if (authCheck instanceof NextResponse) {
      return authCheck;
    }
    const { tenantId, userId, userName } = authCheck;
    const { id: orderId } = await params;

    const idempotencyKey = request.headers.get('Idempotency-Key')?.trim();
    if (!idempotencyKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Idempotency-Key header is required',
          code: 'IDEMPOTENCY_KEY_REQUIRED',
        },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = ExecuteWorkflowActionRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    // Staff delivery needs POD, stop, and route writes in one transaction.
    // Public confirm-received uses a dedicated service, not this adapter.
    if (isStaffDeliveryBypassAction(parsed.data.actionCode)) {
      return NextResponse.json(STAFF_DELIVERY_STAGE_COMMAND_ERROR, { status: 403 });
    }

    const execParams = {
      tenantId,
      orderId,
      screen: parsed.data.screen,
      actionCode: parsed.data.actionCode,
      expectedStateVersion: parsed.data.expectedStateVersion,
      actorUserId: userId,
      actorName: userName,
      input: parsed.data.input,
      idempotencyKey,
      gateDecisions: parsed.data.gateDecisions,
    };

    const result = isCancelOrReturnAction(parsed.data.actionCode)
      ? await executeCancelOrReturnAction(execParams)
      : await executeAction(execParams);

    return NextResponse.json({
      success: true,
      ok: result.ok,
      orderId,
      currentStatus: result.currentStatus,
      stateVersion: result.stateVersion,
      blockedReasons: result.blockedReasons,
      financialWarnings:
        'financialWarnings' in result ? result.financialWarnings : undefined,
      effects: ['history', 'outbox'],
    });
  } catch (error) {
    if (error instanceof CancelReturnOrchestratorError) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          error: error.message,
          code: error.code,
        },
        { status: error.httpStatus },
      );
    }

    if (error instanceof WorkflowEngineError) {
      const status = httpStatusForWorkflowEngineError(error.code);

      return NextResponse.json(
        {
          success: false,
          ok: false,
          error: error.message,
          code: error.code,
          blockedReasons: error.blockedReasons,
        },
        { status },
      );
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 500;
    return NextResponse.json({ success: false, ok: false, error: message }, { status });
  }
}
