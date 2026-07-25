# B17 — Currency Rounding Runtime

## Metadata
Backlog ID: B17 · Severity: MEDIUM · Classification: BLOCKS_FEATURE · Status: IMPLEMENTED 2026-07-25
Authoritative report sections: §15, §42, §50-B17
Required decisions: none (config model exists; activation is technical + D005-consistent)
Dependencies: [B15](B15_Currency_Defaults_And_Tolerances.md) (impl) · Blocks: —
Recommended phase: Seq 10

## Confirmed problem
`rounding_adjustment_amount` participates in the snapshot total formula but has no writer; `sys_currency_rounding_rules_cd` (mig 0290) is seeded but unconsumed — cash rounding is CONFIGURED_ONLY (§15.3-era finding, §42).

## Current evidence — re-verified against live code 2026-07-25 (corrections in bold)

| File or symbol | Doc claim | Re-verified reality |
|---|---|---|
| order-financial-write.service.ts:766 | reads rounding_adjustment (always 0) | **Line stale** (actual read site is `resolveCanonicalTotalAmount`'s caller, line 641; `.select` at 430) — **substance confirmed**: read into the snapshot JSON only, never written back to the column by the `.update()` call (lines 811-872 write ~35 columns, not this one). |
| supabase/migrations/0290_currency_rounding.sql | rules table seeded | **Confirmed** — `sys_currency_rounding_rules_cd`, keyed by `currency_code` alone (no tenant scope), CHECK-constrained to `HALF_UP/HALF_DOWN/FLOOR/CEIL`. All 13 seeded rows use `HALF_UP` with each currency's *native* decimal increment (0.01/0.001/1.00) — no non-native increment (e.g. 0.005) is actually seeded; a Preview QA pilot needs one row edited to exercise real rounding. |
| payment modal fx-rounding line | display-only | **Confirmed, and worse than implied**: the caller hardcoded `roundingAmount={0}` (a literal, not a stale-but-correct pipe), AND the row's visibility gate (`showCurrencyRounding`, 3 independent call sites) was wired to FX-rate presence only — a same-currency rounding adjustment would never have shown even after wiring the value. Both fixed in this package. |
| **New finding (not in original doc)** | — | A **second, older, independently-designed** cash-rounding config surface exists: `sys_currency_cd.cash_rounding_mode`/`cash_rounding_increment_minor` (migration 0264, HQ platform catalog scope) with a **conflicting mode vocabulary** (`HALF_EVEN/UP/DOWN` vs this package's `HALF_UP/HALF_DOWN/FLOOR/CEIL`) and a stale `prisma/schema.prisma` mirror. Explicitly out of scope for this package — see Design decisions below — but flagged so a future audit doesn't count it as an unclosed duplicate. |

## Required outcome
Calculation engine applies the tenant-currency rounding rule (increment + mode) at the defined point (grand total, cash tender), persists the adjustment to `rounding_adjustment_amount`, and the snapshot/receipt/recon all reflect it consistently; rounding gain/loss event reserved for B6/B26.

## Scope
Rule resolution + application in `calculateOrderTotals`/settlement; writer for the column; receipt display.

## Out of scope
GL rounding gain/loss journal (B6); FX (B26).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | YES (rounded totals) |
| Payment facts | POSSIBLE (cash tender rounding) |
| Credit applications | NO |
| BVM | POSSIBLE (ROUNDING line type exists) |
| Cash drawer | POSSIBLE |
| Gateway or bank | NO |
| Tax documents | POSSIBLE |
| ERP-Lite GL | POSSIBLE (deferred) |
| Snapshot | YES |
| Reconciliation | YES |
| Customer receipt | YES |
| Audit/outbox | NO |

## Acceptance criteria
Tenant with 0.005 increment produces rounded grand totals with the adjustment persisted and `preview == submit == snapshot == receipt`.

## Required tests
unit (modes/increments), integration, regression (3-dp currencies).

## Dependencies and sequencing
After B15; align with B11 fixtures.

## Delivery surfaces

Backend services: `resolveCurrencyRoundingRule`/`roundToIncrement` (new, `lib/money/currency-rounding.ts`); `calculateOrderTotals` (order-calculation.service.ts) applies the rule to the grand total before the gift-card cap; writer added to both `OrderService.createOrder`/`createOrderInTransaction` header-create calls and the item-edit recalculation path (order-service.ts).
Database/schema: none new (column `org_orders_mst.rounding_adjustment_amount` + `sys_currency_rounding_rules_cd` both already existed).
API/endpoints: preview/submit responses (`/api/v1/orders/preview-payment`, `/preview-financials`) include `roundingAdjustmentAmount` — no route code changed, both already spread `calculateOrderTotals`'s full result.
Frontend page/screen/dialog/action: payment modal's `FxRoundingLine` now receives the real server-resolved value (was a hardcoded `0`); its 3 independent visibility-gate call sites (`project-capability-context.ts`, `use-payment-engine.ts`'s Simple→Advanced escalation predicate, `payment-modal-v4.right-rail.ts`'s summary) all now fire on rounding presence, not just FX-rate presence. Order-detail page needed zero changes — already correctly wired to the real column. No new page.
Reusable components/helpers: `fx-rounding-line.tsx` reused unchanged (component itself was already correctly built for a real value); new `roundToIncrement`/`resolveCurrencyRoundingRule` in `lib/money/currency-rounding.ts`, mirroring the mode-switch shape already established by `loyalty.service.ts`'s `roundLoyaltyPoints` (B21) without sharing its enum, per the DB-mirror rule (each DB column gets its own mirrored constant — `CURRENCY_ROUNDING_MODES`, separate from `LOYALTY_ROUNDING_RULES`, even though values are identical today).
Permissions: none.
Validation: rule lookup is per-currency-code, safe no-op (adjustment 0) when no active row exists or `rounding_unit` is not a usable positive number — never invents a rounding behavior, matching the B15 "resolve or zero" policy already applied to tax rates.
i18n/RTL: no new strings — `FxRoundingLine` already had complete EN/AR display logic (existing component, dedicated test file), it only needed a real value.
Accessibility: NOT_APPLICABLE beyond display (unchanged component).
Audit trail: `rounding_adjustment_amount` persisted on the order header at submit and on item-edit recalculation; snapshot JSON already carried it (pre-existing).
Observability: preview==submit==snapshot equality proven via a dedicated integration test exercising the exact `resolveCanonicalTotalAmount` formula the snapshot uses against real `resolveCurrencyRoundingRule`/`roundToIncrement` output, for both TAX_EXCLUSIVE and TAX_INCLUSIVE combined with rounding.
Jobs/workers: none.
Feature flag: rule-driven (tenant currency config), confirmed no separate flag — safe by construction: every currently-seeded `sys_currency_rounding_rules_cd` row uses the currency's *native* decimal increment, so the adjustment is mathematically 0 (byte-identical to pre-B17) for every tenant until an admin explicitly edits a row to a non-native increment.
Rollout: dormant by data, not by flag — owner edits one currency's `rounding_unit` on Preview (e.g. OMR to 0.005) → QA runs the B17 scenarios in QA_TEST_GUIDE §23 → owner approval → wider enablement is a data change (UPDATE one row), not a code change.
Rollback: revert the edited row's `rounding_unit` back to the native increment (or `is_active=false`) — adjustment returns to 0 immediately, no code revert needed; currencies never touched are unaffected throughout.

## Design decisions (this implementation)

1. **Single-total rounding, not cash-only differential rounding.** The grand total itself is rounded once (in `calculateOrderTotals`, before the gift-card cap) and the delta persisted as the adjustment — whatever payment method then collects, it collects against this already-rounded total. Considered and rejected: a "cash-only" pattern where the recorded total stays exact but a CASH tender rounds differently, producing a rounding gain/loss to post to GL. That pattern needs its own discrepancy-tracking and GL posting mechanism — explicitly deferred by this package's own "Out of scope: GL rounding gain/loss journal (B6)" — and the doc's required outcome/acceptance criteria (single "grand total" figure, `preview==submit==snapshot==receipt` equality) are fully satisfied by the simpler single-total design without inventing that mechanism.
2. **Insertion point: before the gift-card cap, not after `saleTotal`.** `giftCardApplied` is capped via `Math.min(availableBalance, amountBeforeGiftCard)` — rounding the total after that cap would let the gift-card leg diverge from what the customer actually owes post-rounding. Rounding first keeps the cap, `saleTotal`, and the persisted adjustment internally consistent (regression-tested).
3. **`sys_currency_cd.cash_rounding_*` (migration 0264) is explicitly out of scope.** A second, independently-designed rounding config surface with a conflicting mode vocabulary and a stale Prisma mirror. Reconciling two DB-mirror constants for a HQ-platform-catalog-scope table is a separate, larger decision (which one wins, or a migration to merge them) that doesn't belong in this package — flagged here and in README so it isn't miscounted as an unclosed B17 gap.
4. **Item-level pricing/storage untouched; only the grand-total formula changes** — consistent with B11's same scoping call, and required since `resolveCanonicalTotalAmount`'s `itemsBaseAmount` input is a raw DB aggregate of `total_price`, not a re-derived figure.
5. **Receipts/reports need no explicit "rounding line" beyond the payment modal.** Any surface that reads `order.total_amount` (the single grand-total field) is automatically correct the moment the writer exists — verified the order-detail page and the checked print/report components read the real column, not a hardcoded/re-derived total. The acceptance criterion is total-equality, not a mandated new UI element on every print surface.

## End-to-end operational flow

1. Tenant with a cash-rounding rule (non-native `rounding_unit` on `sys_currency_rounding_rules_cd`) builds an order → preview resolves the rule server-side, rounds the grand total, and shows the rounding line ("— tax included"-style row via `FxRoundingLine`) with the delta.
2. Submit recomputes byte-identically (same function) and persists the delta to `org_orders_mst.rounding_adjustment_amount`; the recalculation snapshot re-derives the same total from that persisted column via `resolveCanonicalTotalAmount`'s `+ roundingAdjustmentAmount` term.
3. Tenants without a non-native rule (everyone, until an admin opts in) see byte-identical pre-B17 behavior — verified by the full existing suite (237/237 suites unchanged) plus dedicated no-op regression assertions.

## Completion evidence
Migration: none required (column + rules table already existed) · Implementation files: `lib/money/currency-rounding.ts` (new), `lib/constants/order-financial.ts` (`CURRENCY_ROUNDING_MODES`), `lib/services/order-calculation.service.ts` (rounding step + `roundingAdjustmentAmount` field), `lib/services/order-service.ts` (writer in both `createOrder`/`createOrderInTransaction` + item-edit recalc path), `lib/services/order-submit-orchestrator.service.ts` (totals mapping), `lib/services/order-financial-write.service.ts` (`resolveCanonicalTotalAmount` exported for testing, no behavior change), `src/features/orders/hooks/use-payment-totals.ts` + `use-payment-engine.ts` + `src/features/orders/ui/payment-full-view.tsx` + `payment/domain/project-capability-context.ts` + `ui/payment-modal-v4.right-rail.ts` (real value threaded to all 3 `showCurrencyRounding` gate sites) · Tests: `__tests__/services/currency-rounding.test.ts` (new, 11 cases — all 4 modes, native/non-native increments, no-op guards, rule resolution), `__tests__/services/order-calculation.service.test.ts` (+4 B17 cases incl. B11+B17 combined), `__tests__/integration/b17-currency-rounding-consistency.test.ts` (new, 3 cases — preview/submit/snapshot formula equality for exclusive, no-rule, and inclusive+rounding combined) · Gates: tsc clean (3 pre-existing unrelated errors, none in touched files) / eslint 0 / full jest 237/237 suites, 2295/2295 tests, zero known failures / build ✓ / check:i18n ✓ · Commit: pending (owner) · Preview QA (deploy/result/approval): pending — see QA_TEST_GUIDE §23 (requires editing one currency's `rounding_unit` on Preview to a non-native value first) · Reviewer: — · Verification: pending Preview QA + owner approval · Authoritative report update: not filed as a separate addendum — the `sys_currency_cd` duplicate-config finding is documented here and in README/memory per this session's established precedent for in-scope adjacent discoveries.
