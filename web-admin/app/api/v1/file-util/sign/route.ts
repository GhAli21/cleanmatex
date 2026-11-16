/**
 * POST /api/v1/file-util/sign
 * Fresh URLs for files already shown (private links expire after 5 minutes). Read-only;
 * POST only because the id list can be long.
 */

import { NextRequest, NextResponse } from 'next/server';
import { signFiles } from '@/lib/services/file-util/file-util.service';
import { badRequest, fileErrorResponse, guardFileRequest, readJson, signSchema } from '@/lib/services/file-util/file-util-http';

/**
 * Signs READY files of one category for the authenticated tenant.
 * @param request JSON body `{ category, fileIds }`
 */
export async function POST(request: NextRequest) {
  const body = signSchema.safeParse(await readJson(request));
  if (!body.success) return badRequest(body.error);

  const auth = await guardFileRequest(request, body.data.category, 'read');
  if (auth instanceof NextResponse) return auth;

  try {
    const data = await signFiles(auth.tenantId, body.data.category, body.data.fileIds);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return fileErrorResponse(error, 'sign');
  }
}
