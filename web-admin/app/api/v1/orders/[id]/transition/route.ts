import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { emitNotificationEvent } from '@lib/notifications/event-emitter';
import {
  WorkflowEngineError,
  executeAction,
} from '@/lib/services/workflow/workflow-engine.service';
import {
  CancelReturnOrchestratorError,
  executeCancelOrReturnAction,
  isCancelOrReturnAction,
} from '@/lib/services/workflow/cancel-return-orchestrator.service';
import { resolveEngineActionCode } from '@/lib/services/workflow/resolve-engine-action-code';
import { prisma } from '@/lib/db/prisma';

const ORDER_STATUS_EVENT: Record<string, string> = {
  ready:     'order.ready',
  cancelled: 'order.cancelled',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * POST /api/v1/orders/[id]/transition
 * Compatibility endpoint that resolves legacy transition fields into an engine action.
 * Requires orders:transition permission; new clients should use POST /actions directly.
 * @param request
 * @param root0
 * @param root0.params
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // Check permission
    const authCheck = await requirePermission('orders:transition')(request);
    if (authCheck instanceof NextResponse) {
      return authCheck; // Permission denied
    }
    const { tenantId, userId, userName } = authCheck;

    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', code: 'INVALID_REQUEST' },
        { status: 400 },
      );
    }
    const nestedInput = isRecord(body.input) ? body.input : {};
    const screen = body.screen;
    const actionCode = resolveEngineActionCode({
      actionCode: body.actionCode,
      screen,
      toStatus: body.toStatus,
      to_status: nestedInput.to_status,
    });
    if (typeof screen !== 'string' || !screen.trim() || !actionCode) {
      return NextResponse.json(
        {
          success: false,
          error: 'Provide screen and a mappable action, or use POST /actions.',
          code: 'WORKFLOW_ENGINE_REQUIRED',
        },
        { status: 400 },
      );
    }

    const idempotencyKey =
      request.headers.get('Idempotency-Key')?.trim() ||
      (typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '') ||
      crypto.randomUUID();

    let expectedStateVersion =
      typeof body.expectedStateVersion === 'number' ? body.expectedStateVersion : null;
    if (expectedStateVersion == null) {
      const rows = await prisma.$queryRaw<Array<{ state_version: bigint | number | null }>>`
        SELECT COALESCE(state_version, 0) AS state_version
        FROM public.org_orders_mst
        WHERE id = ${id}::uuid
          AND tenant_org_id = ${tenantId}::uuid
        LIMIT 1
      `;
      if (!rows[0]) {
        return NextResponse.json(
          { success: false, error: 'Order not found', code: 'NOT_FOUND' },
          { status: 404 },
        );
      }
      expectedStateVersion = Number(rows[0].state_version ?? 0);
    }

    try {
      const execParams = {
        tenantId,
        orderId: id,
        screen: screen.trim(),
        actionCode,
        expectedStateVersion,
        actorUserId: userId,
        actorName: userName,
        input: {
          ...nestedInput,
          notes: body.notes ?? nestedInput.notes,
          preferredToStatus:
            body.toStatus ?? nestedInput.to_status ?? nestedInput.preferredToStatus,
          cancelled_note: nestedInput.cancelled_note,
          cancellation_disposition: nestedInput.cancellation_disposition,
          return_reason: nestedInput.return_reason,
          return_reason_code: nestedInput.return_reason_code,
          rackLocation: nestedInput.rackLocation ?? nestedInput.rack_location,
          metadata: body.metadata ?? nestedInput.metadata,
        },
        idempotencyKey,
      };

      const result = isCancelOrReturnAction(actionCode)
        ? await executeCancelOrReturnAction(execParams)
        : await executeAction(execParams);

      const eventCode = ORDER_STATUS_EVENT[result.currentStatus];
      if (eventCode) {
        void emitNotificationEvent({
          code: eventCode,
          tenantOrgId: tenantId,
          recipientUserIds: [userId],
          sourceEntityType: 'order',
          sourceEntityId: id,
          variables: { order_number: id },
        });
      }

      return NextResponse.json({
        success: true,
        ok: true,
        engine: 'workflow_v2',
        data: {
          order: {
            id,
            status: result.currentStatus,
            currentStatus: result.currentStatus,
            stateVersion: result.stateVersion,
          },
        },
        financialWarnings:
          'financialWarnings' in result ? result.financialWarnings : undefined,
      });
    } catch (error) {
      if (error instanceof CancelReturnOrchestratorError) {
        return NextResponse.json(
          {
            success: false,
            ok: false,
            engine: 'workflow_v2',
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
            engine: 'workflow_v2',
            error: error.message,
            code: error.code,
            blockedReasons: error.blockedReasons,
          },
          { status },
        );
      }
      throw error;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

