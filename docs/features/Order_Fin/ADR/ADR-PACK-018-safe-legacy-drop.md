# ADR-018 — Legacy Order Financial Columns Must Be Dropped Safely

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

Dropping legacy columns immediately can break services, screens, reports, triggers, and tests.

---

## Decision

Use phased migration: add canonical columns, backfill, refactor code/UI/API/reports, add compatibility views if needed, then drop legacy columns.

---

## Rules / Implementation Notes

Do not drop legacy fields in the same migration that introduces canonical financial model.

---

## Consequences

Positive: safer production migration. Negative: transitional schema remains wider temporarily.
