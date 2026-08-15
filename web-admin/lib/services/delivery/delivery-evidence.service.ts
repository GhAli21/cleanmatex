import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import {
  DELIVERY_EVIDENCE_BUCKET,
  DELIVERY_EVIDENCE_MAX_BYTES,
  DELIVERY_EVIDENCE_UPLOAD_TTL_MS,
  type DeliveryEvidenceType,
} from '@/lib/constants/delivery-evidence';
import { prisma } from '@/lib/db/prisma';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

/** Error codes returned by the private delivery evidence upload command. */
export type DeliveryEvidenceErrorCode =
  | 'STOP_NOT_FOUND'
  | 'STOP_NOT_ACTIVE'
  | 'EVIDENCE_EMPTY'
  | 'EVIDENCE_TOO_LARGE'
  | 'EVIDENCE_UNSUPPORTED'
  | 'EVIDENCE_UPLOAD_FAILED';

/** Stable error used by delivery adapters without exposing storage implementation details. */
export class DeliveryEvidenceError extends Error {
  /** Machine-readable classification for web, mobile, and integration callers. */
  readonly code: DeliveryEvidenceErrorCode;
  /** HTTP status appropriate for the versioned API adapter. */
  readonly httpStatus: number;

  /**
   * @param code stable failure classification
   * @param message safe operator-facing explanation
   * @param httpStatus transport status for the versioned API
   */
  constructor(code: DeliveryEvidenceErrorCode, message: string, httpStatus: number) {
    super(message);
    this.name = 'DeliveryEvidenceError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** Tenant-scoped binary evidence supplied by a web, mobile, or integration adapter. */
export interface CreateDeliveryEvidenceUploadCommand {
  /** Tenant scope resolved by the authenticated adapter, never accepted from the client body. */
  tenantId: string;
  stopId: string;
  actorUserId: string;
  evidenceType: DeliveryEvidenceType;
  content: Buffer;
}

/** Receipt returned after a private object has been stored and bound to one delivery stop. */
export interface DeliveryEvidenceUploadResult {
  evidenceId: string;
  evidenceType: DeliveryEvidenceType;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  fileSizeBytes: number;
  expiresAt: Date;
}

type DetectedImage = {
  contentType: DeliveryEvidenceUploadResult['contentType'];
  extension: 'jpeg' | 'png' | 'webp';
};

function detectImage(content: Buffer): DetectedImage | null {
  if (content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) {
    return { contentType: 'image/jpeg', extension: 'jpeg' };
  }
  if (
    content.length >= 8 &&
    content[0] === 0x89 &&
    content[1] === 0x50 &&
    content[2] === 0x4e &&
    content[3] === 0x47 &&
    content[4] === 0x0d &&
    content[5] === 0x0a &&
    content[6] === 0x1a &&
    content[7] === 0x0a
  ) {
    return { contentType: 'image/png', extension: 'png' };
  }
  if (
    content.length >= 12 &&
    content.subarray(0, 4).toString('ascii') === 'RIFF' &&
    content.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { contentType: 'image/webp', extension: 'webp' };
  }
  return null;
}

async function assertActiveStop(tenantId: string, stopId: string): Promise<void> {
  const stop = await prisma.org_dlv_stops_dtl.findFirst({
    where: {
      id: stopId,
      tenant_org_id: tenantId,
      is_active: true,
      rec_status: 1,
    },
    select: { stop_status_code: true },
  });
  if (!stop) {
    throw new DeliveryEvidenceError('STOP_NOT_FOUND', 'Delivery stop was not found.', 404);
  }

  const status = stop.stop_status_code?.trim().toLowerCase() ?? '';
  if (!['pending', 'in_transit'].includes(status)) {
    throw new DeliveryEvidenceError(
      'STOP_NOT_ACTIVE',
      'Delivery evidence can only be uploaded for an active delivery stop.',
      422,
    );
  }
}

/**
 * Stores a private proof object and creates a short-lived receipt bound to one tenant and stop.
 *
 * The storage path is generated server-side from the receipt ID. Completion later locks this
 * receipt rather than accepting an object key from the client, preventing cross-stop substitution.
 *
 * @param params authenticated evidence upload command
 * @returns receipt identifier to include in the atomic completion command
 * @throws {DeliveryEvidenceError} when the stop, binary content, or storage write is invalid
 */
export async function createDeliveryEvidenceUpload(
  params: CreateDeliveryEvidenceUploadCommand,
): Promise<DeliveryEvidenceUploadResult> {
  if (params.content.length === 0) {
    throw new DeliveryEvidenceError('EVIDENCE_EMPTY', 'Delivery evidence cannot be empty.', 422);
  }
  if (params.content.length > DELIVERY_EVIDENCE_MAX_BYTES) {
    throw new DeliveryEvidenceError(
      'EVIDENCE_TOO_LARGE',
      'Delivery evidence must not exceed 10 MB.',
      422,
    );
  }

  const detectedImage = detectImage(params.content);
  if (!detectedImage) {
    throw new DeliveryEvidenceError(
      'EVIDENCE_UNSUPPORTED',
      'Delivery evidence must be a JPEG, PNG, or WebP image.',
      422,
    );
  }

  await assertActiveStop(params.tenantId, params.stopId);

  const evidenceId = randomUUID();
  const objectKey = `${params.tenantId}/delivery/${params.stopId}/${evidenceId}.${detectedImage.extension}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DELIVERY_EVIDENCE_UPLOAD_TTL_MS);
  const sha256Hex = createHash('sha256').update(params.content).digest('hex');
  const storage = createAdminSupabaseClient().storage.from(DELIVERY_EVIDENCE_BUCKET);
  const { error: storageError } = await storage.upload(objectKey, params.content, {
    upsert: false,
    contentType: detectedImage.contentType,
  });
  if (storageError) {
    logger.error('Delivery evidence object upload failed', new Error(storageError.message), {
      tenantId: params.tenantId,
      stopId: params.stopId,
      feature: 'delivery',
      action: 'upload_evidence',
    });
    throw new DeliveryEvidenceError(
      'EVIDENCE_UPLOAD_FAILED',
      'Delivery evidence could not be stored. Try again.',
      502,
    );
  }

  try {
    await prisma.org_dlv_ev_uploads_tr.create({
      data: {
        id: evidenceId,
        tenant_org_id: params.tenantId,
        stop_id: params.stopId,
        evidence_type: params.evidenceType,
        object_key: objectKey,
        content_type: detectedImage.contentType,
        file_size_bytes: params.content.length,
        sha256_hex: sha256Hex,
        upload_status: 'uploaded',
        expires_at: expiresAt,
        created_at: now,
        created_by: params.actorUserId,
      },
    });
  } catch (error) {
    // The receipt is the authorization boundary. Remove an untracked object if its receipt cannot be committed.
    const { error: removeError } = await storage.remove([objectKey]);
    if (removeError) {
      logger.error('Delivery evidence rollback removal failed', new Error(removeError.message), {
        tenantId: params.tenantId,
        stopId: params.stopId,
        evidenceId,
        feature: 'delivery',
        action: 'upload_evidence_cleanup',
      });
    }
    logger.error(
      'Delivery evidence receipt creation failed',
      error instanceof Error ? error : new Error(String(error)),
      {
        tenantId: params.tenantId,
        stopId: params.stopId,
        evidenceId,
        feature: 'delivery',
        action: 'upload_evidence',
      },
    );
    throw new DeliveryEvidenceError(
      'EVIDENCE_UPLOAD_FAILED',
      'Delivery evidence could not be recorded. Try again.',
      500,
    );
  }

  logger.info('Delivery evidence upload receipt created', {
    tenantId: params.tenantId,
    stopId: params.stopId,
    evidenceId,
    evidenceType: params.evidenceType,
    feature: 'delivery',
    action: 'upload_evidence',
  });
  return {
    evidenceId,
    evidenceType: params.evidenceType,
    contentType: detectedImage.contentType,
    fileSizeBytes: params.content.length,
    expiresAt,
  };
}
