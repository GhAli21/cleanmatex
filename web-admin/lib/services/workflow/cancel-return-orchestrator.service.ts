import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';
import {
  canCancelOrder,
  canReturnOrder,
} from '@/lib/constants/workflow-cancel-return';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import {
  CANCEL_DISPOSITIONS,
  type CancelDisposition,
  unwindOrderFinancialsOnCancel,
} from '@/lib/services/order-cancel-financials.service';
import {
  WorkflowEngineError,
  executeAction,
  type ExecuteActionParams,
  type ExecuteActionResult,
} from '@/lib/services/workflow/workflow-engine.service';

const MONEY_EPSILON = 0.001;
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
): Promise<{ status: string; paid: number }> {
  const rows = await prisma.$queryRaw<
    Array<{ status: string | null; current_status: string | null; paid: number }>
  >`
    SELECT
      status,
      current_status,
      COALESCE(total_paid_amount, 0)::float8 AS paid
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
  return { status, paid: Number(row.paid ?? 0) };
}

/**
 * Production cancel/return path for Workflow Engine V2:
 * 1) Status eligibility (cancel ≠ return)
 * 2) Validate reason (+ FN-02 disposition for paid cancels)
 * 3) executeAction (status + audit columns)
 * 4) Financial unwind AFTER cancel status (idempotent)
 */
export async function executeCancelOrReturnAction(
  params: ExecuteActionParams,
): Promise<ExecuteActionResult & { financialWarnings?: string[] }> {
  const action = params.actionCode.trim();
  const input = { ...(params.input ?? {}) };
  const ctx = await loadOrderCancelReturnContext(params.tenantId, params.orderId);

  if (action === WORKFLOW_ACTIONS.CANCEL_ORDER) {
    if (!canCancelOrder(ctx.status)) {
      throw new CancelReturnOrchestratorError(
        'CANCEL_NOT_ALLOWED',
        `Order status "${ctx.status || 'unknown'}" cannot be cancelled. Use customer return after delivered/closed, or the order is already terminal.`,
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

    let disposition: CancelDisposition | undefined;
    if (ctx.paid > MONEY_EPSILON) {
      const requested = asTrimmedString(input.cancellation_disposition).toUpperCase();
      if (!Object.values(CANCEL_DISPOSITIONS).includes(requested as CancelDisposition)) {
        throw new CancelReturnOrchestratorError(
          'CANCEL_DISPOSITION_REQUIRED',
          'This order has collected payments. Choose a disposition (refund, store credit, or keep on account) to cancel it.',
        );
      }
      disposition = requested as CancelDisposition;
      if (disposition === CANCEL_DISPOSITIONS.KEEP_ON_ACCOUNT) {
        const canKeep = await hasPermissionServer('orders:approve_refund');
        if (!canKeep) {
          throw new CancelReturnOrchestratorError(
            'PERMISSION_DENIED',
            'Keeping collected money on a cancelled order requires refund-approval permission.',
            403,
          );
        }
      }
      input.cancellation_disposition = disposition;
    }

    const result = await executeAction({ ...params, input });

    const unwind = await unwindOrderFinancialsOnCancel({
      tenantId: params.tenantId,
      orderId: params.orderId,
      userId: params.actorUserId,
      disposition,
      reason,
    });

    return { ...result, financialWarnings: unwind.warnings };
  }

  if (action === WORKFLOW_ACTIONS.RETURN_ORDER) {
    if (!canReturnOrder(ctx.status)) {
      throw new CancelReturnOrchestratorError(
        'RETURN_NOT_ALLOWED',
        `Order status "${ctx.status || 'unknown'}" cannot be returned. Customer return is only for delivered or closed orders.`,
        422,
      );
    }

    const reason =
      asTrimmedString(input.return_reason) ||
      asTrimmedString(input.cancelled_note) ||
      asTrimmedString(input.notes);
    if (reason.length < MIN_REASON_LENGTH) {
      throw new CancelReturnOrchestratorError(
        'RETURN_REASON_REQUIRED',
        `Return reason must be at least ${MIN_REASON_LENGTH} characters.`,
      );
    }
    input.return_reason = reason;
    input.notes = reason;
    // Catalog terminal is `returned` (never map return → cancelled under V2).
    input.preferredToStatus = 'returned';

    return executeAction({ ...params, input });
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
