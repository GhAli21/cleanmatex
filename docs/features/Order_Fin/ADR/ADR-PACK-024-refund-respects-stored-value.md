# ADR-024 — Refund Paths Must Respect Stored-Value Settlement

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

Refunds may incorrectly treat gift card redemption as discount or refund stored-value as cash.

---

## Decision

Refund logic must inspect original settlement sources and decide whether to refund cash/card, restore stored-value balance, or create customer credit.

---

## Rules / Implementation Notes

Do not refund gift-card redemption as cash unless explicitly approved; preserve original payment/credit lineage.

---

## Consequences

Positive: avoids over-refund and preserves liability correctness. Negative: refund services require audit.
