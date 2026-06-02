# Order Total Is Full Sale Value Before Settlement

**Status:** Accepted  
**Area:** Order Fin Calculation  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Gift card was previously counted twice when order total had already been reduced and then credit was applied again.

## Decision

`total_amount` is the full sale/service value after commercial discounts, tax, and rounding, before payments and stored-value credits.

## Consequences / Implementation Rule

Never subtract cash, card, gateway, gift card, wallet, customer advance, credit note, customer credit, loyalty value, pending gateway, or refunds from `total_amount`.
