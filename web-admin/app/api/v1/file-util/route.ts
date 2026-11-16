/**
 * GET  /api/v1/file-util?category=&entityIds=a,b&purposes=X,Y&refType=&refId=
 *      READY files of one or many records with fresh URLs (one call per list screen).
 * POST /api/v1/file-util
 *      Starts an upload: checks rules, ownership, limits, quota; returns signed upload URLs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FILE_LIST_MAX_ENTITIES, FILE_REF_TYPE_CODES } from '@/lib/constants/file-util';
import { initFileUpload, listFiles } from '@/lib/services/file-util/file-util.service';
import {
  badRequest,
  categorySchema,
  fileErrorResponse,
  guardFileRequest,
  initUploadSchema,
  readJson,
} from '@/lib/services/file-util/file-util-http';

const csv = (v: string | null) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined);

const listQuerySchema = z
  .object({
    category: categorySchema,
    entityIds: z.array(z.string().uuid()).min(1).max(FILE_LIST_MAX_ENTITIES),
    purposes: z.array(z.string().regex(/^[A-Z][A-Z0-9_]{1,49}$/)).max(50).optional(),
    refType: z.enum(FILE_REF_TYPE_CODES).optional(),
    refId: z.string().uuid().optional(),
  })
  .refine((v) => (v.refType === undefined) === (v.refId === undefined), { message: 'refType and refId go together', path: ['refId'] });

/**
 * Lists READY files for the authenticated tenant.
 * @param request query string filter
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const query = listQuerySchema.safeParse({
    category: sp.get('category'),
    entityIds: csv(sp.get('entityIds')),
    purposes: csv(sp.get('purposes')),
    refType: sp.get('refType') ?? undefined,
    refId: sp.get('refId') ?? undefined,
  });
  if (!query.success) return badRequest(query.error);

  const auth = await guardFileRequest(request, query.data.category, 'read');
  if (auth instanceof NextResponse) return auth;

  try {
    const data = await listFiles({
      tenantId: auth.tenantId,
      categoryCode: query.data.category,
      entityIds: query.data.entityIds,
      purposeCodes: query.data.purposes,
      refTypeCode: query.data.refType,
      refId: query.data.refId,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return fileErrorResponse(error, 'list');
  }
}

/**
 * Starts an upload for the authenticated tenant and user.
 * @param request JSON body (initUploadSchema)
 */
export async function POST(request: NextRequest) {
  const body = initUploadSchema.safeParse(await readJson(request));
  if (!body.success) return badRequest(body.error);

  const auth = await guardFileRequest(request, body.data.category, 'write');
  if (auth instanceof NextResponse) return auth;

  try {
    const data = await initFileUpload({
      tenantId: auth.tenantId,
      userId: auth.userId,
      categoryCode: body.data.category,
      purposeCode: body.data.purpose,
      entityId: body.data.entityId,
      refTypeCode: body.data.refType,
      refId: body.data.refId,
      sourceCode: body.data.source,
      fileName: body.data.fileName,
      mimeType: body.data.mimeType,
      sizeBytes: body.data.sizeBytes,
      thumbSizeBytes: body.data.thumbSizeBytes,
      width: body.data.width,
      height: body.data.height,
      durationMs: body.data.durationMs,
      notes: body.data.notes,
    });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return fileErrorResponse(error, 'init');
  }
}
