# BVM Developer Guide

**Last updated:** 2026-05-20
**Build state:** ✅ green | `check:i18n` ✅ green | Tests: 53/53 passing

---

## Table of Contents

1. [Database Schema](#1-database-schema)
2. [Permissions](#2-permissions)
3. [Navigation](#3-navigation)
4. [Constants & Types](#4-constants--types)
5. [Services](#5-services)
6. [Server Actions](#6-server-actions)
7. [API Routes](#7-api-routes)
8. [Feature Module Structure](#8-feature-module-structure)
9. [UI Pages](#9-ui-pages)
10. [i18n Keys](#10-i18n-keys)
11. [Tests](#11-tests)
12. [Known Gaps & Follow-ups](#12-known-gaps--follow-ups)

---

## 1. Database Schema

### Migrations Applied

| Migration | File | Description |
|---|---|---|
| 0300 | `0300_extend_fin_vouchers_mst.sql` | Added BVM columns to `org_fin_vouchers_mst` (voucher_status, posting_status, direction, party fields, amount fields, idempotency_key, etc.) |
| 0301 | `0301_org_fin_vch_trx_lines_dtl.sql` | Created `org_fin_voucher_trx_lines_dtl` (transaction lines table with RLS) |
| 0302 | `0302_voucher_code_tables.sql` | Sys lookup tables: `sys_fin_vch_type_cd`, `sys_fin_vch_line_type_cd`, `sys_fin_vch_line_role_cd`, `sys_fin_vch_target_type_cd`, `sys_fin_vch_direction_cd`. Expense category tables: `sys_fin_exp_cat_cd`, `org_fin_exp_cat_cf` |
| 0303 | `0303_operational_vch_links.sql` | Added `fin_voucher_id` + `fin_voucher_trx_line_id` back-link columns to 6 operational tables |
| 0304 | `0304_voucher_permissions_seed.sql` | Seeded 18 BVM permissions + role mapping |
| 0305 | `0305_finance_vouchers_nav.sql` | Navigation entries for BVM under internal_fin |
| 0306 | `0306_internal_fin_route_paths.sql` | Route path updates for internal_fin section |
| 0307 | `0307_finalize_voucher_type_column.sql` | Finalized `voucher_type` column: backfilled old values, dropped old column, renamed bridge column |

### Key Tables

**`org_fin_vouchers_mst`** — voucher header (tenant-scoped, RLS)

Key columns added in 0300:
- `voucher_type` TEXT — `RECEIPT_VOUCHER | PAYMENT_VOUCHER | REFUND_VOUCHER | ADJUSTMENT_VOUCHER | TRANSFER_VOUCHER`
- `voucher_status` TEXT NOT NULL DEFAULT `'DRAFT'` — business lifecycle axis
- `posting_status` TEXT NOT NULL DEFAULT `'NOT_POSTED'` — GL accounting axis (managed by future GL service)
- `direction` TEXT — `IN | OUT | NEUTRAL`
- `party_type` TEXT — `CUSTOMER | SUPPLIER | EMPLOYEE | OTHER`
- `total_amount`, `paid_amount`, `outstanding_amount`, `subtotal_amount`, `discount_amount`, `tax_amount`, `fee_amount`, `refunded_amount` — all `DECIMAL(19,4)`
- `idempotency_key` TEXT with sparse unique index per tenant

**`org_fin_voucher_trx_lines_dtl`** — transaction lines (tenant-scoped, RLS)

Key columns:
- `voucher_id` UUID FK → `org_fin_vouchers_mst`
- `line_no` INTEGER — sequential per voucher
- `line_type` TEXT — `RECEIPT | PAYMENT | REFUND | EXPENSE | ADVANCE | TRANSFER | ADJUSTMENT | FEE | ROUNDING`
- `line_role` TEXT — 19 values (see constants)
- `target_type` TEXT — `ORDER | INVOICE | CUSTOMER | WALLET | GIFT_CARD | ...`
- `line_status` TEXT DEFAULT `'DRAFT'` — `DRAFT | POSTED | REVERSED | CANCELLED`
- `wiring_status` TEXT DEFAULT `'NOT_WIRED'` — populated by future wiring service
- `payment_method_code` TEXT — `CASH | CARD | BANK_TRANSFER | CHECK | GATEWAY | ...`
- `tendered_amount`, `change_returned_amount` — cash payment fields
- `bank_reference`, `check_number`, `check_bank`, `check_date` — payment method refs
- `order_payment_id`, `cash_drawer_mvt_id` — back-link fields (populated by future wiring service)
- All amount fields: `DECIMAL(19,4)`. All string fields: `TEXT` (not VARCHAR)

**Operational back-link columns** (added by 0303, all nullable):
- `org_order_payments_dtl.fin_voucher_id` + `fin_voucher_trx_line_id`
- `org_cash_drawer_movements_dtl.fin_voucher_id` + `fin_voucher_trx_line_id`
- `org_wallet_txn_dtl.fin_voucher_id` + `fin_voucher_trx_line_id`
- `org_advance_txn_dtl.fin_voucher_id` + `fin_voucher_trx_line_id`
- `org_gift_card_txn_dtl.fin_voucher_id` + `fin_voucher_trx_line_id`
- `org_credit_note_txn_dtl.fin_voucher_id` + `fin_voucher_trx_line_id` (conditional)

**Sys lookup tables** (global, no RLS):
- `sys_fin_vch_type_cd` — 5 voucher types
- `sys_fin_vch_line_type_cd` — 9 line types
- `sys_fin_vch_line_role_cd` — 19 line roles
- `sys_fin_vch_target_type_cd` — 13 target types
- `sys_fin_vch_direction_cd` — 3 direction codes
- `sys_fin_exp_cat_cd` — 8 global expense category templates

**`org_fin_exp_cat_cf`** — tenant-level expense category config (RLS)

---

## 2. Permissions

All 18 BVM permission codes seeded in migration 0304:

| Permission Code | cashier | operator | branch_manager | admin | tenant_admin | super_admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `fin_vouchers:view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `fin_vouchers:print` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `fin_vouchers:create` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `fin_vouchers:post` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `fin_voucher_lines:create` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `fin_vouchers:update` | | | ✓ | ✓ | ✓ | ✓ |
| `fin_vouchers:cancel` | | | ✓ | ✓ | ✓ | ✓ |
| `fin_voucher_lines:update` | | | ✓ | ✓ | ✓ | ✓ |
| `fin_voucher_lines:delete_draft` | | | ✓ | ✓ | ✓ | ✓ |
| `fin_expenses:create` | | | ✓ | ✓ | ✓ | ✓ |
| `fin_refunds:create` | | | ✓ | ✓ | ✓ | ✓ |
| `fin_vouchers:reverse` | | | | ✓ | ✓ | ✓ |
| `fin_vouchers:delete_draft` | | | | ✓ | ✓ | ✓ |
| `fin_vouchers:export` | | | | ✓ | ✓ | ✓ |
| `fin_vouchers:reports` | | | | ✓ | ✓ | ✓ |
| `fin_voucher_lines:reverse` | | | | ✓ | ✓ | ✓ |
| `fin_expenses:approve` | | | | ✓ | ✓ | ✓ |
| `fin_refunds:approve` | | | | ✓ | ✓ | ✓ |

> Permission codes follow `resource:action` pattern matching `^[a-z0-9_]+:[a-z0-9_]+$`.
> `cashier` has `create` + `post` but is **further restricted** at the service layer by voucher type and line role.

---

## 3. Navigation

**Navigation section:** Internal Finance (`internal_fin`) — parent section containing all finance nav items.

| Nav Key | Label | Label2 | Path | Permission |
|---|---|---|---|---|
| `internal_fin` | Internal Finance And Operations | المالية الداخلية والتشغيل | `/dashboard/internal_fin` | — |
| `finance_vouchers` | Business Vouchers | السندات التجارية | `/dashboard/internal_fin/vouchers` | `fin_vouchers:view` |
| `finance_vouchers_new` | New Voucher | سند جديد | `/dashboard/internal_fin/vouchers/new` | `fin_vouchers:create` |
| `finance_vouchers_reports` | Voucher Reports | تقارير السندات | `/dashboard/internal_fin/vouchers/reports` | `fin_vouchers:reports` |

**Files updated (dual-write):**
- `web-admin/config/navigation.ts` — frontend sidebar
- `supabase/migrations/0305_finance_vouchers_nav.sql` — `sys_components_cd` DB entries
- `web-admin/src/ui/navigation/cmx-sidebar.tsx` — `NAV_TRANSLATION_KEY_MAP` (added `internal_fin`, `finance_vouchers`, `finance_vouchers_new`, `finance_vouchers_reports`)

---

## 4. Constants & Types

### `web-admin/lib/constants/voucher.ts`

Key exports:
```typescript
VOUCHER_TYPE          // RECEIPT_VOUCHER | PAYMENT_VOUCHER | REFUND_VOUCHER | ADJUSTMENT_VOUCHER | TRANSFER_VOUCHER
VOUCHER_STATUS        // DRAFT | POSTED | CANCELLED | REVERSED | PARTIALLY_REVERSED
GL_POSTING_STATUS     // NOT_POSTED | POSTED | POSTING_FAILED
VOUCHER_DIRECTION     // IN | OUT | NEUTRAL
LINE_TYPE             // RECEIPT | PAYMENT | REFUND | EXPENSE | ADVANCE | TRANSFER | ADJUSTMENT | FEE | ROUNDING
LINE_ROLE             // 19 values (ORDER_PAYMENT, EXPENSE_PAYMENT, CUSTOMER_REFUND, ...)
TARGET_TYPE           // 13 values (ORDER, INVOICE, CUSTOMER, WALLET, EXPENSE, ...)
WIRING_STATUS         // NOT_WIRED | WIRED | PARTIALLY_WIRED | FAILED | REVERSED
LINE_ROLE_REQUIREMENTS // validation map: line_role → {targetTypes, requiredFields}
CASHIER_ALLOWED_VOUCHER_TYPES  // [RECEIPT_VOUCHER]
CASHIER_ALLOWED_LINE_ROLES     // [ORDER_PAYMENT, CUSTOMER_ADVANCE_RECEIPT, WALLET_TOPUP, GIFT_CARD_SALE, CUSTOMER_CREDIT_RECEIPT]
```

All values mirror DB CHECK constraint values exactly — same case, same separators.

### `web-admin/lib/types/voucher.ts`

Key types:
```typescript
CreateBizVoucherInput, UpdateBizVoucherInput
CreateVoucherLineInput, UpdateVoucherLineInput
PostVoucherInput, ReverseVoucherInput
VoucherLineData, BizVoucherDetailData
VoucherListFilters, VoucherListItem
VoucherStatus, VoucherType, LineRole, LineType, GlPostingStatus
```

---

## 5. Services

All in `web-admin/lib/services/`. Pure functions, no class instances.

| File | Exports | Description |
|---|---|---|
| `voucher-biz.service.ts` | `createBizVoucher`, `updateBizVoucher`, `getBizVoucherById`, `listBizVouchers`, `cancelBizVoucher` | Core CRUD + cancel |
| `voucher-line.service.ts` | `addVoucherLine`, `updateVoucherLine`, `deleteDraftVoucherLine`, `listVoucherLines` | Line CRUD |
| `voucher-number.service.ts` | `generateBizVoucherNo` | Advisory-lock serialized number generation. Format: `RV-2026-000001`. Prefixes: `RV`, `PV`, `RF`, `ADJ`, `TR` |
| `voucher-validation.service.ts` | `validateStatusTransition`, `assertVoucherIsMutable`, `validateRoleForVoucher`, `validateVoucherLine`, `validateVoucherForPosting` | Pure validation, no DB |
| `voucher-posting.service.ts` | `postBizVoucher` | Posting orchestrator: DRAFT→POSTED in a single Prisma transaction with idempotency, audit log, domain event |
| `voucher-reversal.service.ts` | `reverseBizVoucher`, `reverseVoucherLine` | Reversal: creates mirror voucher, sets REVERSED status, writes audit + outbox |

### Posting Transaction Steps (`postBizVoucher`)

1. Check `org_idempotency_keys` — return cached result if key exists
2. `SELECT ... FOR UPDATE` on voucher header (serialize concurrent posts)
3. Assert `voucher_status = 'DRAFT'` via `validateStatusTransition`
4. Load active DRAFT lines
5. `validateVoucherForPosting` — at least one active DRAFT line, header total matches sum
6. Recalculate `total_amount` from line sum
7. UPDATE voucher: `voucher_status='POSTED'`, `posted_at`, `posted_by` — **does NOT touch `posting_status`**
8. UPDATE all active DRAFT lines: `line_status='POSTED'` — `wiring_status` stays `NOT_WIRED`
9. Write `org_domain_events_outbox` row: `event_type='VOUCHER_POSTED'`
10. Write `org_fin_voucher_audit_log` row: `action='POSTED'`
11. Upsert `org_idempotency_keys` as resolved
12. COMMIT — full rollback on any failure

---

## 6. Server Actions

### `web-admin/app/actions/finance/voucher-actions.ts`
```
createBizVoucherAction(input)
updateBizVoucherAction(voucherId, input)
postBizVoucherAction(voucherId, idempotencyKey?)
cancelBizVoucherAction(voucherId, reason)
reverseBizVoucherAction(voucherId, reason)
getBizVoucherDetailAction(voucherId)
listBizVouchersAction(filters, page, pageSize)
```

### `web-admin/app/actions/finance/voucher-line-actions.ts`
```
addVoucherLineAction(voucherId, input)
updateVoucherLineAction(lineId, input)
deleteDraftVoucherLineAction(lineId)
reverseVoucherLineAction(lineId, reason)
listVoucherLinesAction(voucherId)
```

All actions: `getAuthContext → hasPermissionServer → Zod validate → service → revalidatePath → {success, data?, error?}`

---

## 7. API Routes

Base: `web-admin/app/api/v1/finance/vouchers/`

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/v1/finance/vouchers` | `fin_vouchers:view` | List vouchers with filters |
| POST | `/api/v1/finance/vouchers` | `fin_vouchers:create` | Create voucher |
| GET | `/api/v1/finance/vouchers/[voucherId]` | `fin_vouchers:view` | Get detail |
| PATCH | `/api/v1/finance/vouchers/[voucherId]` | `fin_vouchers:update` | Update draft |
| POST | `/api/v1/finance/vouchers/[voucherId]/post` | `fin_vouchers:post` | Post voucher |
| POST | `/api/v1/finance/vouchers/[voucherId]/cancel` | `fin_vouchers:cancel` | Cancel |
| POST | `/api/v1/finance/vouchers/[voucherId]/reverse` | `fin_vouchers:reverse` | Reverse |
| GET | `/api/v1/finance/vouchers/[voucherId]/lines` | `fin_vouchers:view` | List lines |
| POST | `/api/v1/finance/vouchers/[voucherId]/lines` | `fin_voucher_lines:create` | Add line |
| PATCH | `/api/v1/finance/vouchers/[voucherId]/lines/[lineId]` | `fin_voucher_lines:update` | Update line |
| DELETE | `/api/v1/finance/vouchers/[voucherId]/lines/[lineId]` | `fin_voucher_lines:delete_draft` | Delete draft line |
| POST | `/api/v1/finance/vouchers/[voucherId]/lines/[lineId]/reverse` | `fin_voucher_lines:reverse` | Reverse line |
| GET | `/api/v1/finance/vouchers/lookups/types` | `fin_vouchers:view` | Voucher types (filtered by role) |
| GET | `/api/v1/finance/vouchers/lookups/line-roles` | `fin_vouchers:view` | Line roles (filtered by role) |
| GET | `/api/v1/finance/vouchers/lookups/expense-categories` | `fin_vouchers:view` | Tenant expense categories |

---

## 8. Feature Module Structure

`web-admin/src/features/finance/vouchers/`

```
access/
  vouchers-access.ts          # client-side hasVoucherPermission(), getAllowedVoucherTypes(userRole)
model/
  voucher-header-schema.ts    # Zod schema for voucher header
  voucher-line-schema.ts      # Zod schema for voucher line (dynamic by line_role + payment_method)
ui/
  vouchers-table.tsx          # CmxDataTable with server pagination
  voucher-status-badge.tsx    # DRAFT/POSTED/CANCELLED/REVERSED chip
  voucher-direction-badge.tsx # IN/OUT/NEUTRAL badge
  voucher-line-table.tsx      # Lines within detail view
  voucher-cancel-dialog.tsx   # Reason input dialog
  voucher-reversal-dialog.tsx # Reason input dialog
```

---

## 9. UI Pages

`web-admin/app/dashboard/internal_fin/vouchers/`

| File | Type | Description |
|---|---|---|
| `page.tsx` | Server | List: `listBizVouchers` → `VouchersTable` |
| `loading.tsx` | — | Skeleton |
| `new/page.tsx` | Server | Fetch lookups filtered by role → `CreateVoucherForm` |
| `new/create-voucher-form.tsx` | Client | 3-step wizard: Header → Lines → Review & Post |
| `[voucherId]/page.tsx` | Server | `getBizVoucherDetail` → `VoucherDetailClient` |
| `[voucherId]/voucher-detail-client.tsx` | Client | Tabs: Summary / Lines / Audit |

**Create Voucher Wizard steps:**
1. **Header** — type (filtered by role), branch, date, party, currency, description
2. **Lines** — dynamic fields by `line_role`. Cash shows tendered + auto-calculated change. BANK_TRANSFER requires bank_reference. CHECK requires 3 check fields.
3. **Review** — summary + posting note: *"Posting finalizes this voucher. Operational wiring is processed separately."*

---

## 10. i18n Keys

Added to `web-admin/messages/en.json` and `ar.json` under `finance.vouchers.*`:

```
finance.vouchers.title / newVoucher / voucherNo / voucherType / direction / status / postingStatus
finance.vouchers.partyType / party / totalAmount / description / notes
finance.vouchers.lineNo / lineType / lineRole / targetType / paymentMethod / amount / tenderedAmount / changeReturned / expenseCategory
finance.vouchers.actions.{post / cancel / reverse / addLine / editLine / deleteLine / print / export}
finance.vouchers.statusLabels.{DRAFT / POSTED / CANCELLED / REVERSED / PARTIALLY_REVERSED}
finance.vouchers.directionLabels.{IN / OUT / NEUTRAL}
finance.vouchers.voucherTypeLabels.{RECEIPT_VOUCHER / PAYMENT_VOUCHER / REFUND_VOUCHER / ADJUSTMENT_VOUCHER / TRANSFER_VOUCHER}
finance.vouchers.postingNote
finance.vouchers.validation.{atLeastOneLine / totalMismatch / cashDrawerRequired / bankReferenceRequired / checkFieldsRequired / roleNotAllowed}
finance.vouchers.reports.{summary / receipts / payments / expenses / refunds}
```

Navigation keys added to `navigation.*`:
- `internalFinanceOps`, `businessVouchers`, `newVoucher`, `voucherReports`

---

## 11. Tests

| File | Tests | Covers |
|---|---|---|
| `__tests__/services/voucher-validation.test.ts` | 41 | Status transitions (9), mutability guard (4), role restrictions (10), line validation (12), posting pre-checks (6) |
| `__tests__/services/voucher-posting.test.ts` | 12 | Happy path, posting_status untouched, outbox/audit writes, idempotency (hit/miss/upsert), all rejection cases |

Run: `npx jest __tests__/services/voucher-validation.test.ts __tests__/services/voucher-posting.test.ts --no-coverage`

---

## 12. Known Gaps & Follow-ups

| Gap | Priority | Notes |
|---|---|---|
| `sys_fin_vch_type_cd` and `sys_fin_vch_line_role_cd` NOT in Prisma schema | Low | Lookup routes use raw SQL — acceptable until Prisma models needed for typed queries |
| Wiring service (Phase W1/W2) | Future | Populate `fin_voucher_id`/`fin_voucher_trx_line_id` back-links on operational tables. Lines have `wiring_status=NOT_WIRED` until then |
| GL posting service | Future | Reads `voucher_status='POSTED'` rows and manages `posting_status` independently |
| Voucher reports page | Partial UI | `/dashboard/internal_fin/vouchers/reports` page exists; report components to be expanded |
| Expense category UI in settings | Not started | `org_fin_exp_cat_cf` seeded for demo tenants; settings page for tenant customization not yet built |

---

## Infrastructure Reused (Not Created by BVM)

- `org_fin_voucher_audit_log` — migration 0100 (pre-existing)
- `org_domain_events_outbox` — migration 0292 (pre-existing)
- `org_idempotency_keys` — migration 0292 (pre-existing)
