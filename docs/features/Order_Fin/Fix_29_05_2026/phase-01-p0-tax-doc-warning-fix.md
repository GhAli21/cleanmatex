# Phase 1 — P0 Tax-Document Mismatch Warning Fix

**Status:** Done
**Date:** 2026-06-04
**Plan ref:** [order-fin-v1_1-full-alignment-implementation-plan.md](order-fin-v1_1-full-alignment-implementation-plan.md) §Phase 1
**Audit ref:** [Order_Fin_Current_Code_vs_Calculation_Rules_Comparison.md](Order_Fin_Current_Code_vs_Calculation_Rules_Comparison.md) §P0

---

## Problem

`order-financial-write.service.ts` produced the warning `TAX_DOCUMENT_TOTAL_MISMATCH` whenever an order had a linked `tax_document_id` AND `|ar_receivable_amount - total_amount| > 0.001`. That comparand is wrong per spec §16.1 / §24.9:

> Tax document fiscal total **must equal `order.total_amount`** (full sale value).
> Tax document is separate from AR invoice — it does **not** track AR receivable.

The old comparison fired on every partially-paid `CREDIT_INVOICE` order (where `ar_receivable_amount < total_amount` by construction), producing a stream of false warnings on the most common AR scenario.

---

## Fix

Introduced a small pure helper that encodes the correct semantics and disables the warning until Phase 7 (`org_tax_documents_mst` master table) provides a real fiscal-total comparand.

### Files created

- [web-admin/lib/utils/order-financial-tax-document-mismatch.ts](../../../web-admin/lib/utils/order-financial-tax-document-mismatch.ts) — exports `evaluateTaxDocumentTotalMismatch(input)`. Pure function, no DB, no `server-only` dependency, fully unit-testable.

### Files modified

- [web-admin/lib/services/order-financial-write.service.ts](../../../web-admin/lib/services/order-financial-write.service.ts) — imports the helper and replaces the inline comparison at the previous bug site. Inline comment cites spec §16.1 and references the Phase 7 work that will populate `taxDocumentTotalAmount`.

### Behavior

| `taxDocumentId` | `taxDocumentTotalAmount` | `|fiscal - sale|` | Warning fires? |
|---|---|---|---|
| `null` / `undefined` | (any) | (any) | **No** |
| set | `null` / `undefined` (pre-Phase 7) | n/a | **No** (was producing false positives) |
| set | known | `≤ tolerance` (default 0.001) | **No** |
| set | known | `> tolerance` | **Yes** |

The warning code `ORDER_FINANCIAL_WARNING_CODES.TAX_DOCUMENT_TOTAL_MISMATCH` is preserved in [lib/constants/order-financial.ts](../../../web-admin/lib/constants/order-financial.ts); Phase 7 will pass the real `taxDocumentTotalAmount` into the helper from the new master table and the warning will start firing only for genuine drift.

### Reconciliation checks

[web-admin/lib/services/reconciliation/voucher-checks.ts](../../../web-admin/lib/services/reconciliation/voucher-checks.ts) was audited — no parallel tax-document check exists there today. Phase 7 will add `RECON_TAX_DOC_VS_ORDER_TOTALS` against the master table.

### i18n

Audited `web-admin/messages/en.json` and `ar.json`. The warning code `TAX_DOCUMENT_TOTAL_MISMATCH` is a server-side enum value written into `org_orders_mst.financial_calculation_snapshot.warning_codes`; it does **not** surface through any user-facing i18n key today (the mapper in `src/features/orders/lib/map-order-financial-summary-view.ts` never emits it). No translation changes needed in this phase.

---

## Tests

New file [web-admin/\_\_tests\_\_/utils/order-financial-tax-document-mismatch.test.ts](../../../web-admin/__tests__/utils/order-financial-tax-document-mismatch.test.ts) — 10 tests, all passing:

- 2 cases: no document linked → never fires
- 3 cases: document linked but fiscal total unknown (pre-Phase 7) → does not fire (includes the explicit P0 regression: partially-paid CREDIT_INVOICE)
- 5 cases: document linked with known fiscal total → fires only when drift exceeds tolerance, respects custom tolerance, mismatch in either direction

```
PASS __tests__/utils/order-financial-tax-document-mismatch.test.ts
  evaluateTaxDocumentTotalMismatch
    ...
Tests:       10 passed, 10 total
```

Regression suite (re-run, all green):

- `__tests__/utils/order-financial-effective-snapshot.test.ts`
- `__tests__/features/orders/map-order-financial-summary-view.test.ts`
- `__tests__/services/order-calculation.service.test.ts`

```
Test Suites: 3 passed, 3 total
Tests:       18 passed, 18 total
```

---

## Verification gates

| Gate | Status |
|---|---|
| New helper tests | ✓ 10/10 green |
| Adjacent Order Fin regression suites | ✓ 18/18 green |
| `npm run typecheck` | ✓ no errors |
| `npm run build` | ✓ Compiled successfully in 55s; 218 static pages |
| `npm run check:i18n` | n/a — no message-key change |

---

## Phase 7 handoff

When Phase 7 ships `org_tax_documents_mst`, the call site in `order-financial-write.service.ts` will swap `taxDocumentTotalAmount: null` for the real `taxDocument.total_amount` read out of the master table (joined or pre-fetched alongside the existing `tax_document_id` link). No further changes to the helper are expected. Add `RECON_TAX_DOC_VS_ORDER_TOTALS` to `voucher-checks.ts` at that time so reconciliation runs catch drift on issued documents.

---

## Risk

Low. Logic-only change; helper is pure and isolated; no schema or migration; warning code preserved; behavior is strictly less noisy (zero false positives) until Phase 7 wires the real comparand.
