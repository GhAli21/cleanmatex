# ADR-010 — Order Details UI Separates Order Value, Settlement, Receivable, and Tax

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

The old financial panel mixed sale value, discounts, payment, gift cards, AR, and tax in one list.

---

## Decision

Order Details must separate: Order Value, Settlement, Receivable / Collection, Tax Document, Payments & Credits, Invoice / Tax, and Debug.

---

## Rules / Implementation Notes

Top cards: Order Total, Paid, Credits Applied, Balance Due. Debug raw snapshot is permission-controlled.

---

## Consequences

Positive: staff understand totals, payments, credits, AR, and tax. Negative: requires view-model and UI refactor.
