import { NextRequest, NextResponse } from 'next/server';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { forceClosePosSession } from '@/lib/services/pos-session.service';
import { posSessionForceCloseSchema } from '@/lib/validations/pos-session-schemas';
import { posSessionErrorResponse, posSessionResponse } from '../_response';

export async function POST(request: NextRequest) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('pos_session:force_close')(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const parsed = posSessionForceCloseSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await forceClosePosSession({
      tenantId: auth.tenantId,
      userId: auth.userId,
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
