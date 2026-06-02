# Order Details Financial Summary UI Separation

**Status:** Accepted  
**Area:** Order Details UI  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

The old screen mixed order value, settlement, AR, discounts, tax, and credits.

## Decision

Use sections: summary cards, order value, discounts/promotions, tax calculation, completed payments, pending attempts, failed attempts, credits, refunds, balance, receivable/collection, tax document, warnings, debug.

## Consequences / Implementation Rule

Summary cards: order total, paid, pending payments, credits applied, balance due.
