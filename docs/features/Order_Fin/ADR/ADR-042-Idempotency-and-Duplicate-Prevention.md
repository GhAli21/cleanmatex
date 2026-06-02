# Idempotency and Duplicate Prevention

**Status:** Accepted  
**Area:** BVM / Payment / AR / Tax / Refund  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Retries can duplicate payments, credits, invoices, tax docs, and refunds.

## Decision

All financial write flows must be idempotent: submit order, post voucher, create effects, callback, AR invoice, invoice payment allocation, tax doc, refund, recalculation.

## Consequences / Implementation Rule

Use unique idempotency keys, voucher line effect constraints, provider transaction uniqueness, and source redemption uniqueness.
