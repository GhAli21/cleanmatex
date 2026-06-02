# total_tax_amount Is Canonical Tax Summary

**Status:** Accepted  
**Area:** Tax / Order Fin  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Multiple legacy tax fields can double-count tax.

## Decision

`total_tax_amount` equals the sum of active order tax rows such as VAT and municipal fee.

## Consequences / Implementation Rule

Do not calculate `tax + vat_amount + total_tax_amount`.
