# Order Financial Platform — API Reference

All routes are under `/api/v1/` and require a valid session cookie (Supabase auth). Tenant ID is resolved from the session. All responses are JSON.

## Cash Drawers

### `GET /api/v1/cash-drawers`
List all cash drawers for the tenant.

**Permission:** `billing.cash-drawers.manage`

**Response:**
```json
[{ "id": "uuid", "name": "Main Drawer", "branch_id": "uuid", "is_active": true }]
```

### `POST /api/v1/cash-drawers/[drawerId]/open-session`
Open a new session on a drawer.

**Permission:** `billing.cash-drawers.manage`

**Request:**
```json
{ "openedBy": "user-id", "openingBalance": 100.000 }
```

**Response:**
```json
{ "id": "session-uuid", "status": "OPEN", "opening_balance": 100.000 }
```

**Errors:** `409` if drawer already has an OPEN session.

### `POST /api/v1/cash-drawers/[drawerId]/close-session`
Close the current OPEN session.

**Permission:** `billing.cash-drawers.manage`

**Request:**
```json
{ "closedBy": "user-id", "closingBalance": 95.000, "notes": "optional" }
```

**Response:**
```json
{
  "id": "session-uuid", "status": "CLOSED",
  "expected_balance": 110.000, "closing_balance": 95.000, "variance": -15.000
}
```

### `POST /api/v1/cash-drawers/[drawerId]/cash-movement`
Record a cash movement (cash-in/cash-out).

**Permission:** `billing.cash-drawers.manage`

**Request:**
```json
{ "type": "CASH_OUT", "amount": 20.000, "reason": "Petty cash", "performedBy": "user-id" }
```

### `GET /api/v1/cash-drawers/[drawerId]/session/[sessionId]/summary`
Get session summary including payments and movements.

---

## Customer Stored Value

### `GET /api/v1/customers/[customerId]/stored-value`
Get all stored value balances for a customer (wallet, advance, credit notes).

**Permission:** `customers.stored-value.manage`

### `POST /api/v1/customers/[customerId]/wallet/top-up`
Top up a customer wallet.

**Request:**
```json
{ "amount": 50.000, "currencyCode": "OMR", "notes": "optional", "performedBy": "user-id" }
```

### `GET /api/v1/customers/[customerId]/wallet/ledger`
Paginated wallet transaction history.

### `POST /api/v1/customers/[customerId]/advance/issue`
Issue an advance to a customer.

### `GET /api/v1/customers/[customerId]/advance/ledger`
Paginated advance transaction history.

### `POST /api/v1/customers/[customerId]/credit-note/issue`
Issue a credit note.

**Request:**
```json
{
  "amount": 25.000, "currencyCode": "OMR",
  "reason": "Quality issue", "issuedBy": "user-id",
  "relatedOrderId": "order-uuid"
}
```

### `GET /api/v1/customers/[customerId]/credit-notes`
List active credit notes for a customer.

### `GET /api/v1/customers/[customerId]/loyalty`
Get loyalty account balance and tier.

---

## Orders — Financial

### `POST /api/v1/orders/[orderId]/refund`
Initiate a refund request.

**Permission:** `orders.refunds.initiate`

**Request:**
```json
{
  "amount": 30.000, "reason": "QUALITY_ISSUE",
  "method": "CASH", "requestedBy": "user-id", "currencyCode": "OMR"
}
```

**Response:**
```json
{ "id": "refund-uuid", "refund_no": "REF-000001", "refund_status": "PENDING_APPROVAL" }
```

**Errors:** `422` if amount > total_paid.

### `GET /api/v1/orders/[orderId]/refunds`
List all refunds for an order.

### `POST /api/v1/orders/refunds/[refundId]/approve`
Approve a pending refund.

**Permission:** `orders.refunds.approve`

**Request:**
```json
{ "approverId": "user-id" }
```

### `POST /api/v1/orders/[orderId]/collect-payment`
Collect payment on a PAY_ON_COLLECTION order.

**Permission:** `orders.payments.settle`

**Request:**
```json
{
  "paymentLegs": [{ "paymentMethodId": "uuid", "amount": 100.000 }],
  "collectedBy": "user-id"
}
```

---

## Finance Reports

### `GET /api/v1/finance/reports/orders-summary`
Orders financial summary (subtotal, discounts, tax, payments) for a date range.

**Query:** `?from=2026-01-01&to=2026-01-31&branchId=uuid`

### `GET /api/v1/finance/reports/payments-breakdown`
Payment method breakdown for a date range.

### `GET /api/v1/finance/reports/tax-report`
Tax collected breakdown by profile and rate.

---

## Reconciliation

### `POST /api/v1/finance/reconciliation/runs`
Trigger a new reconciliation run.

**Permission:** `billing.reconciliation.run`

**Request:**
```json
{ "runDate": "2026-01-31" }
```

**Response:**
```json
{ "id": "run-uuid", "run_no": "REC-20260131-001", "overall_status": "PASSED" }
```

### `GET /api/v1/finance/reconciliation/runs/[runId]`
Get reconciliation run details including all check results.

### `GET /api/v1/finance/reconciliation/issues/[issueId]`
Get a specific reconciliation issue.

---

## Promotions

### `GET /api/v1/marketing/promotions`
List all promotions (active and inactive).

**Permission:** `marketing.promotions.manage`

### `POST /api/v1/marketing/promotions`
Create a new promotion.

**Request:**
```json
{
  "name": "Summer Sale", "name2": "تخفيضات الصيف",
  "promoCode": "SUMMER20", "discountType": "PERCENTAGE",
  "discountValue": 20, "minOrderAmount": 10.000,
  "validFrom": "2026-06-01", "validTo": "2026-08-31",
  "maxUsage": 100, "maxUsagePerCustomer": 1
}
```

### `GET /api/v1/marketing/promotions/[promoId]`
Get promotion details.

### `PUT /api/v1/marketing/promotions/[promoId]`
Update a promotion.

### `POST /api/v1/marketing/promotions/validate`
Validate a promo code for a given order context.

**Request:**
```json
{
  "promoCode": "SUMMER20", "orderTotal": 50.000,
  "customerId": "uuid", "serviceCategories": ["LAUNDRY"]
}
```

**Response:**
```json
{ "isValid": true, "discountAmount": 10.000, "promoId": "uuid" }
```

---

## Gift Cards

### `GET /api/v1/gift-cards/[cardCode]/balance`
Look up gift card balance by card code.

### `GET /api/v1/gift-cards/[cardCode]/ledger`
Transaction history for a gift card.

---

## Loyalty

### `GET /api/v1/loyalty/config`
Get the tenant's loyalty program configuration.

**Permission:** `marketing.loyalty.manage`

### `GET /api/v1/loyalty/tiers`
List loyalty tiers.

---

## Settings — Tax

### `GET /api/v1/settings/tax/profiles`
List all tax profiles.

**Permission:** `settings.tax.manage`

### `POST /api/v1/settings/tax/profiles`
Create a tax profile.

**Request:**
```json
{
  "name": "Standard VAT", "name2": "ضريبة القيمة المضافة",
  "taxType": "VAT", "rate": 0.05, "isDefault": true
}
```

### `GET/PUT/DELETE /api/v1/settings/tax/profiles/[profileId]`
Get, update, or soft-delete a tax profile.

### `POST /api/v1/settings/tax/exemptions`
Create a tax exemption for a customer or service category.

---

## Settings — Payments

### `GET /api/v1/settings/payments/methods`
List all payment methods.

**Permission:** `settings.payments.manage`

### `POST /api/v1/settings/payments/methods`
Create a payment method.

### `GET/PUT/DELETE /api/v1/settings/payments/methods/[methodId]`
CRUD on a specific payment method.

### `GET /api/v1/settings/payments/terminals`
List payment terminals.

---

## Common Error Codes

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Request body fails Zod schema |
| 401 | `UNAUTHORIZED` | No valid session |
| 403 | `FORBIDDEN` | Missing required permission |
| 404 | `NOT_FOUND` | Resource not found for this tenant |
| 409 | `CONFLICT` | e.g. drawer already has open session |
| 422 | `BUSINESS_RULE_VIOLATION` | e.g. refund amount > total_paid |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

## Idempotency Header

For mutation endpoints that support idempotency (wallet top-up, gift card redemption), pass:

```
Idempotency-Key: <uuid-v4>
```

Repeated requests with the same key within 24 hours return the original response without a second mutation.
