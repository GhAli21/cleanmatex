import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { listPosSessions } from '@/lib/services/pos-session.service';
import { posSessionListQuerySchema } from '@/lib/validations/pos-session-schemas';
import { posSessionErrorResponse, posSessionResponse } from './_response';

/**
 * GET /api/v1/pos-sessions
 *
 * Returns a server-paged POS session history for the authenticated tenant.
 * Tenant and own-versus-all visibility are resolved server-side from the
 * authenticated permission context, never from client-supplied identifiers.
 *
 * @returns Paginated authorized session history or a structured error response.
 */
export async function GET(request: NextRequest) {
  // Tenant resolved server-side by the permission guard to prevent cross-tenant history reads.
  const auth = await requirePermission('pos_session:view')(request);
  if (auth instanceof NextResponse) return auth;

  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = await posSessionListQuerySchema.safeParseAsync(query);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request', details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const canViewAll = await hasPermissionServer('pos_session:view_all');
    const result = await listPosSessions({
      tenantId: auth.tenantId,
      userId: auth.userId,
      canViewAll,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      branchId: parsed.data.branchId,
      userId: parsed.data.userId,
      operatorQuery: parsed.data.operatorQuery,
      terminalQuery: parsed.data.terminalQuery,
      cashDrawerQuery: parsed.data.cashDrawerQuery,
      terminalId: parsed.data.terminalId,
      cashDrawerId: parsed.data.cashDrawerId,
      cashDrawerSessionId: parsed.data.cashDrawerSessionId,
      sessionNo: parsed.data.sessionNo,
      businessDateFrom: parsed.data.businessDateFrom,
      businessDateTo: parsed.data.businessDateTo,
      openedAtFrom: parsed.data.openedAtFrom,
      openedAtTo: parsed.data.openedAtTo,
      status: parsed.data.status,
      scope: parsed.data.scope,
    });
    return posSessionResponse(result);
  } catch (error) {
    return posSessionErrorResponse(error);
  }
}
