# Canonical Voucher Line Types

**Status:** Accepted  
**Area:** BVM Domain Model  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Voucher lines require stable semantic types so handlers know what financial effect to create.

## Decision

Canonical types include `ORDER_PAYMENT`, `ORDER_CREDIT_APPLICATION`, `INVOICE_PAYMENT`, `REFUND_PAYMENT`, `CASH_DRAWER_MOVEMENT`, `CUSTOMER_ADVANCE_RECEIPT`, `GIFT_CARD_TOPUP`, `WALLET_TOPUP`, `EXPENSE_PAYMENT`, `SUPPLIER_PAYMENT`, `PETTY_CASH_ISSUE`, `PETTY_CASH_RETURN`, and `MANUAL_ADJUSTMENT`.

## Consequences / Implementation Rule

Phase 1A requires only `ORDER_PAYMENT`, `ORDER_CREDIT_APPLICATION`, and cash drawer movement.
