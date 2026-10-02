import { NextRequest, NextResponse } from 'next/server';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requireAnyPermission } from '@/lib/middleware/require-permission';
import { openPosSession } from '@/lib/services/pos-session.service';
import { posSessionOpenOthersSchema } from '@/lib/validations/pos-session-schemas';
import { posSessionConflictResponse, posSessionErrorResponse, posSessionResponse } from '../_response';
import { POS_SESSION_PERMISSIONS } from '@/lib/constants/permissions/pos-session-perm';

/**
 * POST /api/v1/pos-sessions/open-others
 *
 * Opens a POS session on behalf of `targetUserId` (e.g. a supervisor
 * starting a cashier's shift). Requires `pos_session:open_others` or the
 * tenant-wide `pos_session:full_manage_others` override. The opened session
 * is owned by `targetUserId`; the acting admin is recorded as `opened_by`.
 */
export async function POST(request: NextRequest) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requireAnyPermission([
    POS_SESSION_PERMISSIONS.OPEN_OTHERS,
    POS_SESSION_PERMISSIONS.FULL_MANAGE_OTHERS,
  ])(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const parsed = await posSessionOpenOthersSchema.safeParseAsync(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await openPosSession({
      tenantId: auth.tenantId,
      userId: parsed.data.targetUserId,
      performedBy: auth.userId,
      branchId: parsed.data.branchId,
      terminalId: parsed.data.terminalId,
      idempotencyKey: parsed.data.idempotencyKey,
      sourceChannel: parsed.data.sourceChannel ?? 'api',
      metadata: parsed.data.metadata,
    });
    const conflict = posSessionConflictResponse(result);
    if (conflict) return conflict;
    return posSessionResponse(result, result.type === 'CREATED' ? 201 : 200);
  } catch (error) {
    return posSessionErrorResponse(error);
  }
}
