# Payment Target Types

**Status:** Accepted  
**Area:** Payment Settlement / BVM / AR  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Payments do not always target an order. They may target an order, invoice, customer advance, wallet, gift card, supplier, or expense.

## Decision

Every payment/voucher line must carry a target type such as `ORDER`, `AR_INVOICE`, `CUSTOMER_ADVANCE`, `GIFT_CARD_TOPUP`, `WALLET_TOPUP`, `SUPPLIER_PAYMENT`, or `EXPENSE`.

## Consequences / Implementation Rule

Only `ORDER`-targeted completed payments reduce order outstanding. `AR_INVOICE` payments reduce invoice/AR outstanding and must not duplicate order payment rows unless a mirror policy is explicitly approved.
