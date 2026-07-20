# B35 — Unified Drawer Expected-Cash (Addendum A2 fix)

## Metadata
Backlog ID: B35 · Severity: MEDIUM · Classification: BLOCKS_FEATURE / CONTROL_GAP · Status: **IMPLEMENTED 2026-07-18**
Authoritative report sections: Addendum A2 (resolves it), §17, §50-B16
Required decisions: none (owner directive 2026-07-18 accepted the single-source-of-truth model + removal of the `order_fin_drawer_close_v2` flag)
Dependencies: [B16](B16_Cash_Drawer_Filtering_And_Variance_Approval.md) (shares the expected-cash code surface) · Blocks: — · Recommended phase: Seq 3 (folded in with B16)

## Confirmed problem
Addendum A2 (code-verified 2026-07-18): the drawer expected-cash formula `expected = float + Σ sessionPayments + Σ(movements IN − OUT)` **double-counts cash sales**. A single cash sale is written to two ledgers — an `org_order_payments_dtl` row (session-linked) **and** a `CASH_SALE` `IN` movement (`order-settlement.service.ts:830-890`, `customer-receipt-posting.service.ts:166`, `wiring/cash-drawer-wiring.handler.ts:68`) — and both were summed. The sale's change `CASH_OUT` movement was also mis-modeled against the net `CASH_SALE` amount.

## Owner decisions (2026-07-18)
1. **Single source of truth:** the **payment ledger owns sale cash**; drawer movements own only manual float / petty / drop / adjustment cash.
2. **No feature flag:** the corrected math is a bug fix and applies **unconditionally** — the `order_fin_drawer_close_v2` flag introduced by B16 is removed (it left the fix dormant and added a second code path). B16's variance approval keeps working, gated only by the per-drawer `variance_approval_threshold` (opt-in) — not by any flag.

## Required outcome — the one formula
```
expected cash = opening float
              + Σ effective cash payments        (active + COMPLETED-set + cash-family)
              + Σ MANUAL movements (IN − OUT)     (order_payment_id IS NULL)
```
Sale-mirror movements (`CASH_SALE` + their change `CASH_OUT`, which carry `order_payment_id`) are **excluded** — the payment already counts that cash. The **same** calculation is used by `closeSession`, `buildSessionReconciliation`/`getSessionSummary`, the list/detail derived-expected loaders, and (via the server value) `buildCashDrawerClosePreview`.

## Scope
Server-side expected-cash math in `lib/services/cash-drawer.service.ts` + the client preview fallback in `cash-drawers/api/cash-drawer-api.ts`; removal of the `order_fin_drawer_close_v2` flag. No schema change, no migration.

## Out of scope
Cash refund OUT movements (B9) — when B9 writes `CASH_REFUND` movements it must confirm they are **not** excluded by the `order_payment_id` rule (a refund reduces expected cash); coordinate at B9. Variance-approval workflow (B16). Safe/bank-deposit (B26).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total / payment facts / credit apps / BVM / gateway / tax docs / snapshot | NO |
| Cash drawer | YES — expected/variance math now counts each cash fact once |
| Reconciliation | YES (drawer expected-cash) |

## Acceptance criteria
A session with one CASH sale (payment row + `CASH_SALE` movement) closes with expected cash counting that sale **once**; a manual float top-up still increases expected cash; `buildCashDrawerClosePreview` shows the same expected cash the server computes; the `order_fin_drawer_close_v2` flag no longer exists anywhere.

## Required tests
unit (payment-filter unconditional; sale-mirror movements excluded via `order_payment_id: null`; manual movements still counted), the pre-existing `cash-drawer-close-preview` tests go green, regression.

## Delivery surfaces
Backend services: `closeSession`, `buildSessionReconciliation`, `loadMovementTotalsBySession`, `loadPaymentTotalsBySession` (all in `cash-drawer.service.ts`) · Database/schema: none · API/endpoints: none new · Frontend page/screen/dialog/action: NOT_APPLICABLE (numbers only; existing screens render the corrected value) · Reason: pure calculation correction, no new UI element · Existing consumer: drawer close/summary/detail screens + POS close preview · Reusable components/helpers: `cash-drawer-cash-facts.ts` (unconditional now) · Permissions: none new · Validation: `order_payment_id` discriminator (manual vs sale-mirror) · i18n/RTL: none · Accessibility: NOT_APPLICABLE · Audit trail: unchanged · Observability: drawer recon checks · Jobs/workers: none · Feature flag: **removed** (`order_fin_drawer_close_v2`) · Rollout: direct (bug fix) · Rollback: git revert

## Completion evidence
**Implementation (2026-07-18):**
- `cash-drawer.service.ts`: removed `isDrawerCloseV2Enabled` + the `canAccess` import + all `effectiveCashOnly` threading; the effective-cash payment filter is now unconditional at every site. `closeSession` movements query + `loadMovementTotalsBySession` add `order_payment_id: null`; `buildSessionReconciliation` filters `movements` to `order_payment_id == null` in-memory. Variance-approval threshold gate now keys off `drawer.variance_approval_threshold != null` only (no flag).
- `cash-drawer-cash-facts.ts`: doc note updated (unconditional, no flag).
- `lib/types/tenant.ts` + `lib/constants/feature-flags.ts`: `order_fin_drawer_close_v2` removed from the FeatureFlags type + FLAG_CATALOG.
- `cash-drawers/api/cash-drawer-api.ts`: `buildCashDrawerClosePreview` fallback expected-cash changed to `openingFloat + cashCollected` (movements are audit context; the server's `reconciliation.expectedCash` is preferred when present).

**Tests:** `cash-drawer.service.test.ts` — flag mocks removed; new assertions that the payment filter is unconditional and that the movements query excludes sale-mirror rows (`order_payment_id: null`); variance-approval tests re-keyed to the per-drawer threshold. **39/39 green.** `cash-drawer-close-preview.test.ts` **3/3 green** (the two previously-failing owner tests now pass).

**Gates (2026-07-18):** tsc clean · jest 39/39 + preview 3/3 · eslint / build — see status.

**Commit:** — (owner) · **Preview QA:** — pending (close a drawer with a cash sale + a manual float movement; confirm expected cash counts the sale once and includes the float; confirm preview matches the close) · **Reviewer:** — · **Verification:** — · **Authoritative report update:** Addendum A2 marked resolved-by-B35 2026-07-18.
