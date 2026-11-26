import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  claimIdempotencyKey,
  deleteIdempotencyHash,
  hashPayload,
} from '@/lib/utils/idempotency';
import {
  executeAction,
  type ExecuteActionResult,
  type PrismaTransactionClient,
} from '@/lib/services/workflow/workflow-engine.service';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

const PREPARATION_COMPLETE_IDEMPOTENCY_RESOURCE = 'preparation_complete';
const PREPARATION_SCREEN = 'preparation';

/** Stable errors exposed by the stage-owned Preparation completion command. */
export type PreparationCompletionErrorCode =
  | 'ORDER_NOT_FOUND'
  | 'PREPARATION_NOT_ACTIVE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'IDEMPOTENCY_IN_FLIGHT';

/**
 * Keeps HTTP adapters independent from database/engine implementation details.
 */
export class PreparationCompletionError extends Error {
  /** Machine-readable classification shared by web, mobile, and integrations. */
  readonly code: PreparationCompletionErrorCode;
  /** HTTP status aligned to retry semantics. */
  readonly httpStatus: number;

  /**
   * @param code stable error classification
   * @param message safe consumer-facing explanation
   * @param httpStatus corresponding transport status
   */
  constructor(code: PreparationCompletionErrorCode, message: string, httpStatus: number) {
    super(message);
    this.name = 'PreparationCompletionError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** Authenticated input for the Preparation completion command. */
export interface CompletePreparationCommand {
  /** Tenant is always resolved by the authenticated adapter, never the browser body. */
  tenantId: string;
  orderId: string;
  actorUserId: string;
  actorName?: string;
  expectedStateVersion: number;
  idempotencyKey: string;
  readyByOverride?: Date;
  internalNotes?: string;
}

/** Replay-safe outcome of the Preparation completion command. */
export interface CompletePreparationResult {
  orderId: string;
  /** ISO timestamp of the preserved (or explicitly updated) ready-by promise, or null if unset. */
  readyBy: string | null;
  workflow: ExecuteActionResult;
}

type LockedPreparationOrder = {
  id: string;
  preparation_status: string | null;
  ready_by_at: Date | null;
};

function normalisePreparationStatus(value: string | null): string {
  return value?.trim().toLowerCase() ?? '';
}

async function loadReplay(
  tenantId: string,
  idempotencyKey: string,
): Promise<CompletePreparationResult | null> {
  const row = await prisma.org_idempotency_keys.findFirst({
    where: {
      tenant_org_id: tenantId,
      key: idempotencyKey,
      resource_type: PREPARATION_COMPLETE_IDEMPOTENCY_RESOURCE,
    },
    select: { response_cache: true },
  });
  const cache = row?.response_cache as { result?: CompletePreparationResult } | null;
  return cache?.result ?? null;
}

async function lockPreparationOrder(
  tx: PrismaTransactionClient,
  tenantId: string,
  orderId: string,
): Promise<LockedPreparationOrder> {
  const rows = await tx.$queryRaw<LockedPreparationOrder[]>`
    SELECT id, preparation_status, ready_by_at
    FROM public.org_orders_mst
    WHERE id = ${orderId}::uuid
      AND tenant_org_id = ${tenantId}::uuid
    FOR UPDATE
  `;
  const order = rows[0];
  if (!order) {
    throw new PreparationCompletionError('ORDER_NOT_FOUND', 'Order was not found.', 404);
  }
  return order;
}

/**
 * Completes preparation and advances its workflow action in one transaction.
 *
 * @param params authenticated, tenant-scoped command input
 * @returns replay-safe completion result
 * @throws {PreparationCompletionError} for stable stage command failures
 * @example
 * await completePreparationCommand({ tenantId, orderId, actorUserId, expectedStateVersion: 2, idempotencyKey: 'prep-123' });
 */
export async function completePreparationCommand(
  params: CompletePreparationCommand,
): Promise<CompletePreparationResult> {
  const payloadHash = hashPayload({
    orderId: params.orderId,
    expectedStateVersion: params.expectedStateVersion,
    readyByOverride: params.readyByOverride?.toISOString(),
    internalNotes: params.internalNotes?.trim(),
  });
  const claim = await claimIdempotencyKey(
    params.tenantId,
    params.idempotencyKey,
    PREPARATION_COMPLETE_IDEMPOTENCY_RESOURCE,
    payloadHash,
  );
  if (claim.status === 'CONFLICT') {
    throw new PreparationCompletionError(
      'IDEMPOTENCY_CONFLICT',
      'This idempotency key belongs to a different preparation request.',
      409,
    );
  }
  if (claim.status === 'IN_FLIGHT') {
    throw new PreparationCompletionError(
      'IDEMPOTENCY_IN_FLIGHT',
      'Preparation completion is already being processed. Retry shortly with the same key.',
      409,
    );
  }
  if (claim.status === 'COMPLETED') {
    const replay = await loadReplay(params.tenantId, params.idempotencyKey);
    if (replay) return replay;
    throw new PreparationCompletionError(
      'IDEMPOTENCY_IN_FLIGHT',
      'Preparation completion is still finalizing. Retry shortly with the same key.',
      409,
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const order = await lockPreparationOrder(tx, params.tenantId, params.orderId);
      const preparationStatus = normalisePreparationStatus(order.preparation_status);
      if (!['pending', 'in_progress'].includes(preparationStatus)) {
        throw new PreparationCompletionError(
          'PREPARATION_NOT_ACTIVE',
          'Preparation is not active for this order.',
          422,
        );
      }

      // Ready-by is an explicit customer promise set by the user (direct entry or
      // Calculate button via the Commercial/Business-Calendar resolver). Never
      // auto-recalculate or silently overwrite order.ready_by_at on completion.
      const effectiveReadyBy = params.readyByOverride ?? order.ready_by_at ?? null;
      if (params.readyByOverride !== undefined || params.internalNotes !== undefined) {
        const now = new Date();
        const stageUpdate = await tx.org_orders_mst.updateMany({
          where: { id: params.orderId, tenant_org_id: params.tenantId },
          data: {
            ...(params.readyByOverride !== undefined && { ready_by_at: params.readyByOverride }),
            ...(params.internalNotes !== undefined && { internal_notes: params.internalNotes.trim() }),
            updated_at: now,
            updated_by: params.actorUserId,
          },
        });
        if (stageUpdate.count !== 1) {
          throw new PreparationCompletionError('ORDER_NOT_FOUND', 'Order was not found.', 404);
        }
      }

      const workflow = await executeAction({
        tenantId: params.tenantId,
        orderId: params.orderId,
        screen: PREPARATION_SCREEN,
        actionCode: WORKFLOW_ACTIONS.COMPLETE_PREPARATION,
        expectedStateVersion: params.expectedStateVersion,
        actorUserId: params.actorUserId,
        actorName: params.actorName ?? 'Preparation Service',
        input: {
          readyByOverride: params.readyByOverride?.toISOString() ?? null,
          internalNotes: params.internalNotes?.trim() ?? null,
        },
        idempotencyKey: `preparation:${params.idempotencyKey}`,
      }, tx);

      const result: CompletePreparationResult = {
        orderId: params.orderId,
        readyBy: effectiveReadyBy ? effectiveReadyBy.toISOString() : null,
        workflow,
      };
      await tx.org_idempotency_keys.updateMany({
        where: {
          tenant_org_id: params.tenantId,
          key: params.idempotencyKey,
          resource_type: PREPARATION_COMPLETE_IDEMPOTENCY_RESOURCE,
        },
        data: {
          resource_id: params.orderId,
          response_cache: {
            payload_hash: payloadHash,
            result,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return result;
    });
  } catch (error) {
    // No partial stage update can survive the transaction rollback, so a caller
    // can correct its request and reuse this key without an orphaned claim.
    await deleteIdempotencyHash(
      params.tenantId,
      params.idempotencyKey,
      PREPARATION_COMPLETE_IDEMPOTENCY_RESOURCE,
    );
    throw error;
  }
}
