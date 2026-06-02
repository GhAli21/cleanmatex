# total_discount_amount Is Commercial Discounts Only

**Status:** Accepted  
**Area:** Discounts / Tax / Order Fin  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Gift cards and wallet credits can be confused with discounts.

## Decision

`total_discount_amount` includes only commercial discounts: line, manual, promo, coupon, campaign, rule, approved manager discount, and promotion-style loyalty discount.

## Consequences / Implementation Rule

Exclude gift card, wallet, customer advance, credit note, customer credit, stored loyalty value, and manual credit.
