# Payment Settlement & Receipt Allocation — Full Test Guide

**Version:** 2.1  
**Date:** 2026-06-16  
**Scope:** Payment Modal V4, overpayment disposition (Phases 2–3), customer receipt allocation (Phase 4), later collection + account receipt (Phase 5), Phase 6 legacy cleanup, **ADR-050 pay-extra intent**  
**Related:** [Implementation plan](../Order_Fin/Payment_Settlement_And_Receipt_Allocation_IMPLEMENTATION_PLAN.md) · [walkthrough.md](./walkthrough.md) · [tech_settlement_catalogs.md](../Order_Fin/technical_docs/tech_settlement_catalogs.md)

---

## Table of contents

1. [What this guide covers](#what-this-guide-covers)
2. [Test environment setup](#test-environment-setup)
3. [Permissions & roles](#permissions--roles)
4. [UI entry points](#ui-entry-points)
5. [Automated validation](#automated-validation)
6. [Pre-flight SQL](#pre-flight-sql)
7. [Test data preparation](#test-data-preparation)
8. [Manual scenarios — Payment Modal V4 (1–15)](#manual-scenarios--payment-modal-v4-115)
9. [Manual scenarios — Overpayment disposition (16–19)](#manual-scenarios--overpayment-disposition-1619)
10. [Manual scenarios — Customer receipt allocation (20–25)](#manual-scenarios--customer-receipt-allocation-2025)
11. [Manual scenarios — Later collection (26–27)](#manual-scenarios--later-collection-2627)
12. [Manual scenarios — Account receipt & collect UI (28–32)](#manual-scenarios--account-receipt--collect-ui-2832)
13. [Manual scenarios — Phase 6 & RBAC (33–35)](#manual-scenarios--phase-6--rbac-3335)
14. [Manual scenarios — Pay-extra intent ADR-050 (36–45)](#manual-scenarios--pay-extra-intent-adr-050-3645)
15. [API reference (optional API-only testing)](#api-reference-optional-api-only-testing)
16. [Post-submit verification SQL](#post-submit-verification-sql)
17. [Regression checklist](#regression-checklist)
18. [Submit error code reference](#submit-error-code-reference)
19. [Test execution log](#test-execution-log)

---

## What this guide covers

| Area | Features to verify |
|------|-------------------|
| **Cash & change** | Tendered vs applied, change returned, drawer retained amount |
| **Method policy** | Overpayment blocked/allowed, terminal, reference, check date |
| **Stored value** | Wallet, advance, credit note picker, gift card, caps |
| **Extra receipt** | Unallocated amount card, adjust legs, advance/credit |
| **Allocation** | Auto/manual preview, confirm, embed in submit |
| **Later collection** | `OrderCollectPaymentModal`, same resolution rules |
| **Account receipt** | Standalone screen, auto-allocate full receipt |
| **Financial snapshot** | `overpaid_amount` = unresolved excess only (Phase 6) |
| **Gateway** | Canonical `PAYMENT_GATEWAY` + `gateway_code` (no live provider — submit blocked/deferred) |

**Canonical DB payment codes:**

- Gateway: `PAYMENT_GATEWAY` + `gateway_code` (`HYPERPAY`, `PAYTABS`, `STRIPE`, …)
- Stored value: `WALLET`, `ADVANCE`, `CREDIT_NOTE`, `LOYALTY_POINTS`, `GIFT_CARD`
- Deprecated provider-as-method rows (`HYPERPAY` as method) must **not** appear in checkout

---

## Test environment setup

### Required migrations (apply in order)

| Migration | Purpose |
|-----------|---------|
| `0357_fin_settlement_catalogs_v1_1.sql` | Catalog tables + policy/preview tables |
| `0354_order_overpay_disposition.sql` | `org_fin_overpay_disp_dtl` audit |
| `0358_permissions_customer_receipt_allocate.sql` | `customers:receipt_allocate` |
| `0359_nav_customers_account_receipt.sql` | Nav + `sys_components_cd` |
| `0360_order_fin_phase6_legacy_cleanup.sql` | Disp table align + `overpaid_amount` backfill |
| `0368_fin_overpay_save_to_wallet.sql` | `SAVE_TO_CUSTOMER_WALLET` catalog row (ADR-050) |

### Runtime prerequisites

- [ ] `web-admin` dev server running (`cd web-admin; npm run dev`)
- [ ] Logged in as user with **cashier** or **branch_manager** role (or super_admin)
- [ ] Active branch selected in tenant context
- [ ] For cash scenarios: **open cash drawer session** for branch/user when `requires_cash_drawer = true`
- [ ] At least one **payment terminal** seeded if testing `requires_terminal`
- [ ] Bilingual: switch EN ↔ AR once per session and spot-check Extra Receipt card labels

### Recommended test role matrix

| Role | Use for |
|------|---------|
| `super_admin` / `tenant_admin` | Full scenario pass |
| `cashier` | Day-to-day POS flows |
| User **without** `orders:overpayment_allocate` | Scenario 35 (RBAC) |
| User **without** `customers:receipt_allocate` | Scenario 35 (account receipt) |

---

## Permissions & roles

| Permission | Required for |
|------------|--------------|
| `orders:create` / order submit | New order + Payment Modal V4 |
| `orders:collect_payment` | Later collection API + collect modal |
| `orders:overpayment_dispose` | Save as advance/credit on extra receipt |
| `orders:overpayment_allocate` | Auto/manual allocation preview + confirm |
| `orders:overpayment_to_advance` | `SAVE_AS_CUSTOMER_ADVANCE` resolution |
| `orders:overpayment_to_credit` | `SAVE_AS_CUSTOMER_CREDIT` resolution |
| `customers:receipt_allocate` | `/dashboard/customers/account-receipt` |

Verify permissions exist:

```sql
SELECT code, name, is_active
FROM sys_auth_permissions
WHERE code IN (
  'orders:overpayment_dispose',
  'orders:overpayment_allocate',
  'orders:overpayment_to_advance',
  'orders:overpayment_to_credit',
  'orders:collect_payment',
  'customers:receipt_allocate'
)
ORDER BY 1;
```

---

## UI entry points

| Flow | Path / component |
|------|------------------|
| New order payment | Orders → New order → Payment Modal V4 |
| Order detail collection | Order detail → Financial / Receivable panel → **Collect payment** → `OrderCollectPaymentModal` |
| Ready screen collection | `/dashboard/ready/[orderId]` → Collect payment button |
| Standalone account receipt | Sidebar → Customers → **Account receipt** → `/dashboard/customers/account-receipt` |
| Extra receipt card | Payment Modal V4 right rail (amber card when unallocated > 0) |
| Auto allocation drawer | Extra receipt → **Auto allocate to open balances** |
| Manual allocation drawer | Extra receipt → **Manual allocate** |

**i18n namespace:** `newOrder.payment.extraReceipt.*` (EN/AR), `customers.accountReceipt.*`

---

## Automated validation

Run from `web-admin/` before manual QA:

```powershell
npm test -- --runTestsByPath `
  __tests__/features/orders/payment-modal-v4.utils.test.ts `
  __tests__/features/orders/payment-modal-v4.right-rail.test.ts `
  __tests__/features/orders/use-order-submission.price-override.test.ts `
  __tests__/features/orders/build-overpayment-resolution.test.ts `
  __tests__/integration/checkout-multi-payment.test.ts `
  __tests__/services/order-settlement-planner.service.test.ts `
  __tests__/services/settlement.service.test.ts `
  __tests__/services/voucher-line.service.test.ts `
  __tests__/services/order-submit-orchestrator.unpaid-balance.test.ts `
  __tests__/services/overpayment-resolution-validator.service.test.ts `
  __tests__/services/customer-receipt-allocation.service.test.ts `
  __tests__/payments/collection-overpayment.test.ts `
  __tests__/constants/settlement-catalog.test.ts
npm run check:i18n
npm run build
```

**Pass criteria:** all listed tests green, i18n parity, production build succeeds.

---

## Pre-flight SQL

Replace `<TENANT_ID>` with your demo tenant UUID.

### Tenant payment methods (effective checkout config)

```sql
SELECT
  id,
  payment_method_code,
  gateway_code,
  payment_nature,
  is_enabled,
  allowed_in_pos,
  supports_change_return,
  supports_overpayment,
  requires_cash_drawer,
  requires_terminal,
  requires_reference
FROM org_payment_methods_cf
WHERE tenant_org_id = '<TENANT_ID>'
  AND is_active = true
  AND rec_status = 1
ORDER BY display_order;
```

### Allocation policy (Phase 4)

```sql
SELECT
  policy_code,
  allocation_mode,
  fallback_destination,
  is_default,
  include_ar_invoices,
  include_b2b_statements,
  include_pay_on_collection_orders,
  require_confirmation_before_posting
FROM org_fin_rcpt_alloc_policy_cf
WHERE tenant_org_id = '<TENANT_ID>'
  AND is_active = true;
```

**Expected:** at least one row e.g. `DEFAULT_OLDEST_DUE`, mode `AUTO_OLDEST_DUE`, fallback `CUSTOMER_ADVANCE`.

### Catalog seeds (sanity)

```sql
SELECT resolution_code, is_active FROM sys_fin_overpay_res_cd ORDER BY display_order;
SELECT allocation_mode FROM sys_fin_rcpt_alloc_mode_cd WHERE is_active;
SELECT fallback_destination FROM sys_fin_rcpt_fb_dest_cd WHERE is_active;
```

### Open cash drawer (if required)

```sql
SELECT id, branch_id, status, opened_at
FROM org_cash_drawer_sessions_mst
WHERE tenant_org_id = '<TENANT_ID>'
  AND status = 'OPEN'
ORDER BY opened_at DESC
LIMIT 5;
```

---

## Test data preparation

Create or identify records **before** allocation scenarios (20+).

### Customer A — “Allocation rich”

Needs:

- Linked on orders during checkout
- ≥1 open **AR invoice** (`org_invoice_mst` with outstanding > 0)
- Optional: open **B2B statement** (`org_b2b_statements_mst`)
- Optional: **pay-on-collection** order with outstanding
- Same **currency** as tenant functional currency

### Customer B — “Walk-in”

Use for scenario 24 — no customer linked on order.

### Customer C — “Advance/credit only”

Single open order, no other balances — excess should fall through to **customer advance** fallback.

### Numeric example (from feature pack)

Use when validating auto-allocation math:

| Field | Value |
|-------|-------|
| Current order due | 10.000 |
| Receipt / excess to allocate | 90.000 (or trigger via multi-leg excess) |
| AR invoice 1 outstanding | 25.000 (due 2026-05-01) |
| AR invoice 2 outstanding | 40.000 (due 2026-05-10) |
| B2B statement outstanding | 50.000 (due 2026-06-01) |

**Expected auto allocation (oldest due):** current order 10 → AR1 25 → AR2 40 → statement 15 partial → remainder 0 (or fallback advance if policy limits targets).

### Open balances API (sanity before UI)

```http
GET /api/v1/customers/{customerId}/open-balances?currencyCode=OMR&excludeOrderId={currentOrderId}
```

Requires permission `orders:overpayment_allocate`. Response `data.targets[]` should list eligible documents with `targetType`, `outstandingAmount`, `dueDate`.

---

## Manual scenarios — Payment Modal V4 (1–15)

### 1. Cash exact payment

| | |
|---|---|
| **Setup** | `CASH` enabled, POS allowed; sale total **8.321** |
| **Steps** | CASH → tendered **8.321** → submit |
| **UI** | Applied 8.321, tendered 8.321, change 0, unallocated 0 |
| **DB** | Payment `amount=8.321`, `tendered_amount=8.321`, `change_returned_amount=0`; drawer movement = **8.321** retained |

### 2. Cash over-tender — change allowed

| | |
|---|---|
| **Setup** | `supports_change_return = true` |
| **Steps** | Sale 8.321 → tendered **8.821** → submit |
| **UI** | Change returned **0.500**, unallocated **0** |
| **DB** | `amount=8.321`, `tendered_amount=8.821`, `change_returned_amount=0.500`; drawer IN **8.321**, CASH_OUT **0.500** |

### 3. Cash over-tender — change blocked

| | |
|---|---|
| **Setup** | `supports_change_return = false` |
| **Steps** | Tendered > applied → submit |
| **Expected** | Blocked; `CASH_CHANGE_NOT_ALLOWED`; no payment/voucher/drawer rows |

### 4. Non-cash overpayment blocked

| | |
|---|---|
| **Setup** | CARD/BANK/CHECK/MOBILE/GATEWAY with `supports_overpayment = false` |
| **Steps** | Amount **8.821** on sale **8.321** |
| **Expected** | `METHOD_OVERPAYMENT_NOT_ALLOWED`; no retained overpayment |

### 5. Retained non-cash overpayment allowed

| | |
|---|---|
| **Setup** | Method with `supports_overpayment = true` (configure test row if needed) |
| **Steps** | Pay 8.821 on 8.321 sale |
| **Expected** | Applied 8.821; snapshot shows retained excess 0.500 until disposition required |

### 6. Gift card + cash change

| | |
|---|---|
| **Setup** | Gift card + `CASH.supports_change_return = true` |
| **Steps** | Sale 8.321; gift **2.000**; cash applied **6.321**, tendered **6.821** |
| **Expected** | Total settled 8.321; change 0.500; gift + cash legs reconcile |

### 7. Wallet / stored-value cap

| | |
|---|---|
| **Methods** | WALLET, ADVANCE, CREDIT_NOTE, LOYALTY_POINTS |
| **Steps** | Select method → try amount > min(balance, remaining due) |
| **Expected** | Keypad/field capped; validation message; CREDIT_NOTE requires picker + `creditReferenceId` in payload |

### 8. Multi-cash change policy

| | |
|---|---|
| **Setup** | Two cash legs: leg A change allowed, leg B change **disallowed**; combined applied > sale total |
| **Expected** | No aggregate “change returned”; **unallocated overpayment** shown; submit blocked until legs adjusted or extra receipt resolution |

### 9. Check due date validation

| | |
|---|---|
| **Steps** | CHECK leg → due date **yesterday** or invalid |
| **Expected** | Client error `checkDateInPast` / `checkDateInvalid`; focus scroll; server Zod rejects if bypassed |

### 10. Payment terminal required

| | |
|---|---|
| **Setup** | `requires_terminal = true`; active terminal for branch |
| **Steps** | Submit without terminal |
| **Expected** | `PAYMENT_TERMINAL_REQUIRED`; payload includes `terminalId` when fixed |

### 11. Gift card + NONE outstanding policy

| | |
|---|---|
| **Steps** | Sale 100; gift 30; cash 70 → submit ✓. Repeat with cash **60** only |
| **Expected** | First succeeds; second → `OUTSTANDING_POLICY_REQUIRED` |

### 12. Price override on create order

| | |
|---|---|
| **Steps** | Override line price → open modal → submit |
| **Expected** | Network payload `items[]` includes `priceOverride`, `overrideReason`, `overrideBy` |

### 13. Split payment reconciliation

| | |
|---|---|
| **Steps** | CASH 4 + CARD 6 on sale 10; change sale total to 8 |
| **Expected** | Legs reconcile; no hidden overpayment |

### 14. Payment gateway method (metadata only)

| | |
|---|---|
| **Setup** | `PAYMENT_GATEWAY` + `gateway_code` (e.g. HYPERPAY) enabled |
| **Steps** | Select gateway rail option; attempt submit |
| **Expected** | Payload uses `payment_method_code=PAYMENT_GATEWAY` + `gateway_code`; status **PROCESSING/PENDING** if submit allowed; **no live redirect** (integration deferred). Overpayment blocked unless `supports_overpayment=true` |

### 15. Later collection policy (baseline)

| | |
|---|---|
| **Steps** | POC/deferred order → collect exact cash; collect with change; collect non-cash overpay |
| **Expected** | Same rules as new-order submit (see scenarios 26–27 for API detail) |

---

## Manual scenarios — Overpayment disposition (16–19)

### 16. Extra receipt — adjust legs (REDUCE_PAYMENT)

| | |
|---|---|
| **Trigger** | Unresolved excess > 0 (scenario 8 pattern) |
| **UI** | Amber **Extra Receipt Handling** card; **Adjust payment amounts** selected |
| **Steps** | Reduce leg amounts until unallocated = 0 → submit |
| **Expected** | No `overpaymentResolution` in payload; `overpaid_amount = 0` |

**Note:** Cash **change** on a single cash leg (tendered > applied with change allowed) is **not** the Extra Receipt card — it uses tendered field and scenarios 2/27.

### 17. Save excess as customer advance

| | |
|---|---|
| **Preconditions** | Customer linked; excess > 0; permission `orders:overpayment_to_advance` |
| **Steps** | Extra receipt → **Save as customer advance** → submit |
| **Payload** | `overpaymentResolution.lines[].resolutionCode = SAVE_AS_CUSTOMER_ADVANCE` |
| **DB** | `org_fin_overpay_disp_dtl` row; advance balance ↑; `overpaid_amount = 0` |

### 18. Save excess as customer credit

| | |
|---|---|
| **Preconditions** | `orders:overpayment_to_credit` |
| **Steps** | **Save as customer credit** → submit |
| **DB** | Resolution `SAVE_AS_CUSTOMER_CREDIT`; credit note issued; `target_ref` set |

### 19. Server rejects missing resolution

| | |
|---|---|
| **Steps** | DevTools: submit with excess but omit `overpaymentResolution` |
| **Expected** | HTTP 400 `OVERPAYMENT_RESOLUTION_REQUIRED`; no duplicate order on replay without idempotency |

---

## Manual scenarios — Customer receipt allocation (20–25)

### 20. Auto allocate — preview + submit (order modal)

| | |
|---|---|
| **Preconditions** | Customer A; open balances; `orders:overpayment_allocate`; excess on checkout |
| **Steps** | 1. Extra receipt → **Auto allocate** 2. Review drawer (documents, amounts, fallback) 3. **Confirm allocation** 4. Submit order |
| **APIs** | `POST .../allocation/preview-auto` → `POST .../allocation/post` `{ confirmOnly: true }` → submit-order with `allocationPreviewId` |
| **DB** | `org_fin_rcpt_alloc_preview_tr.preview_status = POSTED`; target invoices/orders updated; disp audit rows |

### 21. AR invoice wins over order

| | |
|---|---|
| **Setup** | Order with linked open AR invoice + separate open order balance |
| **Steps** | Auto preview |
| **Expected** | Allocation hits **invoice** (`INVOICE_PAYMENT` / target `INVOICE`); open-balances API excludes order when invoice owns balance |

### 22. Manual allocate

| | |
|---|---|
| **Steps** | **Manual allocate** → enter amounts per document summing to excess → confirm → submit |
| **Expected** | `preview-manual` balanced; submit blocked until sum = excess; payload `ALLOCATE_TO_CUSTOMER_BALANCES` |

### 23. Allocation blocked — unallocated remainder

| | |
|---|---|
| **Setup** | Manual lines sum < excess OR policy fallback `BLOCK_AND_REQUIRE_MANUAL_ACTION` |
| **Expected** | Confirm disabled; server `RECEIPT_ALLOCATION_EXCESS_UNRESOLVED` if bypassed |

### 24. Walk-in customer

| | |
|---|---|
| **Setup** | No customer on order; unresolved excess |
| **Expected** | Extra receipt shows **walk-in hint** only + adjust legs; no advance/credit/allocate buttons |

### 25. Idempotent submit replay

| | |
|---|---|
| **Steps** | Complete scenario 20; replay submit with same `idempotencyKey` |
| **Expected** | No duplicate allocation payments or disp rows; preview stays POSTED |

---

## Manual scenarios — Later collection (26–27)

### 26. Collect payment — overpayment resolution parity

| | |
|---|---|
| **UI** | Order detail or Ready → **Collect payment** → `OrderCollectPaymentModal` (same extra receipt / allocation hook as V4) |
| **Setup** | POC order outstanding **50.000**; customer linked |
| **Steps A** | Collect **55** on CARD without resolution → expect block / `OVERPAYMENT_RESOLUTION_REQUIRED` |
| **Steps B** | Collect 55 with advance disposition for excess 5 |

**API alternative** (`POST /api/v1/orders/{id}/payments`):

```json
{
  "paymentLegs": [
    {
      "paymentMethodId": "<CARD_ORG_METHOD_UUID>",
      "amount": 55
    }
  ],
  "overpaymentResolution": {
    "excessAmount": 5,
    "lines": [
      {
        "resolutionCode": "SAVE_AS_CUSTOMER_ADVANCE",
        "amount": 5
      }
    ]
  },
  "idempotencyKey": "collect-test-001"
}
```

**Expected:** Outstanding → 0; advance +5; `overpaid_amount = 0`.

### 27. Collect payment — cash change

| | |
|---|---|
| **Setup** | Outstanding 50; CASH change allowed |
| **Steps** | amount 50, cashTendered 51 |
| **DB** | Drawer IN 50; CASH_OUT 1; no overpayment resolution |

---

## Manual scenarios — Account receipt & collect UI (28–32)

### 28. Standalone account receipt — happy path

| | |
|---|---|
| **Route** | `/dashboard/customers/account-receipt` |
| **Permission** | `customers:receipt_allocate` |
| **Steps** | 1. Select Customer A 2. Receipt amount **100.000** 3. Payment method CASH (or CARD) 4. **Auto allocate** → confirm preview 5. **Post receipt** |
| **API** | `POST /api/v1/customer-receipts/post` with `previewId`, `customerId`, `paymentMethodId`, `receiptAmount` |
| **Expected** | Success toast; balances allocated per policy; voucher + wiring effects; no current order (standalone) |

### 29. Account receipt — allocation required before post

| | |
|---|---|
| **Steps** | Enter amount but skip auto/manual confirm |
| **Expected** | Post button disabled; toast `allocationRequired` if forced |

### 30. Account receipt — no permission

| | |
|---|---|
| **Setup** | User without `customers:receipt_allocate` |
| **Expected** | Screen shows permission message; nav hidden if RBAC enforced |

### 31. Order detail collect modal — allocation on excess

| | |
|---|---|
| **Route** | Order detail → receivable / financial panel |
| **Steps** | Collect more than outstanding with linked customer → use auto allocate on excess → submit |
| **Expected** | Same preview/confirm flow as Payment Modal V4 (`useOverpaymentAllocation` shared hook) |

### 32. Ready screen collect

| | |
|---|---|
| **Route** | `/dashboard/ready/[id]` |
| **Steps** | Open collect modal for ready order; pay outstanding |
| **Expected** | Modal opens; collection succeeds; order financial summary updates |

---

## Manual scenarios — Phase 6 & RBAC (33–35)

### 33. Phase 6 — `overpaid_amount` is unresolved only

| | |
|---|---|
| **Steps** | Run scenario 2 (cash change) and scenario 17 (advance disposition) |
| **SQL** | `SELECT overpaid_amount FROM org_orders_mst WHERE id = ?` |
| **Expected** | After cash change: `overpaid_amount = 0` (excess returned as change, not retained). After advance disposition: `overpaid_amount = 0` (excess routed to advance) |

### 34. Phase 6 — no silent overpayment retention

| | |
|---|---|
| **Setup** | Method with `supports_overpayment = true` **and** unresolved excess without resolution |
| **Expected** | Submit blocked (`OVERPAYMENT_RESOLUTION_REQUIRED`) — excess is **not** silently stored in `overpaid_amount` |

### 35. RBAC — allocation actions hidden

| | |
|---|---|
| **Setup** | User lacking `orders:overpayment_allocate` |
| **Expected** | Extra receipt card: no auto/manual buttons (`canAllocate=false`); API preview returns 403 |

---

## API reference (optional API-only testing)

All routes require auth + CSRF header (`x-csrf-token`) as per web-admin conventions.

### Preview auto allocation

```http
POST /api/v1/customer-receipts/allocation/preview-auto
Content-Type: application/json
```

```json
{
  "customerId": "<UUID>",
  "branchId": "<UUID>",
  "sourceType": "ORDER_PAYMENT_MODAL",
  "sourceOrderId": "<UUID>",
  "receiptAmount": 100,
  "currentOrderAllocationAmount": 10,
  "excessAmount": 90,
  "currencyCode": "OMR",
  "paymentMethodCode": "CASH",
  "idempotencyKey": "preview-auto-001"
}
```

### Confirm preview (no order submit yet)

```http
POST /api/v1/customer-receipts/allocation/post
```

```json
{
  "confirmOnly": true,
  "previewId": "<UUID>",
  "customerId": "<UUID>"
}
```

### Submit order (excerpt — with allocation)

Include in existing submit-order body:

```json
{
  "overpaymentResolution": {
    "excessAmount": 90,
    "allocationPreviewId": "<UUID>",
    "lines": [
      {
        "resolutionCode": "AUTO_ALLOCATE_TO_CUSTOMER_BALANCES",
        "amount": 90
      }
    ]
  },
  "idempotencyKey": "submit-001"
}
```

### Standalone account receipt post

```http
POST /api/v1/customer-receipts/post
```

```json
{
  "customerId": "<UUID>",
  "previewId": "<UUID>",
  "paymentMethodId": "<ORG_PAYMENT_METHOD_UUID>",
  "receiptAmount": 100,
  "currencyCode": "OMR",
  "cashTendered": 100,
  "idempotencyKey": "car-001"
}
```

---

## Post-submit verification SQL

Replace placeholders after each scenario.

### Order payments

```sql
SELECT
  payment_method_code,
  gateway_code,
  amount,
  tendered_amount,
  change_returned_amount,
  payment_status,
  fin_voucher_trx_line_id
FROM org_order_payments_dtl
WHERE tenant_org_id = '<TENANT_ID>'
  AND order_id = '<ORDER_ID>'
ORDER BY created_at;
```

### Order financial snapshot

```sql
SELECT
  total_paid_amount,
  outstanding_amount,
  overpaid_amount,
  pending_credit_application_amount
FROM org_orders_mst
WHERE tenant_org_id = '<TENANT_ID>'
  AND id = '<ORDER_ID>';
```

### Overpayment disposition audit

```sql
SELECT
  resolution_code,
  amount,
  currency_code,
  target_ref,
  voucher_id,
  voucher_trx_line_id,
  idempotency_key,
  created_at
FROM org_fin_overpay_disp_dtl
WHERE tenant_org_id = '<TENANT_ID>'
  AND order_id = '<ORDER_ID>'
  AND is_active = true
ORDER BY created_at;
```

### Allocation preview

```sql
SELECT
  id,
  customer_id,
  excess_amount,
  amount_allocated,
  remaining_unallocated_amount,
  allocation_mode,
  fallback_destination,
  preview_status,
  preview_payload
FROM org_fin_rcpt_alloc_preview_tr
WHERE tenant_org_id = '<TENANT_ID>'
  AND (source_order_id = '<ORDER_ID>' OR customer_id = '<CUSTOMER_ID>')
ORDER BY created_at DESC
LIMIT 5;
```

### Voucher lines (allocation / disposition)

```sql
SELECT
  line_no,
  line_role,
  target_type,
  target_id,
  amount,
  payment_method_code,
  payment_status,
  wiring_status
FROM org_fin_voucher_trx_lines_dtl
WHERE tenant_org_id = '<TENANT_ID>'
  AND fin_voucher_id = '<VOUCHER_ID>'
ORDER BY line_no;
```

**Expect for allocation:** roles such as `INVOICE_PAYMENT`, `STATEMENT_PAYMENT`, `ORDER_PAYMENT`, `CUSTOMER_ADVANCE_RECEIPT`; targets `INVOICE`, `B2B_STATEMENT`, `ORDER`, `CUSTOMER`.

### Cash drawer

```sql
SELECT
  movement_type,
  amount,
  direction,
  order_payment_id,
  fin_voucher_id
FROM org_cash_drawer_movements_dtl
WHERE tenant_org_id = '<TENANT_ID>'
  AND order_id = '<ORDER_ID>'
ORDER BY created_at;
```

### Credit applications (stored value)

```sql
SELECT
  credit_type,
  applied_amount,
  credit_reference_id,
  application_status
FROM org_order_credit_apps_dtl
WHERE tenant_org_id = '<TENANT_ID>'
  AND order_id = '<ORDER_ID>'
ORDER BY created_at;
```

---

## Manual scenarios — Pay-extra intent ADR-050 (36–45)

**Prerequisites:** Migration `0368` applied; demo user has `orders:overpayment_to_wallet`, `orders:overpayment_dispose`, `orders:overpayment_allocate`; linked customer with wallet enabled.

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 36 | Intent OFF unchanged | Overpay with cash (change allowed), toggle **OFF** | Inline Extra Receipt or auto change; **no** Validate button |
| 37 | Toggle enable rule | Order with cash (change return) only | Toggle enabled |
| 38 | Toggle disabled | Order with methods that disallow overpayment and non-cash cash | Toggle disabled + `disabledNoMethods` hint |
| 39 | Validate no excess | Intent ON, legs match sale total exactly | Validate → submit allowed without dialog |
| 40 | Validate opens dialog | Intent ON, card leg > remaining due (supports overpayment) | Validate → Extra Receipt dialog with pooled excess |
| 41 | **Cash + card → wallet** | See walkthrough below | `SAVE_TO_CUSTOMER_WALLET` disposition row; wallet ledger credit |
| 42 | Return cash change | Intent ON, cash tender surplus, pick **Return as cash change** | `RETURN_CASH_CHANGE` line; voucher change_returned_amount set |
| 43 | RBAC wallet hidden | User without `orders:overpayment_to_wallet` | Wallet option hidden in dialog |
| 44 | Collect modal parity | Later collection with intent ON + excess | Same toggle + Validate + dialog in Collect Payment modal |
| 45 | Regression intent OFF | Repeat scenario 2 (cash change) with toggle OFF | Identical to pre-ADR-050 behavior |

### Scenario 41 detail — Cash + card overpay → wallet (demo tenant)

1. Login at [https://cmx.cleanmatex.com/](https://cmx.cleanmatex.com/) as tenant admin/cashier with wallet permission.
2. **Orders → New order** — add items totaling **10.000 OMR** (example).
3. Select a **linked customer** (required for wallet).
4. Open **Payment** modal (V4).
5. **Split payment:** add **Card** leg **6.000** and **Cash** leg **6.000** (total **12.000** → **2.000** pooled excess).
6. Enable **Customer is paying extra** (center workbench, below balance snapshot).
7. Click **Validate payment**.
8. In Extra Receipt dialog, choose **Add to customer wallet** → **Confirm**.
9. Submit order.
10. Verify: `org_fin_overpay_disp_dtl` row with `SAVE_TO_CUSTOMER_WALLET`; customer wallet ledger shows **+2.000**; order financial snapshot `overpaid_amount = 0`.

---

## Regression checklist

Use after any payment/settlement change:

- [ ] Scenarios 1–3 cash exact / change / blocked
- [ ] Scenario 4 non-cash overpayment block
- [ ] Scenario 7 stored-value caps + credit note picker
- [ ] Scenario 8 multi-cash unresolved excess
- [ ] Scenario 9 check date
- [ ] Scenario 10 terminal required
- [ ] Scenario 11 gift + NONE policy
- [ ] Scenario 16–19 extra receipt + server validation
- [ ] Scenario 20–22 allocation auto/manual + invoice priority
- [ ] Scenario 24 walk-in
- [ ] Scenario 26–27 later collection
- [ ] Scenario 28 account receipt standalone
- [ ] Scenario 31–32 collect modals
- [ ] Scenario 33–34 `overpaid_amount` semantics
- [ ] Scenarios 36–45 pay-extra intent (toggle, validate, wallet, collect parity)
- [ ] EN/AR labels on extra receipt + account receipt
- [ ] Automated test suite + build green

---

## Submit error code reference

| Server code | When |
|-------------|------|
| `OUTSTANDING_POLICY_REQUIRED` | NONE policy with remaining balance |
| `PAYMENT_TERMINAL_REQUIRED` | Terminal-required method without `terminalId` |
| `PAYMENT_REFERENCE_REQUIRED` | Reference-required method without ref/auth |
| `CREDIT_REFERENCE_REQUIRED` | CREDIT_NOTE without `creditReferenceId` |
| `CASH_CHANGE_NOT_ALLOWED` | Cash tendered > applied, change disabled |
| `METHOD_OVERPAYMENT_NOT_ALLOWED` | Non-cash amount > due, overpayment disabled |
| `OVERPAYMENT_RESOLUTION_REQUIRED` | Unresolved excess, no resolution payload |
| `OVERPAYMENT_RESOLUTION_MISMATCH` | Line sum ≠ excess or preview amount mismatch |
| `OVERPAYMENT_RESOLUTION_NOT_ALLOWED` | Resolution code blocked for context |
| `RECEIPT_ALLOCATION_EXCESS_UNRESOLVED` | Allocation preview not fully allocated |
| `RETURN_CHANGE_EXCEEDS_CAPACITY` | Change resolution exceeds cash capacity |
| `RETURN_CHANGE_LEG_INVALID` | Invalid change leg reference |
| `B2B_CREDIT_HOLD` / `B2B_CREDIT_EXCEEDED` | B2B credit limits |
| `SPLIT_AMOUNT_MISMATCH` | Leg sum ≠ amount to charge |
| `DEFERRED_LEG_NOT_ALONE` | Deferred method combined with other legs |
| `GATEWAY_NOT_CONFIGURED` | Gateway leg without tenant gateway config |

**UI i18n:** `newOrder.payment.errors.*`, `newOrder.payment.extraReceipt.allocation.*`, `customers.accountReceipt.*`

---

## Test execution log

Copy per test run:

| # | Scenario | Tester | Date | Pass/Fail | Notes / order_id |
|---|----------|--------|------|-----------|------------------|
| 1 | Cash exact | | | | |
| 2 | Cash change allowed | | | | |
| … | | | | | |
| 28 | Account receipt | | | | |
| 35 | RBAC | | | | |
| 41 | Cash+card→wallet | | | | |

---

**Document maintenance:** Update this guide when new resolution codes, API routes, or UI entry points ship. Pay-extra (ADR-050) tracked in [PAY_EXTRA_OVERPAYMENT_PROGRESS.md](../Order_Fin/PAY_EXTRA_OVERPAYMENT_PROGRESS.md). Pending items (HQ flags, gateway integration) are tracked in [Pending_Payment_Settlement_Follow_Ups.md](../Order_Fin/Pending_Payment_Settlement_Follow_Ups.md).
