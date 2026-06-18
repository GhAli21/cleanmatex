# HQ Platform — Financial Settlement `sys_*` Catalogs Implementation Guide

**Audience:** cleanmatexsaas implementer (you)  
**Date:** 2026-06-11  
**Status:** ✅ HQ implementation complete (2026-06-18) — Phases A–G done in cleanmatexsaas  
**Tenant consumer:** `cleanmatex` (web-admin) — constants in `web-admin/lib/constants/settlement-catalog.ts` and `voucher.ts`
**Notes:** the Implementation plan is C:\Users\JHNLP\.claude\plans\you-are-a-world-class-synthetic-octopus.md

---

## 1. Purpose

This guide lists **global `sys_*` catalog tables** that HQ should expose for view/edit in **cleanmatexsaas**. These tables are **shared** with the tenant app on the same Supabase database.

HQ responsibilities:

- Read/write catalog rows via **service role** (cross-tenant safe — tables have **no** `tenant_org_id`)
- Bilingual labels (`name` / `name2`)
- Activate/deactivate codes (`is_active`, `rec_status`)
- Adjust display order, permission gates, and behavioral flags

HQ does **not**:

- Create database migrations (owned by **cleanmatex** only)
- Edit `org_*` tenant tables from global catalog screens (separate tenant-maintenance flows)

**Cross-project contract:** [integration-contracts.md](../../dev/rules/integration-contracts.md)

---

## 2. Architecture pattern (cleanmatexsaas) this is just examples you follow exists project(cleanmatexsaas) standards and way :

this is just examples you follow exists project standards and way :
Better to Put then in the same location of payment settings e.g. for UI (/system-codes/payment-setup) , and follow same for APIs, services , Repository

Example of Reuse the existing **Catalog module** pattern:

| Layer | Reference in cleanmatexsaas |
|-------|-----------------------------|
| API | `platform-api/src/modules/catalog/catalog.controller.ts` |
| Repository | `platform-api/src/modules/catalog/catalog.repository.ts` |
| Web UI shell | `platform-web/src/features/catalog/ui/catalog-dashboard-screen.tsx` |
| Currency precedent | `docs/features/Currency_Setup/HQ_CURRENCY_CATALOG_IMPLEMENTATION_PLAN.md` |

**Access:** Supabase client with **service role** — no RLS on `sys_*` tables.

**Suggested API shape per catalog:**

```text
GET    /api/v1/platform/catalogs/fin-settlement/{catalogKey}
GET    /api/v1/platform/catalogs/fin-settlement/{catalogKey}/{code}
POST   /api/v1/platform/catalogs/fin-settlement/{catalogKey}
PATCH  /api/v1/platform/catalogs/fin-settlement/{catalogKey}/{code}
```

Use `active_only`, `search`, `sort_by`, `limit`, `offset` like existing `CatalogQueryDto`.

---

## 3. Catalog inventory

### 3.1 Settlement catalogs (migration `0357`) — **primary scope**

| Table | PK column | HQ screen group | Tenant TS mirror |
|-------|-----------|-----------------|------------------|
| `sys_fin_overpay_res_cd` | `resolution_code` | Overpayment resolutions | `OVERPAYMENT_RESOLUTIONS` |
| `sys_fin_vch_source_type_cd` | `source_type` | Voucher source types | `VOUCHER_SOURCE_TYPES` |
| `sys_fin_rcpt_alloc_mode_cd` | `allocation_mode` | Receipt allocation modes | `CUSTOMER_RECEIPT_ALLOCATION_MODES` |
| `sys_fin_rcpt_fb_dest_cd` | `fallback_destination` | Allocation fallbacks | `CUSTOMER_RECEIPT_FALLBACK_DESTINATIONS` |
| `sys_fin_rem_bal_policy_cd` | `policy_code` | Outstanding / remainder policies | `REMAINING_BALANCE_POLICIES` |

**Source migration:** `cleanmatex/supabase/migrations/0357_fin_settlement_catalogs_v1_1.sql`  
**Tech reference:** [tech_settlement_catalogs.md](./technical_docs/tech_settlement_catalogs.md)

### 3.2 BVM catalogs (migration `0302` + seeds in `0357`)

| Table | PK column | HQ screen group | Tenant TS mirror |
|-------|-----------|-----------------|------------------|
| `sys_fin_vch_type_cd` | `code` | BVM — voucher types | `voucher.ts` (types) |
| `sys_fin_vch_line_type_cd` | `code` | BVM — line types | — |
| `sys_fin_vch_line_role_cd` | `code` | BVM — line roles | `LINE_ROLE` |
| `sys_fin_vch_target_type_cd` | `code` | BVM — target types | `TARGET_TYPE` |
| `sys_fin_vch_direction_cd` | `code` | BVM — directions | `DIRECTION` |

**Critical:** New `line_role` or `target_type` codes require a **cleanmatex migration** to extend `org_fin_voucher_trx_lines_dtl` CHECK constraints (`chk_vch_trx_ln_role`, `chk_vch_trx_ln_target`). HQ UI should **block create** for these two tables unless coordinated with a tenant-app migration.

### 3.3 Payment config catalogs (migrations `0043`, `0267`, `0291`)

| Table | PK column | HQ screen group | Notes |
|-------|-----------|-----------------|-------|
| `sys_payment_method_cd` | `payment_method_code` | Payment methods | `payment_nature`, `method_category`, `is_deprecated` (0267) |
| `sys_payment_gateway_cd` | `code` | Payment gateways | Provider metadata; `is_online`, `gateway_type` |
| `sys_card_brand_cd` | `code` | Card brands | From 0267 |
| `sys_payment_status_cd` | `code` | Payment statuses | PENDING, COMPLETED, … |

**Canonical gateway model:** method = `PAYMENT_GATEWAY`, provider = `sys_payment_gateway_cd.code` — see [ADR-048](./ADR/ADR-048-Canonical-Payment-Gateway-Method-Model.md). Do **not** re-enable deprecated provider-as-method rows (`HYPERPAY`, `PAYTABS`, `STRIPE` as methods).

### 3.4 Feature flags (HQ-owned, not `sys_fin_*`)

Defined in cleanmatexsaas `sys_feature_flags_*`, consumed by cleanmatex via HQ API:

| Flag code | Purpose |
|-----------|---------|
| `customer_receipt_allocation_v1` | Gate allocation preview/post + account receipt |
| `overpayment_disposition_v1` | Gate disposition UI on submit/collect |

See [Pending_Payment_Settlement_Follow_Ups.md](./Pending_Payment_Settlement_Follow_Ups.md) §1.

---

## 4. Table details — settlement catalogs

### 4.1 `sys_fin_overpay_res_cd`

**Purpose:** Allowed ways to resolve checkout excess (overpayment).

| Column group | Fields | HQ editable |
|--------------|--------|-------------|
| Identity | `resolution_code` (PK, UPPER_SNAKE) | Create only with platform process |
| Labels | `name`, `name2`, `description`, `description2` | Yes |
| Method matrix | `allowed_for_cash`, `allowed_for_card`, `allowed_for_gateway`, `allowed_for_bank`, `allowed_for_check`, `allowed_for_mobile`, `allowed_for_stored_value` | Yes |
| Behavior flags | `creates_change_return`, `creates_payment_reduction`, `creates_void_or_refund`, `creates_customer_advance`, `creates_customer_credit`, `restores_stored_value`, `creates_multi_target_allocation`, `uses_allocation_policy`, `requires_allocation_details` | Yes — **test in tenant app after change** |
| RBAC | `requires_permission`, `permission_code` | Yes — code must exist in `sys_auth_permissions_cd` |
| Workflow | `requires_reason`, `requires_approval` | Yes |
| Meta | `display_order`, `is_system`, `is_active`, `metadata` | Yes (soft-delete via `is_active`) |

**Seeded codes (do not delete):**

`REDUCE_PAYMENT`, `RETURN_CASH_CHANGE`, `VOID_OR_REFUND_EXCESS`, `SAVE_AS_CUSTOMER_ADVANCE`, `SAVE_AS_CUSTOMER_CREDIT`, `RESTORE_STORED_VALUE`, `ALLOCATE_TO_CUSTOMER_BALANCES`, `AUTO_ALLOCATE_TO_CUSTOMER_BALANCES`

**Vocabulary:** `RETURN_CASH_CHANGE` (resolution) ≠ `RETURN_CHANGE` (allocation fallback in `sys_fin_rcpt_fb_dest_cd`).

---

### 4.2 `sys_fin_rcpt_alloc_mode_cd`

**Purpose:** Auto-allocation algorithm for customer receipt excess.

| Column | Notes |
|--------|-------|
| `allocation_mode` | PK: `AUTO_OLDEST_DUE`, `AUTO_OLDEST_DOCUMENT`, `AUTO_PRIORITY_THEN_OLDEST`, `MANUAL_ONLY` |
| `sort_by_due_date`, `sort_by_document_date`, `uses_target_priority`, `is_manual_only` | Algorithm switches |
| FK consumers | `org_fin_rcpt_alloc_policy_cf.allocation_mode` |

---

### 4.3 `sys_fin_rcpt_fb_dest_cd`

**Purpose:** Where leftover excess goes after allocation targets are exhausted.

| Column | Notes |
|--------|-------|
| `fallback_destination` | PK |
| `line_role`, `target_type` | Optional BVM mapping for wallet/advance/credit fallbacks |
| `creates_wallet_topup`, `creates_customer_advance`, `creates_customer_credit`, `creates_cash_change`, `blocks_posting`, `requires_cash` | Behavior |
| FK consumers | `org_fin_rcpt_alloc_policy_cf.fallback_destination` |

**Seeded:** `CUSTOMER_ADVANCE`, `WALLET_TOPUP`, `CUSTOMER_CREDIT`, `RETURN_CHANGE`, `BLOCK_AND_REQUIRE_MANUAL_ACTION`

---

### 4.4 `sys_fin_rem_bal_policy_cd`

**Purpose:** How unpaid order remainder is handled (full pay, POC, AR, B2B).

| Column | Notes |
|--------|-------|
| `policy_code` | PK: `FULL_PAYMENT`, `PAY_ON_COLLECTION`, `CREDIT_INVOICE`, `B2B_STATEMENT` |
| `requires_zero_remaining`, `creates_pay_on_collection_due`, `creates_ar_invoice`, … | Behavior matrix |
| `resulting_payment_status` | Must mirror DB order status strings exactly |

---

### 4.5 `sys_fin_vch_source_type_cd`

**Purpose:** Classifies **where a voucher originated** (modal, account receipt, gateway callback, …).

| Column | Notes |
|--------|-------|
| `source_type` | PK |
| `source_family` | CHECK: `ORDER`, `CUSTOMER_ACCOUNT`, `AR`, `B2B_STATEMENT`, `WALLET`, `GIFT_CARD`, `ADVANCE`, `REFUND`, `GATEWAY`, `MANUAL`, `OTHER` |
| `originates_from_*` | Boolean family flags |
| `is_manual` | Manual voucher entry |

---

## 5. BVM line role / target — CHECK manifest

If HQ adds a row to `sys_fin_vch_line_role_cd` or `sys_fin_vch_target_type_cd`, tenant app **must** add the same string to PostgreSQL CHECK on `org_fin_voucher_trx_lines_dtl`.

**Current allowed `line_role` values** (after `0357`):

```text
ORDER_PAYMENT, INVOICE_PAYMENT, WALLET_TOPUP, GIFT_CARD_SALE,
CUSTOMER_CREDIT_RECEIPT, CUSTOMER_CREDIT_ISSUE, CUSTOMER_ADVANCE_RECEIPT,
SUPPLIER_PAYMENT, EXPENSE_PAYMENT, SHOP_RENT_PAYMENT, UTILITY_PAYMENT,
EMPLOYEE_ADVANCE_PAYMENT, PETTY_CASH_ISSUE, CUSTOMER_REFUND, ORDER_REFUND,
INVOICE_REFUND, PETTY_CASH_RETURN, WALLET_REFUND, GIFT_CARD_REFUND,
INTERNAL_TRANSFER, ORDER_CREDIT_APPLICATION, STATEMENT_PAYMENT,
STATEMENT_CREDIT_APPLICATION
```

**Current allowed `target_type` values:**

```text
ORDER, INVOICE, CUSTOMER, SUPPLIER, EMPLOYEE, WALLET, GIFT_CARD, CREDIT_NOTE,
EXPENSE, BANK_ACCOUNT, CASH_DRAWER, PETTY_CASH, OTHER, B2B_STATEMENT
```

**HQ UI rule:** For these two tables, prefer **edit existing** / **deactivate** over **create new code** unless a cleanmatex migration is scheduled.

---

## 6. Payment method & gateway catalogs

### `sys_payment_method_cd`

Key columns for HQ forms:

| Column | Values / notes |
|--------|----------------|
| `payment_method_code` | PK, UPPER_SNAKE |
| `payment_nature` | `REAL_PAYMENT`, `CREDIT_APPLICATION`, `AR_ALLOCATION`, `DEFERRED_SETTLEMENT`, `PROVIDER`, `INTERNAL_ADJUSTMENT` |
| `method_category` | `CASH`, `CARD`, `GATEWAY`, … |
| `is_deprecated` | If true, tenant checkout should hide |
| `replacement_code` | e.g. `sys_payment_gateway_cd.HYPERPAY` |
| `gateway_code` | Legacy provider link on deprecated rows only |

### `sys_payment_gateway_cd`

| Column | HQ use |
|--------|--------|
| `code` | `HYPERPAY`, `PAYTABS`, `STRIPE`, `MANUAL` |
| `gateway_type` | Provider slug |
| `is_online` | `false` for `MANUAL` — not an online checkout provider |
| `supported_currencies`, `supported_payment_methods` | Arrays |
| `is_system` | Protect core providers from delete |

Tenant credentials stay in `org_payment_methods_cf.gateway_config` (tenant app) — **not** in this table.

---

## 7. What stays in tenant app (not HQ global catalog CRUD)

| Table | Scope | Managed in |
|-------|-------|------------|
| `org_fin_rcpt_alloc_policy_cf` | Per-tenant/branch allocation policy | cleanmatex tenant settings (future) or seed |
| `org_payment_methods_cf` | Tenant enablement + `gateway_config` secrets | cleanmatex web-admin |
| `org_fin_overpay_disp_dtl` | Transaction audit | System only |
| `org_fin_rcpt_alloc_preview_tr` | Runtime previews | System only |

**Optional HQ phase 2:** Tenant policy **templates** that copy into `org_fin_rcpt_alloc_policy_cf` on tenant onboarding (read `0357` seed block for `DEFAULT_OLDEST_DUE`).

---

## 8. Suggested HQ navigation

```text
Platform Admin
└── Financial Catalogs
    ├── Overpayment Resolutions      → sys_fin_overpay_res_cd
    ├── Receipt Allocation
    │   ├── Allocation Modes         → sys_fin_rcpt_alloc_mode_cd
    │   └── Fallback Destinations    → sys_fin_rcpt_fb_dest_cd
    ├── Outstanding Policies         → sys_fin_rem_bal_policy_cd
    ├── Voucher Source Types         → sys_fin_vch_source_type_cd
    ├── BVM Line Roles               → sys_fin_vch_line_role_cd  ⚠ CHECK coordination
    ├── BVM Target Types             → sys_fin_vch_target_type_cd ⚠ CHECK coordination
    ├── BVM (types, directions)      → sys_fin_vch_type_cd, line_type, direction
    └── Payment Config
        ├── Payment Methods          → sys_payment_method_cd
        ├── Payment Gateways         → sys_payment_gateway_cd
        └── Card Brands              → sys_card_brand_cd
```

**Permissions (HQ):** e.g. `platform:catalogs:fin_settlement:read`, `platform:catalogs:fin_settlement:write` — seed in cleanmatexsaas permissions table (not cleanmatex migration unless shared `sys_auth_permissions_cd` is extended from tenant migrations).

---

## 9. Validation rules (HQ forms)

1. **PK codes:** `UPPER_SNAKE_CASE` for fin settlement; payment methods match existing tenant constants.
2. **Bilingual:** `name` (EN) and `name2` (AR) required on create.
3. **DB-mirror:** If tenant app has a TypeScript constant for the code, strings must match **exactly** (case, separators).
4. **`permission_code`:** Must exist in `sys_auth_permissions_cd` before `requires_permission = true`.
5. **`is_system = true`:** Disable delete in UI; allow deactivate only.
6. **FK integrity:** Cannot deactivate `allocation_mode` or `fallback_destination` if referenced by active `org_fin_rcpt_alloc_policy_cf` rows (RESTRICT).
7. **Line role / target create:** Show warning + link to cleanmatex migration workflow.

---

## 10. Implementation checklist (cleanmatexsaas)

### Phase A — Read-only catalog browser

- [ ] Register five settlement tables + BVM tables in catalog repository
- [ ] List + detail API with search/sort/pagination
- [ ] Read-only HQ screens with EN/AR columns
- [ ] Regenerate types after cleanmatex migrations (`prisma` / Supabase types)

### Phase B — Edit global rows

- [ ] PATCH for labels, flags, `display_order`, `is_active`
- [ ] Audit `updated_at` / `updated_by` on write
- [ ] Block PK change on update
- [ ] Confirm dialog for `is_active = false` on FK-referenced codes

### Phase C — Payment config screens

- [ ] `sys_payment_method_cd` + `sys_payment_gateway_cd` CRUD (respect deprecated/provider rules)
- [ ] Visual indicator for deprecated provider-as-method rows

### Phase D — Feature flags

- [ ] Seed `customer_receipt_allocation_v1`, `overpayment_disposition_v1`
- [ ] Document HQ API contract for cleanmatex consumption

### Phase E — Tenant policy templates (optional)

- [ ] Template JSON → push to `org_fin_rcpt_alloc_policy_cf` via tenant-maintenance service

---

## 11. Verification after HQ changes

Run in **local/shared DB** (read-only ok):

```sql
-- Row counts per settlement catalog
SELECT 'overpay' AS cat, COUNT(*) FROM sys_fin_overpay_res_cd WHERE is_active
UNION ALL SELECT 'alloc_mode', COUNT(*) FROM sys_fin_rcpt_alloc_mode_cd WHERE is_active
UNION ALL SELECT 'fb_dest', COUNT(*) FROM sys_fin_rcpt_fb_dest_cd WHERE is_active
UNION ALL SELECT 'rem_bal', COUNT(*) FROM sys_fin_rem_bal_policy_cd WHERE is_active
UNION ALL SELECT 'vch_source', COUNT(*) FROM sys_fin_vch_source_type_cd WHERE is_active;
```

**Tenant app smoke tests** (cleanmatex):

- `npm test -- settlement-catalog`
- `npm test -- overpayment-resolution-validator`
- Manual: [test_guide.md](../Order_Payment_Model/test_guide.md) scenarios 16–27

---

## 12. Related documents

| Doc | Location |
|-----|----------|
| Settlement program (complete) | [Payment_Settlement_And_Receipt_Allocation_IMPLEMENTATION_PLAN.md](./Payment_Settlement_And_Receipt_Allocation_IMPLEMENTATION_PLAN.md) |
| Post-plan backlog | [Pending_Payment_Settlement_Follow_Ups.md](./Pending_Payment_Settlement_Follow_Ups.md) |
| Tenant tech — catalogs | [tech_settlement_catalogs.md](./technical_docs/tech_settlement_catalogs.md) |
| Payment config client guide | [CleanMateX_V1_Payment_Config_Client_Level_Implementation_Guide.md](../Payment_Config_Setup/CleanMateX_V1_Payment_Config_Client_Level_Implementation_Guide.md) |
| Integration contracts | [integration-contracts.md](../../dev/rules/integration-contracts.md) |
| Currency HQ precedent | `cleanmatexsaas/docs/features/Currency_Setup/HQ_CURRENCY_CATALOG_IMPLEMENTATION_PLAN.md` |

---

## 13. Repo sync

| Repo | Path |
|------|------|
| **cleanmatex** (this file) | `docs/features/Order_Fin/HQ_Fin_Settlement_Sys_Catalogs_Implementation_Guide.md` |
| **cleanmatexsaas** (mirror) | `docs/features/Order_Fin/HQ_Fin_Settlement_Sys_Catalogs_Implementation_Guide.md` |

Migrations stay in **cleanmatex** only. Keep both doc copies in sync when catalog tables change.
