# ADR-008 — PAY_ON_COLLECTION Is Operational Outstanding, Not AR

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

PAY_ON_COLLECTION means collection at pickup/delivery, not customer account credit.

---

## Decision

PAY_ON_COLLECTION must not create `org_invoice_mst` or AR ledger debit at order time. It sets `outstanding_amount`, `pay_on_collection_amount`, and payment status.

---

## Rules / Implementation Notes

At collection, create receipt voucher and ORDER_PAYMENT effect, then recalculate order snapshot.

---

## Consequences

Positive: keeps AR clean and matches retail workflow. Negative: PAY_ON_COLLECTION reports must use order outstanding, not AR tables.
