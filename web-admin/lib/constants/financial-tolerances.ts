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
 * Canonical consumers re-export it: `RECONCILIATION_TOLERANCE`
 * (reconciliation/types) and `RECON_REPORT_EPSILON` (reconciliation-reports).
 */
export const CASH_VARIANCE_TOLERANCE = 0.01;
