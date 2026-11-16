/**
 * POST /api/v1/file-util/:id/complete
 * Verifies the uploaded bytes (size, real type, sha256) and makes the file READY. Idempotent.
 */

import { NextRequest, NextResponse } from 'next/server';
import { completeFileUpload } from '@/lib/services/file-util/file-util.service';
import {
  badRequest,
  categoryOnlySchema,
  fileErrorResponse,
  fileIdParamsSchema,
  guardFileRequest,
  readJson,
} from '@/lib/services/file-util/file-util-http';

/**
 * Completes an upload of the authenticated tenant.
 * @param request JSON body `{ category }`
 * @param ctx route params
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = fileIdParamsSchema.safeParse(await ctx.params);
  if (!params.success) return badRequest(params.error);
  const body = categoryOnlySchema.safeParse(await readJson(request));
  if (!body.success) return badRequest(body.error);

  const auth = await guardFileRequest(request, body.data.category, 'write');
  if (auth instanceof NextResponse) return auth;

  try {
    const data = await completeFileUpload(auth.tenantId, auth.userId, body.data.category, params.data.id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return fileErrorResponse(error, 'complete');
  }
}
