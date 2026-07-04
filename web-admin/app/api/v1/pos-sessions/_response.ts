import { NextResponse } from 'next/server';
import { PosSessionError } from '@/lib/services/pos-session.service';
import type { PosSessionBranchConflict } from '@/lib/types/pos-session';

export function posSessionResponse(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function posSessionConflictResponse(result: { type: string } | PosSessionBranchConflict) {
  if (result.type !== 'BRANCH_CONFLICT') return null;
  const conflict = result as PosSessionBranchConflict;
  return NextResponse.json(
    {
      success: false,
      errorCode: 'POS_SESSION_BRANCH_CONFLICT',
      error: 'User already has an active POS session in another branch.',
      data: conflict,
    },
    { status: 409 }
  );
}

export function posSessionErrorResponse(error: unknown) {
  if (error instanceof PosSessionError) {
    return NextResponse.json(
      { success: false, errorCode: error.code, error: error.message },
      { status: error.httpStatus }
    );
  }

  const message = error instanceof Error ? error.message : 'POS session operation failed';
  return NextResponse.json({ success: false, error: message }, { status: 422 });
}
