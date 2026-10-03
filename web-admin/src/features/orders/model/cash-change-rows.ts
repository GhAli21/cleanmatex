/**
 * Pure view-model for the printed cash-change rounding block (A6-4), shared by the A4 payments
 * report and the thermal receipt so the two documents can never disagree.
 */

/** The payment fields the block needs (a subset of `OrderPaymentRow`). */
export interface CashChangePaymentLike {
  currency_code: string | null;
  change_returned_amount: number | null;
}

export interface CashChangeRoundingLike {
  currencyCode: string;
  /** Net posted rounding: `> 0` the drawer kept part of the change (gain), `< 0` it handed out more (loss). */
  adjustment: number;
}

export interface CashChangeRow {
  currencyCode: string;
  adjustment: number;
  exactChange: number;
  handedOut: number;
}

/**
 * One row per currency that had a change rounding: the exact change the payments recorded, the
 * posted rounding, and what was physically handed out (exact minus adjustment: a gain keeps part
 * of the change, a loss adds to it). Decimal places are applied only by the money formatter.
 *
 * @param payments the order's payment rows
 * @param rounding net posted rounding per currency
 * @param fallbackCurrency currency of payments that carry none (the tenant currency)
 * @returns rows to print; empty when no rounding applied
 * @example
 * const rows = buildCashChangeRows(payments, summary.cashChangeRounding, tenantCurrency);
 */
export function buildCashChangeRows(
  payments: readonly CashChangePaymentLike[],
  rounding: readonly CashChangeRoundingLike[],
  fallbackCurrency: string | null | undefined
): CashChangeRow[] {
  return rounding.map(({ currencyCode, adjustment }) => {
    const exactChange = payments
      .filter((p) => (p.currency_code?.trim() || fallbackCurrency) === currencyCode)
      .reduce((sum, p) => sum + Number(p.change_returned_amount ?? 0), 0);
    return { currencyCode, adjustment, exactChange, handedOut: Math.round((exactChange - adjustment) * 10000) / 10000 };
  });
}
