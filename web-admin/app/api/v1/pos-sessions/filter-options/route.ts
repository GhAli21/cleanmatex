import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { listPosSessionFilterOptions } from '@/lib/services/pos-session.service';
import { posSessionFilterOptionsQuerySchema } from '@/lib/validations/pos-session-schemas';
import { posSessionErrorResponse, posSessionResponse } from '../_response';

/**
 * GET /api/v1/pos-sessions/filter-options
 *
 * Returns one server-paged, tenant-scoped POS-session list-of-values dimension.
 * The service derives values from sessions the caller can actually view, rather
 * than exposing the tenant's broader master catalogues.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('pos_session:view')(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = await posSessionFilterOptionsQuerySchema.safeParseAsync(
    Object.fromEntries(request.nextUrl.searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request', details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    return posSessionResponse(await listPosSessionFilterOptions({
      tenantId: auth.tenantId,
      userId: auth.userId,
      canViewAll: await hasPermissionServer('pos_session:view_all'),
      ...parsed.data,
    }));
  } catch (error) {
    return posSessionErrorResponse(error);
  }
}
