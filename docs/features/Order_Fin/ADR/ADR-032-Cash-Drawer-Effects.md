# Cash Drawer Effects from Vouchers

> **Superseded by [ADR-057 — Two-Domain Cash Ledger](./ADR-057-Two-Domain-Cash-Ledger.md)** (design approved 2026-09-25; takes effect when package CLF ships). ADR-057 replaces the "wiring handlers write mirror cash movements" model: a central gate stamps every cash voucher line onto its drawer, custody events move to drawer transactions, and `org_cash_drawer_movements_dtl` is retired. Until CLF ships, the model below remains the current behaviour.

**Status:** Superseded by ADR-057 (design approved 2026-09-25; takes effect when package CLF ships)  
**Area:** POS / Cash Drawer / BVM  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Cash payments, refunds, and change affect cash drawer.

## Decision

Completed cash order payment creates drawer IN. Cash refund creates drawer OUT. Change returned is handled by chosen drawer policy.

## Consequences / Implementation Rule

Supported policies: net-retained or tender/change.
