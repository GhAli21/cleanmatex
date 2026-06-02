# BVM Phase 1A Order Wiring Scope

**Status:** Accepted  
**Area:** BVM / Order Submit  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Order Submit needs real payments and stored-value credit applications immediately. Deferring credit applications leaves gift card, wallet, advance, and customer credit inconsistent.

## Decision

Phase 1A includes `ORDER_PAYMENT`, `ORDER_CREDIT_APPLICATION`, and cash drawer movement for completed cash payments.

## Consequences / Implementation Rule

Out of scope: standalone wallet top-up, gift card sale/top-up, supplier payment, petty cash, expenses, full AP, and legacy backfill.
