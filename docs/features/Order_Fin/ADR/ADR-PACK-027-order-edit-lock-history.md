# ADR-027 — Order Edit Requires Lock and History

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

Concurrent edits can corrupt financial snapshots and unlogged edits are not audit-safe.

---

## Decision

Order edit must use `org_order_edit_locks` and `org_order_edit_history`.

---

## Rules / Implementation Notes

History stores before/after snapshot, changed fields, financial delta, reason, edited_by, edited_at, and approval reference if required.

---

## Consequences

Positive: prevents concurrent conflicts and gives audit trail. Negative: more service/UX complexity.
