# Order Financial Platform — API Reference

All routes are under `/api/v1/` and require a valid session cookie (Supabase auth). Tenant ID is resolved from the session. All responses are JSON.

---

## POS Sessions

POS Session v1 routes manage the authenticated user's operational POS work period. The backend can attach `pos_session_id` to active finance write paths when POS-aware callers provide it. The dashboard workbench is exposed at `/dashboard/internal_fin/pos-sessions`.

### `GET /api/v1/pos-sessions`

Returns paginated POS session history for the current user. Users with `pos_session:view_all` may request `scope=all` for branch/tenant operations review.

**Permission:** `pos_session:view`

**Query parameters:**

- `page`
- `pageSize`
- `branchId`
- `status`
- `scope` = `own` or `all`

### `GET /api/v1/pos-sessions/my-active`

Returns the current user's active POS session. Optional `branchId` query parameter returns a branch-conflict result when the user already has an active session in another branch.

**Permission:** `pos_session:view`

### `POST /api/v1/pos-sessions/open`

Manually opens a POS session. If the user already has an active same-branch session, the route returns the current session. If the active session is in another branch, it returns `409 POS_SESSION_BRANCH_CONFLICT`.

**Permission:** `pos_session:open`

**Request:**
```json
{
  "branchId": "uuid",
  "terminalId": "uuid",
  "idempotencyKey": "client-generated-key",
  "sourceChannel": "api"
}
```

### `POST /api/v1/pos-sessions/ensure-for-order-entry`

Auto-ensure endpoint for POS order-entry flows. Uses the same branch-conflict and idempotency behavior as manual open, but records `AUTO_OPEN` when it creates a new session.

**Permission:** `pos_session:open`

The new-order UI calls this route before `POST /api/v1/orders/submit-order` and forwards the returned session id as `posSessionId`.

### `POST /api/v1/pos-sessions/pause`

Pauses the current active `OPEN` session. Replays with the same idempotency key return the cached result.

**Permission:** `pos_session:pause_resume`

### `POST /api/v1/pos-sessions/resume`

Resumes the current active `PAUSED` session.

**Permission:** `pos_session:pause_resume`

### `POST /api/v1/pos-sessions/close`

Closes the current active session when no linked cash drawer session is still open. If the linked drawer is open, returns `409 POS_SESSION_DRAWER_STILL_OPEN`.

**Permission:** `pos_session:close`

### `POST /api/v1/pos-sessions/force-close`

Force-closes the current active session with a required reason. This route does not silently force-close a linked cash drawer.

**Permission:** `pos_session:force_close`

**Request:**
```json
{
  "reason": "Manager override reason",
  "idempotencyKey": "client-generated-key",
  "sourceChannel": "api"
}
```

### `GET /api/v1/pos-sessions/[sessionId]/summary`

Returns a summary for the current user's POS session using only active finance tables:

- `org_order_payments_dtl`
- `org_order_refunds_dtl`
- `org_fin_voucher_trx_lines_dtl`

**Permission:** `pos_session:view`

Users with `pos_session:view_all` can view summaries for other users' sessions; otherwise the route is restricted to the current user's sessions.

### Drawer close integration

When POS close returns `409 POS_SESSION_DRAWER_STILL_OPEN`, the POS Sessions UI uses the existing drawer close endpoint:

- `POST /api/v1/cash-drawers/[drawerId]/close-session`

POS force-close does not silently force-close a drawer. Drawer force-close remains an explicit future UX/API decision.

---

## Order Submission (Phase 1B — Canonical Path)

### `POST /api/v1/orders/submit-order` ← **Canonical**

Single entry point for all order creation with payment settlement. All business logic lives in `lib/services/order-submit-orchestrator.service.ts`.

**Permission:** `orders:create`

**Idempotency:** Required. `idempotencyKey` must be a non-empty string. Same key + same request → returns cached result (200). Same key already exists → returns cached order.

**Request:**
```json
{
  "customerId": "uuid",
  "items": [
    { "productId": "uuid", "quantity": 2, "pricePerUnit": 10.000, "totalPrice": 20.000, "serviceCategoryCode": "DRY_CLEANING" }
  ],
  "paymentMethod": "CASH",
  "idempotencyKey": "client-generated-unique-key",
  "cashDrawerSessionId": "uuid",
  "clientTotals": {
    "subtotal": 20.000,
    "manualDiscount": 0,
    "promoDiscount": 0,
    "vatValue": 1.000,
    "finalTotal": 21.000
  },
  "amountToCharge": 21.000,
  "paymentLegs": [
    { "method": "CASH", "amount": 21.000, "tenderedAmount": 25.000 }
  ]
}
```

**Response 200 — new order:**
```json
{
  "success": true,
  "data": {
    "order": {
      "id": "uuid",
      "orderNo": "ORD-001",
      "currentStatus": "RECEIVED",
      "totalAmount": "21.000",
      "totalPaidAmount": "21.000",
      "totalCreditAppliedAmount": "0.000",
      "outstandingAmount": "0.000",
      "paymentStatus": "PAID",
      "paymentTypeCode": "CASH"
    },
    "voucher": {
      "id": "uuid",
      "voucherNo": "RV-001",
      "status": "POSTED",
      "wiringStatus": "WIRED"
    },
    "effects": {
      "orderPayments": [
        { "id": "uuid", "amount": "21.000", "paymentMethodCode": "CASH", "paymentStatus": "COMPLETED" }
      ],
      "creditApplications": [],
      "cashMovements": [
        { "id": "uuid", "amount": "21.000", "sessionId": "uuid" }
      ]
    },
    "warnings": []
  }
}
```

**Response 200 — cached (idempotent retry):**
```json
{ "success": true, "data": { "order": { "id": "uuid", "orderNo": "ORD-001", "currentStatus": "RECEIVED" }, "fromCache": true } }
```

**Response 400:**
| Error Code | Cause |
|---|---|
| `AMOUNT_MISMATCH` | Server-computed total differs from `clientTotals.finalTotal` |
| `B2B_CREDIT_HOLD` | B2B customer account is on credit hold |
| `B2B_CREDIT_EXCEEDED` | Order total exceeds available B2B credit limit |
| `SPLIT_AMOUNT_MISMATCH` | Sum of `paymentLegs[].amount` ≠ order total |
| `DEFERRED_LEG_NOT_ALONE` | A deferred method (PAY_ON_COLLECTION) mixed with immediate legs |
| `CHECK_NUMBER_REQUIRED` | Check payment submitted without `checkNumber` |
| `PRODUCT_NOT_FOUND` | A product ID in `items[]` does not exist in this tenant |

**Response 422:**
| Error Code | Cause |
|---|---|
| `CASH_DRAWER_SESSION_REQUIRED` | CASH leg provided but `cashDrawerSessionId` missing |
| `CASH_DRAWER_SESSION_CLOSED` | Referenced cash drawer session is not OPEN |
| `CASH_TENDERED_LESS_THAN_AMOUNT` | `tenderedAmount` < leg amount |
| `GATEWAY_NOT_CONFIGURED` | Gateway code used but no active gateway config found |
| `PAYMENT_REFERENCE_REQUIRED` | BANK_TRANSFER / CHECK leg missing reference number |

**Warning codes in `data.warnings[]`** (informational — order was created successfully):
| Code | Meaning |
|---|---|
| `BANK_TRANSFER_PENDING_CONFIRMATION` | Bank transfer leg has `PENDING` status — awaiting bank confirmation |
| `CHECK_PENDING_CONFIRMATION` | Check leg has `PENDING` status — awaiting clearance |
| `GATEWAY_PAYMENT_PROCESSING` | Gateway leg has `PROCESSING` status — async confirmation pending |

---

### `POST /api/v1/orders/create-with-payment` ← **FROZEN / NOT SERVED**

This route is **not served by Next.js**. The route folder is prefixed with `_legacy_` which Next.js does not route. Preserved in source at `app/api/v1/orders/_legacy_create-with-payment/route.ts` for reference only.

All callers must use `submit-order` instead. An ESLint `no-restricted-imports` rule prevents any new import of this path.

---

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

## Order Payment Read Surfaces (Remediation 2026-07 — Phase 1)

### `GET /api/v1/orders/[id]/report/payments-rprt?sort=asc|desc`

A4 print data: order header + **canonical** payments. Guard: `requirePermission('orders:read')` + centralized tenant context (the old ad-hoc `tenants[0]` auth was removed). Payments come from `getOrderPaymentsCanonical()` (`lib/services/order-financial-summary.service.ts`) over `org_order_payments_dtl` — never `org_payments_dtl_tr` (deprecated, ADR-002).

### `GET /api/v1/orders/[id]/report/invoices-payments-rprt`

A4 print data: order header + invoices with their **canonical AR payment allocations** (`org_invoice_payments_dtl`, reversed allocations excluded). Guard: `requirePermission('orders:read')`.

### Canonical read model

`getOrderPaymentsCanonical(tenantId, orderId): OrderPaymentRow[]` is the single read path for every UI/report listing one order's payments (Payments tab, prints). It reads the same rows the snapshot engine aggregates, so displays can never diverge from `org_orders_mst` canonical totals.

### Cancellation guard (interim, FN-02)

`WorkflowServiceEnhanced.executeScreenTransition('canceling', …)` rejects with `CANCEL_BLOCKED_PAID_ORDER` when the order has canonical `total_paid_amount > 0` or `total_credit_applied_amount > 0`. Replaced by the full disposition flow in Remediation Phase 4.

### `GET /api/v1/finance/reports/money-position` (Remediation Phase 2)

Owner/finance glance row (financial reports hub): today's canonical order-payment collections by method (COMPLETED bucket), orders outstanding, AR outstanding, stored-value liability (wallets+advances+credit notes), open drawer sessions. Guard: `finance_reports:view`. Service: `lib/services/reports/finance-money-position.service.ts`.

### Tenant Payments report — canonical source (Remediation Phase 2)

`report-service.getPaymentsReport` now aggregates `org_order_payments_dtl` (order payments) instead of the deprecated `_tr` ledger: collected KPIs count the COMPLETED/CAPTURED/SETTLED bucket only; pending/authorized/failed stay visible in the status breakdown; refunds KPI counts PROCESSED rows in `org_order_refunds_dtl`. Status filter values are canonical bucket names (`COMPLETED`/`PENDING`/`AUTHORIZED`/`FAILED`), expanded server-side. Scope note: this report covers ORDER payments; AR/B2B collections are reported by the AR reports and reconciliation reports (no double counting).
