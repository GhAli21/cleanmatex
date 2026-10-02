import { NextRequest, NextResponse } from 'next/server';
import { requireAnyPermission } from '@/lib/middleware/require-permission';
import { listTenantUsersForPosSessionOpen } from '@/lib/services/pos-session.service';
import { posSessionErrorResponse, posSessionResponse } from '../_response';
import { POS_SESSION_PERMISSIONS } from '@/lib/constants/permissions/pos-session-perm';
import { z } from 'zod';

const querySchema = z.object({
  query: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/**
 * GET /api/v1/pos-sessions/users
 *
 * Lists tenant users for the "open session on behalf of" picker. Gated by
 * `pos_session:open_others` or `pos_session:full_manage_others` — this list
 * is only useful to someone who can act on it.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAnyPermission([
    POS_SESSION_PERMISSIONS.OPEN_OTHERS,
    POS_SESSION_PERMISSIONS.FULL_MANAGE_OTHERS,
  ])(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await listTenantUsersForPosSessionOpen({
      tenantId: auth.tenantId,
      query: parsed.data.query,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
    return posSessionResponse(result);
  } catch (error) {
    return posSessionErrorResponse(error);
  }
}
