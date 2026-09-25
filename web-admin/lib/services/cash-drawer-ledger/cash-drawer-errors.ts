import { CASH_LEDGER_SQLSTATES, type CashLedgerErrorCode } from '@/lib/constants/cash-drawer';

/**
 * Typed error for every cash-drawer ledger refusal (plan §4B.11). Routes and
 * actions map `code` to an HTTP status + i18n key; the message is for logs only.
 */
export class CashDrawerLedgerError extends Error {
  readonly code: CashLedgerErrorCode;
  readonly details: Record<string, unknown>;

  /**
   * @param code stable error code from CASH_LEDGER_ERRORS
   * @param message log-oriented message (never shown to users as-is)
   * @param details structured context (ids, never money)
   */
  constructor(code: CashLedgerErrorCode, message?: string, details: Record<string, unknown> = {}) {
    super(message ?? code);
    this.name = 'CashDrawerLedgerError';
    this.code = code;
    this.details = details;
  }
}

/**
 * True when an error came from a CLF database guard (immutability, balance,
 * currency). Prisma surfaces the SQLSTATE in the message/meta; matching the
 * code keeps callers from parsing text.
 * @param error anything thrown by a Prisma call
 * @param sqlState one of CASH_LEDGER_SQLSTATES
 * @returns whether the error carries that SQLSTATE
 */
export function isCashLedgerDbError(
  error: unknown,
  sqlState: (typeof CASH_LEDGER_SQLSTATES)[keyof typeof CASH_LEDGER_SQLSTATES],
): boolean {
  if (!(error instanceof Error)) return false;
  const meta = (error as Error & { meta?: { code?: string } }).meta;
  return meta?.code === sqlState || error.message.includes(sqlState);
}
