/**
 * GET /api/v1/pos-sessions/z-reports
 *
 * The Z-report archive: a server-paged, filterable list of frozen shift reports with their
 * headline figures (sales, drawer variance, integrity). Opening one goes through
 * `/api/v1/pos-sessions/[sessionId]/z-report`.
 *
 * Needs `pos_session:report_z`. Without `pos_session:view_all` only the caller's own shifts are
 * listed; with it, other operators' shifts inside the caller's branch scope are included.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { narrowBranchFilter, resolveBranchScope } from '@/lib/services/branch-access.service';
import { listShiftZReports } from '@/lib/services/pos-shift-z-archive.service';
import { POS_SESSION_PERMISSIONS } from '@/lib/constants/permissions/pos-session-perm';
import { posShiftZArchiveQuerySchema } from '@/lib/validations/pos-session-schemas';
import { posSessionErrorResponse, posSessionResponse } from '../_response';

export async function GET(request: NextRequest) {
  const auth = await requirePermission(POS_SESSION_PERMISSIONS.REPORT_Z)(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = await posShiftZArchiveQuerySchema.safeParseAsync(
    Object.fromEntries(request.nextUrl.searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request', details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const canViewAll = await hasPermissionServer(POS_SESSION_PERMISSIONS.VIEW_ALL);
    return posSessionResponse(
      await listShiftZReports({
        tenantId: auth.tenantId,
        userId: auth.userId,
        canViewAll,
        branchIds: narrowBranchFilter(await resolveBranchScope(auth)),
        ...parsed.data,
      })
    );
  } catch (error) {
    return posSessionErrorResponse(error);
  }
}
