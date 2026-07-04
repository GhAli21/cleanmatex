import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getMyActivePosSession } from '@/lib/services/pos-session.service';
import { posSessionBranchQuerySchema } from '@/lib/validations/pos-session-schemas';
import { posSessionConflictResponse, posSessionErrorResponse, posSessionResponse } from '../_response';

export async function GET(request: NextRequest) {
  const auth = await requirePermission('pos_session:view')(request);
  if (auth instanceof NextResponse) return auth;

  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = posSessionBranchQuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await getMyActivePosSession({
      tenantId: auth.tenantId,
      userId: auth.userId,
      branchId: parsed.data.branchId,
    });
    const conflict = posSessionConflictResponse(result);
    if (conflict) return conflict;
    return posSessionResponse(result);
  } catch (error) {
    return posSessionErrorResponse(error);
  }
}
