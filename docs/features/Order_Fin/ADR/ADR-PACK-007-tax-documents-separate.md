# ADR-007 — Tax Documents Are Separate from AR Invoices

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

GCC tax compliance may require tax or simplified tax invoices for cash sales, but AR invoice rows for every sale pollute receivables.

---

## Decision

Create a Tax Documents Module for fiscal/legal/e-invoicing documents. Target: `org_tax_documents_mst` and related line, tax total, payload, reference, and authority status tables.

---

## Rules / Implementation Notes

Order = operation; Voucher = payment transaction; AR Invoice = receivable; Tax Document = fiscal/legal/e-invoice artifact.

---

## Consequences

Positive: supports ZATCA/UAE/Oman readiness while keeping AR clean. Negative: new module is required and voucher receipt may need temporary compliance hardening.
