import { NextRequest, NextResponse } from 'next/server';
import { validateCSRF } from '@/lib/middleware/csrf';
import { getAuthContext } from '@/lib/middleware/require-permission';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { closePosSession, getPosSessionOwner } from '@/lib/services/pos-session.service';
import { posSessionReasonSchema } from '@/lib/validations/pos-session-schemas';
import { posSessionErrorResponse, posSessionResponse } from '../../_response';
import { POS_SESSION_PERMISSIONS } from '@/lib/constants/permissions/pos-session-perm';

/**
 * POST /api/v1/pos-sessions/:sessionId/close
 *
 * Closes the target session. Closing the caller's own session requires
 * `pos_session:close`; closing another user's session additionally requires
 * `pos_session:close_others` (or the tenant-wide `pos_session:full_manage_others`
 * override). Drawer reconciliation is still required in both cases.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  let auth;
  try {
    auth = await getAuthContext();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unauthorized' }, { status: 401 });
  }

  const { sessionId } = await params;

  try {
    const owner = await getPosSessionOwner({ tenantId: auth.tenantId, posSessionId: sessionId });
    if (!owner) {
      return NextResponse.json({ success: false, error: 'POS session was not found.' }, { status: 404 });
    }

    const actingOnOwnSession = owner.userId === auth.userId;
    const allowed = actingOnOwnSession
      ? await hasPermissionServer(POS_SESSION_PERMISSIONS.CLOSE)
      : (await hasPermissionServer(POS_SESSION_PERMISSIONS.CLOSE_OTHERS)) ||
        (await hasPermissionServer(POS_SESSION_PERMISSIONS.FULL_MANAGE_OTHERS));
    if (!allowed) {
      return NextResponse.json(
        { error: `Permission denied: ${actingOnOwnSession ? POS_SESSION_PERMISSIONS.CLOSE : POS_SESSION_PERMISSIONS.CLOSE_OTHERS}` },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = posSessionReasonSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    }

    const result = await closePosSession({
      tenantId: auth.tenantId,
      userId: owner.userId,
      performedBy: auth.userId,
      reason: parsed.data.reason,
      idempotencyKey: parsed.data.idempotencyKey,
      sourceChannel: parsed.data.sourceChannel ?? 'api',
      metadata: parsed.data.metadata,
    });
    return posSessionResponse(result);
  } catch (error) {
    return posSessionErrorResponse(error);
  }
}
