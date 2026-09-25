import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { listPosSessionEvents } from '@/lib/services/pos-session.service';
import { posSessionEventsQuerySchema } from '@/lib/validations/pos-session-schemas';
import { posSessionErrorResponse, posSessionResponse } from '../../_response';

/**
 * GET /api/v1/pos-sessions/:sessionId/events
 *
 * Returns a server-paged event trail only after the requested session is
 * authorized within the authenticated tenant and own/all visibility scope.
 *
 * @returns Authorized lifecycle events or a structured error response.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  // Tenant resolved server-side by the permission guard to prevent cross-tenant audit reads.
  const auth = await requirePermission('pos_session:view')(request);
  if (auth instanceof NextResponse) return auth;
  const parsed = posSessionEventsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }
  const { sessionId } = await params;
  try {
    return posSessionResponse(await listPosSessionEvents({
      tenantId: auth.tenantId,
      userId: auth.userId,
      canViewAll: await hasPermissionServer('pos_session:view_all'),
      posSessionId: sessionId,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    }));
  } catch (error) {
    return posSessionErrorResponse(error);
  }
}
