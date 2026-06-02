# Financial Reconciliation Warnings

**Status:** Accepted  
**Area:** Order Fin / Audit  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Mismatches must be exposed rather than hidden.

## Decision

Warnings include component mismatch, discount mismatch, tax mismatch, outstanding mismatch, pending counted as paid, gift card double-count, credit counted as discount, AR mismatch, tax document mismatch, and legacy field usage.

## Consequences / Implementation Rule

Warnings update `financial_snapshot_status`, `financial_mismatch_warning_count`, and calculation snapshot warnings.
