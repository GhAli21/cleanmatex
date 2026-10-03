/**
 * Financial comparison tolerances — single source of truth (B15).
 *
 * Two comparison classes exist platform-wide: strict ledger equality
 * (`MONEY_COMPARISON_TOLERANCE`) and physical cash counted against expected
 * (`varianceToleranceFor(decimalPlaces)`, currency-aware). Every money comparison
 * must use one of them (directly or via a re-export); new literal epsilons on
 * money paths are forbidden and grep-guarded by
 * `__tests__/services/b15-currency-tolerance-guard.test.ts`.
 */

/**
 * Strict ledger-equality tolerance (0.001) — used wherever two computed money
 * amounts must agree to the smallest supported minor unit (3-decimal
 * currencies): settlement submit checks, financial snapshot recalculation,
 * order-level reconciliation checks, aggregation equality.
 *
 * Canonical consumers re-export it: `ORDER_FINANCIAL_COMPARISON_TOLERANCE`
 * (order-financial-aggregation) and `SETTLEMENT_MONEY_EPSILON`
 * (settlement-catalog).
 */
export const MONEY_COMPARISON_TOLERANCE = 0.001;

/**
 * Currency-aware physical cash variance tolerance — half the smallest
 * circulating unit for the currency's decimal precision (POS Session & Cash
 * Drawer Hardening, W0-15). Used wherever counted cash is compared with
 * expected cash (drawer close and the cash-reconciliation report). It replaced
 * a flat 0.01, which was 20x too wide for 3-decimal currencies (KWD, BHD, OMR:
 * smallest unit 0.001, so the tolerance is 0.0005) and wider than necessary for
 * 2-decimal ones (smallest unit 0.01, tolerance 0.005).
 *
 * @param decimalPlaces the currency's minor-unit precision (2 for AED/SAR,
 * 3 for OMR/BHD/KWD, 0 for a zero-decimal currency). Resolve this from
 * `sys_currency_cd` (or the drawer session's own currency context) — this
 * function does no lookup of its own, matching the other `lib/money/*`
 * helpers that take precision as an explicit parameter.
 * @returns half the smallest unit at that precision, e.g. 0.005 for 2dp, 0.0005 for 3dp
 */
export function varianceToleranceFor(decimalPlaces: number): number {
  const dp = Number.isFinite(decimalPlaces) && decimalPlaces >= 0 ? Math.floor(decimalPlaces) : 2;
  return 0.5 * 10 ** -dp;
}
