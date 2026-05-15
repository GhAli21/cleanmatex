<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# Settlement API

## POST /api/client/v1/orders/:id/payments

### Purpose

Capture real payment and/or apply stored-value credits to an order.

### Request

```json
{
  "payments": [
    {
      "method": "CASH",
      "amount": 10,
      "tenderedAmount": 20
    },
    {
      "method": "CARD",
      "cardBrand": "VISA",
      "amount": 5,
      "authCode": "123456"
    }
  ],
  "credits": [
    {
      "type": "GIFT_CARD",
      "sourceId": "uuid",
      "amount": 3
    },
    {
      "type": "WALLET",
      "sourceId": "uuid",
      "amount": 2
    }
  ],
  "idempotencyKey": "unique-key"
}
```

### Rules

- Payments go to `org_order_payments_dtl`.
- Credits go to `org_order_credit_apps_dtl`.
- Gift card/wallet/customer credit/advance are not payment rows.
- Invoice/AR is not payment.
- Outstanding is recalculated after settlement.

### Errors

| Code | Meaning |
|---|---|
| ORDER_NOT_FOUND | Order missing |
| ORDER_CLOSED | Cannot mutate closed order |
| INSUFFICIENT_WALLET_BALANCE | Wallet balance insufficient |
| GIFT_CARD_EXPIRED | Gift card expired |
| PAYMENT_CAPTURE_FAILED | Payment failed |
| IDEMPOTENCY_CONFLICT | Same key different request |
