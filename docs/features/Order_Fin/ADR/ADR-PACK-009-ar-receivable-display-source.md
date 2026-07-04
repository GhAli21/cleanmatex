# ADR-009 — AR Receivable Display Uses Invoice Outstanding When Invoice Exists

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

Order Details previously showed invoice identity from AR invoice row but amount from order snapshot, causing mismatched UI.

---

## Decision

If AR invoice exists, display AR receivable from `org_invoice_mst.outstanding_amount`. If no invoice exists and payment type is CREDIT_INVOICE, use order outstanding as expected receivable. Otherwise show zero.

---

## Rules / Implementation Notes

If invoice outstanding differs from order outstanding, show `AR_RECEIVABLE_MISMATCH`.

---

## Consequences

Positive: UI reflects authoritative AR amount and exposes mismatch. Negative: UI must load linked invoice data.
