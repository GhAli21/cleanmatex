import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';
import { observeWorkflowFulfilmentCommitted } from '@/lib/services/workflow/workflow-observability';
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
import {
  loadSemanticWorkflowArtifactForOrder,
  SemanticWorkflowArtifactError,
  type SemanticWorkflowCommandChannel,
} from '@/lib/services/workflow/semantic-workflow-artifact.service';
import {
  assertCompiledDeliveryEvidence,
  CompiledDeliveryEvidenceError,
  hasCompiledDeliveryEvidence,
} from '@/lib/services/delivery/compiled-delivery-evidence';
import { SETTLEMENT_TYPE_CODES } from '@/lib/constants/order-financial';
import { WORKFLOW_SYSTEM_ACTOR } from '@/lib/constants/workflow-system-actor';

const DELIVERY_COMPLETE_IDEMPOTENCY_RESOURCE = 'delivery_complete';
const DELIVERY_ORDER_COMPLETE_IDEMPOTENCY_RESOURCE = 'delivery_order_complete';
const DELIVERY_SCREEN = 'driver_delivery';

/** Error codes returned by the stage-owned Delivery completion command. */
export type DeliveryCompletionErrorCode =
  | 'STOP_NOT_FOUND'
  | 'STOP_NOT_ACTIVE'
  | 'STOP_ALREADY_DELIVERED'
  | 'USE_STOP_COMPLETE_COMMAND'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_NOT_OUT_FOR_DELIVERY'
  | 'POD_METHOD_INVALID'
  | 'POD_EVIDENCE_REQUIRED'
  | 'POD_EVIDENCE_INVALID'
  | 'DELIVERY_COLLECTION_REQUIRED'
  | 'DELIVERY_POLICY_UNAVAILABLE'
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
  /** Server-derived channel; cookie POS with an OPEN till may be `pos`. */
  channel?: SemanticWorkflowCommandChannel;
}

/** Successful result persisted in the delivery idempotency record for safe replay. */
export interface CompleteDeliveryResult {
  stopId: string;
  podId: string;
  orderId: string;
  workflow: ExecuteActionResult;
}

/** Order-keyed completion used when the profile does not require an active stop. */
export interface CompleteOrderDeliveryCommand {
  tenantId: string;
  orderId: string;
  actorUserId: string;
  actorName?: string;
  expectedStateVersion: number;
  idempotencyKey: string;
  podNotes?: string;
  /** Server-derived channel; cookie POS with an OPEN till may be `pos`. */
  channel?: SemanticWorkflowCommandChannel;
}

/** Replay-safe outcome for a floor-screen delivery handover without a planned route. */
export interface CompleteOrderDeliveryResult {
  orderId: string;
  workflow: ExecuteActionResult;
}

type LockedDeliveryOrder = {
  id: string;
  current_status: string | null;
  payment_type_code: string | null;
  outstanding_amount: number | string | null;
  wf_profile_id: string | null;
  wf_version_no: number | null;
  wf_profile_version_id: string | null;
  wf_profile_artifact_id: string | null;
  wf_profile_revision: number | null;
  wf_profile_checksum: string | null;
  wf_profile_schema_version: number | null;
};

type LockedDeliveryStop = {
  stop_id: string;
  stop_status_code: string | null;
  route_id: string;
  order_id: string;
  branch_id: string | null;
  payment_type_code: string | null;
  outstanding_amount: number | string | null;
  wf_profile_id: string | null;
  wf_version_no: number | null;
  wf_profile_version_id: string | null;
  wf_profile_artifact_id: string | null;
  wf_profile_revision: number | null;
  wf_profile_checksum: string | null;
  wf_profile_schema_version: number | null;
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
  resourceType: string,
): Promise<CompleteDeliveryResult | CompleteOrderDeliveryResult | null> {
  const row = await prisma.org_idempotency_keys.findFirst({
    where: {
      tenant_org_id: tenantId,
      key: idempotencyKey,
      resource_type: resourceType,
    },
    select: { response_cache: true },
  });
  const cached = row?.response_cache as {
    result?: CompleteDeliveryResult | CompleteOrderDeliveryResult;
  } | null;
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
      o.outstanding_amount,
      o.wf_profile_id::text,
      o.wf_version_no,
      o.wf_profile_version_id::text,
      o.wf_profile_artifact_id::text,
      o.wf_profile_revision,
      o.wf_profile_checksum,
      o.wf_profile_schema_version
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

async function loadOrderArtifact(stop: LockedDeliveryStop) {
  try {
    return await loadSemanticWorkflowArtifactForOrder({
      wf_profile_id: stop.wf_profile_id,
      wf_version_no: stop.wf_version_no,
      wf_profile_version_id: stop.wf_profile_version_id,
      wf_profile_artifact_id: stop.wf_profile_artifact_id,
      wf_profile_revision: stop.wf_profile_revision,
      wf_profile_checksum: stop.wf_profile_checksum,
      wf_profile_schema_version: stop.wf_profile_schema_version,
    });
  } catch (error) {
    if (error instanceof SemanticWorkflowArtifactError) {
      throw new DeliveryCompletionError(
        'DELIVERY_POLICY_UNAVAILABLE',
        'The live delivery policy could not be loaded.',
        422,
      );
    }
    throw error;
  }
}

async function validateEvidence(
  tx: PrismaTransactionClient,
  params: CompleteDeliveryCommand,
  stop: LockedDeliveryStop,
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

  const artifact = await loadOrderArtifact(stop);
  if (!artifact) {
    throw new DeliveryCompletionError(
      'DELIVERY_POLICY_UNAVAILABLE',
      'The live delivery policy could not be loaded.',
      422,
    );
  }
  const compiledEvidence = artifact.evidence ?? [];
  if (!hasCompiledDeliveryEvidence(compiledEvidence)) {
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
  const uploads = await lockEvidenceUploads(tx, params.tenantId, stop.stop_id, requestedIds, now);
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
  const notesOnlyMethod = methodCode === 'POD' || methodCode === 'NOTES';
  if (!notesOnlyMethod) {
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
  }

  try {
    assertCompiledDeliveryEvidence({
      evidence: compiledEvidence,
      podMethodCode: methodCode,
      hasSignature: Boolean(signature),
      photoCount: photos.length,
      hasNotes: Boolean(params.podNotes?.trim()),
    });
  } catch (error) {
    if (error instanceof CompiledDeliveryEvidenceError) {
      throw new DeliveryCompletionError(error.code, error.message, 422);
    }
    throw error;
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
    const replay = await loadReplay(
      params.tenantId,
      params.idempotencyKey,
      DELIVERY_COMPLETE_IDEMPOTENCY_RESOURCE,
    );
    if (replay && 'stopId' in replay) return replay;
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
      const evidence = await validateEvidence(tx, params, stop, now);
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
          confirm_level: 'sys_user',
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
        channel: params.channel ?? 'staff_web',
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
    observeWorkflowFulfilmentCommitted({
      kind: 'delivery',
      tenantId: params.tenantId,
      orderId: result.orderId,
      channel: params.channel,
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

async function lockDeliveryOrder(
  tx: PrismaTransactionClient,
  tenantId: string,
  orderId: string,
): Promise<LockedDeliveryOrder> {
  const rows = await tx.$queryRaw<LockedDeliveryOrder[]>`
    SELECT
      id,
      current_status,
      payment_type_code,
      outstanding_amount,
      wf_profile_id::text,
      wf_version_no,
      wf_profile_version_id::text,
      wf_profile_artifact_id::text,
      wf_profile_revision,
      wf_profile_checksum,
      wf_profile_schema_version
    FROM public.org_orders_mst
    WHERE id = ${orderId}::uuid
      AND tenant_org_id = ${tenantId}::uuid
    FOR UPDATE
  `;
  const order = rows[0];
  if (!order) {
    throw new DeliveryCompletionError('ORDER_NOT_FOUND', 'Order was not found.', 404);
  }
  return order;
}

async function lockActiveDeliveryStopId(
  tx: PrismaTransactionClient,
  tenantId: string,
  orderId: string,
): Promise<string | null> {
  const rows = await tx.$queryRaw<Array<{ stop_id: string }>>`
    SELECT s.id AS stop_id
    FROM public.org_dlv_stops_dtl s
    INNER JOIN public.org_dlv_routes_mst r
      ON r.id = s.route_id
      AND r.tenant_org_id = s.tenant_org_id
    WHERE s.order_id = ${orderId}::uuid
      AND s.tenant_org_id = ${tenantId}::uuid
      AND s.is_active = true
      AND COALESCE(s.rec_status, 1) = 1
      AND r.is_active = true
      AND COALESCE(r.rec_status, 1) = 1
      AND s.stop_status_code IN ('pending', 'in_transit')
    ORDER BY s.updated_at DESC
    LIMIT 1
    FOR UPDATE OF s
  `;
  return rows[0]?.stop_id ?? null;
}

/**
 * Resolves a still-open delivery stop when the CUSTOMER confirms receipt via
 * the public tracking link, so the stop is never left orphaned behind an
 * order the engine already marked delivered. The customer's own confirmation
 * is treated as a valid delivery confirmation for the stop too — it is marked
 * `delivered` (never cancelled) and tagged `confirm_level: 'customer'` so it
 * stays distinguishable from staff/driver completions.
 *
 * Staff must still use the explicit stop-complete command; this path is
 * public-channel only (never called from a staff-authenticated route) and
 * must run inside the same transaction as the CONFIRM_DELIVERY engine call so
 * both writes commit together.
 *
 * @param tx transaction shared with the caller's CONFIRM_DELIVERY execution
 * @param tenantId authenticated tenant scope
 * @param orderId the order the customer is confirming
 * @param confirmNotes optional short comment the customer added
 */
export async function resolveActiveStopForCustomerConfirm(
  tx: PrismaTransactionClient,
  tenantId: string,
  orderId: string,
  confirmNotes?: string,
): Promise<void> {
  const activeStopId = await lockActiveDeliveryStopId(tx, tenantId, orderId);
  if (!activeStopId) return;

  const stop = await tx.org_dlv_stops_dtl.findFirst({
    where: { id: activeStopId, tenant_org_id: tenantId },
    select: { route_id: true },
  });
  if (!stop) return;

  const now = new Date();
  const stopUpdate = await tx.org_dlv_stops_dtl.updateMany({
    where: { id: activeStopId, tenant_org_id: tenantId, stop_status_code: { in: ['pending', 'in_transit'] } },
    data: {
      stop_status_code: 'delivered',
      confirm_level: 'customer',
      confirm_notes: confirmNotes?.trim() || null,
      actual_time: now,
      updated_at: now,
      updated_info: 'Customer confirmed delivery via public tracking link',
    },
  });
  if (stopUpdate.count !== 1) return;

  await refreshRouteProgress(tx, tenantId, stop.route_id, WORKFLOW_SYSTEM_ACTOR.userId, now);
}

async function assertOrderKeyedDeliveryEvidence(
  order: LockedDeliveryOrder,
  podNotes?: string,
): Promise<void> {
  let artifact;
  try {
    artifact = await loadSemanticWorkflowArtifactForOrder({
      wf_profile_id: order.wf_profile_id,
      wf_version_no: order.wf_version_no,
      wf_profile_version_id: order.wf_profile_version_id,
      wf_profile_artifact_id: order.wf_profile_artifact_id,
      wf_profile_revision: order.wf_profile_revision,
      wf_profile_checksum: order.wf_profile_checksum,
      wf_profile_schema_version: order.wf_profile_schema_version,
    });
  } catch (error) {
    if (error instanceof SemanticWorkflowArtifactError) {
      throw new DeliveryCompletionError(
        'DELIVERY_POLICY_UNAVAILABLE',
        'The live delivery policy could not be loaded.',
        422,
      );
    }
    throw error;
  }

  if (!artifact) {
    throw new DeliveryCompletionError(
      'DELIVERY_POLICY_UNAVAILABLE',
      'The live delivery policy could not be loaded.',
      422,
    );
  }

  const evidence = artifact.evidence ?? [];
  if (!hasCompiledDeliveryEvidence(evidence)) return;

  try {
    assertCompiledDeliveryEvidence({
      evidence,
      podMethodCode: 'NOTES',
      hasSignature: false,
      photoCount: 0,
      hasNotes: Boolean(podNotes?.trim()),
    });
  } catch (error) {
    if (error instanceof CompiledDeliveryEvidenceError) {
      throw new DeliveryCompletionError(error.code, error.message, 422);
    }
    throw error;
  }
}

/**
 * Completes delivery from the floor screen when the profile does not require
 * a planned route stop. An active stop is never auto-created; that order must
 * use the stop-owned completion command instead.
 *
 * @param params authenticated tenant-scoped order handover command
 * @returns replay-safe workflow completion for the order
 */
export async function completeDeliveryByOrder(
  params: CompleteOrderDeliveryCommand,
): Promise<CompleteOrderDeliveryResult> {
  const payloadHash = hashPayload({
    orderId: params.orderId,
    expectedStateVersion: params.expectedStateVersion,
    podNotes: params.podNotes?.trim(),
  });
  const claim = await claimIdempotencyKey(
    params.tenantId,
    params.idempotencyKey,
    DELIVERY_ORDER_COMPLETE_IDEMPOTENCY_RESOURCE,
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
    const replay = await loadReplay(
      params.tenantId,
      params.idempotencyKey,
      DELIVERY_ORDER_COMPLETE_IDEMPOTENCY_RESOURCE,
    );
    if (replay && !('stopId' in replay)) return replay;
    throw new DeliveryCompletionError(
      'IDEMPOTENCY_IN_FLIGHT',
      'Delivery completion is still finalizing. Retry shortly with the same key.',
      409,
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await lockDeliveryOrder(tx, params.tenantId, params.orderId);
      const currentStatus = order.current_status?.trim().toLowerCase() ?? '';
      if (currentStatus !== 'out_for_delivery') {
        throw new DeliveryCompletionError(
          'ORDER_NOT_OUT_FOR_DELIVERY',
          'Only out-for-delivery orders can be confirmed from the delivery floor.',
          422,
        );
      }
      if (await lockActiveDeliveryStopId(tx, params.tenantId, params.orderId)) {
        throw new DeliveryCompletionError(
          'USE_STOP_COMPLETE_COMMAND',
          'This order has an active delivery stop. Complete it from the stop command.',
          409,
        );
      }
      if (
        order.payment_type_code === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION
        && Number(order.outstanding_amount ?? 0) > 0
      ) {
        throw new DeliveryCompletionError(
          'DELIVERY_COLLECTION_REQUIRED',
          'Collect the remaining pay-on-collection balance before confirming delivery.',
          422,
        );
      }

      await assertOrderKeyedDeliveryEvidence(order, params.podNotes);

      const workflow = await executeAction({
        tenantId: params.tenantId,
        orderId: params.orderId,
        screen: DELIVERY_SCREEN,
        actionCode: WORKFLOW_ACTIONS.CONFIRM_DELIVERY,
        expectedStateVersion: params.expectedStateVersion,
        actorUserId: params.actorUserId,
        actorName: params.actorName ?? 'Delivery Service',
        input: {
          fulfilmentChannel: 'delivery',
          handoverMode: 'ad_hoc',
          podMethodCode: 'NOTES',
          handoverNotes: params.podNotes?.trim() || null,
        },
        idempotencyKey: `delivery-order:${params.idempotencyKey}`,
        channel: params.channel ?? 'staff_web',
      }, tx);

      const commandResult: CompleteOrderDeliveryResult = {
        orderId: params.orderId,
        workflow,
      };
      await tx.org_idempotency_keys.updateMany({
        where: {
          tenant_org_id: params.tenantId,
          key: params.idempotencyKey,
          resource_type: DELIVERY_ORDER_COMPLETE_IDEMPOTENCY_RESOURCE,
        },
        data: {
          resource_id: params.orderId,
          response_cache: {
            payload_hash: payloadHash,
            result: commandResult,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return commandResult;
    });

    logger.info('Order-keyed delivery completion committed', {
      tenantId: params.tenantId,
      orderId: result.orderId,
      feature: 'delivery',
      action: 'complete_delivery_by_order',
    });
    observeWorkflowFulfilmentCommitted({
      kind: 'delivery',
      tenantId: params.tenantId,
      orderId: result.orderId,
      channel: params.channel,
    });
    return result;
  } catch (error) {
    await deleteIdempotencyHash(
      params.tenantId,
      params.idempotencyKey,
      DELIVERY_ORDER_COMPLETE_IDEMPOTENCY_RESOURCE,
    );
    throw error;
  }
}
