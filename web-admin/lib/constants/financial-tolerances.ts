/**
 * Financial comparison tolerances — single source of truth (B15).
 *
 * Exactly two comparison classes exist platform-wide. Every money comparison
 * must use one of these constants (directly or via a re-export); new literal
 * epsilons on money paths are forbidden and grep-guarded by
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
 * Physical cash variance tolerance (0.01) — used only where counted cash is
 * compared against expected cash (drawer close preview/balancing and the
 * cash-reconciliation reports). Wider than the ledger tolerance because
 * physical counting cannot resolve below the smallest circulating coin.
 *
 * @deprecated (POS Session & Cash Drawer Hardening, W0-15) This flat value is
 * wrong for 3-decimal currencies (KWD/BHD/OMR) — it is 10x too wide for
 * their smallest circulating unit. Use `varianceToleranceFor(decimalPlaces)`
 * for any new/updated call site; this constant is kept only so existing
 * consumers (`reconciliation-reports.ts` and its re-exports) keep compiling
 * until they are migrated in Wave E. `cash-drawer.service.ts`'s own
 * drawer-close comparison was migrated to `varianceToleranceFor` in Wave A
 * (A3-3) since it is the one place a wrong tolerance is a live money bug,
 * not just a report-display concern.
 *
 * Canonical consumers re-export it: `RECONCILIATION_TOLERANCE`
 * (reconciliation/types) and `RECON_REPORT_EPSILON` (reconciliation-reports).
 */
export const CASH_VARIANCE_TOLERANCE = 0.01;

/**
 * Currency-aware physical cash variance tolerance — half the smallest
 * circulating unit for the currency's decimal precision (POS Session & Cash
 * Drawer Hardening, W0-15). Replaces the flat `CASH_VARIANCE_TOLERANCE`,
 * which is 10x too wide for 3-decimal currencies (KWD, BHD, OMR: smallest
 * unit is 0.001, so tolerance should be 0.0005, not 0.01) and slightly wider
 * than necessary for 2-decimal currencies (smallest unit 0.01, tolerance
 * 0.005).
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
