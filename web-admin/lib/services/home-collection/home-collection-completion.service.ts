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
import type { SemanticWorkflowCommandChannel } from '@/lib/services/workflow/semantic-workflow-artifact.service';

const HOME_COLLECTION_COMPLETE_RESOURCE = 'home_collection_complete';
const HOME_COLLECTION_SCREEN = 'home_collection';

export type HomeCollectionCompletionErrorCode =
  | 'ORDER_NOT_FOUND'
  | 'ORDER_NOT_READY'
  | 'IDEMPOTENCY_CONFLICT'
  | 'IDEMPOTENCY_IN_FLIGHT';

export class HomeCollectionCompletionError extends Error {
  readonly code: HomeCollectionCompletionErrorCode;
  readonly httpStatus: number;

  constructor(code: HomeCollectionCompletionErrorCode, message: string, httpStatus: number) {
    super(message);
    this.name = 'HomeCollectionCompletionError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export interface CompleteHomeCollectionCommand {
  tenantId: string;
  orderId: string;
  actorUserId: string;
  actorName?: string;
  expectedStateVersion: number;
  idempotencyKey: string;
  collectionNotes?: string;
  channel?: SemanticWorkflowCommandChannel;
}

export interface CompleteHomeCollectionResult {
  orderId: string;
  workflow: ExecuteActionResult;
}

interface LockedHomeCollectionOrder {
  id: string;
  current_status: string | null;
}

function normaliseStatus(value: string | null): string {
  return value?.trim().toLowerCase() ?? '';
}

async function loadReplay(
  tenantId: string,
  idempotencyKey: string,
): Promise<CompleteHomeCollectionResult | null> {
  const row = await prisma.org_idempotency_keys.findFirst({
    where: {
      tenant_org_id: tenantId,
      key: idempotencyKey,
      resource_type: HOME_COLLECTION_COMPLETE_RESOURCE,
    },
    select: { response_cache: true },
  });
  const cache = row?.response_cache as { result?: CompleteHomeCollectionResult } | null;
  return cache?.result ?? null;
}

async function lockOrder(
  tx: PrismaTransactionClient,
  tenantId: string,
  orderId: string,
): Promise<LockedHomeCollectionOrder> {
  const rows = await tx.$queryRaw<LockedHomeCollectionOrder[]>`
    SELECT id, current_status
    FROM public.org_orders_mst
    WHERE id = ${orderId}::uuid
      AND tenant_org_id = ${tenantId}::uuid
    FOR UPDATE
  `;
  const order = rows[0];
  if (!order) {
    throw new HomeCollectionCompletionError('ORDER_NOT_FOUND', 'Order was not found.', 404);
  }
  return order;
}

async function stampPhysicalIntake(
  tx: PrismaTransactionClient,
  params: CompleteHomeCollectionCommand,
  now: Date,
): Promise<void> {
  const notes = params.collectionNotes?.trim() || 'Home collection confirmed';
  const updated = await tx.$executeRaw`
    UPDATE public.org_orders_mst
    SET
      physical_intake_status = 'received',
      physical_intake_at = ${now},
      physical_intake_by = ${params.actorUserId}::uuid,
      physical_intake_info = ${notes},
      received_at = ${now},
      updated_at = ${now},
      updated_by = ${params.actorUserId}::uuid
    WHERE id = ${params.orderId}::uuid
      AND tenant_org_id = ${params.tenantId}::uuid
  `;
  if (Number(updated) !== 1) {
    throw new HomeCollectionCompletionError('ORDER_NOT_FOUND', 'Order was not found.', 404);
  }
}

/**
 * Confirms inbound home collection: stamps physical intake received, then runs
 * CONFIRM_HOME_COLLECTION → intake on the home_collection screen.
 */
export async function completeHomeCollection(
  params: CompleteHomeCollectionCommand,
): Promise<CompleteHomeCollectionResult> {
  const payloadHash = hashPayload({
    orderId: params.orderId,
    expectedStateVersion: params.expectedStateVersion,
    collectionNotes: params.collectionNotes?.trim(),
  });
  const claim = await claimIdempotencyKey(
    params.tenantId,
    params.idempotencyKey,
    HOME_COLLECTION_COMPLETE_RESOURCE,
    payloadHash,
  );

  if (claim.status === 'CONFLICT') {
    throw new HomeCollectionCompletionError(
      'IDEMPOTENCY_CONFLICT',
      'This idempotency key belongs to a different home collection request.',
      409,
    );
  }
  if (claim.status === 'IN_FLIGHT') {
    throw new HomeCollectionCompletionError(
      'IDEMPOTENCY_IN_FLIGHT',
      'Home collection confirmation is already being processed.',
      409,
    );
  }
  if (claim.status === 'COMPLETED') {
    const replay = await loadReplay(params.tenantId, params.idempotencyKey);
    if (replay) return replay;
    throw new HomeCollectionCompletionError(
      'IDEMPOTENCY_IN_FLIGHT',
      'Home collection confirmation is still finalizing.',
      409,
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await lockOrder(tx, params.tenantId, params.orderId);
      if (normaliseStatus(order.current_status) !== 'out_for_collection') {
        throw new HomeCollectionCompletionError(
          'ORDER_NOT_READY',
          'Only orders out for collection can be confirmed.',
          422,
        );
      }

      const now = new Date();
      await stampPhysicalIntake(tx, params, now);

      const workflow = await executeAction(
        {
          tenantId: params.tenantId,
          orderId: params.orderId,
          screen: HOME_COLLECTION_SCREEN,
          actionCode: WORKFLOW_ACTIONS.CONFIRM_HOME_COLLECTION,
          expectedStateVersion: params.expectedStateVersion,
          actorUserId: params.actorUserId,
          actorName: params.actorName ?? 'Home Collection Service',
          input: {
            fulfilmentChannel: 'home_collection',
            collectionNotes: params.collectionNotes?.trim() || null,
          },
          idempotencyKey: `home_collection:${params.idempotencyKey}`,
          channel: params.channel ?? 'staff_web',
        },
        tx,
      );

      return { orderId: params.orderId, workflow };
    });

    await prisma.org_idempotency_keys.updateMany({
      where: {
        tenant_org_id: params.tenantId,
        key: params.idempotencyKey,
        resource_type: HOME_COLLECTION_COMPLETE_RESOURCE,
      },
      data: {
        response_cache: { result } as unknown as Prisma.InputJsonValue,
      },
    });

    return result;
  } catch (error) {
    await deleteIdempotencyHash(params.tenantId, params.idempotencyKey, HOME_COLLECTION_COMPLETE_RESOURCE);
    throw error;
  }
}
