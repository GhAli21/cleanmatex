# ADR-030 — Order Currency Code Is Required and Has No Hardcoded Default

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

Currency affects amounts, tax, settlement, invoices, and reports. A hardcoded default can corrupt multi-tenant data.

---

## Decision

`currency_code` is required and must be resolved before order insert. Do not rely on DB default such as OMR.

---

## Rules / Implementation Notes

Resolution order: order-specific if allowed, branch currency, tenant default currency. `currency_ex_rate` must be > 0.

---

## Consequences

Positive: safer multi-currency behavior. Negative: existing null rows need backfill before NOT NULL constraint.
