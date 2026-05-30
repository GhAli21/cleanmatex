# ADR-029 — Order Details Raw Financial Snapshot Belongs in Admin Debug Tab

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

Raw DB fields help support/developers but confuse normal users.

---

## Decision

Raw financial snapshot must be shown only in permission-controlled Debug tab.

---

## Rules / Implementation Notes

Suggested permission: `orders:financial_debug:view`.

---

## Consequences

Positive: cleaner production UI with support diagnostics preserved. Negative: permission wiring required.
