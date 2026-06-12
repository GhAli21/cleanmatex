# Payment Settlement Catalogs + Customer Receipt Allocation — Implementation Plan

**Version:** 1.0  
**Date:** 2026-06-11  
**Status:** Approved_By_Jh — production implementation complete (2026-06-11)  
**Pending backlog:** [Pending_Payment_Settlement_Follow_Ups.md](./Pending_Payment_Settlement_Follow_Ups.md)  
**Technical docs:** [tech_settlement_catalogs.md](./technical_docs/tech_settlement_catalogs.md) · [tech_customer_receipt_allocation.md](./technical_docs/tech_customer_receipt_allocation.md)  
**Inputs:**
- [CleanMateX_Payment_Settlement_Catalogs_Upgrade_Reference_v1_1](./CleanMateX_Payment_Settlement_Catalogs_Upgrade_Reference_v1_1/README.md)
- [CleanMateX_Customer_Receipt_Auto_Allocation_Feature_Pack_v1_0](./CleanMateX_Customer_Receipt_Auto_Allocation_Feature_Pack_v1_0/README.md)
- [ADR-046](./ADR/ADR-046-Payment-Method-Overpayment-Policy.md), [ADR-047](./ADR/ADR-047-Overpayment-Disposition.md) (proposed)
- Current codebase + migrations (inspected 2026-06-11)

---

## Executive summary

Implement in **two layers**, in order:

1. **Foundation (Catalogs v1.1)** — additive DB migration(s), TypeScript constants, validation schemas. Extend existing BVM catalogs; do **not** duplicate `sys_fin_vch_*` with long-name tables from the reference SQL.
2. **Business feature (Customer Receipt Allocation v1.0)** — services, APIs, Payment Modal V4 UI, atomic posting via BVM voucher lines.

**North-star rule:** Every excess riyal/OMR must have an explicit destination before submit. `overpaid_amount` = **unresolved excess only** (zero after successful disposition/allocation).

---

## Cross-project scope

Per [integration-contracts.md](../../dev/rules/integration-contracts.md):

| Layer | cleanmatex (tenant app) | cleanmatexsaas (HQ) |
|-------|-------------------------|---------------------|
| **Migrations** | All `supabase/migrations/*` — sole source of truth | Read-only; regenerate types after tenant migrations |
| **sys_* catalogs** | Migrations + seeds created here | Optional HQ admin UI to view/edit global catalog rows (future) |
| **org_* policy** | `org_customer_receipt_allocation_policy_cf` CRUD in tenant settings | No direct DB writes |
| **Feature flags** | Consume via HQ API | Define `customer_receipt_allocation_v1`, `overpayment_disposition_v1` |
| **Tenant settings** | Consume via HQ API | Optional defaults template for new tenants |
| **UI** | Payment Modal V4, allocation drawers, customer open-balances | Policy template management (phase 2+) |
| **API** | `/api/v1/customers/...`, `/api/v1/customer-receipts/...` | None for v1 |

**Separate HQ plan (cleanmatexsaas):** feature-flag definitions, optional catalog admin screens, tenant onboarding seed for default allocation policy — **after** cleanmatex migrations are applied and reviewed.

---

## Current state vs reference packs (gap analysis)

> **Note:** This section is a **historical snapshot** from plan start (2026-06-11). Gaps below were closed in Phases 1–6. For current status see [Status tracker](#status-tracker) and [Pending follow-ups](./Pending_Payment_Settlement_Follow_Ups.md).

### What already exists (production)

| Area | Current artifact | Notes |
|------|------------------|-------|
| BVM line catalogs | `sys_fin_vch_line_type_cd`, `sys_fin_vch_line_role_cd`, `sys_fin_vch_target_type_cd`, `sys_fin_vch_direction_cd` | Migration `0302`; shortened names, not reference long names |
| Voucher lines | `org_fin_voucher_trx_lines_dtl` with `line_role`, `target_type`, `target_id` | CHECK constraints in `0301`, extended `0318`/`0324` |
| Order payments | `org_order_payments_dtl` | ORDER-only; `payment_target_type` **removed** in `0337` ✅ |
| Payment config | `org_payment_methods_cf` + branch overrides | ADR-046 flags live |
| Settlement | `order-settlement-planner`, `order-submit-orchestrator`, BVM wiring | Cash change, caps, terminal, credit note picker |
| Stored value | `stored-value.service.ts` | wallet, advance, credit note |
| AR | `org_invoice_mst`, `ar-invoice.service.ts` | B2B statement link on invoices |
| B2B statements | `org_b2b_statements_mst` | Exists; no STATEMENT_PAYMENT wiring yet |
| Overpayment audit | `org_fin_overpay_disp_dtl` (`0354`/`0360`) | ✅ Applied |

### What reference packs expect but is missing

| Reference item | Gap | Recommended action |
|----------------|-----|-------------------|
| `sys_overpayment_resolution_cd` | Table absent | **Create new** (full v1.1 schema) |
| `sys_fin_voucher_source_type_cd` | Table absent | **Create new** |
| `sys_customer_receipt_allocation_mode_cd` | Table absent | **Create new** |
| `sys_customer_receipt_fallback_destination_cd` | Table absent | **Create new** |
| `org_customer_receipt_allocation_policy_cf` | Table absent | **Create new** + tenant default seed |
| `org_customer_receipt_allocation_preview_tr` | Table absent | **Create new** (preview + idempotency) |
| `sys_fin_voucher_line_*_cd` (long names) | Duplicate of `sys_fin_vch_*` | **Do not create** — seed/extend existing |
| `STATEMENT_PAYMENT` line role | Not in CHECK | **Extend** `chk_vch_trx_ln_role` + catalog seed |
| `B2B_STATEMENT` target type | Not in CHECK | **Extend** `chk_vch_trx_ln_target` + catalog seed |
| `CUSTOMER_CREDIT_ISSUE` role | Production uses `CUSTOMER_CREDIT_RECEIPT` | **Map in plan** — use existing role unless product requires split |
| `AR_INVOICE` target | Production uses `INVOICE` | **Map at service layer** — document alias; no duplicate target code |
| Invoice payment wiring | No dedicated handler | **Add** `invoice-payment-wiring.handler.ts` |
| Statement payment wiring | None | **Add** `statement-payment-wiring.handler.ts` |
| Customer receipt allocation services | None | **New** service layer |
| Payment Modal allocation UI | None | **New** reusable components |

### Naming reconciliation (critical)

Reference pack codes → **production codes** (DB-mirror rule):

| Reference | Production constant | Notes |
|-----------|---------------------|-------|
| `RETURN_CASH_CHANGE` | Same | Replace ADR-047 `RETURN_CHANGE` → align to catalog |
| `AR_INVOICE` target | `INVOICE` | `target_id` = `org_invoice_mst.id` |
| `WALLET_TOPUP` target | `WALLET` | Line role stays `WALLET_TOPUP` |
| `CUSTOMER_ADVANCE` target | `CUSTOMER` | Line role `CUSTOMER_ADVANCE_RECEIPT` |
| `CUSTOMER_CREDIT` target | `CUSTOMER` | Line role `CUSTOMER_CREDIT_RECEIPT` |
| `TO_CREDIT_NOTE` disposition | `CREDIT_NOTE` target + credit note issue service | Legal/accounting gate per tenant |

**Action:** Update ADR-047 disposition types to reference `sys_overpayment_resolution_cd.resolution_code` — single vocabulary.

---

## Architecture (target)

```text
Payment Modal V4
  ├─ Order settlement legs (applied amounts)
  ├─ Extra Receipt / Unallocated Amount panel
  │    ├─ Reduce payment (REDUCE_PAYMENT)
  │    ├─ Return cash change (RETURN_CASH_CHANGE) — cash only
  │    ├─ Manual allocate (ALLOCATE_TO_CUSTOMER_BALANCES)
  │    └─ Auto allocate preview → confirm (AUTO_ALLOCATE_TO_CUSTOMER_BALANCES)
  └─ Submit (idempotencyKey + allocation previewId)

POST /api/v1/orders/submit-order
  └─ order-submit-orchestrator
       ├─ Recompute financials (authoritative saleTotal)
       ├─ validateSettlementPlan
       ├─ validateOverpaymentResolution (catalog-driven)
       ├─ customer-receipt-allocation.service (if excess > 0)
       └─ Single transaction:
            ├─ Order + items + current-order voucher lines
            ├─ Allocation voucher lines (multi-target)
            ├─ Wiring handlers (order / invoice / statement / wallet / advance / credit)
            ├─ Cash drawer (retained cash, change OUT)
            └─ Financial snapshot (overpaid_amount = unresolved only)

org_fin_voucher_trx_lines_dtl  ← generic targeting (NOT org_order_payments_dtl)
org_order_payments_dtl         ← ORDER_PAYMENT lines only
```

---

## Phase 0 — Discovery & ADR alignment (no code)

| # | Task | Owner | Output |
|---|------|-------|--------|
| 0.1 | Run inspection queries from catalog pack `04_MIGRATION_GENERATION_INSTRUCTIONS` against **local DB** (MCP read-only) | Dev | Gap report snapshot |
| 0.2 | Product sign-off: fallback default = `CUSTOMER_ADVANCE`; credit note vs customer credit rules | Product | ADR-048 addendum |
| 0.3 | Merge ADR-047 with catalog resolution codes; deprecate duplicate disposition type names | Dev | Update ADR-047 → Accepted |
| 0.4 | Decide fate of `0354_order_overpay_disp_dtl`: **Option A** keep as lightweight audit FK to voucher; **Option B** drop in favor of preview_tr + voucher lines only | Dev/Product | ADR note |
| 0.5 | **Update this plan status** → `Phase 0 complete` | Dev | Checkbox in plan |

**Recommendation:** Option A — keep `org_order_overpay_disp_dtl` but store `resolution_code` + `voucher_line_id`/`voucher_id`, not parallel business logic.

---

## Phase 1 — Catalogs / Foundation

**Migration:** `0357_fin_settlement_catalogs_v1_1.sql` (replace/merge with pending `0354` review order)

### 1.1 New sys_* tables (create if not exists)

| Table | Max name len | Content |
|-------|--------------|---------|
| `sys_overpayment_resolution_cd` | 30 ✅ | Full schema from reference `01_TARGET` §9 |
| `sys_fin_voucher_source_type_cd` | 30 ✅ | Reference §7 — **note:** name is exactly 30 chars |
| `sys_cust_rcpt_alloc_mode_cd` | 30 ✅ | **Rename** from reference if needed: `sys_customer_receipt_allocation_mode_cd` = 38 chars ❌ |
| `sys_cust_rcpt_fb_dest_cd` | 30 ✅ | **Rename** fallback destination catalog |
| `sys_remaining_balance_policy_cd` | 31 ❌ | Use `sys_rem_balance_policy_cd` (27) OR skip table and keep TS-only until needed |

> **Database skill:** All object names ≤ 30 chars. Reference pack long names must be **abbreviated** for new tables; document mapping in migration comments.

**Alternative (preferred for readability):** Keep descriptive table names only where ≤30 chars; for longer concepts use feature abbreviation per `.claude/skills/database/feature-abbreviations.md`:
- `sys_ord_fin_overpay_res_cd` (27)
- `sys_fin_vch_source_type_cd` (26) — aligns with existing `sys_fin_vch_*` prefix

### 1.2 Extend existing BVM catalogs (seed only, no duplicate tables)

Migration patches:

```text
INSERT INTO sys_fin_vch_line_role_cd ... ON CONFLICT
  + STATEMENT_PAYMENT (if missing)
  + STATEMENT_CREDIT_APPLICATION (if credit-on-statement needed)

INSERT INTO sys_fin_vch_target_type_cd ... ON CONFLICT
  + B2B_STATEMENT (if missing)

ALTER org_fin_voucher_trx_lines_dtl
  DROP CONSTRAINT chk_vch_trx_ln_role ... RESTRICT
  -- recreate with STATEMENT_PAYMENT (+ any new roles)
  DROP CONSTRAINT chk_vch_trx_ln_target ... RESTRICT
  -- recreate with B2B_STATEMENT
```

Follow [drop-cascade migration workflow](../../dev/drop-cascade-migration-workflow.md): manifest old CHECK values, recreate identically + additions.

### 1.3 Tenant policy table

`org_cust_rcpt_alloc_policy_cf` (27 chars) — columns from reference pack; FK to abbreviated sys catalogs.

Default seed per demo tenant (in migration or tenant init script): `DEFAULT_OLDEST_DUE`, `AUTO_OLDEST_DUE`, fallback `CUSTOMER_ADVANCE`.

### 1.4 Preview transaction table

`org_cust_rcpt_alloc_preview_tr` — from feature pack `02_Database`; stores preview payload, idempotency, expiry.

### 1.5 Permissions (single migration block)

| Permission | Purpose |
|------------|---------|
| `orders:overpayment_dispose` | Base excess handling |
| `orders:overpayment_allocate` | Manual/auto customer balance allocation |
| `orders:overpayment_to_wallet` | Wallet fallback |
| `orders:overpayment_to_advance` | Advance fallback |
| `orders:overpayment_to_credit` | Customer credit issue |
| `customers:receipt_allocate` | Account-level receipt screen (future) |

Navigation dual-write **deferred** until standalone Customer Receipt screen exists.

### 1.6 TypeScript constants & validation

| File | Action |
|------|--------|
| `web-admin/lib/constants/settlement-catalog.ts` | **New** — overpayment resolutions, allocation modes, fallback destinations, voucher source types |
| `web-admin/lib/constants/voucher.ts` | Extend `LINE_ROLE`, `TARGET_TYPE`, `LINE_ROLE_REQUIREMENTS` |
| `web-admin/lib/constants/overpayment-disposition.ts` | **Refactor** → re-export from settlement-catalog resolutions |
| `web-admin/lib/validations/new-order-payment-schemas.ts` | Replace disposition schema with `overpaymentResolution` + optional `allocationPlan` |
| `web-admin/lib/validations/customer-receipt-allocation-schema.ts` | **New** — preview/post payloads per API pack |

### 1.7 Phase 1 tests

- Catalog seed presence test (SQL or integration)
- Constants mirror DB CHECK values (snapshot test)
- Zod structural validation tests

### 1.8 Phase 1 documentation & status

| Task | Output |
|------|--------|
| Update `overpayment-change-contract.md` | Catalog vocabulary |
| Update implementation tracker | Phase 1 complete |
| **Update this plan** § Phase 1 status | ✅ |
| Run `/documentation` skill | `docs/features/Order_Fin/technical_docs/tech_settlement_catalogs.md` |

**Do not apply migration via agent** — create file, stop for user review.

---

## Phase 2 — Basic overpayment disposition

### 2.1 Server: block unresolved excess

| Component | Change |
|-----------|--------|
| `order-settlement-planner.service.ts` | Compute `excessAmount`, `unresolvedExcess` |
| `overpayment-resolution-validator.ts` | **New** — catalog + policy matrix |
| `order-submit-orchestrator.service.ts` | Reject if excess > ε and no resolution plan |
| `order-financial-write.service.ts` | `overpaid_amount` = unresolved only |

Error codes (align catalog + i18n):

```text
OVERPAYMENT_RESOLUTION_REQUIRED
OVERPAYMENT_RESOLUTION_MISMATCH
OVERPAYMENT_RESOLUTION_NOT_ALLOWED
RETURN_CHANGE_EXCEEDS_CAPACITY
RECEIPT_ALLOCATION_EXCESS_UNRESOLVED
```

### 2.2 RETURN_CASH_CHANGE + REDUCE_PAYMENT

| Resolution | Behavior |
|------------|----------|
| `RETURN_CASH_CHANGE` | Existing cash change path + CASH_OUT drawer |
| `REDUCE_PAYMENT` | Client reduces leg amounts; server validates sum = saleTotal |

### 2.3 UI — Payment Modal V4

Reusable components (Cmx only):

| Component | Path |
|-----------|------|
| `CmxExtraReceiptHandlingCard` | `src/features/orders/ui/payment-modal/allocation/extra-receipt-handling-card.tsx` |
| Wire into `payment-modal-v4.tsx` right rail | Show when `settledNow > saleTotal` |

Labels: **Extra Receipt Amount** / **Unallocated Amount** — never "Change" unless `RETURN_CASH_CHANGE` selected.

### 2.4 Phase 2 tests

- Planner: excess blocks submit without resolution
- Integration: cash over-tender + change → `overpaid_amount = 0`
- UI: submit disabled when unresolved

### 2.5 Phase 2 docs & status

Update ADR-047, test_guide.md, walkthrough.md; **update plan status**.

---

## Phase 3 — Stored-value disposition

Resolutions from catalog:

| Resolution | Line role | Target | Creates `org_order_payments_dtl`? |
|------------|-----------|--------|----------------------------------|
| `SAVE_AS_CUSTOMER_ADVANCE` | `CUSTOMER_ADVANCE_RECEIPT` | `CUSTOMER` | **No** |
| `SAVE_AS_CUSTOMER_CREDIT` | `CUSTOMER_CREDIT_RECEIPT` | `CUSTOMER` | **No** |
| Wallet top-up (fallback) | `WALLET_TOPUP` | `WALLET` | **No** |
| Credit note (restricted) | Credit note issue API | `CREDIT_NOTE` | **No** |

| Service | Action |
|---------|--------|
| `overpayment-disposition.service.ts` | Execute resolutions inside submit TX |
| Reuse | `topUpWalletTx`, `issueAdvanceTx`, customer credit issue |

**Gate:** `TO_CREDIT_NOTE` / credit note only when tenant policy + permission + customer linked; otherwise block or route to `CUSTOMER_CREDIT`.

### Phase 3 tests & docs

Atomic TX tests, wallet/advance balance assertions, permission denied paths; **update plan status**.

---

## Phase 4 — Customer receipt allocation

### 4.1 Services (new)

| Service | Responsibility |
|---------|----------------|
| `customer-open-balance-query.service.ts` | Eligible orders, AR invoices, B2B statements; **AR-invoice-wins-over-order** rule |
| `customer-receipt-allocation-policy.service.ts` | Resolve effective policy (branch → tenant default) |
| `customer-receipt-allocation.service.ts` | Auto + manual algorithms (feature pack §3) |
| `customer-receipt-posting.service.ts` | Atomic voucher create + line post + wiring |
| `customer-receipt-allocation-validator.ts` | 15 rules from feature pack |

### 4.2 Wiring handlers (new)

| Handler | Effect table |
|---------|--------------|
| `invoice-payment-wiring.handler.ts` | AR invoice payment allocation — **not** `org_order_payments_dtl` |
| `statement-payment-wiring.handler.ts` | B2B statement allocation |
| Extend `order-payment-wiring.handler.ts` | Guard: only `ORDER` target + order owns balance |

Register in `voucher-wiring.service.ts`.

### 4.3 API routes (cleanmatex)

Per feature pack `04_API_Contracts.md` — use versioned paths:

```text
POST /api/v1/customer-receipts/allocation/preview-auto
POST /api/v1/customer-receipts/allocation/preview-manual
POST /api/v1/customer-receipts/allocation/post
GET  /api/v1/customers/[id]/open-balances
```

Submit-order may **embed** allocation when source = `ORDER_PAYMENT_MODAL` (single TX) or call posting service with `previewId`.

### 4.4 UI

| Component | Spec ref |
|-----------|----------|
| `auto-allocation-preview-drawer.tsx` | Pack §5 — preview before post |
| `manual-allocation-drawer.tsx` | Pack §5 — open balances picker |
| Reuse `CmxExtraReceiptHandlingCard` | Action buttons |

**UX rules:**
- Auto allocation **must** show preview when `require_confirmation_before_posting = true`
- Submit disabled until `remainingUnallocatedAmount = 0`
- EN/AR under `newOrder.payment.extraReceipt.*`

### 4.5 Phase 4 tests

Full matrix from `07_Test_Cases_And_QA_Checklist.md` (minimum 20 scenarios):

- Auto oldest due, partial last target, fallback advance/wallet/credit
- Order with AR invoice → allocates to invoice not order
- Invoice payment → no order payment row
- Idempotency replay
- Multi-currency block when policy requires same currency

### 4.6 Phase 4 docs & status

PRD acceptance criteria checklist; reconciliation warning codes; **update plan status**; `/documentation` skill for user guide + developer guide.

---

## Phase 5 — Later collection parity & HQ

| Task | Status | Notes |
|------|--------|-------|
| `collectPaymentTx` excess handling | ✅ Done | Same resolution/allocation services as submit-order |
| `collection-overpayment.ts` metrics | ✅ Done | Reuses `computeSettlementOverpaymentMetrics` |
| API routes accept `overpaymentResolution` | ✅ Done | `POST /api/v1/orders/[id]/payments`, `/collect-payment` |
| Unit tests + test_guide scenarios 26–27 | ✅ Done | `settlement.service.test.ts`, `collection-overpayment.test.ts` |
| Standalone Customer Account Receipt screen | ✅ Done | `/dashboard/customers/account-receipt` + nav 0359 |
| cleanmatexsaas feature flags | ⬜ Pending | → [Pending doc §1](./Pending_Payment_Settlement_Follow_Ups.md#1-hq-feature-flags-cleanmatexsaas) |
| Reconciliation reports | ⬜ Pending | → [Pending doc §2](./Pending_Payment_Settlement_Follow_Ups.md#2-reconciliation--unallocated-excess--0) |
| Later-collection UI (order detail) | ✅ Done | OrderCollectPaymentModal wired |
| Payment Modal V4 → `useOverpaymentAllocation` | ✅ Done | Refactored 2026-06-11 |

---

## Phase 6 — Legacy cleanup (separate migration, after code validation)

**Only after** grep + tests confirm zero usage:

| Legacy item | Action |
|-------------|--------|
| Silent `overpaid_amount` retention paths | ✅ Removed (`settlement-overpayment.ts`, Phase 6) |
| Duplicate TS aliases (`CUSTOMER_CREDIT` = `CREDIT_NOTE`) | ⬜ Pending optional cleanup → [Pending doc §3](./Pending_Payment_Settlement_Follow_Ups.md#3-optional-code-hygiene-cleanmatex) |
| `RETURN_CHANGE` vs `RETURN_CASH_CHANGE` | ✅ Documented — distinct domains; see [tech_settlement_catalogs.md](./technical_docs/tech_settlement_catalogs.md) |
| Deprecated gateway method rows | **ADR-048** done; **ADR-049** deferred → [Pending doc §4](./Pending_Payment_Settlement_Follow_Ups.md#4-online-payment-gateway-parked) |

Migration `0360_order_fin_phase6_legacy_cleanup.sql` applied (disp table align + `overpaid_amount` backfill). No further Phase 6 migration required unless optional alias cleanup is approved.

---

## Migration generation checklist (Phase 1 deliverable)

Before writing `0357_*.sql`:

```sql
-- Run read-only (local MCP), record results in migration header comment
-- 1. List existing sys_fin_vch_* row counts
-- 2. List CHECK constraint definitions on org_fin_voucher_trx_lines_dtl
-- 3. Confirm org_order_payments_dtl has NO payment_target_type
-- 4. Confirm 0354 not applied (or merge carefully if applied)
```

Migration must:

- [ ] Use `INSERT ... ON CONFLICT DO UPDATE` for seeds
- [ ] Use `ADD COLUMN IF NOT EXISTS` for patches
- [ ] Use `DROP CONSTRAINT ... RESTRICT` + recreate for CHECK extensions
- [ ] Include RLS on all new `org_*` tables
- [ ] Include bilingual `name`/`name2` on catalogs
- [ ] **Not** create duplicate `sys_fin_voucher_line_type_cd` when `sys_fin_vch_line_type_cd` exists
- [ ] Abbreviate table names > 30 chars

---

## Test strategy summary

| Layer | Tooling |
|-------|---------|
| Unit | Resolution validator, allocation algorithm, open-balance query |
| Service | Mock Prisma TX — posting + wiring |
| Integration | Submit-order with allocation, idempotency |
| UI | RTL + EN/AR key parity (`npm run check:i18n`) |
| Build | `npm run build` after each phase |
| Manual | Extend [test_guide.md](../Order_Payment_Model/test_guide.md) |

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Reference SQL table names > 30 chars | Abbreviate; document mapping |
| Duplicate catalog tables | Extend `sys_fin_vch_*` only |
| ADR-047 / catalog vocabulary drift | Single `settlement-catalog.ts` |
| CHECK constraint migration failure | RESTRICT + full value manifest |
| Partial TX (order created, wallet not credited) | Single orchestrator transaction |
| B2B statement balance source unclear | Query service uses `org_b2b_statements_mst` + invoice links |
| Credit note legal restrictions | Feature flag + permission + tenant setting gate |

---

## Suggested timeline (indicative)

| Phase | Effort | Dependency |
|-------|--------|------------|
| 0 — ADR / discovery | 1–2 days | — |
| 1 — Catalogs migration + constants | 3–5 days | Phase 0 approved |
| 2 — Basic disposition | 3–4 days | Phase 1 applied |
| 3 — Stored-value disposition | 2–3 days | Phase 2 |
| 4 — Customer receipt allocation | 5–8 days | Phase 1 + 3 |
| 5 — Later collection + HQ flags | 2–3 days | Phase 4 |
| 6 — Legacy drop | 1–2 days | Production soak |

---

## Plan maintenance tasks (after each phase)

Per user requirement — **repeat at end of every phase:**

1. Update **Status** section at top of this file (phase checklist).
2. Update [overpayment-contract-implementation-tracker.md](../Order_Payment_Model/overpayment-contract-implementation-tracker.md).
3. Update [test_guide.md](../Order_Payment_Model/test_guide.md) with new scenarios.
4. Run `npm run build` + targeted tests; record results in tracker.
5. Invoke **`/documentation` skill** to refresh:
   - `docs/features/Order_Fin/technical_docs/tech_settlement_catalogs.md`
   - `docs/features/Order_Fin/technical_docs/tech_customer_receipt_allocation.md`
   - ADR-047 / new ADR-048 as needed

---

## Status tracker

| Phase | Status | Notes |
|-------|--------|-------|
| 0 — Discovery & ADR | ✅ Complete | Defaults approved; ADR-047 finalized |
| 1 — Catalogs / Foundation | ✅ Complete | `0357` + `0354` applied locally |
| 2 — Basic overpayment | ✅ Complete | Disposition audit + validator + UI card |
| 3 — Stored-value disposition | ✅ Complete | Advance + credit note via BVM lines |
| 4 — Customer receipt allocation | ✅ Complete | Preview APIs, drawers, executor, test_guide 16–25 |
| 5 — Later collection / HQ | ✅ Complete | Backend + collect modal + ready screen + account receipt screen |
| 6 — Legacy cleanup | ✅ Complete | Silent retention removed; migration 0360 backfill |
| Final documentation pass | ✅ Complete | `tech_settlement_catalogs.md` + tracker refresh (2026-06-11) |
| Post-plan backlog | 📋 Tracked | [Pending_Payment_Settlement_Follow_Ups.md](./Pending_Payment_Settlement_Follow_Ups.md) |

---

## Decisions (resolved at plan start)

1. ✅ Abbreviated catalog table names (`sys_fin_overpay_res_cd`, etc.)
2. ✅ Option A — keep `org_fin_overpay_disp_dtl` audit table
3. ✅ `CUSTOMER_CREDIT_ISSUE` canonical; `CUSTOMER_CREDIT_RECEIPT` compat only
4. Credit note destination — permission-gated (`orders:overpayment_to_credit_note`)
5. ✅ Default fallback `CUSTOMER_ADVANCE`

---

## Related files

```text
docs/features/Order_Fin/
  Payment_Settlement_And_Receipt_Allocation_IMPLEMENTATION_PLAN.md  ← this file
  Pending_Payment_Settlement_Follow_Ups.md                          ← post-plan backlog
  technical_docs/tech_settlement_catalogs.md
  technical_docs/tech_customer_receipt_allocation.md
  ADR/ADR-047 … ADR-049

supabase/migrations/  0354, 0357, 0358, 0359, 0360  (applied)

web-admin/lib/
  constants/settlement-catalog.ts
  services/customer-receipt-*.ts
  services/wiring/invoice-payment-wiring.handler.ts
  services/wiring/statement-payment-wiring.handler.ts
```
