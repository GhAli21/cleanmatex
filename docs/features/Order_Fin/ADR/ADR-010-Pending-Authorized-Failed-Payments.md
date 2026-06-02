# Pending, Authorized, and Failed Payments Are Not Paid

**Status:** Accepted  
**Area:** Payment Gateway / Order Fin  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Gateways and cards have pending/authorized states before money is captured or settled.

## Decision

Only `CAPTURED`, `SETTLED`, or `COMPLETED` ORDER-targeted payments count in `total_paid_amount`. `PENDING`, `PROCESSING`, and `CAPTURE_PENDING` count in `pending_payment_amount`. `AUTHORIZED` counts in `authorized_payment_amount`. Failed/refused/cancelled/expired/voided/reversed attempts count in `failed_payment_amount`.

## Consequences / Implementation Rule

Pending and authorized amounts are visible but do not reduce outstanding.
