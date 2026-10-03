/**
 * /api/v1/pos-sessions/[sessionId]/z-report
 *
 * GET  — the stored, immutable Z-report of a closed POS session (404 Z_REPORT_NOT_FOUND when none).
 * POST — generate it now for a closed session that has none (tenants that do not auto-generate at
 *        close, or a back-fill). Idempotent: a session has exactly one Z-report.
 *
 * Both need `pos_session:report_z`; seeing another operator's session also needs `pos_session:view_all`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { generateShiftZReport, getShiftZReport } from '@/lib/services/pos-shift-report.service';
import { guardPosSessionBranch } from '@/lib/api/branch-access-guard';
import { POS_SESSION_PERMISSIONS } from '@/lib/constants/permissions/pos-session-perm';
import { POS_SHIFT_REPORT_ERROR } from '@/lib/constants/pos-shift-report';
import { posSessionErrorResponse, posSessionResponse } from '../../_response';

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requirePermission(POS_SESSION_PERMISSIONS.REPORT_Z)(request);
  if (auth instanceof NextResponse) return auth;

  const { sessionId } = await params;

  const branchDenied = await guardPosSessionBranch(auth, sessionId);
  if (branchDenied) return branchDenied;

  try {
    const canViewAll = await hasPermissionServer(POS_SESSION_PERMISSIONS.VIEW_ALL);
    const report = await getShiftZReport({
      tenantId: auth.tenantId,
      userId: auth.userId,
      posSessionId: sessionId,
      canViewAll,
    });
    if (!report) {
      return NextResponse.json(
        {
          success: false,
          errorCode: POS_SHIFT_REPORT_ERROR.Z_NOT_FOUND,
          error: 'No Z-report has been generated for this POS session.',
        },
        { status: 404 }
      );
    }
    return posSessionResponse(report);
  } catch (error) {
    return posSessionErrorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission(POS_SESSION_PERMISSIONS.REPORT_Z)(request);
  if (auth instanceof NextResponse) return auth;

  const { sessionId } = await params;

  const branchDenied = await guardPosSessionBranch(auth, sessionId);
  if (branchDenied) return branchDenied;

  try {
    // Generating is bound by the same visibility rule as reading: the owner's own session, or view_all.
    const canViewAll = await hasPermissionServer(POS_SESSION_PERMISSIONS.VIEW_ALL);
    await getShiftZReport({
      tenantId: auth.tenantId,
      userId: auth.userId,
      posSessionId: sessionId,
      canViewAll,
    });
    const { created } = await generateShiftZReport({
      tenantId: auth.tenantId,
      posSessionId: sessionId,
      actorUserId: auth.userId,
    });
    const report = await getShiftZReport({
      tenantId: auth.tenantId,
      userId: auth.userId,
      posSessionId: sessionId,
      canViewAll,
    });
    return posSessionResponse(report, created ? 201 : 200);
  } catch (error) {
    return posSessionErrorResponse(error);
  }
}
