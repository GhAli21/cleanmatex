# Phase 8 — UI Consolidation

**Date:** 2026-06-05  
**Migration:** none  
**Plan ref:** [order-fin-v1_1-full-alignment-implementation-plan.md § Phase 8](order-fin-v1_1-full-alignment-implementation-plan.md)

---

## Goal

Surface all new fields introduced by Phases 2–7 in the Order Financial UI panels. No business logic changes — this phase is purely additive UI wiring.

---

## Service / type changes

### `web-admin/lib/services/order-financial-summary.service.ts`
- `OrderRefundRow` extended: `refund_source_type: string | null`, `reopens_due_amount: number` (Phase 6 canonical columns).
- New export `TaxDocumentSummaryRow` — maps `org_tax_documents_mst` rows to a typed read model.
- New field `taxDocuments: TaxDocumentSummaryRow[]` on `OrderFinancialSummary`.
- `getOrderFinancialSummary()` now queries `org_tax_documents_mst` (all docs for the order, newest first) in the same parallel `Promise.all` block. Adds ~1 DB round-trip (no N+1).
- Refund mapping reads `refund_source_type` / `reopens_due_amount` via safe cast (Prisma type not yet reflecting Phase 6 migration on some environments).

### `web-admin/app/actions/orders/get-order-financial.ts`
- `TaxDocumentSummaryRow` re-exported.
- `OrderFinancialData` now includes `taxDocuments: TaxDocumentSummaryRow[]`.

### `web-admin/src/features/orders/model/order-financial-summary-view.ts`
- `OrderTaxDocumentView` extended with Phase 7 lifecycle fields: `triggerEvent`, `fiscalYear`, `sequenceNumber`, `totalAmount`, `taxAmount`, `issuedAt`, `issuedBy`, `cancelledAt`, `cancellationReason`, `supersedesId`.
- `rawSnapshot` type extended: `taxPricingModeAtCalculation: string | null` (extracted from `financialCalculationSnapshot` JSON).

### `web-admin/src/features/orders/lib/map-order-financial-summary-view.ts`
- `rawSnapshot.taxPricingModeAtCalculation` derived from `snapshot.financialCalculationSnapshot?.taxPricingModeAtCalculation`.

### `web-admin/app/dashboard/orders/[id]/order-detail-client.tsx`
- `taxDocument` built from `financialData.taxDocuments[0]` when present, with all Phase 7 lifecycle fields mapped. Falls back to snapshot header fields (`taxDocumentId/No/Status/Type`) for legacy orders with no `org_tax_documents_mst` row.

---

## New components

### `order-tax-base-buckets.tsx`
Extracted from the tax-summary area. Props: `amounts` (5 bucket fields), `currencyCode`, `pricingMode?`. Shows:
- Sub-header "Tax base decomposition" (i18n: `taxBase.title`).
- Taxable / non-taxable / exempt / zero-rated / out-of-scope rows (skip zero buckets when only `taxableAmount` is populated).
- Pricing mode footnote when `pricingMode` is provided (`TAX_EXCLUSIVE` / `TAX_INCLUSIVE`).

### `tax-document-lifecycle-timeline.tsx`
Extracted from the tax-document panel. Props: `taxDocument: OrderTaxDocumentView`, `currencyCode?`. Shows:
- Status badge (color-coded: ISSUED = success, DRAFT = warning, CANCELLED = destructive, SUPERSEDED = secondary).
- Document type label.
- Metadata block: document no, fiscal-year/sequence, total amount, tax amount, issued-at, issued-by, cancelled-at, cancellation reason.
- Missing fields are simply omitted (handles both legacy and Phase 7 documents).

---

## Modified panels

| File | What changed |
|---|---|
| `order-value-breakdown.tsx` | After the tax row: renders `<OrderTaxBaseBuckets>` with `amounts` + `rawSnapshot.taxPricingModeAtCalculation`. |
| `order-financial-summary-cards.tsx` | Below the 4 KPI cards: shows a base-currency secondary row when `baseCurrency.currencyCode ≠ currencyCode` and `baseCurrency.totalAmount > 0`. Displays all 6 base-currency amounts using `CmxKpiStatCard`. |
| `order-settlement-summary.tsx` | In the totals block: adds amber `pendingCreditApplicationAmount` row and red `failedCreditApplicationAmount` row (each hidden when = 0). |
| `order-payments-credits-tables.tsx` | Credit-app table: added `application_status` column with `Badge` (success/warning/destructive/info). Added refunds table (hidden when empty): refund-no, amount, source-type label, method, reopens-due amount, status, date. |
| `order-tax-document-panel.tsx` | Delegates to `<TaxDocumentLifecycleTimeline>` when a tax document exists; renders the existing "not available" message otherwise. |
| `order-financial-debug-panel.tsx` | Two new debug fields: `taxPricingModeAtCalculation`, `currencyExRate`. |

---

## i18n keys added

**`orders.detail.financial`** namespace:

| Key | EN | AR |
|---|---|---|
| `creditApp.pendingLabel` | Pending credit applications | اعتمادات ائتمانية معلقة |
| `creditApp.failedLabel` | Failed credit applications | اعتمادات ائتمانية فاشلة |
| `refundsTable` | Refunds | المسترجعات |
| `refunds.sourceTypeLabels.*` | 7 labels | 7 labels |
| `col.applicationStatus` | Application status | حالة التطبيق |
| `col.sourceType` | Source type | نوع المصدر |
| `col.reopensDue` | Reopens balance | يعيد فتح الرصيد |
| `debug.fields.taxPricingModeAtCalculation` | Tax pricing mode at calculation | وضع تسعير الضريبة عند الحساب |
| `debug.fields.currencyExRate` | Currency exchange rate | سعر صرف العملة |

---

## Storybook

| Story file | Variants |
|---|---|
| `OrderTaxBaseBuckets.stories.tsx` | TaxableOnly, AllBuckets, TaxInclusive, NoPricingMode, RTL |
| `TaxDocumentLifecycleTimeline.stories.tsx` | Draft, Issued, Cancelled, CreditNote, LegacyMinimal, RTL |

---

## Validation

- `npm run build` → green (no type or compile errors)
- `npm run check:i18n` → "i18n parity check passed: en.json and ar.json have matching keys"

---

## Remaining phases

| Phase | Status |
|---|---|
| 9 — Legacy reader sanity grep (passive CI gate) | Pending |
| 11 — Documentation refresh + Codex deferred coverage | Pending |
