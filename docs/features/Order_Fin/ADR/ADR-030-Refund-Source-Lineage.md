# Refunds Must Preserve Source Lineage

**Status:** Accepted  
**Area:** Refund / Settlement  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Refunding cash and restoring gift card are different events.

## Decision

Refund source types include `REAL_PAYMENT_REFUND`, `GIFT_CARD_RESTORE`, `WALLET_RESTORE`, `CUSTOMER_ADVANCE_RESTORE`, `CUSTOMER_CREDIT_ISSUE`, `CREDIT_NOTE_ISSUE`, and `MANUAL_EXCEPTION`.

## Consequences / Implementation Rule

Manual exception requires permission and reason. Do not refund stored-value redemption as cash unless explicitly approved.
