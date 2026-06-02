# Stored-Value Credits Do Not Reduce Taxable Amount or Tax

**Status:** Accepted  
**Area:** Tax / Stored Value  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Gift card/wallet/advance/credit note settle the debt; they are not price reductions.

## Decision

Stored-value credits do not reduce `taxable_amount`, `total_tax_amount`, `total_amount`, or tax document total.

## Consequences / Implementation Rule

They reduce only `outstanding_amount` through `total_credit_applied_amount`.
