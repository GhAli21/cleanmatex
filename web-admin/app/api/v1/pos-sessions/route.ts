import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { listPosSessions } from '@/lib/services/pos-session.service';
import { posSessionListQuerySchema } from '@/lib/validations/pos-session-schemas';
import { posSessionErrorResponse, posSessionResponse } from './_response';

export async function GET(request: NextRequest) {
  const auth = await requirePermission('pos_session:view')(request);
  if (auth instanceof NextResponse) return auth;

  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = posSessionListQuerySchema.safeParse(query);
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
      status: parsed.data.status,
      scope: parsed.data.scope,
    });
    return posSessionResponse(result);
  } catch (error) {
    return posSessionErrorResponse(error);
  }
}
