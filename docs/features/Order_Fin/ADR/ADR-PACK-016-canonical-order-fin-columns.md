# ADR-016 — Canonical Order Financial Snapshot Columns

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

`org_orders_mst` contains legacy and new financial fields, causing mapper and UI confusion.

---

## Decision

Use canonical Order Fin fields for read models and calculations: item/base, charges, discount, tax, total, paid, credits, refunds, outstanding, overpaid, collection, and AR receivable.

---

## Rules / Implementation Notes

Legacy fields remain only during phased transition and should be dropped after code/report refactor.

---

## Consequences

Positive: stable formulas and clean UI mapping. Negative: migration and refactor required.
