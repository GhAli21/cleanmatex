import { NextRequest, NextResponse } from 'next/server';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { openPosSession } from '@/lib/services/pos-session.service';
import { posSessionOpenSchema } from '@/lib/validations/pos-session-schemas';
import { posSessionConflictResponse, posSessionErrorResponse, posSessionResponse } from '../_response';
import { guardBranchIds } from '@/lib/api/branch-access-guard';

export async function POST(request: NextRequest) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('pos_session:open')(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const parsed = await posSessionOpenSchema.safeParseAsync(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  // B3: the branch the session is opened/linked in must be one the actor may operate on.
  const branchDenied = parsed.data.branchId ? await guardBranchIds(auth, [parsed.data.branchId]) : null;
  if (branchDenied) return branchDenied;

  try {
    const result = await openPosSession({
      tenantId: auth.tenantId,
      userId: auth.userId,
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
