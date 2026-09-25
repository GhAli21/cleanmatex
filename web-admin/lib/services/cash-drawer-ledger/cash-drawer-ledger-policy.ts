/**
 * Cash-drawer ledger gate — the pure decision (CLF, ADR-057, plan §4B.4).
 *
 * Given one voucher line, its drawer, the drawer's live session, the resolved
 * `requires_session` setting and the gate mode, decide whether the line is cash
 * at all, which effect it has, which session window it lands in, or why it is
 * refused. No I/O: the gate loads the facts under the drawer lock and calls this.
 *
 * Principles encoded here:
 *  - Financial events are never refused because of session state when they are
 *    DEFERRED (late verify, reversal) — they land in the next window instead.
 *  - Integrity rules (drawer active, branch, type capability, currency) apply to
 *    every mode, because they describe where cash can physically be.
 *  - A CLOSING session is not open for new cash: interactive cash is refused,
 *    deferred cash goes to the next window.
 */

import {
  CASH_DRAWER_SESSION_STATUSES,
  CASH_EFFECTS,
  CASH_GATE_MODES,
  CASH_LEDGER_ERRORS,
  type CashLedgerErrorCode,
} from '@/lib/constants/cash-drawer';
import { isCashFamilyMethod } from '@/lib/utils/cash-method';
import type { CashLineDecision, CashLineDecisionInput } from '@/lib/types/cash-drawer-ledger';

const reject = (error: CashLedgerErrorCode): CashLineDecision => ({ effect: null, sessionId: null, error });

/**
 * Decides the drawer effect of one voucher line. Rules are evaluated in the
 * order of plan §4B.4; the first that applies wins.
 * @param input line, drawer, live session, resolved setting and mode
 * @returns flat decision — `error` set means the posting must be refused
 * @example
 *   decideCashLine({ line, drawer, liveSession: { id, status: 'OPEN' }, requiresSession: true, mode: 'INTERACTIVE' })
 *   // → { effect: 'DRAWER', sessionId: id, error: null }
 */
export function decideCashLine(input: CashLineDecisionInput): CashLineDecision {
  const { line, drawer, liveSession, requiresSession, mode } = input;

  // 1. Not a physical-cash line.
  const direction = line.direction;
  if (!isCashFamilyMethod(line.paymentMethodCode) || (direction !== 'IN' && direction !== 'OUT')) {
    return { effect: null, sessionId: null, error: null };
  }

  // 2. The tenant tracks this cash method outside drawers.
  if (!line.requiresCashDrawer) {
    return { effect: CASH_EFFECTS.UNTRACKED, sessionId: null, error: null };
  }

  // 3. Money not received yet — recognised later (B30 VERIFY), not now.
  if (!line.isCompleted) {
    return { effect: CASH_EFFECTS.PENDING, sessionId: null, error: null };
  }

  // 4–9. Integrity: where can this cash physically be?
  if (!drawer) return reject(CASH_LEDGER_ERRORS.CASH_DRAWER_REQUIRED);
  if (!drawer.isActive) return reject(CASH_LEDGER_ERRORS.CASH_DRAWER_INACTIVE);
  if (line.branchId && line.branchId !== drawer.branchId) {
    return reject(CASH_LEDGER_ERRORS.CASH_DRAWER_BRANCH_MISMATCH);
  }
  if (direction === 'IN' && !drawer.acceptsCustomerCash) {
    return reject(CASH_LEDGER_ERRORS.CASH_DRAWER_TYPE_NOT_ALLOWED);
  }
  if (direction === 'OUT' && !drawer.allowsCustomerCashOut) {
    return reject(CASH_LEDGER_ERRORS.CASH_DRAWER_TYPE_NOT_ALLOWED);
  }
  const currency = line.currencyCode?.trim().toUpperCase() || null;
  if (!currency) return reject(CASH_LEDGER_ERRORS.CASH_CURRENCY_REQUIRED);
  if (currency !== drawer.currencyCode.trim().toUpperCase()) {
    return reject(CASH_LEDGER_ERRORS.CASH_CURRENCY_MISMATCH);
  }

  // 10. Open session: the cash belongs to it.
  if (liveSession?.status === CASH_DRAWER_SESSION_STATUSES.OPEN) {
    return { effect: CASH_EFFECTS.DRAWER, sessionId: liveSession.id, error: null };
  }

  if (mode === CASH_GATE_MODES.INTERACTIVE) {
    // 11. Counting in progress: a person must not take or pay cash now.
    if (liveSession?.status === CASH_DRAWER_SESSION_STATUSES.CLOSING) {
      return reject(CASH_LEDGER_ERRORS.DRAWER_SESSION_CLOSING);
    }
    // 12. Policy requires an open session for cash handled at the drawer.
    if (requiresSession) return reject(CASH_LEDGER_ERRORS.CASH_DRAWER_SESSION_NOT_OPEN);
  }

  // 13. Deferred event, or a session-less drawer: next window.
  return { effect: CASH_EFFECTS.DRAWER, sessionId: null, error: null };
}
