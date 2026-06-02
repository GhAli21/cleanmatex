# Canonical Order Financial Snapshot Columns

**Status:** Accepted  
**Area:** Order Fin / Database  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Legacy columns caused ambiguity: `subtotal`, `discount`, `tax`, `total`, `paid_amount`, `gift_card_applied_amount`, and `net_receivable_amount`.

## Decision

Use canonical snapshot columns such as `items_base_amount`, `subtotal_amount`, `total_amount`, `total_charges_amount`, `total_discount_amount`, `total_tax_amount`, `total_paid_amount`, `total_credit_applied_amount`, `outstanding_amount`, `pay_on_collection_amount`, and `ar_receivable_amount`.

## Consequences / Implementation Rule

New logic must not use ambiguous legacy fields.
