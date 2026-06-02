# Legacy Financial Columns Drop Strategy

**Status:** Accepted  
**Area:** Database Migration  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Legacy fields are dangerous but dropping them blindly can break code.

## Decision

Drop legacy columns only after canonical columns, backfill, code refactor, test validation, and reconciliation.

## Consequences / Implementation Rule

Legacy examples: `subtotal`, `discount`, `tax`, `total`, `paid_amount`, `vat_amount`, `gift_card_applied_amount`, `promo_discount_amount`, `service_charge`, `service_charge_type`, `net_receivable_amount`.
