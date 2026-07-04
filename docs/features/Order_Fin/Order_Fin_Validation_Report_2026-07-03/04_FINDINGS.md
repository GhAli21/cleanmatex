# 04 — Findings (severity-ordered)

Confirmed = verified in cited source/migrations. Inferred = plausible impact that needs a runtime/data check to size.

---

## 🔴 FN-01 — Deprecated payment ledger still powers user-facing financial outputs (CONFIRMED code-level; runtime impact inferred-high)

**Facts (confirmed):**
- ADR-002 (`docs/features/Order_Fin/ADR/ADR-002-Deprecate-org-payments-dtl-tr.md`, accepted 2026-05-30): "No new writes should target `org_payments_dtl_tr`"; canonical = `org_fin_voucher_trx_lines_dtl`.
- The canonical order submit flow **does not write `_tr`**: the legacy `recordPaymentTransaction` call was deliberately removed (`lib/services/order-submit-orchestrator.service.ts:981-997`). `settleOrderTx`, `collectPaymentTx`, and all wiring handlers write `org_order_payments_dtl` only (`order-settlement.service.ts:230,800`; grep of `lib/services/wiring/` = zero `_tr` references).
- Yet these surfaces read `_tr` (full list in [03](./03_REPORT_DOCUMENT_INVENTORY.md)): order Payments tab, order payments print, order invoices+payments print, tenant Payments report (`report-service.ts:268`), cash-up (`cashup-service.ts:51`), voucher payment linkage (`voucher-service.ts:295-600`), cancel promo/gift reversal (`order-cancel-service.ts:63`).
- And `_tr` still has **live writers**: `payment-service.ts:1096` (invoice/customer payments from customers, b2b, ready, internal_fin pages) — so the ledger is neither fully dead nor fully alive.

**Impact (inferred, needs the data check in [15 Q1](./15_OPEN_QUESTIONS.md)):** payments captured through the canonical order flow do not appear on the order Payments tab, the two order prints, the tenant Payments report, or cash-up expected-cash. Finance sees different totals on the Financial tab (canonical) vs the Payments tab (`_tr`) of the same order. Reports under-report revenue collection. This is the classic split-ledger failure mode.

**Fix direction:** [13 §1](./13_RECOMMENDED_DIRECTION.md).

---

## 🔴 FN-02 — Order cancellation performs no canonical financial unwind (CONFIRMED)

**Facts:**
- Cancel path: `workflow-service-enhanced.ts:301-341` → RPC `cmx_ord_canceling_transition` (defined only in `supabase/migrations/0130_cmx_ord_canceling_returning_functions.sql`; grep shows **zero** payment/credit/refund/financial references in it) → then a best-effort loop that reads `_tr` rows (`getPaymentsForOrder`) and calls `cancelPayment` on them, with failures swallowed by `console.warn` (:335, :339).
- Canonical `org_order_payments_dtl` rows are never touched on cancel; `org_order_credit_apps_dtl` has no reversal writer anywhere (only `'APPLIED'` is ever written — `order-settlement.service.ts:319`; grep for REVERSED/CANCELLED application_status writers = none).
- No `recalculateOrderFinancialSnapshotTx` call in the cancel path.
- Gift/promo unwind (`order-cancel-service.reversePromoAndGiftForOrder`, :56-130) reads promo/gift linkage **from `_tr` columns** — canonical orders store gift cards as credit applications (ADR-008), so this loop finds nothing for them.

**Impact:** a cancelled paid order keeps `payment_status = PAID/OVERPAID` with COMPLETED payment rows and APPLIED credit; customer money is neither refunded nor parked as store credit; consumed wallet/advance/gift-card value is never restored. Audit answer to "where did the customer's money go after cancellation?" is: nowhere, silently. GCC and worldwide POS/ERP standard practice is to force a disposition at cancel time (refund / store credit / manager-approved leave-open).

**Note:** even the legacy `_tr` handling is accounting-weak — `cancelPayment` flips a completed payment to cancelled, making received money disappear from reporting instead of flowing through a refund/credit path.

**Fix direction:** [13 §2](./13_RECOMMENDED_DIRECTION.md) + ADR ([14](./14_ARCHITECTURAL_AND_ADR_RECOMMENDATIONS.md)).

---

## 🟠 FN-03 — Tax-document fiscal-total check suppressed although the table shipped (CONFIRMED)

`order-financial-write.service.ts:815-824` passes `taxDocumentTotalAmount: null` into `evaluateTaxDocumentTotalMismatch` with a comment: "The stored fiscal total lives on `org_tax_documents_mst` (Phase 7); **until that table ships** we cannot read a real comparand." The table shipped in `supabase/migrations/0341_tax_documents_master_and_lines.sql` and is already read for display by `order-financial-summary.service.ts:410`. The §16.1 fiscal-total control (tax document total must equal order total) is therefore permanently off, and the comment is stale. Cheap fix: read the linked tax document's total inside the recalc tx and pass it through.

---

## 🟠 FN-04 — Order report/print routes: ad-hoc auth, no RBAC, first-tenant assumption (CONFIRMED)

`app/api/v1/orders/[id]/report/payments-rprt/route.ts:13-20` (and the invoices-payments sibling) define a local `getAuthContext` that takes `tenants[0].tenant_id` from `get_user_tenants` — not the platform's centralized tenant context — and enforce **no permission code** (contrast: `orders:read` on 16 other order routes, `finance_reports:view` on the reconciliation reports). Also `as any` at :73. Tenant isolation itself holds (explicit `.eq('tenant_org_id', …)` :66 + `withTenantContext` inside `getPaymentsForOrder` :1301), but:
- any authenticated tenant user of any role can pull full payment/discount data for any order;
- for multi-tenant users, `tenants[0]` may disagree with the session tenant used by the payments service in the same request → header from tenant A, payments from tenant B (both self-tenants, so no leak, but inconsistent output).

Same auth style appears on other order sub-routes found in the guard sweep (`orders/[id]/discounts`, `orders/[id]/route.ts`, `history`, `state`, `transitions`, …) — acceptable for low-sensitivity reads, but the *report* endpoints carry money data and deserve the standard gate.

---

## 🟠 FN-05 — Tax-base decomposition still zeroed (CONFIRMED; known/tracked)

`order-financial-write.service.ts:685-688`: `nonTaxable/exempt/zeroRated/outOfScope = 0`. The e-invoice foundation (constants/types/pure helpers, tenant enablement columns via `0383`, ADR-052) exists, but the engine emits no real buckets. Fine for flat-VAT GCC operation today; blocking for ZATCA-class e-invoicing. Restated (not new) so it stays visible on the compliance runway; per-category decomposition + jurisdiction adapter remain open follow-ups.

---

## 🟠 FN-06 — Two cash-reconciliation systems; legacy one reads the dying ledger (CONFIRMED)

Legacy cash-up (`lib/services/cashup-service.ts` — "org_payments_dtl_tr (completed only)" per its own header, groupBy at :51; consumed by `app/actions/billing/cashup-actions.ts` + `src/features/billing/ui/cashup-history.tsx`) coexists with the BVM cash-drawer sessions/movements model and the D-09 cash-drawer reconciliation report. Cash-up expected-cash misses canonical cash payments entirely (FN-01 dependency). Either retire cash-up in favor of drawer sessions + D-09, or repoint it to `org_cash_drawer_movements`.

---

## 🟡 FN-07 — ADR numbering collision (CONFIRMED)

`docs/features/Order_Fin/ADR/` holds **two parallel series**: e.g. `ADR-001-Business-Voucher-Master-Detail-Model.md` AND `ADR-001-order-total-full-sale-value.md`; the pattern repeats through ADR-015 (84 files total). Citations like "ADR-002" are ambiguous (this very report must cite ADR-002 by filename). Needs a renumber or a prefix split (e.g. `ADR-BVM-*` / `ADR-FIN-*`) + regenerated index.

---

## 🔵 LOW (confirmed, batchable)

- **FN-08** — `PAYMENT_STATUSES` (lowercase, `lib/constants/payment.ts:113`) has **zero** consumers, while the only `_tr` write site hardcodes `'completed'` (`payment-service.ts:1113`). Dead constant + literal at the write site.
- **FN-09** — two exported types named `OrderPaymentStatus`: `lib/constants/payment.ts:222` (row statuses) vs `lib/constants/order-financial.ts:539` (header statuses). Same name, different unions — import-confusion hazard on a money domain.
- **FN-10** — `application_status: 'APPLIED'` string literal at `order-settlement.service.ts:319` instead of `CREDIT_APPLICATION_STATUSES.APPLIED` (value matches DB; discipline drift only).
- **FN-11** — AR invoice + customer statement prints hardcode `'ar-OM'`/`'en-OM'` locales and duplicate a private `formatCurrency` instead of `lib/money/format-money` (`ar-invoice-print-rprt.tsx:10-17`, `ar-customer-statement-print-rprt.tsx:10-17`). Wrong number/date shaping for KSA/UAE/Kuwait tenants.
- **FN-12** — finance/orders RBAC codes exist only as string literals in routes; `lib/constants/permissions/` contains just `admin-perm.ts` + `help.ts`. The CLAUDE.md golden path (`{domain}-perm.ts`) is unpopulated for the finance domain.
- **FN-13** — known dead branch: `allow_partial_last_target=false` guard in `runAutoAllocationAlgorithm` unreachable (carried from D-12 §4, F-AA1). Cleanup only.

---

## Inferred risks / unknowns (not findings yet)

- **R-01** — Size of FN-01 in production: how many `_tr` rows exist for orders created after the orchestrator removal, and what the Payments tab actually shows operators today. One SQL count settles it ([15 Q1](./15_OPEN_QUESTIONS.md)).
- **R-02** — Gateway capture/callback lifecycle (PENDING→CAPTURED) has never been exercised end-to-end in this repo; warning codes exist (`PENDING_PAYMENT_COUNTED_AS_PAID` tests) but no live-path validation.
- **R-03** — Whether the legacy cash-up screen is still reachable in navigation for production roles (affects FN-06 urgency).
- **R-04** — Remote/prod apply state of migrations after `0384` (through `0392`) — user-gated per project workflow.
- **R-05** — Payment Modal v4 manual QA: Simple/escalation scenario #9 + tablet visual pass still pending a running app (per `Payment_Modal_v4_Engine_Architecture.md` §8).
- **R-06** — E-invoice enablement toggle UI lives in cleanmatexsaas (cross-project dependency; columns are write-orphaned until it ships).
- **R-07** — Multi-currency: base-currency projections exist (`projectBaseCurrencyAmount`), but no test evidence for non-1.0 `currency_ex_rate` flows was found in this pass.
- **R-08** — Epsilon inconsistency candidate: `customer-open-balance-query.service.ts:220` uses literal `0.001` rather than `SETTLEMENT_MONEY_EPSILON`; harmless at 3dp, wrong if a 2dp-currency tenant policy changes.

---

## ✅ Verified-closed from the 2026-06-18 program (spot-checked this pass)

- F-R1/F-R2 refund idempotency + FOR UPDATE + keyed credit-note issue — `order-refund.service.ts:174-181, 411-472`.
- F-R3 refund numbering — now `fn_next_fin_doc_no` with row-level lock (comment + call at :285-304); the `count(*)+1` race is gone.
- F-01/F-02/F-04/F-10/F-T5/D-09 — accepted from the prior report's live-DB verification (`Opus_Validation_Report_18_06_2026/24_IMPLEMENTATION_STATUS.md`).
- D-12 type debt: `tsc --noEmit` = 0; legacy modals retired to `.tsx.bak`; gateway-method domain decision codified as `toCanonicalLegMethod` in `lib/validations/new-order-payment-schemas.ts`.
