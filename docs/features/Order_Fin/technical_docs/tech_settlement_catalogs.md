# Settlement Catalogs — Technical Reference

**Status:** Production (Approved_By_Jh, 2026-06-11)  
**Migration:** `0357_fin_settlement_catalogs_v1_1.sql` (+ audit `0354`, cleanup `0360`)  
**TypeScript:** `web-admin/lib/constants/settlement-catalog.ts`  
**Related:** [tech_customer_receipt_allocation.md](./tech_customer_receipt_allocation.md) · [ADR-047](../ADR/ADR-047-Overpayment-Disposition.md)

---

## Overview

Settlement catalogs define **how checkout excess is resolved** (overpayment disposition) and **how unallocated customer receipts are allocated** across open balances. Constants in `settlement-catalog.ts` mirror DB catalog tables exactly (DB-mirror rule).

---

## Database tables (`0357`)

| Table | Purpose |
|-------|---------|
| `sys_fin_overpay_res_cd` | Overpayment resolution codes (`RETURN_CASH_CHANGE`, `SAVE_AS_CUSTOMER_ADVANCE`, …) |
| `sys_fin_vch_source_type_cd` | Voucher origin (`ORDER_PAYMENT_MODAL`, `CUSTOMER_RECEIPT`, `GATEWAY_CALLBACK`, …) |
| `sys_fin_rcpt_alloc_mode_cd` | Auto-allocation algorithm (`AUTO_OLDEST_DUE`, `MANUAL_ONLY`, …) |
| `sys_fin_rcpt_fb_dest_cd` | Fallback when allocation leaves remainder (`CUSTOMER_ADVANCE`, `RETURN_CHANGE`, …) |
| `sys_fin_rem_bal_policy_cd` | Remaining-balance policy codes (reference; order workflow uses existing constants) |
| `org_fin_rcpt_alloc_policy_cf` | Tenant/branch allocation policy (RLS) |
| `org_fin_rcpt_alloc_preview_tr` | Preview payload + idempotency before post (RLS) |

### Audit table (`0354` / aligned `0360`)

| Table | Purpose |
|-------|---------|
| `org_fin_overpay_disp_dtl` | Per-submit disposition audit (`resolution_code`, `voucher_trx_line_id`, amounts) |

Migration `0360` renamed legacy `org_order_overpay_disp_dtl` → `org_fin_overpay_disp_dtl` and `disposition_type` → `resolution_code` where environments had the older shape.

---

## Extended BVM catalogs (seed in `0357`)

Existing tables — **not duplicated**:

| Table | Additions |
|-------|-----------|
| `sys_fin_vch_line_role_cd` | `STATEMENT_PAYMENT`, `STATEMENT_CREDIT_APPLICATION`, `CUSTOMER_CREDIT_ISSUE` |
| `sys_fin_vch_target_type_cd` | `B2B_STATEMENT` |

`org_fin_voucher_trx_lines_dtl` CHECK constraints recreated with new role/target values (RESTRICT drop pattern).

---

## Vocabulary: do not confuse

| Code | Domain | Meaning |
|------|--------|---------|
| `RETURN_CASH_CHANGE` | **Overpayment resolution** (`sys_fin_overpay_res_cd`) | Cashier returns physical change on a cash leg |
| `RETURN_CHANGE` | **Allocation fallback** (`sys_fin_rcpt_fb_dest_cd`) | Leftover after auto-allocation routed as change — **not** the same as `RETURN_CASH_CHANGE` |
| `CUSTOMER_CREDIT_ISSUE` | **Line role** (canonical) | BVM line for issuing customer credit |
| `CUSTOMER_CREDIT_RECEIPT` | **Line role** (deprecated compat) | Normalized to `CUSTOMER_CREDIT_ISSUE` in `voucher.ts` |

Error codes `RETURN_CHANGE_EXCEEDS_CAPACITY` / `RETURN_CHANGE_LEG_INVALID` refer to **cash change capacity** on resolution legs, not the fallback destination code.

---

## TypeScript constants

| Export | DB source |
|--------|-----------|
| `OVERPAYMENT_RESOLUTIONS` | `sys_fin_overpay_res_cd.resolution_code` |
| `VOUCHER_SOURCE_TYPES` | `sys_fin_vch_source_type_cd.source_type` |
| `CUSTOMER_RECEIPT_ALLOCATION_MODES` | `sys_fin_rcpt_alloc_mode_cd.allocation_mode` |
| `CUSTOMER_RECEIPT_FALLBACK_DESTINATIONS` | `sys_fin_rcpt_fb_dest_cd.fallback_destination` |
| `OVERPAYMENT_RESOLUTION_PERMISSIONS` | `sys_auth_permissions_cd` (seeded in `0354`/`0357`) |

Phase groupings:

- `PHASE2_OVERPAYMENT_RESOLUTIONS` — reduce, cash change, advance, credit, restore stored value
- `PHASE4_ALLOCATION_RESOLUTIONS` — manual + auto allocate to customer balances

---

## Services using catalogs

| Service | Role |
|---------|------|
| `overpayment-resolution-validator.service.ts` | Blocks submit when excess unresolved |
| `overpayment-disposition.service.ts` | Executes advance/credit resolutions in submit TX |
| `customer-receipt-allocation-policy.service.ts` | Resolves effective tenant policy |
| `customer-receipt-allocation.service.ts` | Auto/manual allocation algorithms |
| `customer-receipt-excess-executor.service.ts` | Applies preview + disposition atomically |
| `order-submit-orchestrator.service.ts` | Orchestrates validator + executor |
| `settlement-overpayment.ts` | `unresolvedExcess` metrics (no silent retention) |

---

## Permissions (seeded)

| Code | Purpose |
|------|---------|
| `orders:overpayment_dispose` | Base excess handling |
| `orders:overpayment_allocate` | Manual/auto allocation |
| `orders:overpayment_to_wallet` | Wallet fallback |
| `orders:overpayment_to_advance` | Advance fallback |
| `orders:overpayment_to_credit` | Customer credit issue |
| `orders:overpayment_to_credit_note` | Credit note destination (gated) |
| `customers:receipt_allocate` | Standalone account receipt (`0358`) |

---

## Migrations (apply order)

1. `0357_fin_settlement_catalogs_v1_1.sql`
2. `0354_order_overpay_disposition.sql` (audit table; CHECK aligns with `0357` seeds)
3. `0358_permissions_customer_receipt_allocate.sql`
4. `0359_nav_customers_account_receipt.sql`
5. `0360_order_fin_phase6_legacy_cleanup.sql` (environments with legacy disp table name)

---

## Tests

- `web-admin/__tests__/constants/settlement-catalog.test.ts` — constant ↔ DB parity
- `overpayment-resolution-validator.service.test.ts`
- `build-overpayment-resolution.test.ts`

Manual: [test_guide.md](../../Order_Payment_Model/test_guide.md) scenarios 16–27.

---

## HQ catalog administration

Global `sys_*` rows are edited in **cleanmatexsaas** (service role). See [HQ_Fin_Settlement_Sys_Catalogs_Implementation_Guide.md](../HQ_Fin_Settlement_Sys_Catalogs_Implementation_Guide.md).

## Pending follow-ups

See [Pending_Payment_Settlement_Follow_Ups.md](../Pending_Payment_Settlement_Follow_Ups.md) (HQ flags, reconciliation, optional TS alias cleanup, gateway deferred).
