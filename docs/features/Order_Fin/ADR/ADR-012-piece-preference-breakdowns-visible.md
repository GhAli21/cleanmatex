# ADR-012 — Piece and Preference Extra Prices Remain Visible as Breakdowns

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

Even when extras are included inside item totals, users need transparency for why an item costs more.

---

## Decision

Keep `piece_extra_price_amount` and `preference_extra_price_amount` as reporting/audit/UI breakdown fields.

---

## Rules / Implementation Notes

Do not add breakdown fields again to order total in current mode.

---

## Consequences

Positive: improves transparency and supports future migration. Negative: UI labels must clearly say they are included in base/item total.
