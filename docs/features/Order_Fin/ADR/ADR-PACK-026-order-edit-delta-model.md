# ADR-026 — Order Edit Uses Financial Delta Model

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

Editing submitted orders can change amounts after payments, AR invoices, or tax documents exist.

---

## Decision

Order Edit must calculate before/after financial delta and decide action: no action, additional collection/debit note, refund/customer credit/credit note, or approval.

---

## Rules / Implementation Notes

Do not directly mutate posted payments, credit applications, voucher lines, issued AR invoice lines, or issued tax document lines.

---

## Consequences

Positive: safe post-payment edits. Negative: edit flow needs preview and approval logic.
