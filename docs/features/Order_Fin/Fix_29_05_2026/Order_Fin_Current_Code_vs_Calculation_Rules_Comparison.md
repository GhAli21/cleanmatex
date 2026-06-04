# Order Fin Current Code vs Calculation Rules Comparison

## 1. Header

- **Compared sources**
  - `docs/features/Order_Fin/Fix_29_05_2026/CleanMateX_Order_Fin_Calculation_Algorithms_Full_v1_1.md`
  - `docs/features/Order_Fin/Fix_29_05_2026/Full non-simplified calculation rule set.md`
- **Comparison baseline**
  - Current code and active schema contract only
- **Date**
  - June 2, 2026
- **Conclusion status summary**
  - `Needs follow-up implementation`

## 2. Executive Summary

Overall alignment is **strong in the core canonical semantics** and **partial in the full enterprise breadth promised by the two specs**.

Major matches:

- `total_amount` is treated as sale value, not as net-after-payment value.
- Gift card / stored value is kept separate from discounts and from sale-total math.
- `outstanding_amount`, `overpaid_amount`, `pay_on_collection_amount`, and `ar_receivable_amount` follow the canonical formulas in the active runtime.
- `PAY_ON_COLLECTION` is treated as non-AR in the live runtime.
- AR receivable is frozen to discovered runtime codes through a shared constant instead of silent inference.
- Canonical snapshot status, warning codes, calculation JSON, hash, and trace fields exist and are actively written.
- Summary/read-model code now reads canonical fields first and exposes canonical AR/tax-document fields.

Major deviations:

- The current schema does **not** implement the broader tax-base split fields from `v1.1` such as `non_taxable_amount`, `exempt_amount`, `zero_rated_amount`, and `out_of_scope_amount`.
- The current schema/runtime does **not** implement `pending_credit_application_amount` or `failed_credit_application_amount`.
- The current schema/runtime does **not** implement the `base_*` currency snapshot fields required by `v1.1`.
- Tax-document behavior is only partially implemented: the schema and read model exist, but there is no full tax-document decision/update workflow in the current runtime.
- The current tax-document mismatch warning logic appears incorrect because it compares `ar_receivable_amount` to `total_amount`, even though the spec says tax-document total should track fiscal sale total, not receivable.

Highest-risk gaps:

- **P0:** incorrect tax-document mismatch logic in `order-financial-write.service.ts`
- **P1:** missing tax-document lifecycle implementation
- **P1:** missing tax-base decomposition fields for compliance-grade reporting
- **P1:** missing base-currency financial snapshot fields

Production-safety relative to the two specs:

- The current code is **production-safe for the implemented canonical runtime path**.
- It is **not yet fully aligned with the full calculation specifications**, especially on tax-document lifecycle, richer tax-base decomposition, and multi-currency/base-currency snapshot scope.

## 3. Comparison Matrix

| Topic | Reference rule | Current code status | Evidence | Gap type | Severity | Required action |
|---|---|---|---|---|---|---|
| Canonical vocabulary and field meanings | Order value, settlement, AR, and tax document must be separate concepts | Implemented | `order-calculation.service.ts:258-264`, `order-financial-write.service.ts:564-580`, `order-financial-summary.service.ts:360-408` | None | Low | Keep as canonical baseline |
| Order value build | `items_base_amount`, subtotal, charges, discounts, tax, rounding feed `total_amount` | Implemented with acceptable simplification | `order-financial-write.service.ts:520-559`, `0334...sql:399-438` | Current pricing mode simplification | Low | Keep docs explicit that item totals already embed extras |
| Discount handling | Commercial discounts only; credits must not be discounts | Implemented | `order-calculation.service.ts:140-226`, `order-financial-write.service.ts:597-600`, `0333...sql:136-141` | None | Low | Keep current warning guard |
| Tax handling | Tax is computed after commercial discounts; stored value must not reduce tax base | Implemented for current runtime | `order-calculation.service.ts:210-264`, `order-calculation.service.test.ts` gift-card tax assertions, `map-order-financial-summary-view.ts:176-178` | Missing richer tax-base buckets | P1 | Add non-taxable/exempt/zero-rated/out-of-scope support if full tax reporting is required |
| Sale total / `total_amount` | `total_amount` is full sale value and never net of payments/credits | Implemented | `order-calculation.service.ts:258-264`, `order-financial-write.service.ts:552-559`, `0333...sql:63-64` | None | Low | Keep |
| Payment lifecycle buckets | Completed, pending, authorized, failed must be separated | Implemented, but split is stricter than one source doc wording | `order-financial.ts:312-317`, `order-financial-write.service.ts:536-539`, `0334...sql:103-258` | Implemented differently than one spec passage | Medium | Keep stricter split; update docs to make `authorized` its own bucket everywhere |
| Credit application handling | Applied credits separate from payment and discount; pending/failed credit apps tracked too | Partially implemented | `order-financial-write.service.ts:532-535`, `0334...sql:263-271` | Missing schema/runtime breadth | P1 | Add pending/failed credit-application fields only when source table supports lifecycle states |
| Refund handling | Split refunds into real-payment refunded, stored-value restored, and customer credit issued | Implemented with acceptable simplification | `order-financial-write.service.ts:543-549`, `0334...sql:273-339`, `0333...sql:79-88` | Reopen-due behavior still fixed at zero | Medium | Add explicit reopen-due source rules when business process exists |
| `net_collected_amount` | Prefer stricter rule: `max(total_paid_amount - real_payment_refunded_amount, 0)` | Implemented | `order-financial-write.service.ts:564`, `order-financial-summary.service.ts:388`, `map-order-financial-summary-view.ts:68-69` | Spec conflict resolved | Low | Keep stricter rule as canonical resolution |
| `outstanding_amount` | `max(total_amount - total_paid_amount - total_credit_applied_amount + reopeners, 0)` | Implemented with zero reopeners | `order-financial-write.service.ts:561-572`, `0334...sql:485-496`, `Full non-simplified...md:855-864` | Partial implementation | Medium | Implement non-zero reopen-due only when explicit business rows exist |
| `overpaid_amount` | `max(total_paid_amount + total_credit_applied_amount - total_amount, 0)` | Implemented | `order-financial-write.service.ts:573`, `order-financial-summary.service.ts:390`, `map-order-financial-summary-view.ts:72` | None | Low | Keep |
| `PAY_ON_COLLECTION` | Outstanding is operational collection only; no AR invoice | Implemented | `order-financial-write.service.ts:574-577`, `ar-invoice.service.test.ts:249-278`, `map-order-financial-summary-view.ts:76-78,266-271` | None | Low | Keep |
| `ar_receivable_amount` | Receivable only for invoice-like settlement types | Partially implemented | `order-financial.ts:278-289`, `order-financial-write.service.ts:578-580`, `0334...sql:508-517` | Runtime discovered set narrower than spec | Medium | If B2B/INVOICE codes are introduced in DB, extend the frozen constant set deliberately |
| AR invoice creation/update behavior | Create/update AR invoice only for receivable cases; invoice amount tracks receivable only | Implemented for current discovered code set | `ar-invoice.service.ts:85-92,432-440`, `ar-invoice.service.test.ts:195-278` | Narrower code-set scope | Medium | Keep current behavior; extend only after persisted-code discovery |
| Tax document separation | Tax document must be separate from AR invoice and track sale total, not receivable | Partially implemented and partially incorrect | Schema/read fields in `0333...sql:47-50`, `order-financial-summary.service.ts:396-399`; warning logic in `order-financial-write.service.ts:603` | Runtime gap and incorrect warning rule | P0 | Implement real tax-document workflow and fix mismatch rule to compare fiscal totals, not AR receivable |
| Financial snapshot status and warnings | Snapshot should expose mismatch/recalc state and warning codes | Implemented with safer default drift | `order-financial.ts:326-355`, `order-financial-write.service.ts:282-299`, `0333...sql:53-57`, `0334...sql` status backfill | Implemented differently than spec default | Medium | Consider changing schema default from `RECALCULATION_REQUIRED` to `CURRENT` only if write path always guarantees immediate projection |
| Audit/hash/trace behavior | Persist versioned snapshot, stable hash, trace id; exclude volatile fields from hash | Implemented | `order-financial-write.service.ts:325-353,659-677`, `0333...sql:127-132` | None | Low | Add direct unit coverage for hash invariants |
| Validation contract behavior | Checkout/request contracts should be canonical around `saleTotal`, split legs, and outstanding policy | Implemented with compatibility simplification | `new-order-payment-schemas.ts:129-173,208-311`, `financial-schemas.test.ts:149-211`, `checkout-multi-payment.test.ts:54-158` | Acceptable simplification | Low | Keep aliases minimal and documented |
| UI summary semantics | Summary should use canonical values, AR invoice precedence, and mismatch warnings | Implemented | `order-financial-summary.service.ts:360-408`, `map-order-financial-summary-view.ts:68-170,181-299`, `map-order-financial-summary-view.test.ts:69-238` | None | Low | Keep |
| Data model breadth | `v1.1` requires `non_taxable_amount`, `exempt_amount`, `zero_rated_amount`, `out_of_scope_amount`, `pending_credit_application_amount`, `failed_credit_application_amount`, `base_*` fields | Not implemented | Missing from `0333...sql`, missing from `schema.prisma` search results, present only in spec docs | Not implemented | P1 | Add only if enterprise tax reporting and base-currency reporting are in active scope |

## 4. Gap Analysis

### Implemented as specified

- **Sale total stays independent from settlement**
  - Current behavior: `saleTotal` and `total_amount` are calculated before gift card and before payment settlement.
  - Expected behavior: full sale value must never be reduced by payments or stored-value credits.
  - Risk: low.
  - Assessment: intentional and safe.

- **Completed payments and applied credits reduce outstanding, not order total**
  - Current behavior: `outstanding_amount` is derived from `total_amount - total_paid_amount - total_credit_applied_amount`.
  - Expected behavior: exactly matches both docs.
  - Risk: low.
  - Assessment: intentional and safe.

- **`PAY_ON_COLLECTION` is not AR**
  - Current behavior: `pay_on_collection_amount` gets outstanding; `ar_receivable_amount` stays `0`; AR invoice creation is rejected in tests.
  - Expected behavior: exactly matches both docs.
  - Risk: low.
  - Assessment: intentional and safe.

- **AR invoice read model prefers invoice outstanding over header receivable**
  - Current behavior: mapper uses AR invoice outstanding first when invoice exists.
  - Expected behavior: invoice should remain the stronger AR truth once linked.
  - Risk: low.
  - Assessment: intentional and safe.

### Implemented with acceptable simplification

- **AR receivable code set**
  - Current behavior: only `CREDIT_INVOICE` is frozen in runtime constants.
  - Expected behavior: specs list `CREDIT_INVOICE`, `B2B`, and `INVOICE`.
  - Business/accounting risk: low as long as only `CREDIT_INVOICE` is actually persisted today.
  - Assessment: intentional and safe for the current repo; risky only if new persisted codes appear without updating constants.

- **Snapshot status default**
  - Current behavior: schema default is `RECALCULATION_REQUIRED`; runtime then writes `CURRENT`, `MISMATCH`, or `RECALCULATION_REQUIRED`.
  - Expected behavior: `v1.1` lists default `CURRENT`.
  - Business/accounting risk: low; this is conservative rather than misleading.
  - Assessment: intentional and safe, but different from spec wording.

- **Current pricing mode item/extras semantics**
  - Current behavior: `subtotal_amount` and `items_base_amount` are intentionally equal because extras are embedded in line totals.
  - Expected behavior: both docs allow this current-mode simplification.
  - Business/accounting risk: low if documented.
  - Assessment: intentional and safe.

### Partially implemented

- **Refund reopen-due logic**
  - Current behavior: `refund_reopens_due_amount`, `credit_reversal_reopens_due_amount`, and `credit_reversed_amount` exist, but runtime currently fixes them to `0`.
  - Expected behavior: specs allow explicit reopen-due behavior when refund/reversal rows prove it.
  - Business/accounting risk: medium in businesses that reopen due after refund or reverse credits operationally.
  - Assessment: intentional for now, but incomplete.

- **Tax document support**
  - Current behavior: tax-document fields exist in schema and summary output, but there is no complete runtime decision/create/update path in the inspected implementation.
  - Expected behavior: tax document should be handled separately from AR and should track fiscal sale total.
  - Business/accounting risk: high for e-invoicing / fiscal compliance flows.
  - Assessment: risky and incomplete.

- **Credit application lifecycle breadth**
  - Current behavior: active applied credits are counted; pending/failed credit-application buckets are absent.
  - Expected behavior: both specs define pending and failed credit-application amounts.
  - Business/accounting risk: medium for audit/reconciliation visibility.
  - Assessment: incomplete; partly constrained by the current source schema.

### Not implemented

- **Tax-base decomposition fields**
  - Current behavior: only `taxable_amount` is stored.
  - Expected behavior: `non_taxable_amount`, `exempt_amount`, `zero_rated_amount`, and `out_of_scope_amount` should exist and be populated.
  - Business/accounting risk: medium to high for jurisdiction-grade reporting and tax analytics.
  - Assessment: not implemented.

- **Base-currency snapshot fields**
  - Current behavior: order header has `currency_code` and `currency_ex_rate`, but not `base_currency_code` or the `base_*` financial amounts.
  - Expected behavior: `v1.1` requires `base_total_amount`, `base_tax_amount`, `base_paid_amount`, `base_credit_applied_amount`, `base_outstanding_amount`, and `base_ar_receivable_amount`.
  - Business/accounting risk: high if consolidated reporting or multi-currency GL/reporting is required.
  - Assessment: not implemented.

### Implemented differently than spec

- **Pending vs authorized lifecycle handling**
  - Current behavior: `pending_payment_amount` and `authorized_payment_amount` are separate fields and separate lifecycle buckets.
  - Expected behavior: the simpler rule-set document includes authorized inside `pending_payment_amount` in one earlier definition, while the fuller `v1.1` spec separates them.
  - Business/accounting risk: low because the stricter separation is clearer and safer.
  - Assessment: intentional and safe.

- **`net_collected_amount` wording conflict**
  - Current behavior: runtime uses `real_payment_refunded_amount`, not broad `refunded_amount`.
  - Expected behavior:
    - `Full non-simplified calculation rule set.md` contains older wording using `refunded_amount` in one section.
    - The same document later tightens this to `cash_or_real_payment_refunded_amount`.
    - `v1.1` explicitly uses `real_payment_refunded_amount`.
  - Business/accounting risk: high if broad refund totals are used because wallet restoration and credit issuance would incorrectly reduce cash collection.
  - Assessment: current code is correct; the specs conflict and the stricter `v1.1` rule should remain canonical.

- **Header `payment_status` vocabulary**
  - Current behavior: runtime uses `UNPAID`, `PENDING_COLLECTION`, `PARTIALLY_PAID`, `PAID`, `OVERPAID`.
  - Expected behavior: the simpler rule-set includes labels like `PENDING_PAYMENT` / `PARTIALLY_PAID_WITH_PENDING` in narrative logic.
  - Business/accounting risk: low if UI and summary semantics remain consistent.
  - Assessment: different but acceptable; current implementation is narrower and normalized.

- **Tax-document mismatch warning logic**
  - Current behavior: `hasTaxDocumentAmountMismatch` is driven by `abs(ar_receivable_amount - total_amount) > 0.001` when `tax_document_id` exists.
  - Expected behavior: specs say tax-document total is based on fiscal sale total, not receivable.
  - Business/accounting risk: high because partially paid `CREDIT_INVOICE` orders can show false tax-document mismatch warnings.
  - Assessment: risky and likely incorrect.

## 5. Action List

| Priority | Subsystem | Expected result | Change type |
|---|---|---|---|
| P0 | `web-admin/lib/services/order-financial-write.service.ts` | Replace tax-document mismatch logic so it compares tax-document fiscal total semantics to sale total semantics, not `ar_receivable_amount` to `total_amount` | Code-only |
| P1 | Tax-document workflow | Add explicit tax-document decision/create/update hooks and immutable-issued-document handling that match the specs | Code-only |
| P1 | Schema + Prisma + write service | Add `non_taxable_amount`, `exempt_amount`, `zero_rated_amount`, `out_of_scope_amount` and populate them from tax engine outputs where supported | Schema + code |
| P1 | Schema + Prisma + write service | Add `base_currency_code` and `base_*` financial snapshot fields if consolidated multi-currency reporting is a real product requirement | Schema + code |
| P1 | Credit application lifecycle | Add `pending_credit_application_amount` and `failed_credit_application_amount` only after the source table has a reliable lifecycle/status model | Schema + code |
| P1 | Tests | Add direct coverage for tax-document mismatch semantics, financial hash stability rules, refund reopen-due behavior, and snapshot status transitions | Test-only |
| P2 | Constants/docs | Explicitly document that the active AR code set is currently frozen to `CREDIT_INVOICE` because no persisted `B2B` / `INVOICE` settlement codes were discovered | Docs-only |
| P2 | Status vocabulary docs | Reconcile narrative spec wording around `pending_payment_amount`, `authorized_payment_amount`, and header `payment_status` labels so future readers do not treat them as contradictions | Docs-only |

### Verification Coverage

Existing automated coverage already supports these areas:

- `order-calculation.service.test.ts`
  - covers `saleTotal` behavior
  - covers gift card separation from sale total
  - covers tax remaining independent from gift-card settlement
- `payment-service.test.ts`
  - covers payment/refund service paths
  - gives partial confidence in canonical payment handling, but not the full Order Fin formula matrix
- `ar-invoice.service.test.ts`
  - covers `CREDIT_INVOICE` happy paths
  - covers `PAY_ON_COLLECTION` rejection for AR invoice creation
- `map-order-financial-summary-view.test.ts`
  - covers AR invoice precedence
  - covers `netCollectedAmount` using real-payment refunds
  - covers mixed-case pending/authorized warnings
  - covers gift-card warning derivation from canonical credit rows
- `financial-schemas.test.ts`
  - covers canonical `saleTotal` payload rules
  - covers amount-to-charge validation
  - covers check-date validation behavior
- `checkout-multi-payment.test.ts`
  - covers split-leg sum parity
  - covers deferred-method isolation
  - covers partial-payment payload policies
- `order-service.test.ts`
  - exists again and now runs, but it is not a deep formula-matrix suite for the full Order Fin spec

Important algorithm rules that still appear untested or under-tested:

- tax-document lifecycle creation/update rules
- tax-document mismatch detection correctness
- base-currency projection rules
- non-taxable / exempt / zero-rated / out-of-scope tax buckets
- pending/failed credit-application lifecycle amounts
- refund reopen-due and credit-reversal reopen-due semantics
- direct hash-stability proof that volatile fields are excluded
- scenario-matrix coverage for the richer examples described in both specs

High-risk uncovered areas:

- tax-document behavior
- multi-currency/base-currency snapshot scope
- richer tax-base decomposition

## 6. Final Verdict

`Needs follow-up implementation`

The current code correctly implements the core canonical runtime semantics and is materially aligned with the main sale/settlement/AR model. It is not yet fully aligned with the two calculation specifications because important enterprise-grade areas remain partial or absent, especially tax-document workflow, broader tax-base decomposition, and base-currency snapshot support. The current tax-document mismatch warning rule also appears semantically wrong and should be corrected before claiming full spec compliance.
