/**
 * GET /api/v1/pos-sessions/[sessionId]/x-report
 *
 * The live X-report of a POS session: the shift's figures right now (sales, refunds, voucher
 * roll-up, drawer cash, change rounding, linked drawer session). Computed on demand, never
 * stored. Same visibility as the session summary: the owner, or `pos_session:view_all`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { getLivePosShiftReport } from '@/lib/services/pos-shift-report.service';
import { guardPosSessionBranch } from '@/lib/api/branch-access-guard';
import { POS_SESSION_PERMISSIONS } from '@/lib/constants/permissions/pos-session-perm';
import { posSessionErrorResponse, posSessionResponse } from '../../_response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requirePermission(POS_SESSION_PERMISSIONS.VIEW)(request);
  if (auth instanceof NextResponse) return auth;

  const { sessionId } = await params;

  const branchDenied = await guardPosSessionBranch(auth, sessionId);
  if (branchDenied) return branchDenied;

  try {
    const canViewAll = await hasPermissionServer(POS_SESSION_PERMISSIONS.VIEW_ALL);
    const report = await getLivePosShiftReport({
      tenantId: auth.tenantId,
      userId: auth.userId,
      posSessionId: sessionId,
      canViewAll,
    });
    return posSessionResponse(report);
  } catch (error) {
    return posSessionErrorResponse(error);
  }
}
