# Multi-Currency and Base Currency Snapshots

**Status:** Accepted  
**Area:** Currency / Reporting  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Transaction currency must be authoritative while reports may need base currency.

## Decision

Store `currency_code`, `currency_ex_rate`, `base_currency_code`, `base_total_amount`, `base_tax_amount`, `base_paid_amount`, `base_credit_applied_amount`, `base_outstanding_amount`, and `base_ar_receivable_amount`.

## Consequences / Implementation Rule

Transaction values are authoritative; base values are reporting snapshots.
