import 'server-only';

import { NextResponse } from 'next/server';
import { PosSessionError } from '@/lib/services/pos-session.service';

/**
 * Maps a POS-session refusal raised inside a finance write (B1: `POS_SESSION_REQUIRED`,
 * `POS_SESSION_MISMATCH`, branch/open-not-found conflicts) to its stable response so the UI can react
 * — e.g. offer "Open session now" on `POS_SESSION_REQUIRED` — instead of showing a generic failure.
 * Returns `null` for anything else, so the caller's own error handling continues unchanged.
 *
 * @param error whatever the finance service threw
 * @returns a ready response for a `PosSessionError`, otherwise `null`
 * @example
 * const posSessionResponse = posSessionFinanceErrorResponse(err);
 * if (posSessionResponse) return posSessionResponse;
 */
export function posSessionFinanceErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof PosSessionError)) return null;
  return NextResponse.json(
    {
      success: false,
      errorCode: error.code,
      // `code` is the envelope key older screens (customer receipts, drawers) read.
      code: error.code,
      error: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
    { status: error.httpStatus }
  );
}
