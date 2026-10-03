import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { getPosSessionSummary } from '@/lib/services/pos-session.service';
import { posSessionErrorResponse, posSessionResponse } from '../../_response';
import { guardPosSessionBranch } from '@/lib/api/branch-access-guard';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requirePermission('pos_session:view')(request);
  if (auth instanceof NextResponse) return auth;

  const { sessionId } = await params;


  const branchDenied = await guardPosSessionBranch(auth, sessionId);

  if (branchDenied) return branchDenied;
  try {
    const canViewAll = await hasPermissionServer('pos_session:view_all');
    const summary = await getPosSessionSummary({
      tenantId: auth.tenantId,
      userId: auth.userId,
      posSessionId: sessionId,
      canViewAll,
    });
    return posSessionResponse(summary);
  } catch (error) {
    return posSessionErrorResponse(error);
  }
}
