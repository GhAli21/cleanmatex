> **✅ RESOLVED 2026-07-04** — all gate items closed by the remediation program; see [16_RESOLUTION_ADDENDUM.md](./16_RESOLUTION_ADDENDUM.md). Remaining user actions: review + apply migrations 0393/0394/0395.

# 12 — Must-Fix Items (GA gate)

Ordered. Items 1–4 gate release of the order-financial surface; 5–6 are release-process gates already owned by the user.

## 1. FN-01 — Repoint deprecated-ledger readers to canonical sources 🔴

Minimum viable scope (read-side only, no migration):
- Order **Payments tab** + both order prints → read `org_order_payments_dtl` (via the existing `order-financial-summary.service.ts` payments block) instead of `payment-service.getPaymentsForOrder`.
- Tenant **Payments report** (`report-service.getPaymentsReport` :268) → aggregate canonical order payments (+ keep `_tr` rows for the invoice/customer flows still writing there, clearly unioned or filtered by source until item 2 of [13](./13_RECOMMENDED_DIRECTION.md) lands).
- Add the locking DB-integration test (canonical payment visible in report query).
- **First:** run the sizing query ([15 Q1](./15_OPEN_QUESTIONS.md)) to confirm blast radius and decide whether historical `_tr` rows must be merged into displays.

## 2. FN-02 — Cancellation financial policy + enforcement 🔴

- **Decision needed ([15 Q3](./15_OPEN_QUESTIONS.md)):** disposition options for cancelling a paid order (refund / store credit / keep-on-account w/ approval).
- Minimum safe guard shippable now, ahead of the full flow: **block cancel when the canonical snapshot shows `total_paid_amount > 0` or APPLIED credit > 0**, with a message directing to refund first — plus stop swallowing unwind errors (`workflow-service-enhanced.ts:335,339`).
- Full fix: settlement-owned `unwindOrderFinancialsTx` (reverse credit apps, route payments to refund/disposition, recalc snapshot, audit) + cancel-dialog disposition step + tests.

## 3. FN-04 — Gate the order print/report routes 🟠

Replace the local `getAuthContext` in `orders/[id]/report/payments-rprt/route.ts` and `…/invoices-payments-rprt/route.ts` with `requirePermission('orders:read')` (add `orders:view_financial_breakdown` if the business wants payment prints restricted further) + the centralized tenant context. Small, no migration (codes already seeded).

## 4. FN-03 — Wire the tax-document fiscal-total comparand 🟠

In `recalculateOrderFinancialSnapshotTx`, when `order.tax_document_id` is set, read the linked `org_tax_documents_mst` total inside the tx and pass it as `taxDocumentTotalAmount` (:815-824); delete the stale comment. Restores the §16.1 control; warning-only, so regression risk ≈ 0.

## 5. Pending migrations to remote/prod (user-gated)

Review + apply anything after `0384` not yet on remote (through `0392`, the 2D-QA constraint fix). Per project rule, this review only lists it — the user applies.

## 6. Payment Modal v4 manual QA completion (R-05)

Escalation scenario #9 + tablet visual pass on a running app, per `Payment_Modal_v4_Engine_Architecture.md` §8.

---

## Explicitly NOT gating (scheduled instead)

- FN-05 tax decomposition — gates **e-invoice go-live**, not this GA (ADR-052 stands).
- FN-06 cash-up retirement — do with FN-01 follow-through; the D-09 cash-drawer recon already covers the need.
- FN-07 ADR renumber, FN-08…FN-13 hygiene batch — next hardening window.
- R-02 gateway lifecycle — gates enabling gateway methods for tenants, not cash/card-present GA.
