import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';
import { canCancelOrder } from '@/lib/constants/workflow-cancel-return';
import {
  WorkflowEngineError,
  executeAction,
  type ExecuteActionParams,
  type ExecuteActionResult,
} from '@/lib/services/workflow/workflow-engine.service';

const MIN_REASON_LENGTH = 10;

export class CancelReturnOrchestratorError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus = 400) {
    super(message);
    this.name = 'CancelReturnOrchestratorError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function loadOrderCancelReturnContext(
  tenantId: string,
  orderId: string,
): Promise<{ status: string; preparationStatus: string }> {
  const rows = await prisma.$queryRaw<
    Array<{
      status: string | null;
      current_status: string | null;
      preparation_status: string | null;
    }>
  >`
    SELECT
      status,
      current_status,
      preparation_status
    FROM public.org_orders_mst
    WHERE id = ${orderId}::uuid
      AND tenant_org_id = ${tenantId}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    throw new CancelReturnOrchestratorError('NOT_FOUND', 'Order not found.', 404);
  }
  const status = (row.current_status || row.status || '').trim().toLowerCase();
  const preparationStatus = (row.preparation_status || '').trim().toLowerCase();
  return { status, preparationStatus };
}

/**
 * Cancel path for Workflow Engine V2 (ADR lock):
 * 1) Narrow status eligibility (draft / intake / incomplete preparing)
 * 2) Reason required
 * 3) executeAction → cancelled
 * No automatic Fin unwind — money disposition is explicit via Fin screens.
 *
 * RETURN_ORDER is deferred to V1.1 (sub-order model).
 */
export async function executeCancelOrReturnAction(
  params: ExecuteActionParams,
): Promise<ExecuteActionResult> {
  const action = params.actionCode.trim();
  const input = { ...(params.input ?? {}) };
  const ctx = await loadOrderCancelReturnContext(params.tenantId, params.orderId);

  if (action === WORKFLOW_ACTIONS.CANCEL_ORDER) {
    if (!canCancelOrder(ctx.status, ctx.preparationStatus)) {
      throw new CancelReturnOrchestratorError(
        'CANCEL_NOT_ALLOWED',
        `Order status "${ctx.status || 'unknown'}" cannot be cancelled. Use hold/stop after work starts, or handle money explicitly in Fin. Return is V1.1.`,
        422,
      );
    }

    const reason =
      asTrimmedString(input.cancelled_note) ||
      asTrimmedString(input.notes) ||
      asTrimmedString(input.cancellation_reason);
    if (reason.length < MIN_REASON_LENGTH) {
      throw new CancelReturnOrchestratorError(
        'CANCEL_REASON_REQUIRED',
        `Cancellation reason must be at least ${MIN_REASON_LENGTH} characters.`,
      );
    }
    input.cancelled_note = reason;
    input.notes = reason;
    input.preferredToStatus = 'cancelled';

    return executeAction({ ...params, input });
  }

  if (action === WORKFLOW_ACTIONS.RETURN_ORDER) {
    throw new CancelReturnOrchestratorError(
      'RETURN_DEFERRED_V11',
      'Customer return via RETURN_ORDER is deferred to V1.1 (sub-order). Until then create a normal order with discount/notes.',
      422,
    );
  }

  throw new WorkflowEngineError(
    'ACTION_NOT_ALLOWED',
    `Action "${action}" is not a cancel/return orchestrator action.`,
  );
}

export function isCancelOrReturnAction(actionCode: string): boolean {
  const code = actionCode.trim();
  return code === WORKFLOW_ACTIONS.CANCEL_ORDER || code === WORKFLOW_ACTIONS.RETURN_ORDER;
}
