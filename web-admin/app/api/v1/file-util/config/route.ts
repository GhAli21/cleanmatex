/**
 * GET /api/v1/file-util/config?category=
 * Upload rules of one category for the UI: purposes (EN/AR names, default, limits) and the
 * allowed file types of each. Global reference data; requires the category's read permission.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCategoryConfig } from '@/lib/services/file-util/file-util.service';
import { badRequest, categoryOnlySchema, fileErrorResponse, guardFileRequest } from '@/lib/services/file-util/file-util-http';

/**
 * Returns the category's upload configuration.
 * @param request `?category=`
 */
export async function GET(request: NextRequest) {
  const query = categoryOnlySchema.safeParse({ category: request.nextUrl.searchParams.get('category') });
  if (!query.success) return badRequest(query.error);

  const auth = await guardFileRequest(request, query.data.category, 'read');
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.json({ success: true, data: await getCategoryConfig(query.data.category) });
  } catch (error) {
    return fileErrorResponse(error, 'config');
  }
}
