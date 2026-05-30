# ADR-019 — Backfill Gift Card Affected Orders Conservatively

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

Historical orders may have gift card netted from order total and also recorded as credit application.

---

## Decision

Backfill must be previewable and scoped only to confirmed affected rows.

---

## Rules / Implementation Notes

Do not blindly run `total = total + gift_card_applied_amount` for every gift-card order. Use preview SELECT and evidence such as linked invoice/recalculated details.

---

## Consequences

Positive: avoids damaging correct orders. Negative: migration is more complex and may require manual review.
