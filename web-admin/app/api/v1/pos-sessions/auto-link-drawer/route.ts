import { NextRequest, NextResponse } from 'next/server';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requireAllPermissions } from '@/lib/middleware/require-permission';
import { autoLinkDrawer } from '@/lib/services/pos-session.service';
import { posSessionAutoLinkDrawerSchema } from '@/lib/validations/pos-session-schemas';
import { posSessionErrorResponse, posSessionResponse } from '../_response';

/**
 * POST /api/v1/pos-sessions/auto-link-drawer
 *
 * Links an already-open cash drawer session to the authenticated user's POS
 * session. Drawer selection/opening remains owned by cash-drawer APIs.
 */
export async function POST(request: NextRequest) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requireAllPermissions(['pos_session:open', 'cash_drawer:view'])(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const parsed = posSessionAutoLinkDrawerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await autoLinkDrawer({
      tenantId: auth.tenantId,
      userId: auth.userId,
      posSessionId: parsed.data.posSessionId,
      branchId: parsed.data.branchId,
      cashDrawerSessionId: parsed.data.cashDrawerSessionId,
      idempotencyKey: parsed.data.idempotencyKey,
      sourceChannel: parsed.data.sourceChannel ?? 'api',
      metadata: parsed.data.metadata,
    });
    return posSessionResponse(result);
  } catch (error) {
    return posSessionErrorResponse(error);
  }
}
