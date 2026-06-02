# Tax Documents Are Separate from AR Invoices

**Status:** Accepted  
**Area:** Tax / AR / Compliance  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Tax/fiscal documents may be required for cash sales, while AR invoices must only represent receivables.

## Decision

Separate Tax Document Module from AR Invoice Module.

## Consequences / Implementation Rule

Tax document total equals `order.total_amount`, not AR receivable.
