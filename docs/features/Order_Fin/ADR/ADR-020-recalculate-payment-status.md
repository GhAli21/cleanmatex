# ADR-020 — Payment Status Must Be Recalculated After Financial Repair

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

Changing total/outstanding/credit values can make payment status stale.

---

## Decision

Any financial repair or recalculation must also recalculate `payment_status`.

---

## Rules / Implementation Notes

Suggested rules: outstanding 0 → PAID; paid/credits > 0 and outstanding > 0 → PARTIALLY_PAID; no settlement and PAY_ON_COLLECTION → PENDING_COLLECTION; pending gateway → PENDING_GATEWAY.

---

## Consequences

Positive: reports and UI match financial snapshot. Negative: historical status values may change after repair.
