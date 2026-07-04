# ADR-001 — Order Total Is Full Sale Value Before Settlement

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

The order header previously mixed sale total, amount due after gift card, amount due after payment, and AR receivable base. This created a confirmed double-counting bug when gift card was already netted from `order.total` and then subtracted again through `total_credit_applied_amount`.

---

## Decision

`org_orders_mst.total` / future `total_amount` represents the full sale/service value after commercial discounts, tax, and rounding. It must not subtract real payments, gift cards, wallet, customer advance, credit note, customer credit, loyalty value, or refunds.

---

## Rules / Implementation Notes

Canonical formula:

```text
total_amount = items_base_amount + total_charges_amount - total_discount_amount + total_tax_amount + rounding_adjustment_amount
outstanding_amount = total_amount - total_paid_amount - total_credit_applied_amount
```

---

## Consequences

Positive: prevents stored-value double counting, stabilizes revenue/tax base, and makes AR sizing deterministic. Negative: code that treated `finalTotal` as amount due after gift card must be refactored, and affected historical orders require controlled backfill.
