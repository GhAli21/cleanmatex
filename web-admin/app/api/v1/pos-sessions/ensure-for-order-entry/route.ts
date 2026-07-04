import { NextRequest, NextResponse } from 'next/server';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { ensurePosSessionForOrderEntry } from '@/lib/services/pos-session.service';
import { posSessionEnsureSchema } from '@/lib/validations/pos-session-schemas';
import { posSessionConflictResponse, posSessionErrorResponse, posSessionResponse } from '../_response';

export async function POST(request: NextRequest) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('pos_session:open')(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const parsed = posSessionEnsureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await ensurePosSessionForOrderEntry({
      tenantId: auth.tenantId,
      userId: auth.userId,
      branchId: parsed.data.branchId,
      terminalId: parsed.data.terminalId,
      idempotencyKey: parsed.data.idempotencyKey,
      sourceChannel: parsed.data.sourceChannel ?? 'pos_order_entry',
      metadata: parsed.data.metadata,
    });
    const conflict = posSessionConflictResponse(result);
    if (conflict) return conflict;
    return posSessionResponse(result, result.type === 'CREATED' ? 201 : 200);
  } catch (error) {
    return posSessionErrorResponse(error);
  }
}
