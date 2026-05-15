<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# Accounting Event Catalog

## 1. Purpose

Accounting events translate business activity into journal/voucher entries.

## 2. Events

| Event | Trigger | Accounting Meaning |
|---|---|---|
| ORDER_CONFIRMED | Order finalized | Revenue/tax recognition candidate |
| ORDER_CHARGE_RECOGNIZED | Charge applied | Additional revenue/fee |
| ORDER_DISCOUNT_APPLIED | Discount applied | Revenue reduction |
| ORDER_TAX_RECOGNIZED | Tax calculated | Tax liability |
| ORDER_PAYMENT_RECEIVED | Real payment captured | Cash/bank/card clearing |
| ORDER_GIFT_CARD_REDEEMED | Gift card used | Liability reduction |
| ORDER_WALLET_APPLIED | Wallet used | Liability reduction |
| ORDER_ADVANCE_APPLIED | Advance used | Advance liability reduction |
| ORDER_CUSTOMER_CREDIT_APPLIED | Customer credit used | Customer liability reduction |
| ORDER_LOYALTY_CREDIT_APPLIED | Loyalty credit used | Loyalty liability/marketing |
| ORDER_INVOICED_AR | Invoice created | AR created |
| ORDER_REFUNDED | Refund processed | Reversal/cash out |
| ORDER_VOIDED | Order voided | Reversal |
| GIFT_CARD_SOLD | Gift card sold | Cash vs gift card liability |
| GIFT_CARD_EXPIRED | Gift card expired | Breakage revenue if policy allows |
| WALLET_TOPPED_UP | Wallet top-up | Cash vs wallet liability |
| CUSTOMER_ADVANCE_RECEIVED | Advance received | Cash vs advance liability |
| CUSTOMER_CREDIT_CREATED | Credit created | Liability to customer |

## 3. Posting Rule

Posting should be event-driven through outbox, not directly from UI route.
