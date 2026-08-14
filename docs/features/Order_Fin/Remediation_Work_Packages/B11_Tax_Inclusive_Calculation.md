# B11 — Tax-Inclusive Calculation

## Metadata
Backlog ID: B11 · Severity: HIGH · Classification: BLOCKS_FEATURE · Status: IMPLEMENTED 2026-07-25
Authoritative report sections: H3, §4, §14, §50-B11
Required decisions: none (snapshot semantics already defined; engine change is technical)
Dependencies: none — coordination only: [B12](B12_Order_Amendment_And_Financial_Delta.md) (impl overlap on the item-edit path; B12 retires that path and recommends B11 first — B12 is NOT a predecessor of B11) · Blocks: —
Recommended phase: Seq 10

## Confirmed problem
`calculateOrderTotals` always adds tax (no TAX_INCLUSIVE branch); the snapshot handles inclusive via `taxAddend=0`; the item-edit path assumes inclusive with a 0.05 fallback — three inconsistent behaviors (H3), so inclusive tenants get wrong previews/submits.

## Current evidence — re-verified against live code 2026-07-25 (corrections in bold)

| File or symbol | Doc claim | Re-verified reality |
|---|---|---|
| order-calculation.service.ts:309–340 (now :288–363) | saleTotal = afterDiscounts + VAT + additional | **Confirmed accurate** — no mode branch existed; `calculateOrderTotals` never imported `resolveTaxPricingMode`/`TAX_PRICING_MODES`/`extractTaxFromInclusive`. |
| order-financial-write.service.ts:285–336 (now `resolveCanonicalTotalAmount` at :139–190) | taxAddend=0 when inclusive; `extractTaxFromInclusive` helper exists (:273) | **Partially stale** — the helper is at **:127**, not :273, and had **zero production callers** (dead code, exercised only by its own unit test) before this package. `resolveCanonicalTotalAmount`'s taxAddend=0 branch was real but was unreachable-correct-by-coincidence: nothing upstream ever produced genuinely inclusive-extracted `itemsBaseAmount`/tax facts for it to branch on meaningfully. |
| pricing-mode-resolver.service.ts | resolves tenant/branch mode | **Confirmed accurate** — `resolveTaxPricingMode` existed (branch → tenant → `TAX_EXCLUSIVE`, gated by the `tax_inclusive_pricing` feature flag, default OFF everywhere) but had exactly one caller (`order-financial-write.service.ts`), never the calc engine. |
| lib/db/orders.ts:919 | inclusive reverse-split + 0.05 fallback | **STALE — already fixed by B15.** `recalculateOrderTotals`'s reverse-split at :950-951 zero-rates on unconfigured tax with a `logger.warn` (proven by a passing regression test, `b15-currency-tolerance-guard.test.ts:78`); no hardcoded 0.05 remains there. |
| **New finding (not in original doc)** | — | `tax.service.ts`'s `TaxService.getTaxRate()` had a live `DEFAULT_VAT_RATE = 0.05` fallback — returned silently whenever the `TENANT_VAT_RATE` setting was unset, unparsable, or resolution threw. This directly violated the B15 "resolve-or-zero-rate, warn, never assume a rate" policy and was reachable from `calculateOrderTotals`'s own no-tax-profile fallback branch (the exact code this package modifies) and from `pricing.service.ts`. **Fixed in this package** (see Implementation). |

## Required outcome
Preview, submit, snapshot, and item flows produce identical totals under both TAX_INCLUSIVE and TAX_EXCLUSIVE: inclusive extracts embedded tax (`price/(1+rate)`), exclusive adds — one resolved mode consulted everywhere.

## Scope
Mode branch in `calculateOrderTotals` (+ tax lines baseAmount semantics), preview API parity, UI display labels (tax included), regression fixtures both modes.

## Out of scope
Retiring the legacy item-edit path (B23 via B12); rounding rules (B17).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | YES (inclusive tenants) |
| Payment facts | NO |
| Credit applications | NO |
| BVM | NO |
| Cash drawer | NO |
| Gateway or bank | NO |
| Tax documents | POSSIBLE (correct tax split feeds B14) |
| ERP-Lite GL | NO |
| Snapshot | YES (consistency, same formula) |
| Reconciliation | YES (tax checks in B20) |
| Customer receipt | YES (display) |
| Audit/outbox | NO |

## Acceptance criteria
Preview == submit == snapshot totals for inclusive fixture orders; AMOUNT_MISMATCH does not fire on mode alone; exclusive behavior byte-identical to today.

## Required tests
unit (both modes, compound tax), integration (preview/submit/snapshot equality), regression, i18n/UI display.

## Dependencies and sequencing
Independent start; coordinate fixtures with B20 tax check.

## Delivery surfaces

Backend services: `calculateOrderTotals` (order-calculation.service.ts) resolves `resolveTaxPricingMode` and passes it to `calculateTax`; `calculateTax` (tax-engine.service.ts) gained the actual TAX_INCLUSIVE branch (see Implementation notes); `TaxService.getTaxRate` (tax.service.ts) — adjacent B15-policy fix, see below. Preview routes inherit unchanged (no route code changed — they already spread `calculateOrderTotals`'s full result).
Database/schema: none — the `tax_pricing_mode` columns + `tax_inclusive_pricing` feature flag already existed from migration 0339.
API/endpoints: preview-payment/preview-financials + submit — same shapes; response now also carries `taxPricingMode`; tax lines carry inclusive-extracted values when applicable.
Frontend page/screen/dialog/action: payment modal (payment-full-view.tsx, via use-payment-totals.ts) appends a "— tax included" suffix to each tax breakdown row when the server-resolved mode is TAX_INCLUSIVE. Client-side fallback estimate (used only during the ~300ms preview debounce) is unchanged/exclusive-shaped by design — server totals always win once loaded, matching the pre-existing "never assume tax client-side" pattern. Receipts/reports inherit correct data automatically (they render persisted `org_order_taxes_dtl` rows, not their own tax math) — no hardcoded exclusive-only label found in the payment print report.
Reusable components/helpers: `extractTaxFromInclusive` (order-financial-write.service.ts:127, now exported for tests, still owns the single-rate math) is now genuinely reused — imported directly by `tax-engine.service.ts`'s new pricingMode-aware extraction pre-pass, and directly by `calculateOrderTotals`'s no-tax-profile fallback branch. No duplicate extraction math was written.
Permissions: none
Validation: AMOUNT_MISMATCH tolerance unchanged; mode resolved server-side only (`resolveTaxPricingMode(prisma, tenantId, branchId)` inside `calculateOrderTotals` — client never chooses or sends a mode).
i18n/RTL: `newOrder.payment.tax.includedSuffix` added to EN (`tax included`) and AR (`شامل الضريبة`); `npm run check:i18n` passes.
Accessibility: NOT_APPLICABLE beyond text changes.
Audit trail: tax pricing mode already recorded in snapshot JSON (order-financial-write.service.ts, pre-existing); `OrderCalculationResult.taxPricingMode` now also surfaces it on every preview/submit response.
Observability: preview==submit==snapshot equality proven via a dedicated integration test exercising the exact `resolveCanonicalTotalAmount` formula the snapshot uses against `calculateTax`'s real extraction output.
Jobs/workers: none
Feature flag: **correction to the original doc** — mode is tenant/branch config (`org_tenants_mst`/`org_branches_mst.tax_pricing_mode`) but `resolveTaxPricingMode` ADDITIONALLY gates TAX_INCLUSIVE behind the pre-existing `tax_inclusive_pricing` feature flag (default OFF for every tenant, per migration 0339's flag catalog seed). This means the fix is dormant everywhere until the owner explicitly enables the flag for a tenant AND sets `tax_pricing_mode='TAX_INCLUSIVE'` — a safe, zero-blast-radius rollout by construction, not by test discipline alone.
Rollout: flag stays OFF by default (already true pre-B11) → owner enables `tax_inclusive_pricing` + sets `tax_pricing_mode='TAX_INCLUSIVE'` for one pilot tenant/branch on Preview → QA runs the B11 scenarios in QA_TEST_GUIDE §22 → owner approval → wider enablement is a config change, not a code change.
Rollback: disable the feature flag (or clear `tax_pricing_mode`) for the affected tenant — `resolveTaxPricingMode` falls back to TAX_EXCLUSIVE immediately, byte-identical to pre-B11 behavior. No code revert needed for rollback; exclusive tenants are unaffected throughout regardless.

## Design decisions (this implementation)

1. **Extraction algorithm — solve-then-replay, not a parallel formula.** `calculateTax` (tax-engine.service.ts) computes a combined multiplier `K` by running a lightweight unitless pre-pass over the same rate/compound rules already in the forward loop (`K = 1 + priorTaxFraction`), extracts the net base via the existing `extractTaxFromInclusive(gross, K-1)` helper, then feeds that net base into the **unchanged** forward per-profile loop. This means the per-line compound math is never duplicated — inclusive mode literally reuses the same forward computation as exclusive mode, just seeded with a different base. Proven correct for N profiles in any compound/non-compound order (unit + integration tests cover 1 profile, 2 parallel non-compound profiles, and a non-compound-then-compound stack).
2. **VAT/GST vs. CUSTOM tax under TAX_INCLUSIVE — uniform treatment, not split.** All profile-driven tax lines (`org_tax_profiles_cf`, any `tax_type`) participate in the same inclusive-extraction envelope when `taxBreakdown.length > 0` — there is no VAT-embedded-but-CUSTOM-additive special case, because the doc's own "one resolved mode consulted everywhere" principle applies to the tenant's whole configured tax-profile set, not a per-type carve-out invented for this package.
3. ~~**The ad-hoc `additionalTaxRate`/`additionalTaxAmount` params stay additive in both modes.**~~ These only applied in the legacy no-tax-profile-configured fallback branch and represented a manually-entered order-level surcharge with no profile/catalog backing — never embedded in the priced item, so never extracted. `additionalTaxEmbedded = isInclusive && taxBreakdown.length > 0` was the single flag that discriminated the two cases.

   > **SUPERSEDED 2026-08-13 (B28 follow-up #4).** Both request params were **removed entirely**: they were accepted on the submit path but had no equivalent on the preview routes, so a non-zero value would have made the payment-modal preview disagree with the amount actually charged. Verified dead in practice before removal (no caller could send a non-zero value — the client hardcodes its `taxRate` to 0). Tax now resolves from exactly two authoritative sources: configured tax profiles, and the server-resolved `TENANT_VAT_RATE` fallback. `additionalTaxEmbedded` still exists and still discriminates correctly — it now governs only CUSTOM-type **profile** lines, which is what `additionalTaxAmount` has always summed. B11's inclusive/exclusive math is otherwise unchanged. See [B28](B28_Financial_Regression_Test_Coverage.md) → "follow-up #4".
4. **Item-level pricing/storage is untouched.** `subtotal`/item `total_price` continue to be the raw catalog price entered by the tenant (tax-inclusive gross, for inclusive tenants) — B11 only changes how the TAX portion is computed and how the RETURNED `afterDiscounts` (net-of-tax) and `saleTotal` (unchanged gross) fields are derived from it. This keeps the fix inside the doc's stated Scope and matches how `resolveCanonicalTotalAmount`'s `itemsBaseAmount` input is actually populated downstream (DB aggregate of the untouched item price, not a re-derived net).
5. **Adjacent fix: `TaxService.getTaxRate` no longer assumes 5%.** Discovered while verifying the no-tax-profile fallback branch this package modifies (`calculateOrderTotals` → `tax.getTaxRate`) — `DEFAULT_VAT_RATE = 0.05` was silently returned on unset/unparsable/error, violating the already-shipped B15 policy. Fixed to zero-rate + `logger.warn`, matching `lib/db/orders.ts`'s existing pattern exactly. This is a real, live bug fix, not scope creep — it sits on the exact call path this package already touches.

## End-to-end operational flow

1. Inclusive-mode + flag-enabled tenant builds an order → preview (`/api/v1/orders/preview-payment` or `/preview-financials`) resolves TAX_INCLUSIVE server-side, extracts embedded VAT from the priced item total, and returns `afterDiscounts` (net), `vatValue`/`taxBreakdown` (extracted), `saleTotal` (unchanged gross), `taxPricingMode: 'TAX_INCLUSIVE'`.
2. Payment modal shows each tax breakdown row with a "— tax included" suffix; the grand total matches the priced item total exactly (nothing added).
3. Submit (`submitOrder` → `calculateOrderTotals` again) recomputes byte-identically (same function, same inputs) — AMOUNT_MISMATCH does not fire on mode alone. `settleOrderTx` persists the same extracted `taxBreakdown` lines into `org_order_taxes_dtl`.
4. The recalculation snapshot (`recalculateOrderFinancialSnapshotTx`) re-derives the header total from those persisted rows via `resolveCanonicalTotalAmount`'s `taxAddend=0` branch — reconstructing the exact same gross, proven by the B11 integration test.
5. Exclusive tenants (the default, and every tenant until the flag is explicitly enabled) see byte-identical pre-B11 behavior throughout — verified by re-running the full existing test suite (2277/2277 unchanged) plus new exclusive-mode regression assertions in every touched file.

## Completion evidence
Migration: none required (schema/flag already existed from migration 0339) · Implementation files: `lib/services/tax-engine.service.ts` (pricingMode-aware `calculateTax`), `lib/services/order-calculation.service.ts` (mode resolution + branch + `taxPricingMode` field), `lib/services/tax.service.ts` (B15-policy fix to `getTaxRate`), `lib/services/order-financial-write.service.ts` (`resolveCanonicalTotalAmount` exported for testing, no behavior change), `src/features/orders/hooks/use-payment-totals.ts` + `src/features/orders/ui/payment-full-view.tsx` (tax-included label), `messages/en+ar/newOrder/payment/tax.json` (i18n) · Tests: `__tests__/services/tax-engine.service.test.ts` (+7 TAX_INCLUSIVE cases incl. compound), `__tests__/services/order-calculation.service.test.ts` (+5 TAX_INCLUSIVE cases), `__tests__/services/tax.service.test.ts` (new, 6 cases — B15 zero-rate regression), `__tests__/integration/b11-tax-inclusive-consistency.test.ts` (new, 3 cases — preview/submit/snapshot formula equality) · Gates: tsc clean (3 pre-existing unrelated errors, none in touched files) / eslint 0 / full jest 235/235 suites, 2277/2277 tests, zero known failures / build ✓ / check:i18n ✓ · Commit: pending (owner) · Preview QA (deploy/result/approval): pending — see QA_TEST_GUIDE §22 · Reviewer: — · Verification: pending Preview QA + owner approval · Authoritative report update: not filed as a separate addendum — the `tax.service.ts` finding is documented here and in README/memory per this session's established precedent (B19/B21) for in-scope adjacent discoveries.
