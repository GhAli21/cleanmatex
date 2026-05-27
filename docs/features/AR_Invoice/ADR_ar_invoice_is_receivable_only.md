# ADR: AR Invoice (`org_invoice_mst`) is a Receivable-Only Document

**Date:** 2026-05-28
**Status:** Accepted
**Deciders:** Engineering (BVM Phase 1B Stabilization session)
**Related:** `ADR_submit_order_canonical_path.md`

---

## Context

`org_invoice_mst` historically did two jobs at once:

1. **AR receivable tracking** — "this customer owes us money" (credit/B2B/PAY_ON_COLLECTION sales)
2. **Tax invoice / fiscal artifact** — proof-of-supply needed for GCC VAT (ZATCA, FTA, NBR, OTA, GAZT) compliance

This dual purpose produced a real bug surfaced in the BVM Phase 1B stabilization audit:

- Fully-paid cash/card orders were creating `org_invoice_mst` rows with status `ISSUED`
- `ensureCanonicalArInvoiceArtifactsTx` then wrote an `INVOICE_ISSUED` debit into `org_customer_ar_ledger_dtl`
- Result: AR ledger debit existed even though no money was owed — polluted ledger, broken aging reports, and acceptance criterion #11 of the AR Invoice PRD was actually never satisfied despite being marked done

The bug was masked because the `settleOrder` flow immediately offset the debit with payment fact rows for cash sales — but PAY_ON_COLLECTION orders produced orphan debits with no offsetting credit until delivery.

---

## Decision

`org_invoice_mst` represents **AR receivables only**. It exists when and only when there is an outstanding amount the customer owes that should be tracked through AR aging, statements, dunning, and the customer ledger.

**Per-order-type behavior:**

| Order type | `org_invoice_mst` row | AR ledger `INVOICE_ISSUED` debit | Tax artifact today | Tax artifact future |
|---|---|---|---|---|
| Cash, card, gateway (fully paid) | ❌ NO | ❌ NO | Receipt voucher print | Tax Documents Module (Simplified) |
| PAY_ON_COLLECTION | ❌ NO at order time | ❌ NO at order time | Receipt voucher when collected | Tax Documents Module (Simplified at collection) |
| CREDIT_INVOICE / B2B / INVOICE | ✅ YES (status `ISSUED`) | ✅ YES | AR invoice print | Tax Documents Module (Standard) |

The condition is captured at the orchestrator boundary as the `shouldCreateArInvoice` signal:

```typescript
const shouldCreateArInvoice = effectiveOutstandingPolicy === 'CREDIT_INVOICE';
```

The settlement planner produces the same flag downstream for symmetry:

```typescript
shouldCreateArInvoice: outstandingPolicy === 'CREDIT_INVOICE'
```

---

## Implementation surface

### Orchestrator (submit-order)

- `lib/services/order-submit-orchestrator.service.ts`
  - `createInvoice()` is gated on `shouldCreateArInvoice`
  - `invoiceId` is hoisted to `string | null` for downstream consumers
  - `applyPromoCodeTx(tx, { invoiceId: invoiceId ?? undefined, ... })` — promo rows accept null invoice
  - `redeemGiftCardTx(tx, { invoiceId: invoiceId ?? undefined, ... })` — gift card rows accept null invoice
  - Returns `{ orderId, orderNo, invoiceId: string | null, currentStatus }`

### Promo redemption (`applyPromoCodeTx`)

- `lib/services/discount-service.ts` — `invoiceId` parameter is now `string | undefined`
- DB column `org_promotion_usage_dtl.invoice_id` is already `String?` (no migration needed)

### Gift card redemption (`redeemGiftCardTx`)

- `lib/services/gift-card-service.ts` — `invoiceId` parameter was already optional
- DB column `org_gift_card_txn_dtl.invoice_id` is already `String?` (no migration needed)

### AR Invoice defense-in-depth

- `lib/services/ar-invoice.service.ts` → `ensureCanonicalArInvoiceArtifactsTx`
  - Early-return guard: if the invoice's `payment_type_code` is not `INVOICE`/`CREDIT_INVOICE` AND `outstanding_amount` is not > 0, the AR ledger debit is skipped
  - This handles edge cases where a non-orchestrator caller writes an `org_invoice_mst` row but the order is fully paid

---

## Consequences

### Positive
- Cash sales no longer produce vestigial AR ledger debits
- AR aging, customer balance, dunning, and statement reports stop including cash-sale noise
- AR Invoice PRD acceptance criterion #11 is actually satisfied for the first time
- Voucher receipts retain a clean role as proof-of-payment for cash sales

### Negative (accepted)
- **Tax compliance gap window**: Until the Tax Documents Module ships, GCC tax-compliant tenants rely on the voucher receipt print as the simplified tax invoice. The voucher print template must therefore include VAT breakdown, seller VAT registration, and (for ZATCA Phase 2 in Saudi) a QR code. Tenants below ZATCA Phase 2 threshold are unaffected.
- **Historical data**: Existing cash-sale `org_invoice_mst` rows are left in place (no backfill). The behavior change is forward-only. Queries that filter by `payment_type_code` or `customer_id` will naturally pick the new rows correctly.
- **Frontend**: `SubmitOrderResult.order.invoiceId` is now `string | null`. The order submission hook does not consume this field today, but any future consumer must handle null.

---

## Out of scope (deferred to dedicated features)

- **Tax Documents Module** (`org_tax_documents_mst` / `org_tax_documents_dtl`) — separate PRD. Will own GCC tax-invoice obligations: STANDARD (B2B), SIMPLIFIED (B2C cash), DEBIT_NOTE, CREDIT_NOTE. Will carry ZATCA Phase 2 fields (UUID, hash chain, cleared XML).
- **ZATCA Phase 2 e-invoice clearance** — separate PRD. Mandatory for Saudi tenants above revenue thresholds in the staged rollout through 2026.
- **Voucher print template hardening** — separate task. Today the template prints amount/method/order info. To serve as a Simplified Tax Invoice it needs: seller VAT registration, item-level VAT breakdown, ZATCA QR. Track as an observability item, not a regulatory blocker for tenants outside Saudi/UAE.

---

## Rollout checklist

- [x] ADR-1 written (this document)
- [x] `applyPromoCodeTx.invoiceId` made optional
- [x] `createInvoice()` gated in orchestrator
- [x] Defense-in-depth guard in `ensureCanonicalArInvoiceArtifactsTx`
- [x] Orchestrator return type updated to `invoiceId: string | null`
- [ ] Verify dev environment: cash submit produces no AR row, B2B credit submit does
- [ ] Voucher print template audit (tax compliance preliminary check)
- [ ] Backlog: Tax Documents Module PRD
