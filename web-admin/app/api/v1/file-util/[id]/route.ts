/**
 * PATCH  /api/v1/file-util/:id  — change purpose, note or display order of a READY file.
 * DELETE /api/v1/file-util/:id?category=  — soft-delete; storage is purged by the cleanup job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { deleteFile, updateFile } from '@/lib/services/file-util/file-util.service';
import {
  badRequest,
  categoryOnlySchema,
  fileErrorResponse,
  fileIdParamsSchema,
  guardFileRequest,
  readJson,
  updateSchema,
} from '@/lib/services/file-util/file-util-http';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Updates a file of the authenticated tenant.
 * @param request JSON body (updateSchema)
 * @param ctx route params
 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const params = fileIdParamsSchema.safeParse(await ctx.params);
  if (!params.success) return badRequest(params.error);
  const body = updateSchema.safeParse(await readJson(request));
  if (!body.success) return badRequest(body.error);

  const auth = await guardFileRequest(request, body.data.category, 'write');
  if (auth instanceof NextResponse) return auth;

  try {
    const data = await updateFile({
      tenantId: auth.tenantId,
      userId: auth.userId,
      categoryCode: body.data.category,
      fileId: params.data.id,
      purposeCode: body.data.purpose,
      notes: body.data.notes,
      sortOrder: body.data.sortOrder,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return fileErrorResponse(error, 'update');
  }
}

/**
 * Soft-deletes a file of the authenticated tenant.
 * @param request `?category=` names the category the caller is authorized for
 * @param ctx route params
 */
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const params = fileIdParamsSchema.safeParse(await ctx.params);
  if (!params.success) return badRequest(params.error);
  const query = categoryOnlySchema.safeParse({ category: request.nextUrl.searchParams.get('category') });
  if (!query.success) return badRequest(query.error);

  const auth = await guardFileRequest(request, query.data.category, 'write');
  if (auth instanceof NextResponse) return auth;

  try {
    await deleteFile(auth.tenantId, auth.userId, query.data.category, params.data.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return fileErrorResponse(error, 'delete');
  }
}
