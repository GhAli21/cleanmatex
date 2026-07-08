import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { getMyActivePosSession } from '@/lib/services/pos-session.service';
import { posSessionBranchQuerySchema } from '@/lib/validations/pos-session-schemas';
import { posSessionConflictResponse, posSessionErrorResponse, posSessionResponse } from '../_response';

/**
 * GET /api/v1/pos-sessions/my-active
 *
 * Resolves the authenticated user's active POS session. The optional context
 * projection is intentionally permission-aware so drawer reconciliation labels
 * are not leaked through the POS lineage surface.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('pos_session:view')(request);
  if (auth instanceof NextResponse) return auth;

  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = posSessionBranchQuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const includeDrawerContext = parsed.data.includeContext
      ? await hasPermissionServer('cash_drawer:view')
      : false;
    const result = await getMyActivePosSession({
      tenantId: auth.tenantId,
      userId: auth.userId,
      branchId: parsed.data.branchId,
      includeContext: parsed.data.includeContext,
      includeDrawerContext,
    });
    const conflict = posSessionConflictResponse(result);
    if (conflict) return conflict;
    return posSessionResponse(result);
  } catch (error) {
    return posSessionErrorResponse(error);
  }
}
