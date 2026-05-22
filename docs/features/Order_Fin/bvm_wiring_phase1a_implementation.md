# BVM Wiring Phase 1A — Feature Implementation Documentation

**Feature:** Business Voucher Module — Wiring Layer Phase 1A  
**Date:** 2026-05-22  
**Status:** Complete  
**PRD:** `docs/features/Order_Fin/CleanMateX_Business_Voucher_Wiring_PRD_v2_1_Ready_For_Implementation.md`

---

## Overview

Phase 1A implements the **wiring layer** that atomically connects posted voucher transaction lines to their operational effects in a single DB transaction. Before this feature, vouchers could be posted (DRAFT → POSTED) but lines remained `wiring_status = NOT_WIRED` — no payment rows, credit application rows, or cash drawer movements were created from BVM vouchers.

**What wiring does:**

| Line role | Direction | Operational table | Effect |
|---|---|---|---|
| `ORDER_PAYMENT` | IN | `org_order_payments_dtl` | Creates the payment record |
| `ORDER_CREDIT_APPLICATION` | — | `org_order_credit_apps_dtl` | Creates the credit application audit row |
| `ORDER_PAYMENT` + CASH + session | IN | `org_cash_drawer_movements_dtl` | Creates CASH_SALE movement in drawer |

---

## Permissions

### New Permission Codes

| Code | Display Name | Category | Roles Granted |
|---|---|---|---|
| `fin_vouchers:wire` | Wire Voucher Lines | actions | branch_manager, admin, tenant_admin, super_admin |
| `fin_vouchers:view_effects` | View Voucher Linked Effects | read | cashier, operator, branch_manager, admin, tenant_admin, super_admin |

**Migration:** `supabase/migrations/0319_bvm_wiring_phase1a_permissions.sql`

**Note:** `fin_vouchers:wire` is checked implicitly by the post action — the `fin_vouchers:post` permission gate remains the API entry point. Wiring is an internal service concern triggered automatically on posting.

---

## Navigation Tree

No new navigation entries. The existing vouchers page (`/dashboard/internal_fin/vouchers`) now shows:
- Wiring status column in the line table
- Post Preview dialog before posting
- Linked Effects panel after a voucher is posted

---

## Tenant Settings

No new tenant settings for Phase 1A.

---

## Feature Flags

No new feature flags. The wiring path is always active for vouchers created via the BVM UI.

---

## Plan Limits & Constraints

No per-plan restrictions. Available to all tenants with the `fin_vouchers:post` permission.

---

## i18n Keys

All keys added to `finance.vouchers.*` namespace in `web-admin/messages/en.json` and `web-admin/messages/ar.json`.

### New Keys

| Key path | EN | AR |
|---|---|---|
| `finance.vouchers.wiringStatus` | Wiring Status | حالة الربط |
| `finance.vouchers.wiringStatusLabels.NOT_WIRED` | Not Wired | غير مرتبط |
| `finance.vouchers.wiringStatusLabels.WIRED` | Wired | مرتبط |
| `finance.vouchers.wiringStatusLabels.PARTIALLY_WIRED` | Partially Wired | مرتبط جزئيًا |
| `finance.vouchers.wiringStatusLabels.FAILED` | Failed | فشل |
| `finance.vouchers.wiringStatusLabels.REVERSED` | Reversed | معكوس |
| `finance.vouchers.linkedEffects.title` | Linked Operational Effects | التأثيرات التشغيلية المرتبطة |
| `finance.vouchers.linkedEffects.orderPayments` | Order Payments | مدفوعات الطلبات |
| `finance.vouchers.linkedEffects.cashMovements` | Cash Drawer Movements | حركات الصندوق النقدي |
| `finance.vouchers.linkedEffects.creditApplications` | Credit Applications | تطبيقات الائتمان |
| `finance.vouchers.linkedEffects.noEffects` | No linked effects found. | لا توجد تأثيرات مرتبطة. |
| `finance.vouchers.postPreview.title` | Posting Preview | معاينة الترحيل |
| `finance.vouchers.postPreview.description` | The following operational effects will be created... | سيتم إنشاء التأثيرات التشغيلية التالية... |
| `finance.vouchers.postPreview.confirm` | Confirm & Post | تأكيد وترحيل |
| `finance.vouchers.postAndWireSuccess` | Voucher posted and wired successfully. | تم ترحيل السند وربطه بنجاح. |
| `finance.vouchers.creditApplicationType` | Credit Type | نوع الائتمان |
| `finance.vouchers.lineRoleLabels.ORDER_CREDIT_APPLICATION` | Order Credit Application | تطبيق ائتمان طلب |

---

## API Routes

### Modified

| Method | Path | Change |
|---|---|---|
| `POST` | `/api/v1/finance/vouchers/[voucherId]/post` | Now calls `postAndWireBizVoucher()` instead of `postBizVoucher()`. Response is a superset of previous (`PostAndWireResult` extends the old shape with `wiring: WiringResult`). Backward compatible. |

### New

| Method | Path | Permission | Description |
|---|---|---|---|
| `GET` | `/api/v1/finance/vouchers/[voucherId]/linked-effects` | `fin_vouchers:view_effects` | Returns all operational effects linked to a voucher (payments, cash movements, credit apps) |
| `GET` | `/api/v1/finance/voucher-lines/[lineId]/linked-effects` | `fin_vouchers:view_effects` | Returns operational effects for a single voucher line |

#### GET `/api/v1/finance/vouchers/[voucherId]/linked-effects`

**Response:**
```json
{
  "success": true,
  "data": {
    "voucherId": "uuid",
    "orderPayments": [
      {
        "id": "uuid",
        "order_id": "uuid",
        "amount": "150.0000",
        "payment_method_code": "CASH",
        "line_id": "uuid",
        "payment_status": "COMPLETED"
      }
    ],
    "cashDrawerMovements": [
      {
        "id": "uuid",
        "session_id": "uuid",
        "amount": "150.0000",
        "movement_type": "CASH_SALE",
        "line_id": "uuid"
      }
    ],
    "creditApplications": []
  }
}
```

#### GET `/api/v1/finance/voucher-lines/[lineId]/linked-effects`

**Response:**
```json
{
  "success": true,
  "data": {
    "lineId": "uuid",
    "wiring_status": "WIRED",
    "effects": [
      {
        "effectType": "ORDER_PAYMENT",
        "effectId": "uuid",
        "tableRef": "org_order_payments_dtl",
        "amount": "150.0000",
        "currency_code": "SAR"
      }
    ]
  }
}
```

---

## Database Migrations

### 0318_bvm_wiring_phase1a_schema.sql

**Status: Applied**

Changes:
1. `ALTER TABLE org_fin_voucher_trx_lines_dtl ADD COLUMN IF NOT EXISTS credit_application_type TEXT`
   — For ORDER_CREDIT_APPLICATION lines: WALLET, GIFT_CARD, CUSTOMER_ADVANCE, CREDIT_NOTE, LOYALTY_CREDIT

2. `ALTER TABLE org_order_credit_apps_dtl ADD COLUMN IF NOT EXISTS fin_voucher_id UUID`
3. `ALTER TABLE org_order_credit_apps_dtl ADD COLUMN IF NOT EXISTS fin_voucher_trx_line_id UUID`
4. `CREATE UNIQUE INDEX uq_credit_app_vch_line ON org_order_credit_apps_dtl (fin_voucher_trx_line_id) WHERE fin_voucher_trx_line_id IS NOT NULL`
5. `CREATE INDEX idx_credit_app_fin_voucher ON org_order_credit_apps_dtl (fin_voucher_id) WHERE fin_voucher_id IS NOT NULL`
6. `DROP CONSTRAINT chk_vch_trx_ln_role` + re-add with `ORDER_CREDIT_APPLICATION` included

### 0319_bvm_wiring_phase1a_permissions.sql

**Status: Applied**

Seeds `fin_vouchers:wire` and `fin_vouchers:view_effects` into `sys_auth_permissions` and grants to roles via `sys_auth_role_default_permissions`.

---

## Constants & Types

### Modified: `web-admin/lib/constants/voucher.ts`

- Added `ORDER_CREDIT_APPLICATION: 'ORDER_CREDIT_APPLICATION'` to `LINE_ROLE` object
- Added to `CASHIER_ALLOWED_LINE_ROLES`
- Added to `LINE_ROLE_REQUIREMENTS` with `targetTypes: [TARGET_TYPE.ORDER]` and `requiredFields: ['order_id']`

### New: `web-admin/lib/types/voucher-wiring.ts`

Types:
- `VoucherLineForWiring` — full line projection for wiring operations
- `WiringHandler` — handler contract interface
- `LinkedEffect` — single operational effect
- `WireLineResult` — result per wired line
- `WiringResult` — aggregate wiring outcome
- `PostAndWireResult` — combined post + wire result
- `LinkedEffectsResult` — all effects for a voucher
- `LineLinkedEffectResult` — effects for a single line

### Modified: `web-admin/lib/types/voucher.ts`

Added to `VoucherLineData`:
- `credit_application_type: string | null`
- `order_payment_id: string | null`
- `cash_drawer_mvt_id: string | null`
- `org_payment_method_id: string | null`
- `payment_terminal_id: string | null`
- `cash_drawer_session_id: string | null`
- `card_brand_code: string | null`
- `card_last4: string | null`
- `gateway_code: string | null`
- `gateway_reference: string | null`
- `bank_reference: string | null`
- `check_number: string | null`
- `branch_id: string | null`

Added to `CreateVoucherLineInput`:
- `credit_application_type?: string`
- `org_payment_method_id?: string`
- `payment_terminal_id?: string`

---

## UI Components

### New

| Component | Path | Purpose |
|---|---|---|
| `WiringStatusBadge` | `src/features/finance/vouchers/ui/wiring-status-badge.tsx` | Color-coded badge for WIRING_STATUS values |
| `VoucherLinkedEffectsPanel` | `src/features/finance/vouchers/ui/voucher-linked-effects-panel.tsx` | Three-section panel showing effects after posting |
| `VoucherPostPreviewDialog` | `src/features/finance/vouchers/ui/voucher-post-preview-dialog.tsx` | Preview dialog showing expected effects before posting |

### Modified

| Component | Change |
|---|---|
| `voucher-line-table.tsx` | Added `wiring_status` column with `WiringStatusBadge` |
| `voucher-detail-client.tsx` | Post button → opens preview dialog; effects panel shown after posting |
| `voucher-detail page.tsx` | Fetches `linkedEffects` server-side for POSTED vouchers |

---

## Server Actions

### Modified: `app/actions/finance/voucher-actions.ts`

- `postBizVoucherAction` — now calls `postAndWireBizVoucher()`, returns `PostAndWireResult`
- Added `getVoucherLinkedEffectsAction()` — permission-checked linked effects fetch

---

## Key Service Files

| File | Purpose |
|---|---|
| `lib/services/wiring/order-payment-wiring.handler.ts` | Wires ORDER_PAYMENT lines → org_order_payments_dtl |
| `lib/services/wiring/order-credit-application-wiring.handler.ts` | Wires ORDER_CREDIT_APPLICATION → org_order_credit_apps_dtl |
| `lib/services/wiring/cash-drawer-wiring.handler.ts` | Wires CASH ORDER_PAYMENT → org_cash_drawer_movements_dtl |
| `lib/services/voucher-wiring.service.ts` | Orchestrator: `postAndWireBizVoucher()`, `getVoucherLinkedEffects()`, `getLineLinkedEffect()` |
| `lib/services/order-settlement.service.ts` | **Modified** — `wiringMode?: boolean` guard prevents double-write when BVM wiring is active |

---

## Environment Variables

No new environment variables.

---

## Dependencies

No new npm packages.

---

## Monitoring & Logging

- Domain event `VOUCHER_POSTED_AND_WIRED` written to `org_domain_events_outbox` on each successful post+wire
- Audit log entry action `POSTED_AND_WIRED` written to `org_fin_voucher_audit_log` including wiring summary
- Handler errors bubble up and roll back the entire transaction — the voucher stays DRAFT with no partial state

---

## Testing Scenarios

### Happy Path

1. **CASH order payment:**
   - Create voucher with ORDER_PAYMENT/CASH line + cash_drawer_session_id
   - Post → verify `org_order_payments_dtl` row with `fin_voucher_trx_line_id` set
   - Verify `org_cash_drawer_movements_dtl` row with movement_type=CASH_SALE and `fin_voucher_trx_line_id` set
   - Both rows use `line.amount`, not tendered_amount

2. **CARD order payment:**
   - Create voucher with ORDER_PAYMENT/CARD line (no session)
   - Post → verify `org_order_payments_dtl` row with payment_status=COMPLETED
   - Verify NO `org_cash_drawer_movements_dtl` row

3. **ORDER_CREDIT_APPLICATION:**
   - Create voucher with ORDER_CREDIT_APPLICATION line + credit_application_type=WALLET
   - Post → verify `org_order_credit_apps_dtl` row with credit_type=WALLET
   - Verify NO `org_order_payments_dtl` row

### Idempotency

4. POST the post route twice with same idempotency_key → second returns `fromCache: true`, zero new DB rows

### Error Rollback

5. Mock cashDrawerWiringHandler.wire() to throw after orderPaymentWiringHandler succeeds
   → Verify: voucher stays DRAFT, no `org_order_payments_dtl` row exists (full rollback)

### Linked Effects API

6. After wiring, `GET /linked-effects` → all three arrays populated correctly

### Regression

7. `settleOrder()` without `wiringMode` still creates `org_order_payments_dtl` directly (existing behavior unchanged)
8. Order creation via `create-with-payment` end-to-end is unchanged

---

## Implementation Status

- [x] Schema migration (0318) — authored, pending apply
- [x] Permissions migration (0319) — authored, pending apply
- [x] LINE_ROLE.ORDER_CREDIT_APPLICATION constant
- [x] VoucherLineData + CreateVoucherLineInput type updates
- [x] `voucher-wiring.ts` types
- [x] `order-payment-wiring.handler.ts`
- [x] `order-credit-application-wiring.handler.ts`
- [x] `cash-drawer-wiring.handler.ts`
- [x] `voucher-wiring.service.ts` orchestrator
- [x] `order-settlement.service.ts` wiringMode guard
- [x] `post/route.ts` → `postAndWireBizVoucher`
- [x] `voucher-actions.ts` updates
- [x] Linked effects API routes
- [x] WiringStatusBadge component
- [x] VoucherLinkedEffectsPanel component
- [x] VoucherPostPreviewDialog component
- [x] VoucherLineTable wiring_status column
- [x] Voucher detail page + client updates
- [x] EN/AR i18n keys
- [x] Build passing clean (zero warnings)
- [x] current_status.md updated
- [x] BVM_WIRING_PHASE1A_GUIDE.md created
- [x] Migration 0318 applied
- [x] Migration 0319 applied
- [x] Prisma client regenerated after migrations
