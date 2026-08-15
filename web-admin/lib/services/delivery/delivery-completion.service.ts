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

const DELIVERY_COMPLETE_IDEMPOTENCY_RESOURCE = 'delivery_complete';
const DELIVERY_SCREEN = 'driver_delivery';

/** Error codes returned by the stage-owned Delivery completion command. */
export type DeliveryCompletionErrorCode =
  | 'STOP_NOT_FOUND'
  | 'STOP_NOT_ACTIVE'
  | 'STOP_ALREADY_DELIVERED'
  | 'POD_METHOD_INVALID'
  | 'POD_EVIDENCE_REQUIRED'
  | 'POD_EVIDENCE_INVALID'
  | 'DELIVERY_COLLECTION_REQUIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'IDEMPOTENCY_IN_FLIGHT';

/**
 * Stable application error used by the API adapter without leaking database details.
 */
export class DeliveryCompletionError extends Error {
  /** Machine-readable error code for web, mobile, and integration consumers. */
  readonly code: DeliveryCompletionErrorCode;
  /** HTTP status aligned to the command's retry semantics. */
  readonly httpStatus: number;

  /**
   * @param code stable failure classification
   * @param message safe operator-facing explanation
   * @param httpStatus transport status for the versioned API
   */
  constructor(code: DeliveryCompletionErrorCode, message: string, httpStatus: number) {
    super(message);
    this.name = 'DeliveryCompletionError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** Command input shared by staff web, future mobile, and integration adapters. */
export interface CompleteDeliveryCommand {
  /** Tenant scope is resolved by the authenticated API adapter, never client supplied. */
  tenantId: string;
  stopId: string;
  actorUserId: string;
  actorName?: string;
  expectedStateVersion: number;
  idempotencyKey: string;
  podMethodCode: string;
  /** Optional operator context retained with the immutable proof record. */
  podNotes?: string;
  signatureEvidenceId?: string;
  photoEvidenceIds?: string[];
}

/** Successful result persisted in the delivery idempotency record for safe replay. */
export interface CompleteDeliveryResult {
  stopId: string;
  podId: string;
  orderId: string;
  workflow: ExecuteActionResult;
}

type LockedDeliveryStop = {
  stop_id: string;
  stop_status_code: string | null;
  route_id: string;
  order_id: string;
  branch_id: string | null;
  payment_type_code: string | null;
  outstanding_amount: number | string | null;
};

type LockedPod = {
  id: string;
};

type LockedEvidenceUpload = {
  id: string;
  evidence_type: 'signature' | 'photo';
  object_key: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalisePodMethod(value: string): string {
  return value.trim().toUpperCase();
}

async function loadReplay(
  tenantId: string,
  idempotencyKey: string,
): Promise<CompleteDeliveryResult | null> {
  const row = await prisma.org_idempotency_keys.findFirst({
    where: {
      tenant_org_id: tenantId,
      key: idempotencyKey,
      resource_type: DELIVERY_COMPLETE_IDEMPOTENCY_RESOURCE,
    },
    select: { response_cache: true },
  });
  const cached = row?.response_cache as { result?: CompleteDeliveryResult } | null;
  return cached?.result ?? null;
}

async function lockDeliveryStop(
  tx: PrismaTransactionClient,
  tenantId: string,
  stopId: string,
): Promise<LockedDeliveryStop> {
  const rows = await tx.$queryRaw<LockedDeliveryStop[]>`
    SELECT
      s.id AS stop_id,
      s.stop_status_code,
      s.route_id,
      s.order_id,
      s.branch_id,
      o.payment_type_code,
      o.outstanding_amount
    FROM public.org_dlv_stops_dtl s
    INNER JOIN public.org_orders_mst o
      ON o.id = s.order_id
      AND o.tenant_org_id = s.tenant_org_id
    INNER JOIN public.org_dlv_routes_mst r
      ON r.id = s.route_id
      AND r.tenant_org_id = s.tenant_org_id
    WHERE s.id = ${stopId}::uuid
      AND s.tenant_org_id = ${tenantId}::uuid
      AND s.is_active = true
      AND COALESCE(s.rec_status, 1) = 1
      AND r.is_active = true
      AND COALESCE(r.rec_status, 1) = 1
    FOR UPDATE OF s, o, r
  `;

  const stop = rows[0];
  if (!stop) {
    throw new DeliveryCompletionError('STOP_NOT_FOUND', 'Delivery stop was not found.', 404);
  }
  return stop;
}

async function lockPod(
  tx: PrismaTransactionClient,
  tenantId: string,
  stopId: string,
): Promise<LockedPod | null> {
  const rows = await tx.$queryRaw<LockedPod[]>`
    SELECT id
    FROM public.org_dlv_pod_tr
    WHERE stop_id = ${stopId}::uuid
      AND tenant_org_id = ${tenantId}::uuid
      AND is_active = true
      AND COALESCE(rec_status, 1) = 1
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

/**
 * Locks only unexpired uploads that belong to the authenticated tenant and
 * target stop, so object keys cannot be replayed across deliveries.
 */
async function lockEvidenceUploads(
  tx: PrismaTransactionClient,
  tenantId: string,
  stopId: string,
  evidenceIds: readonly string[],
  now: Date,
): Promise<LockedEvidenceUpload[]> {
  if (evidenceIds.length === 0) return [];

  return tx.$queryRaw<LockedEvidenceUpload[]>`
    SELECT id, evidence_type, object_key
    FROM public.org_dlv_ev_uploads_tr
    WHERE tenant_org_id = ${tenantId}::uuid
      AND stop_id = ${stopId}::uuid
      AND id = ANY(${evidenceIds}::uuid[])
      AND upload_status = 'uploaded'
      AND is_active = true
      AND rec_status = 1
      AND expires_at > ${now}
    FOR UPDATE
  `;
}

async function validateEvidence(
  tx: PrismaTransactionClient,
  params: CompleteDeliveryCommand,
  stopId: string,
  now: Date,
): Promise<{
  methodCode: string;
  otpVerified: boolean;
  signatureObjectKey: string | null;
  photoObjectKeys: string[];
  uploadIds: string[];
}> {
  const methodCode = normalisePodMethod(params.podMethodCode);
  // OTP is intentionally unavailable until its durable expiry and retry controls
  // are released; accepting it now would create an unverifiable delivery proof.
  if (methodCode === 'OTP') {
    throw new DeliveryCompletionError(
      'POD_METHOD_INVALID',
      'OTP proof is not enabled for delivery completion.',
      422,
    );
  }
  const methodRows = await tx.$queryRaw<Array<{ code: string }>>`
    SELECT code
    FROM public.sys_dlv_pod_method_cd
    WHERE code = ${methodCode}
      AND is_active = true
      AND COALESCE(rec_status, 1) = 1
    LIMIT 1
  `;
  if (!methodRows[0]) {
    throw new DeliveryCompletionError('POD_METHOD_INVALID', 'POD method is not supported.', 422);
  }

  const signatureEvidenceId = params.signatureEvidenceId?.trim() || null;
  const photoEvidenceIds = (params.photoEvidenceIds ?? []).map((evidenceId) => evidenceId.trim());
  if (
    (signatureEvidenceId && !UUID_PATTERN.test(signatureEvidenceId)) ||
    photoEvidenceIds.length > 10 ||
    photoEvidenceIds.some((evidenceId) => !UUID_PATTERN.test(evidenceId))
  ) {
    throw new DeliveryCompletionError(
      'POD_EVIDENCE_INVALID',
      'Delivery evidence references are invalid.',
      422,
    );
  }
  const requestedIds = signatureEvidenceId ? [signatureEvidenceId, ...photoEvidenceIds] : photoEvidenceIds;
  if (new Set(requestedIds).size !== requestedIds.length) {
    throw new DeliveryCompletionError('POD_EVIDENCE_INVALID', 'Delivery evidence contains duplicate uploads.', 422);
  }
  const uploads = await lockEvidenceUploads(tx, params.tenantId, stopId, requestedIds, now);
  if (uploads.length !== requestedIds.length) {
    throw new DeliveryCompletionError(
      'POD_EVIDENCE_INVALID',
      'Delivery evidence is missing, expired, or belongs to another stop.',
      422,
    );
  }
  const signature = uploads.find((upload) => upload.id === signatureEvidenceId);
  const photos = uploads.filter((upload) => photoEvidenceIds.includes(upload.id));
  const otpVerified = false;

  if (signature && signature.evidence_type !== 'signature') {
    throw new DeliveryCompletionError('POD_EVIDENCE_INVALID', 'Signature evidence has an invalid type.', 422);
  }
  if (photos.some((photo) => photo.evidence_type !== 'photo')) {
    throw new DeliveryCompletionError('POD_EVIDENCE_INVALID', 'Photo evidence has an invalid type.', 422);
  }
  if (methodCode === 'SIGNATURE' && !signature) {
    throw new DeliveryCompletionError('POD_EVIDENCE_REQUIRED', 'A signature is required.', 422);
  } else if (methodCode === 'PHOTO' && photos.length === 0) {
    throw new DeliveryCompletionError('POD_EVIDENCE_REQUIRED', 'At least one delivery photo is required.', 422);
  } else if (methodCode === 'MIXED' && (!signature || photos.length === 0)) {
    throw new DeliveryCompletionError(
      'POD_EVIDENCE_REQUIRED',
      'A signature and at least one delivery photo are required.',
      422,
    );
  }

  return {
    methodCode,
    otpVerified,
    signatureObjectKey: signature?.object_key ?? null,
    photoObjectKeys: photos.map((photo) => photo.object_key),
    uploadIds: uploads.map((upload) => upload.id),
  };
}

async function writePod(
  tx: PrismaTransactionClient,
  params: CompleteDeliveryCommand,
  stop: LockedDeliveryStop,
  existingPod: LockedPod | null,
  evidence: {
    methodCode: string;
    otpVerified: boolean;
    signatureObjectKey: string | null;
    photoObjectKeys: string[];
  },
  now: Date,
): Promise<string> {
  const podData = {
    pod_method_code: evidence.methodCode,
    otp_verified: evidence.otpVerified,
    signature_url: null,
    photo_urls: [] as unknown as Prisma.InputJsonValue,
    pod_notes: params.podNotes?.trim() || null,
    signature_object_key: evidence.signatureObjectKey,
    photo_object_keys: evidence.photoObjectKeys as unknown as Prisma.InputJsonValue,
    verified_at: now,
    verified_by: params.actorUserId,
    updated_at: now,
    updated_by: params.actorUserId,
    metadata: {
      completion_command: true,
      idempotency_key: params.idempotencyKey,
    } as Prisma.InputJsonValue,
  };

  if (existingPod) {
    const update = await tx.org_dlv_pod_tr.updateMany({
      where: { id: existingPod.id, tenant_org_id: params.tenantId },
      data: podData,
    });
    if (update.count !== 1) {
      throw new DeliveryCompletionError('STOP_NOT_FOUND', 'Delivery evidence was not found.', 404);
    }
    return existingPod.id;
  }

  const pod = await tx.org_dlv_pod_tr.create({
    data: {
      ...podData,
      stop_id: stop.stop_id,
      tenant_org_id: params.tenantId,
      branch_id: stop.branch_id,
      created_by: params.actorUserId,
    },
    select: { id: true },
  });
  return pod.id;
}

/** Marks evidence uploads consumed only after the POD write is part of the same transaction. */
async function consumeEvidenceUploads(
  tx: PrismaTransactionClient,
  tenantId: string,
  uploadIds: readonly string[],
  actorUserId: string,
  now: Date,
): Promise<void> {
  if (uploadIds.length === 0) return;
  const consumed = await tx.$queryRaw<Array<{ id: string }>>`
    UPDATE public.org_dlv_ev_uploads_tr
    SET upload_status = 'consumed', consumed_at = ${now}, consumed_by = ${actorUserId}::uuid,
        updated_at = ${now}, updated_by = ${actorUserId}
    WHERE tenant_org_id = ${tenantId}::uuid
      AND id = ANY(${uploadIds}::uuid[])
      AND upload_status = 'uploaded'
    RETURNING id
  `;
  if (consumed.length !== uploadIds.length) {
    throw new DeliveryCompletionError('POD_EVIDENCE_INVALID', 'Delivery evidence changed concurrently.', 409);
  }
}

async function refreshRouteProgress(
  tx: PrismaTransactionClient,
  tenantId: string,
  routeId: string,
  actorUserId: string,
  now: Date,
): Promise<void> {
  await tx.$executeRaw`
    UPDATE public.org_dlv_routes_mst r
    SET
      total_stops = counts.total_stops,
      completed_stops = counts.completed_stops,
      route_status_code = CASE
        WHEN counts.total_stops > 0 AND counts.completed_stops = counts.total_stops THEN 'completed'
        WHEN counts.completed_stops > 0 THEN 'in_progress'
        ELSE r.route_status_code
      END,
      completed_at = CASE
        WHEN counts.total_stops > 0 AND counts.completed_stops = counts.total_stops THEN COALESCE(r.completed_at, ${now})
        ELSE r.completed_at
      END,
      updated_at = ${now},
      updated_by = ${actorUserId}
    FROM (
      SELECT
        COUNT(*)::integer AS total_stops,
        COUNT(*) FILTER (WHERE stop_status_code = 'delivered')::integer AS completed_stops
      FROM public.org_dlv_stops_dtl
      WHERE route_id = ${routeId}::uuid
        AND tenant_org_id = ${tenantId}::uuid
        AND is_active = true
        AND COALESCE(rec_status, 1) = 1
    ) counts
    WHERE r.id = ${routeId}::uuid
      AND r.tenant_org_id = ${tenantId}::uuid
  `;
}

/**
 * Complete a staff delivery in one tenant-scoped transaction.
 *
 * The command deliberately does not collect money: a remaining PAY_ON_COLLECTION
 * balance must be recorded by the auditable Order Fin collection command before
 * delivery is confirmed.
 *
 * @param params authenticated tenant-scoped delivery command
 * @returns replay-safe POD, stop, and workflow completion result
 * @throws {DeliveryCompletionError} when evidence, payment policy, or retry state blocks completion
 * @example
 * await completeDelivery({ tenantId, stopId, actorUserId, expectedStateVersion: 4, idempotencyKey, podMethodCode: 'SIGNATURE', signatureEvidenceId });
 */
export async function completeDelivery(
  params: CompleteDeliveryCommand,
): Promise<CompleteDeliveryResult> {
  const payloadHash = hashPayload({
    stopId: params.stopId,
    expectedStateVersion: params.expectedStateVersion,
    podMethodCode: normalisePodMethod(params.podMethodCode),
    signatureEvidenceId: params.signatureEvidenceId?.trim(),
    photoEvidenceIds: params.photoEvidenceIds ?? [],
  });
  const claim = await claimIdempotencyKey(
    params.tenantId,
    params.idempotencyKey,
    DELIVERY_COMPLETE_IDEMPOTENCY_RESOURCE,
    payloadHash,
  );

  if (claim.status === 'CONFLICT') {
    throw new DeliveryCompletionError(
      'IDEMPOTENCY_CONFLICT',
      'This idempotency key belongs to a different delivery request.',
      409,
    );
  }
  if (claim.status === 'IN_FLIGHT') {
    throw new DeliveryCompletionError(
      'IDEMPOTENCY_IN_FLIGHT',
      'Delivery completion is already being processed. Retry shortly with the same key.',
      409,
    );
  }
  if (claim.status === 'COMPLETED') {
    const replay = await loadReplay(params.tenantId, params.idempotencyKey);
    if (replay) return replay;
    throw new DeliveryCompletionError(
      'IDEMPOTENCY_IN_FLIGHT',
      'Delivery completion is still finalizing. Retry shortly with the same key.',
      409,
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const stop = await lockDeliveryStop(tx, params.tenantId, params.stopId);
      const stopStatus = stop.stop_status_code?.trim().toLowerCase() ?? '';
      if (stopStatus === 'delivered') {
        throw new DeliveryCompletionError('STOP_ALREADY_DELIVERED', 'Delivery stop is already delivered.', 409);
      }
      if (!['pending', 'in_transit'].includes(stopStatus)) {
        throw new DeliveryCompletionError('STOP_NOT_ACTIVE', 'Delivery stop is not active.', 422);
      }
      if (
        stop.payment_type_code === 'PAY_ON_COLLECTION' &&
        Number(stop.outstanding_amount ?? 0) > 0
      ) {
        throw new DeliveryCompletionError(
          'DELIVERY_COLLECTION_REQUIRED',
          'Collect the remaining pay-on-collection balance before confirming delivery.',
          422,
        );
      }

      const now = new Date();
      const existingPod = await lockPod(tx, params.tenantId, stop.stop_id);
      const evidence = await validateEvidence(tx, params, stop.stop_id, now);
      const podId = await writePod(tx, params, stop, existingPod, evidence, now);
      await consumeEvidenceUploads(tx, params.tenantId, evidence.uploadIds, params.actorUserId, now);

      const stopUpdate = await tx.org_dlv_stops_dtl.updateMany({
        where: {
          id: stop.stop_id,
          tenant_org_id: params.tenantId,
          stop_status_code: { in: ['pending', 'in_transit'] },
        },
        data: {
          stop_status_code: 'delivered',
          actual_time: now,
          updated_at: now,
          updated_by: params.actorUserId,
        },
      });
      if (stopUpdate.count !== 1) {
        throw new DeliveryCompletionError('STOP_ALREADY_DELIVERED', 'Delivery stop changed concurrently.', 409);
      }

      const workflow = await executeAction({
        tenantId: params.tenantId,
        orderId: stop.order_id,
        screen: DELIVERY_SCREEN,
        actionCode: WORKFLOW_ACTIONS.CONFIRM_DELIVERY,
        expectedStateVersion: params.expectedStateVersion,
        actorUserId: params.actorUserId,
        actorName: params.actorName ?? 'Delivery Service',
        input: {
          podId,
          podMethodCode: evidence.methodCode,
          otpVerified: evidence.otpVerified,
          signatureObjectKey: evidence.signatureObjectKey,
          photoObjectKeys: evidence.photoObjectKeys,
        },
        idempotencyKey: `delivery:${params.idempotencyKey}`,
      }, tx);

      await refreshRouteProgress(tx, params.tenantId, stop.route_id, params.actorUserId, now);

      const commandResult: CompleteDeliveryResult = {
        stopId: stop.stop_id,
        podId,
        orderId: stop.order_id,
        workflow,
      };
      await tx.org_idempotency_keys.updateMany({
        where: {
          tenant_org_id: params.tenantId,
          key: params.idempotencyKey,
          resource_type: DELIVERY_COMPLETE_IDEMPOTENCY_RESOURCE,
        },
        data: {
          resource_id: podId,
          response_cache: {
            payload_hash: payloadHash,
            result: commandResult,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return commandResult;
    });

    logger.info('Delivery completion committed', {
      tenantId: params.tenantId,
      stopId: params.stopId,
      orderId: result.orderId,
      podId: result.podId,
      feature: 'delivery',
      action: 'complete_delivery',
    });
    return result;
  } catch (error) {
    // A validation or transaction failure has no delivery side effect, so the
    // caller may correct its request and reuse the key without a stale claim.
    await deleteIdempotencyHash(
      params.tenantId,
      params.idempotencyKey,
      DELIVERY_COMPLETE_IDEMPOTENCY_RESOURCE,
    );
    throw error;
  }
}
