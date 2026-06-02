# Reports Must Use Canonical Financial Fields

**Status:** Accepted  
**Area:** Reports / Analytics  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Reports using legacy fields will produce wrong totals.

## Decision

Reports must use canonical fields such as `total_amount`, `total_paid_amount`, `total_credit_applied_amount`, `outstanding_amount`, `ar_receivable_amount`, `pay_on_collection_amount`, `total_discount_amount`, and `total_tax_amount`.

## Consequences / Implementation Rule

Audit and refactor existing reports.
