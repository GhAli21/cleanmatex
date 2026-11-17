import 'server-only';

/**
 * File Util service — the only writer of `org_file_mst` and of objects in File Util buckets.
 *
 * Upload flow: `initFileUpload` (rules, ownership, limits, quota → PENDING row + signed upload
 * URL) → browser PUTs bytes straight to storage → `completeFileUpload` (real size, content type,
 * sha256 → READY). Reads return URLs built on demand; keys are stored, URLs never are.
 *
 * Every `org_*` query carries the caller's `tenant_org_id` (tenant resolved server-side from the
 * authenticated session by the route). Purging bytes of DELETED files is the HQ platform-workers
 * job `file-util-purge`; expiring abandoned uploads is the DB function `fn_file_util_expire_pending`.
 */

import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { canStoreBytes } from '@/lib/services/usage-tracking.service';
import {
  FILE_PENDING_TTL_MS,
  FILE_SIGNED_URL_TTL_SECONDS,
  FILE_STATUSES,
  FILE_THUMB_MIME,
  type FileCategoryCode,
  type FileRefTypeCode,
  type FileSourceCode,
} from '@/lib/constants/file-util';
import { canVerifyMime, contentMatchesMime, fileExtension } from './file-sniff';

// ─── Errors ─────────────────────────────────────────────────────────────────

/** Stable error codes returned by File Util adapters (web, mobile, integrations). */
export type FileUtilErrorCode =
  | 'CATEGORY_UNAVAILABLE'
  | 'PURPOSE_UNAVAILABLE'
  | 'TYPE_NOT_ALLOWED'
  | 'EXTENSION_MISMATCH'
  | 'FILE_TOO_LARGE'
  | 'ENTITY_NOT_FOUND'
  | 'REF_NOT_FOUND'
  | 'LIMIT_REACHED'
  | 'QUOTA_EXCEEDED'
  | 'PLAN_UNAVAILABLE'
  | 'FILE_NOT_FOUND'
  | 'UPLOAD_MISSING'
  | 'CONTENT_MISMATCH'
  | 'SIZE_MISMATCH'
  | 'STORAGE_FAILED';

/** Safe, typed failure; `message` is operator-facing English, UIs map `code` to i18n. */
export class FileUtilError extends Error {
  readonly code: FileUtilErrorCode;
  readonly httpStatus: number;

  /**
   * @param code stable failure classification
   * @param message safe explanation (no storage internals)
   * @param httpStatus status for the versioned API
   */
  constructor(code: FileUtilErrorCode, message: string, httpStatus: number) {
    super(message);
    this.name = 'FileUtilError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

/** Upload request after route validation; tenant and user come from the session, never the body. */
export interface InitFileUploadCommand {
  tenantId: string;
  userId: string;
  categoryCode: FileCategoryCode;
  /** Omitted = the category's default purpose. */
  purposeCode?: string;
  entityId: string;
  refTypeCode?: FileRefTypeCode;
  refId?: string;
  sourceCode: FileSourceCode;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Size of the browser-made WebP thumbnail; omitted when none will be uploaded. */
  thumbSizeBytes?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  notes?: string;
}

/** Where and how the browser uploads; the signed URLs are single-use and short-lived. */
export interface InitFileUploadResult {
  fileId: string;
  upload: { path: string; token: string; signedUrl: string };
  thumbUpload: { path: string; token: string; signedUrl: string } | null;
}

/** File as returned to clients. URLs are fresh (private: 5-minute signed; public: stable). */
export interface FileView {
  id: string;
  categoryCode: string;
  purposeCode: string;
  entityId: string;
  refTypeCode: string | null;
  refId: string | null;
  sourceCode: string;
  notes: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  sortOrder: number;
  createdAt: string;
  createdBy: string | null;
  url: string;
  thumbUrl: string | null;
}

/** List filter for one or many records of one category. */
export interface ListFilesQuery {
  tenantId: string;
  categoryCode: FileCategoryCode;
  entityIds: string[];
  purposeCodes?: string[];
  refTypeCode?: FileRefTypeCode;
  refId?: string;
}

/** Editable fields of a READY file. */
export interface UpdateFileCommand {
  tenantId: string;
  userId: string;
  categoryCode: FileCategoryCode;
  fileId: string;
  purposeCode?: string;
  notes?: string | null;
  sortOrder?: number;
}

const FILE_VIEW_SELECT = {
  id: true,
  category_code: true,
  purpose_code: true,
  entity_id: true,
  ref_type_code: true,
  ref_id: true,
  source_code: true,
  notes: true,
  original_name: true,
  mime_type: true,
  size_bytes: true,
  width: true,
  height: true,
  duration_ms: true,
  sort_order: true,
  created_at: true,
  created_by: true,
  bucket_code: true,
  object_key: true,
  thumb_object_key: true,
} satisfies Prisma.org_file_mstSelect;
type FileViewRow = Prisma.org_file_mstGetPayload<{ select: typeof FILE_VIEW_SELECT }>;

// ─── Rules ──────────────────────────────────────────────────────────────────

type ResolvedRules = {
  bucketCode: string;
  storageBucketId: string;
  isPublic: boolean;
  purposeCode: string;
  purposeMaxFiles: number | null;
  categoryMaxFiles: number | null;
  maxSizeBytes: number;
  extensions: string[];
};

/**
 * Loads the category, purpose, bucket and allowed type in one place; every rule is data
 * (sys_file_* tables), so HQ changes apply to the next upload without a deploy.
 */
async function resolveRules(categoryCode: string, purposeCode: string | undefined, mimeType: string): Promise<ResolvedRules> {
  const category = await prisma.sys_file_category_cd.findFirst({
    where: { category_code: categoryCode, is_active: true, rec_status: 1 },
    select: {
      max_size_bytes: true,
      max_files_per_entity: true,
      sys_file_bucket_cd: { select: { bucket_code: true, storage_bucket_id: true, is_public: true, scope_code: true, is_active: true } },
    },
  });
  const bucket = category?.sys_file_bucket_cd;
  // A tenant category must write to an active TENANT bucket (cross-table rule the DB cannot hold).
  if (!category || !bucket || !bucket.is_active || bucket.scope_code !== 'TENANT') {
    throw new FileUtilError('CATEGORY_UNAVAILABLE', 'This file category is not available.', 422);
  }

  const purpose = await prisma.sys_file_purpose_cd.findFirst({
    where: purposeCode
      ? { category_code: categoryCode, purpose_code: purposeCode, is_active: true, rec_status: 1 }
      : { category_code: categoryCode, is_default: true, is_active: true, rec_status: 1 },
    select: { purpose_code: true, max_files: true, max_size_bytes: true },
  });
  if (!purpose) {
    throw new FileUtilError('PURPOSE_UNAVAILABLE', 'This file purpose is not available.', 422);
  }

  const link = await prisma.sys_file_purpose_mime_dtl.findFirst({
    where: {
      category_code: categoryCode,
      purpose_code: purpose.purpose_code,
      mime_type: mimeType,
      is_active: true,
      rec_status: 1,
      sys_file_mime_types_cd: { is_allowed: true, is_active: true, rec_status: 1 },
    },
    select: { sys_file_mime_types_cd: { select: { extensions: true } } },
  });
  if (!link || !canVerifyMime(mimeType)) {
    throw new FileUtilError('TYPE_NOT_ALLOWED', 'This file type is not allowed here.', 422);
  }

  return {
    bucketCode: bucket.bucket_code,
    storageBucketId: bucket.storage_bucket_id,
    isPublic: bucket.is_public,
    purposeCode: purpose.purpose_code,
    purposeMaxFiles: purpose.max_files,
    categoryMaxFiles: category.max_files_per_entity,
    maxSizeBytes: Number(purpose.max_size_bytes ?? category.max_size_bytes),
    extensions: link.sys_file_mime_types_cd.extensions,
  };
}

/** The owning record must exist in the caller's organization. */
async function assertEntityOwned(tenantId: string, categoryCode: FileCategoryCode, entityId: string): Promise<void> {
  const where = { id: entityId, tenant_org_id: tenantId };
  let found: unknown;
  switch (categoryCode) {
    case 'ORDER_FILE':
      found = await prisma.org_orders_mst.findFirst({ where, select: { id: true } });
      break;
    case 'CUSTOMER_FILE':
      found = await prisma.org_customers_mst.findFirst({ where, select: { id: true } });
      break;
    case 'PRODUCT_IMAGE':
      found = await prisma.org_product_data_mst.findFirst({ where, select: { id: true } });
      break;
    case 'TENANT_LOGO':
      found = entityId === tenantId ? entityId : null;
      break;
  }
  if (!found) throw new FileUtilError('ENTITY_NOT_FOUND', 'The record was not found.', 404);
}

/** A sub-record must belong to the same order (entity) and organization. */
async function assertRefOwned(tenantId: string, orderId: string, refTypeCode: FileRefTypeCode, refId: string): Promise<void> {
  const where = { id: refId, tenant_org_id: tenantId, order_id: orderId };
  const select = { id: true } as const;
  let found: unknown;
  switch (refTypeCode) {
    case 'ORDER_ITEM':
      found = await prisma.org_order_items_dtl.findFirst({ where, select });
      break;
    case 'ORDER_PIECE':
      found = await prisma.org_order_item_pieces_dtl.findFirst({ where, select });
      break;
    case 'ORDER_ISSUE':
      found = await prisma.org_order_issues.findFirst({ where, select });
      break;
    case 'DELIVERY_STOP':
      found = await prisma.org_dlv_stops_dtl.findFirst({ where, select });
      break;
    case 'QA_DECISION':
      found = await prisma.org_qa_decisions_tr.findFirst({ where, select });
      break;
    case 'ASM_TASK':
      found = await prisma.org_asm_tasks_mst.findFirst({ where, select });
      break;
    case 'ASM_EXCEPTION': {
      // Exceptions hang off an assembly task; the task carries the order.
      const exception = await prisma.org_asm_exceptions_tr.findFirst({
        where: { id: refId, tenant_org_id: tenantId },
        select: { task_id: true },
      });
      found = exception
        ? await prisma.org_asm_tasks_mst.findFirst({ where: { id: exception.task_id, tenant_org_id: tenantId, order_id: orderId }, select })
        : null;
      break;
    }
  }
  if (!found) throw new FileUtilError('REF_NOT_FOUND', 'The referenced order detail was not found.', 404);
}

// ─── Storage helpers ────────────────────────────────────────────────────────

function storageFor(storageBucketId: string) {
  return createAdminSupabaseClient().storage.from(storageBucketId);
}

async function removeObjects(storageBucketId: string, keys: string[], context: Record<string, unknown>): Promise<boolean> {
  if (keys.length === 0) return true;
  const { error } = await storageFor(storageBucketId).remove(keys);
  if (error) {
    logger.error('File Util object removal failed', new Error(error.message), { ...context, feature: 'file-util' });
    return false;
  }
  return true;
}

async function bucketIdOf(bucketCode: string): Promise<{ storageBucketId: string; isPublic: boolean }> {
  const bucket = await prisma.sys_file_bucket_cd.findUniqueOrThrow({
    where: { bucket_code: bucketCode },
    select: { storage_bucket_id: true, is_public: true },
  });
  return { storageBucketId: bucket.storage_bucket_id, isPublic: bucket.is_public };
}

// ─── Published URLs ─────────────────────────────────────────────────────────

/**
 * Single-slot purposes whose public URL is published on the owning record, for readers that only
 * know a URL column (receipts, mobile app, public booking, HQ): PRODUCT_IMAGE/MAIN →
 * `org_product_data_mst.product_image`, TENANT_LOGO/MAIN → `org_tenants_mst.logo_url`.
 * The file row stays the truth; the column is rewritten in the same transaction as every change
 * to that slot (decision 14 in docs/features/File_Util/PLAN.md).
 */
const PUBLISHED_URL_PURPOSE: Partial<Record<FileCategoryCode, string>> = {
  PRODUCT_IMAGE: 'MAIN',
  TENANT_LOGO: 'MAIN',
};

function publishesUrl(categoryCode: FileCategoryCode, purposeCode: string): boolean {
  return PUBLISHED_URL_PURPOSE[categoryCode] === purposeCode;
}

/** Rewrites the owning record's URL column from the slot's current READY file (or clears it). */
async function syncPublishedUrl(tx: Prisma.TransactionClient, tenantId: string, userId: string, categoryCode: FileCategoryCode, entityId: string): Promise<void> {
  const purposeCode = PUBLISHED_URL_PURPOSE[categoryCode];
  if (!purposeCode) return;
  const file = await tx.org_file_mst.findFirst({
    where: { tenant_org_id: tenantId, category_code: categoryCode, entity_id: entityId, purpose_code: purposeCode, status_code: FILE_STATUSES.READY },
    orderBy: { ready_at: 'desc' },
    select: { bucket_code: true, object_key: true },
  });
  let url: string | null = null;
  if (file) {
    const bucket = await bucketIdOf(file.bucket_code);
    // A private bucket has no lasting URL; publishing a signed one would break after 5 minutes.
    if (bucket.isPublic) url = storageFor(bucket.storageBucketId).getPublicUrl(file.object_key).data.publicUrl;
    else logger.warn('File Util published slot is in a private bucket; URL column cleared', { tenantId, categoryCode, feature: 'file-util' });
  }
  const audit = { updated_at: new Date(), updated_by: userId, updated_info: 'file-util:published-url' };
  if (categoryCode === 'PRODUCT_IMAGE') {
    await tx.org_product_data_mst.updateMany({ where: { id: entityId, tenant_org_id: tenantId }, data: { product_image: url, ...audit } });
  } else if (categoryCode === 'TENANT_LOGO') {
    // The organization row is the tenant itself: its id is the tenant id.
    await tx.org_tenants_mst.updateMany({ where: { id: tenantId }, data: { logo_url: url, ...audit } });
  }
}

/** Marks a file DELETED with the standard soft-delete columns (ck_ofm_rec_sync). */
function softDeleteData(userId: string, info: string) {
  return {
    status_code: FILE_STATUSES.DELETED,
    deleted_at: new Date(),
    deleted_by: userId,
    deleted_info: info,
    rec_status: 0,
    is_active: false,
    updated_by: userId,
  };
}

// ─── Commands ───────────────────────────────────────────────────────────────

/**
 * Validates an upload against the category/purpose rules, record ownership, file limits and the
 * plan storage quota, then reserves a PENDING row and returns signed upload URLs.
 *
 * Limits are counted under a transaction advisory lock per (tenant, category, record), so two
 * uploads at once cannot both take the last slot. PENDING rows count as taken until they
 * complete or expire. A single-slot purpose (max_files = 1) replaces its file on completion.
 *
 * @param cmd validated upload request; `tenantId` is resolved server-side from the session
 * @returns file id plus signed upload targets
 * @throws {FileUtilError} on any rule, ownership, limit, quota or storage failure
 * @example
 * await initFileUpload({ tenantId, userId, categoryCode: 'ORDER_FILE', entityId: orderId,
 *   sourceCode: 'ORDER_DETAIL', fileName: 'stain.jpg', mimeType: 'image/jpeg', sizeBytes: 182340 });
 */
export async function initFileUpload(cmd: InitFileUploadCommand): Promise<InitFileUploadResult> {
  const mimeType = cmd.mimeType.toLowerCase();
  const rules = await resolveRules(cmd.categoryCode, cmd.purposeCode, mimeType);

  if (!rules.extensions.includes(fileExtension(cmd.fileName))) {
    throw new FileUtilError('EXTENSION_MISMATCH', 'The file name extension does not match its type.', 422);
  }
  if (cmd.sizeBytes > rules.maxSizeBytes) {
    throw new FileUtilError('FILE_TOO_LARGE', `The file is larger than the ${Math.floor(rules.maxSizeBytes / 1048576)} MB limit.`, 422);
  }

  await assertEntityOwned(cmd.tenantId, cmd.categoryCode, cmd.entityId);
  if (cmd.refTypeCode && cmd.refId) {
    await assertRefOwned(cmd.tenantId, cmd.entityId, cmd.refTypeCode, cmd.refId);
  }

  const totalBytes = cmd.sizeBytes + (cmd.thumbSizeBytes ?? 0);
  // Fail closed like order creation: no plan means no known limit.
  const quota = await canStoreBytes(cmd.tenantId, totalBytes).catch((error: unknown) => {
    logger.error('File Util quota check failed', error instanceof Error ? error : new Error(String(error)), { tenantId: cmd.tenantId, feature: 'file-util', action: 'init' });
    throw new FileUtilError('PLAN_UNAVAILABLE', 'No active plan was found for this organization.', 503);
  });
  if (!quota.canProceed) {
    throw new FileUtilError('QUOTA_EXCEEDED', quota.message ?? 'Storage limit reached. Please upgrade your plan.', 422);
  }

  const fileId = randomUUID();
  const folder = `${cmd.tenantId}/${cmd.categoryCode}/${cmd.entityId}/`;
  const objectKey = `${folder}${fileId}.${rules.extensions[0]}`;
  const thumbKey = cmd.thumbSizeBytes ? `${folder}${fileId}_thumb.webp` : null;
  const replacesSlot = rules.purposeMaxFiles === 1;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`file-util:${cmd.tenantId}:${cmd.categoryCode}:${cmd.entityId}`}::text, 0))`;
    const live = {
      tenant_org_id: cmd.tenantId,
      category_code: cmd.categoryCode,
      entity_id: cmd.entityId,
      OR: [
        { status_code: FILE_STATUSES.READY },
        { status_code: FILE_STATUSES.PENDING, created_at: { gt: new Date(Date.now() - FILE_PENDING_TTL_MS) } },
      ],
    } satisfies Prisma.org_file_mstWhereInput;

    if (!replacesSlot && rules.purposeMaxFiles !== null) {
      const inPurpose = await tx.org_file_mst.count({ where: { ...live, purpose_code: rules.purposeCode } });
      if (inPurpose >= rules.purposeMaxFiles) {
        throw new FileUtilError('LIMIT_REACHED', `This record already has the maximum ${rules.purposeMaxFiles} files of this kind.`, 409);
      }
    }
    if (rules.categoryMaxFiles !== null) {
      const inCategory = await tx.org_file_mst.count({ where: live });
      // A replacement frees its old slot on completion, so it never grows the total.
      const replacing = replacesSlot && (await tx.org_file_mst.count({ where: { ...live, purpose_code: rules.purposeCode, status_code: FILE_STATUSES.READY } })) > 0;
      if (!replacing && inCategory >= rules.categoryMaxFiles) {
        throw new FileUtilError('LIMIT_REACHED', `This record already has the maximum ${rules.categoryMaxFiles} files.`, 409);
      }
    }

    await tx.org_file_mst.create({
      data: {
        id: fileId,
        tenant_org_id: cmd.tenantId,
        category_code: cmd.categoryCode,
        purpose_code: rules.purposeCode,
        entity_id: cmd.entityId,
        ref_type_code: cmd.refTypeCode ?? null,
        ref_id: cmd.refId ?? null,
        source_code: cmd.sourceCode,
        notes: cmd.notes?.trim() || null,
        bucket_code: rules.bucketCode,
        object_key: objectKey,
        thumb_object_key: thumbKey,
        original_name: cmd.fileName.trim(),
        mime_type: mimeType,
        size_bytes: BigInt(cmd.sizeBytes),
        width: cmd.width ?? null,
        height: cmd.height ?? null,
        duration_ms: cmd.durationMs ?? null,
        status_code: FILE_STATUSES.PENDING,
        created_by: cmd.userId,
        created_info: 'file-util:init',
      },
    });
  });

  const storage = storageFor(rules.storageBucketId);
  const main = await storage.createSignedUploadUrl(objectKey);
  const thumb = thumbKey ? await storage.createSignedUploadUrl(thumbKey) : null;
  if (main.error || !main.data || (thumb && (thumb.error || !thumb.data))) {
    // Leave the PENDING row to the cleanup job; nothing was written to storage.
    logger.error('File Util signed upload URL failed', new Error(main.error?.message ?? thumb?.error?.message ?? 'no data'), {
      tenantId: cmd.tenantId, fileId, feature: 'file-util', action: 'init',
    });
    throw new FileUtilError('STORAGE_FAILED', 'The upload could not be prepared. Try again.', 502);
  }

  return {
    fileId,
    upload: { path: main.data.path, token: main.data.token, signedUrl: main.data.signedUrl },
    thumbUpload: thumb?.data ? { path: thumb.data.path, token: thumb.data.token, signedUrl: thumb.data.signedUrl } : null,
  };
}

/**
 * Verifies the uploaded object (exists, exact declared size, real content type, sha256) and
 * marks the file READY. Idempotent: completing a READY file returns it unchanged. On a content or
 * size mismatch the objects are removed and the file is DELETED.
 *
 * @param tenantId organization resolved server-side from the session
 * @param userId acting user
 * @param categoryCode category the caller is authorized for; must match the file
 * @param fileId file returned by `initFileUpload`
 * @returns the READY file with fresh URLs
 * @throws {FileUtilError} FILE_NOT_FOUND, UPLOAD_MISSING, SIZE_MISMATCH, CONTENT_MISMATCH
 */
export async function completeFileUpload(tenantId: string, userId: string, categoryCode: FileCategoryCode, fileId: string): Promise<FileView> {
  const file = await prisma.org_file_mst.findFirst({
    where: { id: fileId, tenant_org_id: tenantId, category_code: categoryCode },
    select: {
      status_code: true, bucket_code: true, object_key: true, thumb_object_key: true, mime_type: true,
      size_bytes: true, purpose_code: true, entity_id: true,
      sys_file_purpose_cd: { select: { max_files: true } },
    },
  });
  if (!file || file.status_code === FILE_STATUSES.DELETED) {
    throw new FileUtilError('FILE_NOT_FOUND', 'The file was not found.', 404);
  }
  if (file.status_code === FILE_STATUSES.READY) return (await viewFiles([await loadViewRow(tenantId, fileId)]))[0];

  const { storageBucketId } = await bucketIdOf(file.bucket_code);
  const storage = storageFor(storageBucketId);
  const context = { tenantId, fileId, action: 'complete' };

  // shortcut: downloads the whole object (≤ bucket ceiling, 50 MB) to hash and check it; stream it if limits grow.
  const { data: blob, error } = await storage.download(file.object_key);
  if (error || !blob) throw new FileUtilError('UPLOAD_MISSING', 'The file was not uploaded yet.', 409);
  const bytes = Buffer.from(await blob.arrayBuffer());

  const reject = async (code: FileUtilErrorCode, message: string): Promise<never> => {
    await removeObjects(storageBucketId, [file.object_key, ...(file.thumb_object_key ? [file.thumb_object_key] : [])], context);
    await prisma.org_file_mst.updateMany({
      where: { id: fileId, tenant_org_id: tenantId, status_code: FILE_STATUSES.PENDING },
      data: { ...softDeleteData(userId, `file-util:rejected:${code}`), purged_at: new Date() },
    });
    throw new FileUtilError(code, message, 422);
  };

  // The quota and limits were checked against the declared size, so it must be exact.
  if (BigInt(bytes.length) !== file.size_bytes) await reject('SIZE_MISMATCH', 'The uploaded file size does not match.');
  if (!contentMatchesMime(file.mime_type, bytes)) await reject('CONTENT_MISMATCH', 'The file content does not match its type.');

  let thumbSize: bigint | null = null;
  let thumbKey = file.thumb_object_key;
  if (thumbKey) {
    const thumb = await storage.download(thumbKey);
    const thumbBytes = thumb.data ? Buffer.from(await thumb.data.arrayBuffer()) : null;
    if (thumbBytes && contentMatchesMime(FILE_THUMB_MIME, thumbBytes)) {
      thumbSize = BigInt(thumbBytes.length);
    } else {
      // A missing or invalid thumbnail is not fatal: drop it and show the full image instead.
      if (thumbBytes) await removeObjects(storageBucketId, [thumbKey], context);
      thumbKey = null;
    }
  }

  const sha256Hex = createHash('sha256').update(bytes).digest('hex');
  const replaced: { object_key: string; thumb_object_key: string | null }[] = [];
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`file-util:${tenantId}:${categoryCode}:${file.entity_id}`}::text, 0))`;
    const updated = await tx.org_file_mst.updateMany({
      where: { id: fileId, tenant_org_id: tenantId, status_code: FILE_STATUSES.PENDING },
      data: {
        status_code: FILE_STATUSES.READY,
        ready_at: new Date(),
        sha256_hex: sha256Hex,
        thumb_object_key: thumbKey,
        thumb_size_bytes: thumbSize,
        updated_by: userId,
        updated_info: 'file-util:complete',
      },
    });
    if (updated.count === 0) return; // a concurrent complete won the race; result is the same
    if (file.sys_file_purpose_cd.max_files === 1) {
      const slot = { tenant_org_id: tenantId, category_code: categoryCode, entity_id: file.entity_id, purpose_code: file.purpose_code, status_code: FILE_STATUSES.READY, id: { not: fileId } };
      replaced.push(...(await tx.org_file_mst.findMany({ where: slot, select: { object_key: true, thumb_object_key: true } })));
      await tx.org_file_mst.updateMany({ where: slot, data: softDeleteData(userId, 'file-util:replaced') });
    }
    if (publishesUrl(categoryCode, file.purpose_code)) await syncPublishedUrl(tx, tenantId, userId, categoryCode, file.entity_id);
  });
  // Replaced objects are left for the purge sweep (DELETED, purged_at NULL), so a storage hiccup never loses the new file.

  logger.info('File Util upload completed', { tenantId, fileId, categoryCode, replaced: replaced.length, feature: 'file-util', action: 'complete' });
  return (await viewFiles([await loadViewRow(tenantId, fileId)]))[0];
}

async function loadViewRow(tenantId: string, fileId: string): Promise<FileViewRow> {
  const row = await prisma.org_file_mst.findFirst({ where: { id: fileId, tenant_org_id: tenantId }, select: FILE_VIEW_SELECT });
  if (!row) throw new FileUtilError('FILE_NOT_FOUND', 'The file was not found.', 404);
  return row;
}

/** Builds client views with fresh URLs: one batch signing call per private bucket. */
async function viewFiles(rows: FileViewRow[]): Promise<FileView[]> {
  const buckets = new Map<string, { storageBucketId: string; isPublic: boolean }>();
  for (const code of new Set(rows.map((r) => r.bucket_code))) buckets.set(code, await bucketIdOf(code));

  const urls = new Map<string, string>();
  for (const [code, bucket] of buckets) {
    const keys = rows.filter((r) => r.bucket_code === code).flatMap((r) => (r.thumb_object_key ? [r.object_key, r.thumb_object_key] : [r.object_key]));
    const storage = storageFor(bucket.storageBucketId);
    if (bucket.isPublic) {
      for (const key of keys) urls.set(key, storage.getPublicUrl(key).data.publicUrl);
      continue;
    }
    const { data, error } = await storage.createSignedUrls(keys, FILE_SIGNED_URL_TTL_SECONDS);
    if (error || !data) throw new FileUtilError('STORAGE_FAILED', 'Files could not be opened. Try again.', 502);
    for (const item of data) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }

  return rows.map((r) => ({
    id: r.id,
    categoryCode: r.category_code,
    purposeCode: r.purpose_code,
    entityId: r.entity_id,
    refTypeCode: r.ref_type_code,
    refId: r.ref_id,
    sourceCode: r.source_code,
    notes: r.notes,
    originalName: r.original_name,
    mimeType: r.mime_type,
    sizeBytes: Number(r.size_bytes),
    width: r.width,
    height: r.height,
    durationMs: r.duration_ms,
    sortOrder: r.sort_order,
    createdAt: r.created_at.toISOString(),
    createdBy: r.created_by,
    url: urls.get(r.object_key) ?? '',
    thumbUrl: r.thumb_object_key ? urls.get(r.thumb_object_key) ?? null : null,
  }));
}

/**
 * READY files of one or many records of a category, optionally narrowed to purposes or one
 * sub-record, in display order, with fresh URLs.
 *
 * @param q filter; `tenantId` resolved server-side from the session
 * @returns files ordered by record, purpose, sort order, upload time
 * @example
 * await listFiles({ tenantId, categoryCode: 'ORDER_FILE', entityIds: [orderId], purposeCodes: ['DAMAGE'] });
 */
export async function listFiles(q: ListFilesQuery): Promise<FileView[]> {
  const rows = await prisma.org_file_mst.findMany({
    where: {
      tenant_org_id: q.tenantId,
      category_code: q.categoryCode,
      entity_id: { in: q.entityIds },
      status_code: FILE_STATUSES.READY,
      ...(q.purposeCodes?.length ? { purpose_code: { in: q.purposeCodes } } : {}),
      ...(q.refTypeCode && q.refId ? { ref_type_code: q.refTypeCode, ref_id: q.refId } : {}),
    },
    select: FILE_VIEW_SELECT,
    orderBy: [{ entity_id: 'asc' }, { purpose_code: 'asc' }, { sort_order: 'asc' }, { created_at: 'asc' }],
  });
  return rows.length ? viewFiles(rows) : [];
}

/**
 * Fresh URLs for files already shown (e.g. after the 5-minute links expire).
 *
 * @param tenantId organization resolved server-side from the session
 * @param categoryCode category the caller may read; files of other categories are ignored
 * @param fileIds READY files to sign
 */
export async function signFiles(tenantId: string, categoryCode: FileCategoryCode, fileIds: string[]): Promise<FileView[]> {
  const rows = await prisma.org_file_mst.findMany({
    where: { tenant_org_id: tenantId, category_code: categoryCode, id: { in: fileIds }, status_code: FILE_STATUSES.READY },
    select: FILE_VIEW_SELECT,
  });
  return rows.length ? viewFiles(rows) : [];
}

/**
 * Changes purpose, note or display order of a READY file. A new purpose must accept the file's
 * type and have room (single-slot purposes are not a move target while occupied).
 *
 * @param cmd edit; `tenantId` resolved server-side from the session
 * @returns the updated file with fresh URLs
 */
export async function updateFile(cmd: UpdateFileCommand): Promise<FileView> {
  const file = await prisma.org_file_mst.findFirst({
    where: { id: cmd.fileId, tenant_org_id: cmd.tenantId, category_code: cmd.categoryCode, status_code: FILE_STATUSES.READY },
    select: { mime_type: true, purpose_code: true, entity_id: true },
  });
  if (!file) throw new FileUtilError('FILE_NOT_FOUND', 'The file was not found.', 404);

  await prisma.$transaction(async (tx) => {
    if (cmd.purposeCode && cmd.purposeCode !== file.purpose_code) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`file-util:${cmd.tenantId}:${cmd.categoryCode}:${file.entity_id}`}::text, 0))`;
      const rules = await resolveRules(cmd.categoryCode, cmd.purposeCode, file.mime_type);
      if (rules.purposeMaxFiles !== null) {
        const used = await tx.org_file_mst.count({
          where: { tenant_org_id: cmd.tenantId, category_code: cmd.categoryCode, entity_id: file.entity_id, purpose_code: rules.purposeCode, status_code: { in: [FILE_STATUSES.READY, FILE_STATUSES.PENDING] } },
        });
        if (used >= rules.purposeMaxFiles) {
          throw new FileUtilError('LIMIT_REACHED', 'That kind of file is already at its maximum for this record.', 409);
        }
      }
    }
    await tx.org_file_mst.updateMany({
      where: { id: cmd.fileId, tenant_org_id: cmd.tenantId, status_code: FILE_STATUSES.READY },
      data: {
        ...(cmd.purposeCode ? { purpose_code: cmd.purposeCode } : {}),
        ...(cmd.notes !== undefined ? { notes: cmd.notes?.trim() || null } : {}),
        ...(cmd.sortOrder !== undefined ? { sort_order: cmd.sortOrder } : {}),
        updated_by: cmd.userId,
        updated_info: 'file-util:update',
      },
    });
    // Moving a file into or out of a published slot changes the record's URL.
    const moved = cmd.purposeCode && cmd.purposeCode !== file.purpose_code;
    if (moved && (publishesUrl(cmd.categoryCode, file.purpose_code) || publishesUrl(cmd.categoryCode, cmd.purposeCode!))) {
      await syncPublishedUrl(tx, cmd.tenantId, cmd.userId, cmd.categoryCode, file.entity_id);
    }
  });
  return (await viewFiles([await loadViewRow(cmd.tenantId, cmd.fileId)]))[0];
}

/**
 * Soft-deletes a file (READY or an unfinished upload). Storage objects are removed by the purge
 * sweep, so the row stays for audit.
 *
 * @param tenantId organization resolved server-side from the session
 * @param userId acting user
 * @param categoryCode category the caller may change; must match the file
 * @param fileId file to delete
 */
export async function deleteFile(tenantId: string, userId: string, categoryCode: FileCategoryCode, fileId: string): Promise<void> {
  const where = { id: fileId, tenant_org_id: tenantId, category_code: categoryCode, status_code: { in: [FILE_STATUSES.READY, FILE_STATUSES.PENDING] } };
  await prisma.$transaction(async (tx) => {
    const file = await tx.org_file_mst.findFirst({ where, select: { entity_id: true, purpose_code: true, status_code: true } });
    if (!file) throw new FileUtilError('FILE_NOT_FOUND', 'The file was not found.', 404);
    const result = await tx.org_file_mst.updateMany({ where, data: softDeleteData(userId, 'file-util:delete') });
    if (result.count === 0) throw new FileUtilError('FILE_NOT_FOUND', 'The file was not found.', 404);
    if (file.status_code === FILE_STATUSES.READY && publishesUrl(categoryCode, file.purpose_code)) {
      await syncPublishedUrl(tx, tenantId, userId, categoryCode, file.entity_id);
    }
  });
}

/** Upload rules of one category as the UI needs them (purpose picker, accept list, limits). */
export interface FileCategoryConfig {
  categoryCode: string;
  maxSizeBytes: number;
  maxFilesPerEntity: number | null;
  imageMaxDimension: number | null;
  isPublic: boolean;
  purposes: {
    purposeCode: string;
    name: string;
    name2: string | null;
    isDefault: boolean;
    maxFiles: number | null;
    maxSizeBytes: number;
    mimeTypes: { mimeType: string; kindCode: string; previewCode: string; extensions: string[] }[];
  }[];
}

/**
 * Active purposes of a category, in display order, each with its active allowed types.
 * Global reference data (no tenant rows).
 *
 * @param categoryCode category to describe
 * @throws {FileUtilError} CATEGORY_UNAVAILABLE when the category is missing or inactive
 * @example
 * const cfg = await getCategoryConfig('ORDER_FILE'); // cfg.purposes[0].purposeCode === 'BEFORE_IMAGE'
 */
export async function getCategoryConfig(categoryCode: FileCategoryCode): Promise<FileCategoryConfig> {
  const category = await prisma.sys_file_category_cd.findFirst({
    where: { category_code: categoryCode, is_active: true, rec_status: 1 },
    select: {
      max_size_bytes: true,
      max_files_per_entity: true,
      image_max_dimension: true,
      sys_file_bucket_cd: { select: { is_public: true } },
      sys_file_purpose_cd: {
        where: { is_active: true, rec_status: 1 },
        orderBy: [{ rec_order: 'asc' }, { purpose_code: 'asc' }],
        select: {
          purpose_code: true, name: true, name2: true, is_default: true, max_files: true, max_size_bytes: true,
          sys_file_purpose_mime_dtl: {
            where: { is_active: true, rec_status: 1, sys_file_mime_types_cd: { is_allowed: true, is_active: true, rec_status: 1 } },
            orderBy: [{ rec_order: 'asc' }],
            select: { sys_file_mime_types_cd: { select: { mime_type: true, kind_code: true, preview_code: true, extensions: true } } },
          },
        },
      },
    },
  });
  if (!category) throw new FileUtilError('CATEGORY_UNAVAILABLE', 'This file category is not available.', 422);

  return {
    categoryCode,
    maxSizeBytes: Number(category.max_size_bytes),
    maxFilesPerEntity: category.max_files_per_entity,
    imageMaxDimension: category.image_max_dimension,
    isPublic: category.sys_file_bucket_cd.is_public,
    purposes: category.sys_file_purpose_cd.map((p) => ({
      purposeCode: p.purpose_code,
      name: p.name,
      name2: p.name2,
      isDefault: p.is_default,
      maxFiles: p.max_files,
      maxSizeBytes: Number(p.max_size_bytes ?? category.max_size_bytes),
      mimeTypes: p.sys_file_purpose_mime_dtl
        .map((l) => l.sys_file_mime_types_cd)
        // Types the server cannot verify would be refused at upload; do not offer them.
        .filter((m) => canVerifyMime(m.mime_type))
        .map((m) => ({ mimeType: m.mime_type, kindCode: m.kind_code, previewCode: m.preview_code, extensions: m.extensions })),
    })),
  };
}
