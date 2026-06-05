# Multi-Currency and Base Currency Snapshots

**Status:** Implemented (Phase 4, 2026-06-05)  
**Area:** Currency / Reporting  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Transaction currency must be authoritative while reports may need base currency.

## Decision

Store `currency_code`, `currency_ex_rate`, `base_cur_currency_code`, `base_cur_total_amount`, `base_cur_tax_amount`, `base_cur_paid_amount`, `base_cur_credit_applied_amount`, `base_cur_outstanding_amount`, and `base_cur_ar_receivable_amount`.

## Consequences / Implementation Rule

Transaction values are authoritative; base values are reporting snapshots.
