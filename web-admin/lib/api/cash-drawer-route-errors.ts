import 'server-only';

import { NextResponse } from 'next/server';

import { CashDrawerLedgerError } from '@/lib/services/cash-drawer-ledger/cash-drawer-errors';
import { CashDrawerSessionError, VarianceApprovalError } from '@/lib/services/cash-drawer.service';
import { CASH_LEDGER_ERRORS, type CashLedgerErrorCode } from '@/lib/constants/cash-drawer';
import { logger } from '@/lib/utils/logger';

/**
 * Shared cash-drawer route error mapper (CLF-7, plan §4B.11). Every CLF
 * route calls this from its `catch` instead of hand-rolling a status/code
 * mapping — keeps the `{ success: false, error, code }` envelope and HTTP
 * status consistent across all ~16 routes, closing the "shared route mapper
 * still open" item left from the 2026-09-25 writer-rewiring pass.
 */

/** Status codes that deviate from the default 422 for a ledger refusal (§4B.11). */
const LEDGER_ERROR_STATUS: Partial<Record<CashLedgerErrorCode, number>> = {
  [CASH_LEDGER_ERRORS.CASH_DRAWER_SESSION_NOT_OPEN]: 409,
  [CASH_LEDGER_ERRORS.DRAWER_SESSION_CLOSING]: 409,
  [CASH_LEDGER_ERRORS.DRAWER_SESSION_NOT_CLOSING]: 409,
  [CASH_LEDGER_ERRORS.CASH_LINE_IMMUTABLE]: 409,
  [CASH_LEDGER_ERRORS.CASH_LEG_MUST_REVERSE]: 409,
  [CASH_LEDGER_ERRORS.POST_CLOSE_SESSION_NOT_CLOSED]: 409,
};

const SESSION_ERROR_STATUS: Record<string, number> = {
  DRAWER_SESSION_ALREADY_OPEN: 409,
};

const VARIANCE_ERROR_STATUS: Record<string, number> = {
  VARIANCE_NOT_PENDING_APPROVAL: 409,
  VARIANCE_ALREADY_APPROVED: 409,
  VARIANCE_REASON_REQUIRED: 400,
};

/**
 * Maps any error a CLF service may throw to a `NextResponse`. Unknown errors
 * fall back to a generic 500 with no code (never leak a raw message as a
 * stable code for the client to branch on).
 * @param error whatever the route's try/catch received
 * @param fallbackMessage shown when the error is not one of the typed CLF errors
 */
export function mapCashDrawerError(error: unknown, fallbackMessage = 'Request failed'): NextResponse {
  if (error instanceof CashDrawerLedgerError) {
    const status = LEDGER_ERROR_STATUS[error.code] ?? 422;
    return NextResponse.json({ success: false, error: error.code, code: error.code }, { status });
  }
  if (error instanceof CashDrawerSessionError) {
    const status = SESSION_ERROR_STATUS[error.code] ?? 409;
    return NextResponse.json({ success: false, error: error.code, code: error.code }, { status });
  }
  if (error instanceof VarianceApprovalError) {
    const status = VARIANCE_ERROR_STATUS[error.code] ?? 409;
    return NextResponse.json({ success: false, error: error.code, code: error.code }, { status });
  }
  // Untyped failure: the raw message may carry SQL / column / id detail, so it is logged for
  // operators and never sent to the client — only the route's own fallback text is.
  logger.error(fallbackMessage, error instanceof Error ? error : new Error(String(error)));
  return NextResponse.json({ success: false, error: fallbackMessage }, { status: 500 });
}
