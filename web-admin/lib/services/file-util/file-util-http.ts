import 'server-only';

/**
 * File Util — shared HTTP adapter pieces for the `/api/v1/file-util/*` routes: request guard,
 * request schemas and error mapping. Keeps each route thin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission, type AuthContext } from '@/lib/middleware/require-permission';
import { checkAPIRateLimitTenant } from '@/lib/middleware/rate-limit';
import { logger } from '@/lib/utils/logger';
import {
  FILE_CATEGORY_ACCESS,
  FILE_CATEGORY_CODES,
  FILE_REF_TYPE_CODES,
  FILE_SOURCE_CODES,
  type FileCategoryCode,
} from '@/lib/constants/file-util';
import { FileUtilError } from './file-util.service';

export const categorySchema = z.enum(FILE_CATEGORY_CODES);
/** Accepts any 8-4-4-4-12 hex UUID (PostgreSQL/seeded IDs + RFC 4122). */
export const uuidLikeSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid UUID');
const codeSchema = z.string().regex(/^[A-Z][A-Z0-9_]{1,49}$/);

/** POST /api/v1/file-util body. */
export const initUploadSchema = z
  .object({
    category: categorySchema,
    purpose: codeSchema.optional(),
    entityId: uuidLikeSchema,
    refType: z.enum(FILE_REF_TYPE_CODES).optional(),
    refId: uuidLikeSchema.optional(),
    source: z.enum(FILE_SOURCE_CODES),
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(3).max(255),
    sizeBytes: z.number().int().positive(),
    thumbSizeBytes: z.number().int().positive().max(5 * 1048576).optional(),
    width: z.number().int().positive().max(100000).optional(),
    height: z.number().int().positive().max(100000).optional(),
    durationMs: z.number().int().nonnegative().optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((v) => (v.refType === undefined) === (v.refId === undefined), {
    message: 'refType and refId go together',
    path: ['refId'],
  });

/** POST /api/v1/file-util/sign body. */
export const signSchema = z.object({
  category: categorySchema,
  fileIds: z.array(uuidLikeSchema).min(1).max(200),
});

/** PATCH /api/v1/file-util/:id body. */
export const updateSchema = z
  .object({
    category: categorySchema,
    purpose: codeSchema.optional(),
    notes: z.string().max(2000).nullable().optional(),
    sortOrder: z.number().int().min(0).max(100000).optional(),
  })
  .refine((v) => v.purpose !== undefined || v.notes !== undefined || v.sortOrder !== undefined, {
    message: 'Nothing to update',
  });

/** Body or query that only names the category (complete, delete). */
export const categoryOnlySchema = z.object({ category: categorySchema });

export const fileIdParamsSchema = z.object({ id: uuidLikeSchema });

/**
 * Guard chain for File Util routes: CSRF on writes (blocks cross-site form posts riding the
 * session cookie) → any one of the category's read/write permissions (tenant resolved server-side
 * from the authenticated session) → per-tenant API rate limit.
 *
 * @returns the auth context, or the response to return
 */
export async function guardFileRequest(
  request: NextRequest,
  category: FileCategoryCode,
  mode: 'read' | 'write',
): Promise<AuthContext | NextResponse> {
  if (request.method !== 'GET') {
    const csrf = await validateCSRF(request);
    if (csrf) return csrf;
  }
  let auth: AuthContext | NextResponse = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  for (const code of FILE_CATEGORY_ACCESS[category][mode]) {
    auth = await requirePermission(code)(request);
    // Only a permission denial (403) tries the next code; sign-in, tenant or timeout failures are final.
    if (!(auth instanceof NextResponse) || auth.status !== 403) break;
  }
  if (auth instanceof NextResponse) return auth;
  const rateLimit = await checkAPIRateLimitTenant(auth.tenantId);
  if (rateLimit) return rateLimit;
  return auth;
}

/** 400 with the first validation problem; never echoes input. */
export function badRequest(error: z.ZodError): NextResponse {
  const issue = error.issues[0];
  return NextResponse.json(
    { success: false, code: 'INVALID_REQUEST', error: issue ? `${issue.path.join('.') || 'request'}: ${issue.message}` : 'Invalid request.' },
    { status: 400 },
  );
}

/** Maps service errors to their status; anything else is a logged 500 without internals. */
export function fileErrorResponse(error: unknown, action: string): NextResponse {
  if (error instanceof FileUtilError) {
    return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.httpStatus });
  }
  logger.error('File Util request failed', error instanceof Error ? error : new Error(String(error)), { feature: 'file-util', action });
  return NextResponse.json({ success: false, code: 'FILE_UTIL_FAILED', error: 'The file request failed.' }, { status: 500 });
}

/** Reads a JSON body; null when missing or malformed (schemas then reject it). */
export async function readJson(request: NextRequest): Promise<unknown> {
  return request.json().catch(() => null);
}
