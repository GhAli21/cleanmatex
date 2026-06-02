# Financial Debug Tab Is Admin/Support Only

**Status:** Accepted  
**Area:** Order Details UI / Security  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Raw financial fields are confusing for normal staff but useful for support.

## Decision

Show raw snapshot and JSON trace only in permission-controlled Debug tab.

## Consequences / Implementation Rule

Recommended permission: `orders:financial_debug:view`.
