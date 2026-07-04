# 00 — Executive Summary

## Verdict

🟡 **Core financial engine: production-grade. Output/reporting layer and cancellation flow: not yet aligned with it.**

The canonical money engine — pricing, snapshot recalculation, settlement, idempotency, vouchers, AR, stored value, refunds — is correct, well-tested, and in several areas exemplary (idempotency architecture, DB-truth test harness, payload oracle, refund concurrency fixes). Everything the 2026-06-18 report gated on is verified closed in code.

What this pass found is a **second-system seam**: the platform migrated its *write* path to the canonical financial model (`org_order_payments_dtl` + voucher trx lines, ADR-002 dated 2026-05-30), but a set of *read* surfaces — the order Payments tab, two order print reports, the tenant Payments report, and the cash-up module — still read the **deprecated** `org_payments_dtl_tr` ledger that the canonical order flow no longer writes. Separately, **order cancellation performs no canonical financial unwind at all**: payments stay COMPLETED, credit applications stay APPLIED, and no refund/disposition decision is forced. Both are the kind of gap that surfaces as "the report doesn't match the order screen" and "cancelled order still shows paid" tickets — high operational and audit cost, moderate engineering cost to fix.

## Top findings (severity-ordered; full detail in [04](./04_FINDINGS.md))

| ID | Sev | Finding |
|---|---|---|
| FN-01 | 🔴 HIGH | Deprecated ledger `org_payments_dtl_tr` still powers the order Payments tab, order payment prints, the tenant Payments report, and cash-up — but canonical submit/collect flows stopped writing it (`order-submit-orchestrator.service.ts:981-997`). Canonical payments are invisible on those surfaces; ADR-002 is violated by live reads AND by remaining live writes (`payment-service.ts:1096`). |
| FN-02 | 🔴 HIGH | Order cancellation has **no canonical financial unwind**: `workflow-service-enhanced.ts:301-341` calls the cancel RPC (no financial logic in `0130`), then best-effort-cancels only `_tr` rows and swallows failures with `console.warn`. Canonical payments/credit-apps untouched; no forced refund/store-credit disposition; no snapshot recalc. |
| FN-03 | 🟠 MED | Tax-document fiscal-total check is permanently suppressed: engine passes `taxDocumentTotalAmount: null` (`order-financial-write.service.ts:815-824`) with a comment claiming `org_tax_documents_mst` "hasn't shipped" — it shipped in migration `0341` and the summary service reads it. |
| FN-04 | 🟠 MED | Order report/print API routes use ad-hoc auth: `tenants[0]` active-tenant pick, **no RBAC permission check**, `as any` (`app/api/v1/orders/[id]/report/payments-rprt/route.ts:13-20,73`). Tenant isolation holds via RLS + explicit filters, but role gating is absent and inconsistent with the platform's `requirePermission` pattern. |
| FN-05 | 🟠 MED (HIGH at e-invoice go-live) | Tax-base decomposition still hardcoded to zero (`order-financial-write.service.ts:685-688`). Known, tracked (ADR-052); restated because ZATCA-class e-invoicing cannot ship without it. |
| FN-06 | 🟠 MED | Dual cash-reconciliation systems: legacy cash-up (`cashup-service.ts:51`, reads `_tr`) coexists with BVM cash-drawer sessions/movements + the D-09 reconciliation report. Cash-up expected-cash misses canonical cash payments. |
| FN-07 | 🟡 LOW-MED | ADR governance: `docs/features/Order_Fin/ADR/` contains two colliding series (two ADR-001s … two ADR-015s, 84 files) — authority and citation ambiguity. |
| FN-08…FN-13 | 🔵 LOW | Constants/formatting/consistency items: dead lowercase `PAYMENT_STATUSES`; duplicate `OrderPaymentStatus` type name in two files; `'APPLIED'` literal; `ar-OM`/`en-OM` hardcoded in AR prints; finance permission codes as scattered literals; known dead allocation branch. |

## What is verifiably strong

- **Engine math** re-verified: status-bucketed payment sums, unresolved-overpay-only, refund-reopens-due, header-fallback warnings, base-currency projection ([05](./05_FINANCIAL_VALIDATION_MATRIX.md)).
- **Pricing** (`order-calculation.service.ts`): staged rounding at tenant decimal places, discounts capped, best-rule vs promo stacking policy, VAT after discounts, gift card correctly excluded from sale total.
- **Refunds**: F-R1 idempotent replay, F-R2 `FOR UPDATE` + keyed credit-note issue, F-R3 now via `fn_next_fin_doc_no` — all verified in `order-refund.service.ts:174-472`.
- **Idempotency + RLS + DB-truth harness**: unchanged from prior verification; still exemplary.
- **Payment Modal v4**: single-engine/two-mode architecture with an oracle-frozen payload contract — a genuinely strong, GCC-POS-grade cashier UX ([10](./10_UI_WORKFLOW_AND_DOCUMENT_OUTPUT_FINDINGS.md)).
- **RBAC granularity** on money actions: separate `orders:collect_payment`, `orders:process_refund` vs `orders:approve_refund`, `invoices:void`/`write_off`, `finance_reports:view` ([08](./08_PERMISSIONS_AND_TENANT_ISOLATION.md)).

## The call

**Do not GA the reporting surface or cancellation flow as-is.** Gate on: FN-01 (repoint the four output surfaces to canonical sources), FN-02 (define + enforce a cancellation disposition policy), FN-04 (permission-gate the print routes — small), FN-03 (wire the comparand — small). Everything else is scheduled hardening. Detail in [12](./12_MUST_FIX_ITEMS.md) and [13](./13_RECOMMENDED_DIRECTION.md).
