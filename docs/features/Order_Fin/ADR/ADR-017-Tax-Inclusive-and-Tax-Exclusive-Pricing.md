# Support Tax-Inclusive and Tax-Exclusive Pricing

**Status:** Implemented (Phase 5, 2026-06-05)  
**Area:** Tax / Pricing  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Retail POS may be tax-inclusive, while B2B may be tax-exclusive.

## Decision

Support `TAX_EXCLUSIVE` and `TAX_INCLUSIVE` modes.

## Consequences / Implementation Rule

For tax-exclusive: total = net before tax + tax + rounding. For tax-inclusive: total already includes extracted tax and equals net before tax + rounding.
