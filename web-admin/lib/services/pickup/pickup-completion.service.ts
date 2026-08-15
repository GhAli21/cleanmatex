import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';
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
import { SETTLEMENT_TYPE_CODES } from '@/lib/constants/order-financial';

const PICKUP_COMPLETE_IDEMPOTENCY_RESOURCE = 'pickup_complete';
const PICKUP_HANDOVER_SCREEN = 'pickup_handover';

/** Stable failure codes for all staff, mobile, and integration pickup consumers. */
export type PickupCompletionErrorCode =
  | 'ORDER_NOT_FOUND'
  | 'ORDER_NOT_READY'
  | 'PICKUP_RELEASE_REQUIRED'
  | 'PICKUP_COLLECTION_REQUIRED'
  | 'PICKUP_PARTIAL_RELEASE_UNSUPPORTED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'IDEMPOTENCY_IN_FLIGHT';

/**
 * Transport-neutral pickup completion failure.
 *
 * The API adapter maps this stable code to HTTP without exposing database details.
 */
export class PickupCompletionError extends Error {
  /** Machine-readable result shared by every pickup adapter. */
  readonly code: PickupCompletionErrorCode;
  /** Retry-safe HTTP mapping for the versioned API. */
  readonly httpStatus: number;

  /**
   * @param code stable pickup failure classification
   * @param message safe operator-facing message
   * @param httpStatus HTTP status for the API adapter
   */
  constructor(code: PickupCompletionErrorCode, message: string, httpStatus: number) {
    super(message);
    this.name = 'PickupCompletionError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** Authenticated, tenant-scoped input for the physical pickup command. */
export interface CompletePickupCommand {
  /** Resolved on the server from the authenticated request; never supplied by the client. */
  tenantId: string;
  orderId: string;
  actorUserId: string;
  actorName?: string;
  expectedStateVersion: number;
  idempotencyKey: string;
  handoverNotes?: string;
  /** Public confirmation may only fulfil an already released pickup order. */
  requireReleasedPickup?: boolean;
}

/** Replay-safe outcome for a completed pickup handover. */
export interface CompletePickupResult {
  orderId: string;
  releaseIds: string[];
  workflow: ExecuteActionResult;
}

interface LockedPickupOrder {
  id: string;
  current_status: string | null;
  payment_type_code: string | null;
  outstanding_amount: number | string | null;
}

interface LockedRelease {
  id: string;
  release_type: string;
  release_status: string;
  has_release_lines: boolean;
}

type PickupHandoverMode = 'direct' | 'released';

function normaliseStatus(value: string | null): string {
  return value?.trim().toLowerCase() ?? '';
}

function normalisePaymentType(value: string | null): string {
  return value?.trim().toUpperCase() ?? '';
}

async function loadReplay(
  tenantId: string,
  idempotencyKey: string,
): Promise<CompletePickupResult | null> {
  const row = await prisma.org_idempotency_keys.findFirst({
    where: {
      tenant_org_id: tenantId,
      key: idempotencyKey,
      resource_type: PICKUP_COMPLETE_IDEMPOTENCY_RESOURCE,
    },
    select: { response_cache: true },
  });
  const cache = row?.response_cache as { result?: CompletePickupResult } | null;
  return cache?.result ?? null;
}

async function lockPickupOrder(
  tx: PrismaTransactionClient,
  tenantId: string,
  orderId: string,
): Promise<LockedPickupOrder> {
  const rows = await tx.$queryRaw<LockedPickupOrder[]>`
    SELECT id, current_status, payment_type_code, outstanding_amount
    FROM public.org_orders_mst
    WHERE id = ${orderId}::uuid
      AND tenant_org_id = ${tenantId}::uuid
    FOR UPDATE
  `;
  const order = rows[0];
  if (!order) {
    throw new PickupCompletionError('ORDER_NOT_FOUND', 'Order was not found.', 404);
  }
  return order;
}

async function lockReleasedPickupRecords(
  tx: PrismaTransactionClient,
  tenantId: string,
  orderId: string,
): Promise<LockedRelease[]> {
  return tx.$queryRaw<LockedRelease[]>`
    SELECT
      r.id,
      r.release_type,
      r.release_status,
      EXISTS (
        SELECT 1
        FROM public.org_wf_release_ln l
        WHERE l.release_id = r.id
          AND l.tenant_org_id = r.tenant_org_id
          AND COALESCE(l.rec_status, 1) = 1
          AND l.qty_released > 0
      ) AS has_release_lines
    FROM public.org_wf_release_mst r
    WHERE r.tenant_org_id = ${tenantId}::uuid
      AND r.order_id = ${orderId}::uuid
      AND r.release_status = 'released'
      AND r.release_type IN ('pickup', 'partial')
      AND COALESCE(r.rec_status, 1) = 1
    FOR UPDATE
  `;
}

async function fulfilPickupReleases(
  tx: PrismaTransactionClient,
  params: CompletePickupCommand,
  records: LockedRelease[],
  handoverMode: PickupHandoverMode,
  now: Date,
): Promise<string[]> {
  if (records.some((record) => record.release_type === 'partial' || record.has_release_lines)) {
    throw new PickupCompletionError(
      'PICKUP_PARTIAL_RELEASE_UNSUPPORTED',
      'This order has an open partial release and requires item-level fulfilment.',
      422,
    );
  }

  const notes = params.handoverNotes?.trim() || null;
  const pickupIds = records
    .filter((record) => record.release_type === 'pickup')
    .map((record) => record.id);

  if (handoverMode === 'released' && pickupIds.length === 0) {
    throw new PickupCompletionError(
      'PICKUP_RELEASE_REQUIRED',
      'This order is not yet available for pickup.',
      422,
    );
  }

  if (pickupIds.length === 0) {
    const created = await tx.$queryRaw<Array<{ id: string }>>`
      INSERT INTO public.org_wf_release_mst (
        tenant_org_id,
        order_id,
        release_type,
        release_status,
        state_version_at,
        released_at,
        released_by,
        fulfilled_at,
        fulfilled_by,
        fulfillment_notes,
        created_by,
        updated_at,
        updated_by
      ) VALUES (
        ${params.tenantId}::uuid,
        ${params.orderId}::uuid,
        'pickup',
        'fulfilled',
        ${params.expectedStateVersion + 1},
        ${now},
        ${params.actorUserId}::uuid,
        ${now},
        ${params.actorUserId}::uuid,
        ${notes},
        ${params.actorUserId}::uuid,
        ${now},
        ${params.actorUserId}::uuid
      )
      RETURNING id
    `;
    return created.map((row) => row.id);
  }

  for (const releaseId of pickupIds) {
    const updated = await tx.$executeRaw`
      UPDATE public.org_wf_release_mst
      SET
        release_status = 'fulfilled',
        fulfilled_at = ${now},
        fulfilled_by = ${params.actorUserId}::uuid,
        fulfillment_notes = ${notes},
        updated_at = ${now},
        updated_by = ${params.actorUserId}::uuid
      WHERE id = ${releaseId}::uuid
        AND tenant_org_id = ${params.tenantId}::uuid
        AND release_type = 'pickup'
        AND release_status = 'released'
    `;
    if (Number(updated) !== 1) {
      throw new PickupCompletionError('ORDER_NOT_READY', 'Pickup release changed concurrently.', 409);
    }
  }
  return pickupIds;
}

/**
 * Confirm a customer counter pickup atomically.
 *
 * A pickup release stages an order, but a staff member may also complete an
 * explicit direct counter handover from `ready`. Both paths fulfil the pickup
 * audit and execute `CONFIRM_PICKUP` in one transaction, so neither record can
 * survive without the workflow transition.
 *
 * @param params authenticated and tenant-scoped pickup command
 * @returns replay-safe fulfilled release IDs and workflow result
 * @throws {PickupCompletionError} when state, collection, partial fulfilment, or replay policy blocks handover
 * @example
 * await completePickup({ tenantId, orderId, actorUserId, expectedStateVersion: 4, idempotencyKey: 'pickup-123' });
 */
export async function completePickup(
  params: CompletePickupCommand,
): Promise<CompletePickupResult> {
  const payloadHash = hashPayload({
    orderId: params.orderId,
    expectedStateVersion: params.expectedStateVersion,
    handoverNotes: params.handoverNotes?.trim(),
    requireReleasedPickup: Boolean(params.requireReleasedPickup),
  });
  const claim = await claimIdempotencyKey(
    params.tenantId,
    params.idempotencyKey,
    PICKUP_COMPLETE_IDEMPOTENCY_RESOURCE,
    payloadHash,
  );

  if (claim.status === 'CONFLICT') {
    throw new PickupCompletionError(
      'IDEMPOTENCY_CONFLICT',
      'This idempotency key belongs to a different pickup request.',
      409,
    );
  }
  if (claim.status === 'IN_FLIGHT') {
    throw new PickupCompletionError(
      'IDEMPOTENCY_IN_FLIGHT',
      'Pickup confirmation is already being processed. Retry shortly with the same key.',
      409,
    );
  }
  if (claim.status === 'COMPLETED') {
    const replay = await loadReplay(params.tenantId, params.idempotencyKey);
    if (replay) return replay;
    throw new PickupCompletionError(
      'IDEMPOTENCY_IN_FLIGHT',
      'Pickup confirmation is still finalizing. Retry shortly with the same key.',
      409,
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await lockPickupOrder(tx, params.tenantId, params.orderId);
      const currentStatus = normaliseStatus(order.current_status);
      const isReleasedPickup = currentStatus === 'ready_for_pickup';
      const isDirectCounterPickup = currentStatus === 'ready' && !params.requireReleasedPickup;
      if (!isReleasedPickup && !isDirectCounterPickup) {
        throw new PickupCompletionError(
          'ORDER_NOT_READY',
          'Only ready-for-pickup orders, or ready orders handed over at the counter, can be confirmed as picked up.',
          422,
        );
      }
      if (
        normalisePaymentType(order.payment_type_code) === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION &&
        Number(order.outstanding_amount ?? 0) > 0
      ) {
        throw new PickupCompletionError(
          'PICKUP_COLLECTION_REQUIRED',
          'Collect the remaining pay-on-collection balance before confirming pickup.',
          422,
        );
      }

      const openReleases = await lockReleasedPickupRecords(tx, params.tenantId, params.orderId);
      const now = new Date();
      const handoverMode: PickupHandoverMode = isDirectCounterPickup ? 'direct' : 'released';
      const releaseIds = await fulfilPickupReleases(
        tx,
        params,
        openReleases,
        handoverMode,
        now,
      );
      const workflow = await executeAction({
        tenantId: params.tenantId,
        orderId: params.orderId,
        screen: PICKUP_HANDOVER_SCREEN,
        actionCode: WORKFLOW_ACTIONS.CONFIRM_PICKUP,
        expectedStateVersion: params.expectedStateVersion,
        actorUserId: params.actorUserId,
        actorName: params.actorName ?? 'Pickup Service',
        input: {
          fulfilmentChannel: 'pickup',
          handoverMode,
          releaseIds,
          handoverNotes: params.handoverNotes?.trim() || null,
        },
        idempotencyKey: `pickup:${params.idempotencyKey}`,
      }, tx);

      const commandResult: CompletePickupResult = {
        orderId: params.orderId,
        releaseIds,
        workflow,
      };
      await tx.org_idempotency_keys.updateMany({
        where: {
          tenant_org_id: params.tenantId,
          key: params.idempotencyKey,
          resource_type: PICKUP_COMPLETE_IDEMPOTENCY_RESOURCE,
        },
        data: {
          resource_id: releaseIds[0] ?? params.orderId,
          response_cache: {
            payload_hash: payloadHash,
            result: commandResult,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return commandResult;
    });

    logger.info('Pickup handover committed', {
      tenantId: params.tenantId,
      orderId: params.orderId,
      releaseIds: result.releaseIds,
      feature: 'pickup',
      action: 'complete_pickup',
    });
    return result;
  } catch (error) {
    // No fulfilment or workflow change can survive a rolled-back transaction,
    // so a corrected retry may safely reuse this key.
    await deleteIdempotencyHash(
      params.tenantId,
      params.idempotencyKey,
      PICKUP_COMPLETE_IDEMPOTENCY_RESOURCE,
    );
    throw error;
  }
}
