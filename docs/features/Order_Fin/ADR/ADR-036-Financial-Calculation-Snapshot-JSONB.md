# Financial Calculation Snapshot JSONB

**Status:** Accepted  
**Area:** Order Fin / Audit / AI Explanation  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Numeric columns show final values but not the calculation reasoning.

## Decision

Add `financial_calculation_snapshot jsonb`, `financial_calculation_hash text`, and `financial_calculation_trace_id uuid`.

## Consequences / Implementation Rule

Numeric columns remain operational truth. JSONB is for audit, debugging, support, AI explanation, and reconciliation trace.
