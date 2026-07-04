# ADR-003 — Separate Real Payments from Credit Applications

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

Settlement can include money received and stored-value/customer-credit applications. Mixing them breaks paid amount, cash reporting, and receivable logic.

---

## Decision

Real payments go to `org_order_payments_dtl` and `total_paid_amount`. Credit applications go to `org_order_credit_apps_dtl` and `total_credit_applied_amount`.

---

## Rules / Implementation Notes

Real payments include CASH, CARD, BANK_TRANSFER, CHECK, MOBILE_PAYMENT, and gateways when confirmed. Credit applications include GIFT_CARD, WALLET, CUSTOMER_ADVANCE, CREDIT_NOTE, CUSTOMER_CREDIT, LOYALTY_VALUE, and MANUAL_CREDIT.

---

## Consequences

Positive: clean cash/bank reporting and correct stored-value consumption. Negative: reports and UI must show paid and credits separately.
