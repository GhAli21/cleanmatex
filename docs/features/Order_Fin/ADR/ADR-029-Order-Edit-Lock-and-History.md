# Order Edit Requires Lock and History

**Status:** Accepted  
**Area:** Order Edit / Audit  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Concurrent edits can corrupt financial snapshots.

## Decision

Use `org_order_edit_locks` and `org_order_edit_history`.

## Consequences / Implementation Rule

History stores before snapshot, after snapshot, changed fields, delta, reason, actor, timestamp, and approval reference if required.
