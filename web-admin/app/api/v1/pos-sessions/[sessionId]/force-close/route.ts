import { NextRequest, NextResponse } from 'next/server';
import { validateCSRF } from '@/lib/middleware/csrf';
import { getAuthContext } from '@/lib/middleware/require-permission';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { forceClosePosSession, getPosSessionOwner } from '@/lib/services/pos-session.service';
import { posSessionForceCloseSchema } from '@/lib/validations/pos-session-schemas';
import { posSessionErrorResponse, posSessionResponse } from '../../_response';
import { POS_SESSION_PERMISSIONS } from '@/lib/constants/permissions/pos-session-perm';
import { guardPosSessionBranch } from '@/lib/api/branch-access-guard';

/**
 * POST /api/v1/pos-sessions/:sessionId/force-close
 *
 * Force-closes the target session with a mandatory reason. Force-closing the
 * caller's own session requires `pos_session:force_close` and still requires
 * the linked cash drawer to be closed. Force-closing ANOTHER user's session
 * additionally requires `pos_session:close_others` (or the tenant-wide
 * `pos_session:full_manage_others` override) and, for that admin path only,
 * bypasses the drawer-closed requirement — the realistic use case is an
 * abandoned/stuck session whose drawer was never reconciled. The drawer
 * session itself is left open for separate reconciliation; the bypass is
 * recorded on the POS session event for audit.
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


  const branchDenied = await guardPosSessionBranch(auth, sessionId);

  if (branchDenied) return branchDenied;
  try {
    const owner = await getPosSessionOwner({ tenantId: auth.tenantId, posSessionId: sessionId });
    if (!owner) {
      return NextResponse.json({ success: false, error: 'POS session was not found.' }, { status: 404 });
    }

    const actingOnOwnSession = owner.userId === auth.userId;
    const hasFullManageOthers = await hasPermissionServer(POS_SESSION_PERMISSIONS.FULL_MANAGE_OTHERS);
    const allowed = actingOnOwnSession
      ? await hasPermissionServer(POS_SESSION_PERMISSIONS.FORCE_CLOSE)
      : hasFullManageOthers ||
        ((await hasPermissionServer(POS_SESSION_PERMISSIONS.CLOSE_OTHERS)) &&
          (await hasPermissionServer(POS_SESSION_PERMISSIONS.FORCE_CLOSE)));
    if (!allowed) {
      return NextResponse.json(
        {
          error: `Permission denied: requires ${
            actingOnOwnSession
              ? POS_SESSION_PERMISSIONS.FORCE_CLOSE
              : `[${POS_SESSION_PERMISSIONS.CLOSE_OTHERS} + ${POS_SESSION_PERMISSIONS.FORCE_CLOSE}] or ${POS_SESSION_PERMISSIONS.FULL_MANAGE_OTHERS}`
          }`,
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = posSessionForceCloseSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    }

    const result = await forceClosePosSession({
      tenantId: auth.tenantId,
      userId: owner.userId,
      performedBy: auth.userId,
      reason: parsed.data.reason,
      idempotencyKey: parsed.data.idempotencyKey,
      sourceChannel: parsed.data.sourceChannel ?? 'api',
      metadata: parsed.data.metadata,
      bypassDrawerCheck: !actingOnOwnSession,
    });
    return posSessionResponse(result);
  } catch (error) {
    return posSessionErrorResponse(error);
  }
}
