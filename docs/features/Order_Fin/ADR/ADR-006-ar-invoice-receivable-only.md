# ADR-006 — AR Invoice Is Receivable-Only

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

`org_invoice_mst` historically mixed AR receivable tracking with tax/fiscal invoice proof. This caused cash/PAY_ON_COLLECTION orders to create AR debits despite no receivable.

---

## Decision

`org_invoice_mst` is receivable-only. It exists for CREDIT_INVOICE / B2B / INVOICE receivables, not for fully paid cash/card/mobile/gateway orders or PAY_ON_COLLECTION at order time.

---

## Rules / Implementation Notes

AR invoice total equals receivable amount after completed payments and applied credits. Example: total 2.140, cash 1.000, gift card 0.150 → AR invoice 0.990.

---

## Consequences

Positive: AR aging and customer statements stay clean. Negative: tax/fiscal invoice compliance must be handled by Tax Documents Module or temporary receipt hardening.
