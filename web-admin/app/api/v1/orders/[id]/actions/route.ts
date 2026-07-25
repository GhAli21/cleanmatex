import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { ExecuteWorkflowActionRequestSchema } from '@/lib/validations/workflow-schema';
import {
  WorkflowEngineError,
  executeAction,
} from '@/lib/services/workflow/workflow-engine.service';
import {
  CancelReturnOrchestratorError,
  executeCancelOrReturnAction,
  isCancelOrReturnAction,
} from '@/lib/services/workflow/cancel-return-orchestrator.service';

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
