# ADR-005 — Business Voucher Wiring Phase 1A Scope

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

Order Submit requires safe handling for real payments, credit applications, and cash drawer effects. Deferring credit applications blocks gift card/wallet/advance/credit note redemption.

---

## Decision

Phase 1A includes ORDER_PAYMENT, ORDER_CREDIT_APPLICATION, and CASH_DRAWER wiring.

---

## Rules / Implementation Notes

Deferred: standalone wallet top-up, customer advance receipt, gift card sale, credit note issue, invoice payment, refunds, expenses, and legacy backfill.

---

## Consequences

Positive: supports production Submit Order settlement. Negative: Phase 1A is larger than payment-only wiring.
