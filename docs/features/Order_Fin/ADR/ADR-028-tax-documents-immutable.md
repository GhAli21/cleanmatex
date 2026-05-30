# ADR-028 — Issued Tax Documents Are Immutable

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

Tax documents submitted/reported/cleared to authorities cannot be silently changed.

---

## Decision

Issued/reported/cleared tax documents are immutable. Corrections use CREDIT_NOTE or DEBIT_NOTE.

---

## Rules / Implementation Notes

Never mutate original issued fiscal document lines after authority submission/reporting/clearance.

---

## Consequences

Positive: compliance-ready audit trail. Negative: order edits after tax issue require adjustment documents.
