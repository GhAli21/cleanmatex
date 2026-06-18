# CleanMateX Order Financial — Validation Report & Implementation Plan

**Date:** 2026-06-18
**Reviewer role:** Senior SaaS finance architect / ERP consultant / PostgreSQL-Supabase architect / Next.js full-stack / payment-systems reviewer
**Verdict:** 🟡 **PARTIALLY VALID** (one hard blocker on an otherwise production-grade implementation)
**Scope inspected first-hand:** 30 financial migrations (0100–0377), ~20 backend services, BVM wiring handlers, Payment Modal V4 UI, settlement/voucher/financial constants, Zod schemas, and the `__tests__` suite. This verdict reflects code as it actually exists, **not** the governing plan's "all phases complete" claim.

**Governing baseline:** [Payment_Settlement_And_Receipt_Allocation_IMPLEMENTATION_PLAN.md](./Payment_Settlement_And_Receipt_Allocation_IMPLEMENTATION_PLAN.md) · [ADR-047](./ADR/ADR-047-Overpayment-Disposition.md) · [ADR-046](./ADR/ADR-046-Payment-Method-Overpayment-Policy.md)

---

## A. Executive Verdict

### 🟡 PARTIALLY VALID

The architecture is **sound and faithfully implements the approved model**. The hard separation between real payments and stored-value/credit is correctly enforced at every layer: `org_order_payments_dtl` is ORDER-only (rule 1/2), generic targeting lives on `org_fin_voucher_trx_lines_dtl.target_type/target_id` (rule 3), and the financial-truth engine computes `total_paid` from completed real payments only, `total_credit_applied` from APPLIED credits only, and `overpaid_amount` as unresolved excess only (rules 13/14/19/20/21).

**One hard blocker** prevents a VALID verdict: the **Save-to-Wallet overpayment disposition is broken end-to-end** by a missing CHECK-constraint extension. Any cashier who routes checkout excess to a customer wallet triggers a DB constraint violation that **rolls back the entire order submit / collect-payment transaction**. A test that purports to guard this is a no-op (asserts uniqueness, not DB parity), which is why it shipped.

Everything else is production-grade. Fix the blocker (one-line migration) and add the missing integration test, and this moves to VALID.

| Rule area | Status |
|---|---|
| Real payment vs credit/stored-value separation (1–6, 23) | ✅ Enforced |
| Voucher targeting & line roles (3, 7, 8, 9, 10, 11) | ✅ Correct |
| AR-invoice-wins-over-order (12) | ✅ Enforced |
| Financial truth: paid/credit/pending/overpaid (13,14,19,20,21,22) | ✅ Correct |
| Overpayment resolution & fallback (15,16,17,18) | ✅ Correct (except wallet) |
| **Save-to-Wallet disposition** | ❌ **Blocker — DB CHECK rejects it** |
| Settlement catalogs / categories | ✅ Present, ⚠️ wallet CHECK gap |
| UI labels & UX | ✅ Complete |

---

## B. Critical Blockers

### 🔴 BLOCKER-1 — `SAVE_TO_CUSTOMER_WALLET` disposition violates the audit CHECK constraint

- **File/table:** `org_fin_overpay_disp_dtl` · constraint `org_fin_overpay_disp_res_chk`
  - Created: `supabase/migrations/0354_order_overpay_disposition.sql:43-53` — 8 codes, **no** `SAVE_TO_CUSTOMER_WALLET`
  - Re-created (gated): `supabase/migrations/0360_order_fin_phase6_legacy_cleanup.sql:51-62` — same 8 codes; only runs in the legacy-rename branch (`IF org_fin_overpay_disp_dtl IS NULL AND org_order_overpay_disp_dtl IS NOT NULL`, line 30-31), which is **skipped** on the current repo (0354 already creates the new-name table → ELSIF "already present — align skipped", line 108)
  - Wallet code added to catalog only: `supabase/migrations/0368_fin_overpay_save_to_wallet.sql` seeds `sys_fin_overpay_res_cd` but **never alters the CHECK**
- **Current behavior:** `web-admin/lib/services/overpayment-disposition.service.ts:120-184` tops up the wallet then `INSERT INTO org_fin_overpay_disp_dtl (... resolution_code='SAVE_TO_CUSTOMER_WALLET' ...)`. Postgres rejects the row → exception propagates up the single `prisma.$transaction` in `order-submit-orchestrator.service.ts:719-958` → **whole order submit rolls back**. Same failure on later collection (`collectPaymentTx` reuses the disposition service).
- **Expected behavior:** Wallet disposition succeeds; wallet credited; audit row persisted; `overpaid_amount` → 0.
- **Risk:** **High.** A wired, permission-seeded, UI-exposed path (`canSaveWallet` button, `extra-receipt-handling-card.tsx:137-145`) fails at runtime with a generic 500. Cashier cannot complete checkout when over-tender is routed to wallet. Silent until exercised because the guard test (B-2) is a no-op.
- **Fix recommendation:** New migration `0378_*` that drops + recreates `org_fin_overpay_disp_res_chk` (RESTRICT) including `SAVE_TO_CUSTOMER_WALLET`. See §C / §G Phase 1.

### 🟠 BLOCKER-2 — Catalog "mirror" test asserts nothing meaningful

- **File:** `web-admin/__tests__/constants/settlement-catalog.test.ts:11-24`
- **Current behavior:** Test named *"mirrors org_fin_overpay_disp_dtl resolution CHECK constraint"* builds an array that **includes** `SAVE_TO_CUSTOMER_WALLET`, then only asserts `new Set(auditCodes).size === auditCodes.length` (uniqueness). It never reads the migration or the DB, so it is green while the real CHECK diverges.
- **Expected behavior:** Compare the TS constant set against the literal CHECK value list from the migration (or against the live DB constraint in an integration test).
- **Risk:** Medium — false assurance; root cause that let BLOCKER-1 ship.
- **Fix recommendation:** Replace the uniqueness assertion with a parity assertion against the canonical code list; add a DB-level integration test (§I).

---

## C. Schema Gaps

| # | Table | Gap | Safe migration recommendation |
|---|---|---|---|
| C-1 | `org_fin_overpay_disp_dtl` | CHECK `org_fin_overpay_disp_res_chk` omits `SAVE_TO_CUSTOMER_WALLET` (Blocker-1) | New `0378`: `DROP CONSTRAINT … RESTRICT` then re-add with all 9 codes. Manifest old values first. |
| C-2 | `org_fin_overpay_disp_dtl` | No FK to `sys_fin_overpay_res_cd(resolution_code)` — catalog drift only caught by a hand-maintained CHECK | Optional hardening: add `FK … REFERENCES sys_fin_overpay_res_cd ON DELETE RESTRICT`. Lower priority than C-1; do **not** bundle with C-1. |
| C-3 | Naming consistency | Line table is `org_fin_voucher_trx_lines_dtl` (full word) while catalogs are `sys_fin_vch_*` and constraints `*_vch_trx_ln_*`. **No duplicate tables** — rule satisfied — but cosmetically inconsistent. | No migration. Document the abbreviation map in `tech_settlement_catalogs.md`. Cosmetic only. |

**Recommended C-1 fix (illustrative — not applied):**
```sql
-- 0378_fin_overpay_disp_check_add_wallet.sql  (create-only; user reviews/runs)
BEGIN;
ALTER TABLE public.org_fin_overpay_disp_dtl
  DROP CONSTRAINT IF EXISTS org_fin_overpay_disp_res_chk RESTRICT;
ALTER TABLE public.org_fin_overpay_disp_dtl
  ADD CONSTRAINT org_fin_overpay_disp_res_chk
  CHECK (resolution_code IN (
    'REDUCE_PAYMENT','RETURN_CASH_CHANGE','VOID_OR_REFUND_EXCESS',
    'SAVE_AS_CUSTOMER_ADVANCE','SAVE_TO_CUSTOMER_WALLET','SAVE_AS_CUSTOMER_CREDIT',
    'RESTORE_STORED_VALUE','ALLOCATE_TO_CUSTOMER_BALANCES','AUTO_ALLOCATE_TO_CUSTOMER_BALANCES'
  ));
COMMIT;
```

**Schema strengths confirmed (no gaps):**
- `org_order_payments_dtl` has **no** `payment_target_type` (explicitly dropped at `0337:148-153`) — rules 1/2.
- `org_fin_voucher_trx_lines_dtl` CHECKs include `INVOICE_PAYMENT` / `STATEMENT_PAYMENT` / `B2B_STATEMENT` (`0357:349-400`).
- All new `org_*` tables have tenant + service_role RLS.
- Catalogs extend `sys_fin_vch_*` rather than duplicating with long `sys_fin_voucher_*` names (rule satisfied).
- Fallback seed defaults to `CUSTOMER_ADVANCE` (`0357:655-681`) — rule 16.

---

## D. Service Gaps

| # | File/service | Current behavior | Expected | Required change |
|---|---|---|---|---|
| D-1 | `overpayment-disposition.service.ts` | Inserts wallet audit row that the DB rejects (Blocker-1) | Insert succeeds | None in code — fixed by C-1 migration. |
| D-2 | `overpayment-resolution-validator.service.ts:113-117` | `VOID_OR_REFUND_EXCESS` and `RESTORE_STORED_VALUE` throw `NOT_ALLOWED` at submit | Catalog codes **defined but intentionally unwired** at checkout (rule 18) | No fix needed; **document** as deferred so they aren't mistaken for bugs. |
| D-3 | `order-submit-orchestrator.service.ts:564` | Comment says "tx1 — create order … (idempotency-unaware)" | Misleading — create + voucher + wiring + disposition + allocation + settle all run in **one** `$transaction` (line 719) | Cosmetic: fix the stale comment. Behavior is correct. |

**Service strengths confirmed:**
- Order-payment wiring enforces `target_type==='ORDER' && target_id===order_id` (`order-payment-wiring.handler.ts:46-50`) and stamps `payment_nature_snapshot:'REAL_PAYMENT'`.
- Invoice-payment wiring routes to `org_invoice_payments_dtl` via `allocateArPaymentTx`, **never** writes `org_order_payments_dtl` (rule 7).
- Statement-payment wiring routes to `org_b2b_statements_mst` (rule 8).
- `stored-value.service.ts` has **zero** references to `org_order_payments_dtl` (rules 5/6).
- Gateway/bank/check legs resolve to `PENDING` so they don't reduce outstanding (rule 19).
- `customer-open-balance-query.service.ts:161` skips orders that already own an open AR invoice (rule 12).
- `order-financial-write.service.ts`: `total_paid` only sums COMPLETED + real-payment rows (`:721` + `isClearlyRealPaymentRow`); only APPLIED credits count (`:689-692`); `overpaid = max(0, gross − changeReturned − disposed)` (`:767-774`).

---

## E. UI Gaps

**No functional gaps.** All required right-panel labels exist; credit/real-payment separation correct.

| Required label | Status | Evidence |
|---|---|---|
| Real Payments Received | ✅ | `messages/en.json:5492` |
| Credits / Stored Value Applied | ✅ | `messages/en.json:5493` (`creditsApplied`) |
| Total Settled Now | ✅ | `messages/en.json:5487` |
| Remaining Balance | ✅ | `messages/en.json:5488` |
| Overpaid Amount | ✅ | `messages/en.json:5489` |
| Extra Receipt (Handling/Amount) | ✅ | `messages/en.json:5230-5231` (`newOrder.payment.extraReceipt.*`) |

| # | Component | Note | Suggested polish (non-blocking) |
|---|---|---|---|
| E-1 | `extra-receipt-handling-card.tsx:137-145` | "Save to Wallet" button shown/selectable but submitting it currently 500s (Blocker-1) | Until C-1 ships, optionally gate `canSaveWallet` behind the wallet/`overpayment_disposition_v1` flag to avoid exposing the broken path. |
| E-2 | Card offers `adjust_legs`, `RETURN_CASH_CHANGE`, advance, wallet, credit, auto/manual allocate | Matches catalog + rules 16/17 (cash-only change gated by `canReturnCashChange`) | Confirm AR parity via `npm run check:i18n`. |

Gift card / wallet / customer credit render as **resolution modes / credit applications**, never as real payment methods.

---

## F. Data Correction / Backfill Needs

No destructive correction required. After applying C-1, two read-only previews recommended. **No UPDATE without approval.**

**F-1 — Detect any persisted wallet dispositions (expect zero if the path always failed atomically):**
```sql
SELECT d.tenant_org_id, d.order_id, d.resolution_code, d.amount, d.created_at
FROM org_fin_overpay_disp_dtl d
WHERE d.resolution_code = 'SAVE_TO_CUSTOMER_WALLET';
```

**F-2 — Re-verify `overpaid_amount` integrity for orders with disposition rows (recompute as a check, not an update):**
```sql
WITH disp AS (
  SELECT tenant_org_id, order_id, COALESCE(SUM(amount),0) AS disposed
  FROM org_fin_overpay_disp_dtl WHERE COALESCE(is_active,true) GROUP BY 1,2)
SELECT o.tenant_org_id, o.id, o.overpaid_amount,
       GREATEST(GREATEST(o.total_paid_amount + o.total_credit_applied_amount - o.total_amount,0)
                - COALESCE(o.change_returned_amount,0) - COALESCE(d.disposed,0), 0) AS recomputed
FROM org_orders_mst o
LEFT JOIN disp d ON d.tenant_org_id=o.tenant_org_id AND d.order_id=o.id
WHERE ABS(o.overpaid_amount
      - GREATEST(GREATEST(o.total_paid_amount + o.total_credit_applied_amount - o.total_amount,0)
                 - COALESCE(o.change_returned_amount,0) - COALESCE(d.disposed,0),0)) > 0.001;
```
If F-2 returns rows, re-run `recalculateOrderFinancialSnapshotTx` per affected order rather than a raw UPDATE.

---

## G. Implementation Plan

> Each phase ends with a STATUS update + `/documentation` refresh. No migration applied by agent — create file, stop, user reviews/runs.

- **Phase 1 — Foundation / unblock wallet (CRITICAL, first)**
  1. Migration `0378` extends `org_fin_overpay_disp_res_chk` with `SAVE_TO_CUSTOMER_WALLET` (§C-1).
  2. Fix BLOCKER-2: rewrite the `settlement-catalog.test.ts` "mirror" assertion to real parity.
  3. Update `tech_settlement_catalogs.md` (naming map §C-3 + wallet fix). Flip ADR-047 Proposed→Accepted, align vocabulary to catalog.
- **Phase 2 — Block unresolved excess (verify)** — already implemented (`overpayment-resolution-validator.service.ts:68-81`); add an orchestrator-level integration test.
- **Phase 3 — Simple disposition (change/reduce/wallet/advance/credit)** — complete; after Phase 1 add wallet/advance/credit DB-CHECK integration tests. Confirm with product whether `VOID_OR_REFUND_EXCESS` should be wired at checkout (currently `NOT_ALLOWED` by design).
- **Phase 4 — Manual allocation** — complete; add the two missing wiring-handler tests.
- **Phase 5 — Auto allocation (oldest)** — complete; add fallback-exhaustion tests.
- **Phase 6 — Reports / reconciliation / tests** — wire the pending "unallocated excess > 0" reconciliation report; complete §I matrix; run F-1/F-2 on real data.

---

## H. Exact Files Likely to Modify

**Must (Phase 1):**
- `supabase/migrations/0378_fin_overpay_disp_check_add_wallet.sql` *(new)*
- `web-admin/__tests__/constants/settlement-catalog.test.ts`
- `docs/features/Order_Fin/technical_docs/tech_settlement_catalogs.md`
- `docs/features/Order_Fin/Payment_Settlement_And_Receipt_Allocation_IMPLEMENTATION_PLAN.md` (status), `docs/features/Order_Fin/ADR/ADR-047-Overpayment-Disposition.md`

**Should (cosmetic / hardening):**
- `web-admin/lib/services/order-submit-orchestrator.service.ts:564` — stale "tx1" comment
- Optional `0379` — FK `org_fin_overpay_disp_dtl.resolution_code` → `sys_fin_overpay_res_cd` (§C-2)

**Only if product expands scope:** `overpayment-resolution-validator.service.ts` (un-block `VOID_OR_REFUND_EXCESS` / `RESTORE_STORED_VALUE`).

---

## I. Exact Tests to Add

| Test file | Scenario | Why |
|---|---|---|
| `__tests__/services/overpayment-disposition.wallet.integration.test.ts` *(new)* | Submit with over-tender → `SAVE_TO_CUSTOMER_WALLET`; assert wallet credited **and** audit row persists against the **real CHECK** | Would have caught BLOCKER-1 |
| `__tests__/constants/settlement-catalog.test.ts` *(rewrite)* | TS resolution set **equals** migration CHECK literal list | Fixes BLOCKER-2 |
| `__tests__/services/invoice-payment-wiring.handler.test.ts` *(new)* | `INVOICE_PAYMENT`/`INVOICE` → `org_invoice_payments_dtl`, **no** order-payment row | Rule 7 untested |
| `__tests__/services/statement-payment-wiring.handler.test.ts` *(new)* | `STATEMENT_PAYMENT`/`B2B_STATEMENT` → statement balance reduced | Rule 8 untested |
| `__tests__/services/customer-receipt-allocation.fallback.test.ts` *(new)* | Auto-allocate exhausts targets → fallback advance/wallet/credit/RETURN_CHANGE/BLOCK | Fallback matrix (rule 16) |
| `__tests__/services/order-financial-write.gateway-pending.test.ts` *(new)* | PENDING/AUTHORIZED gateway leg → excluded from `total_paid`, no outstanding reduction, warning fires | Rules 19/20 |
| extend `customer-receipt-allocation.service.test.ts` | Order **with** open AR invoice → allocate to invoice, not order | Rule 12 regression lock |

**Already covered (good):** settlement planner, overpayment-resolution validator (unit), order-payment wiring, settlement service, collection-overpayment, stored-value, refund classification, financial warning codes, allocation validator, build-overpayment-resolution.

---

## J. Per-Rule Compliance Matrix

| # | Business rule | Status | Evidence |
|---|---|---|---|
| 1 | `org_order_payments_dtl` = direct ORDER real-payments only | ✅ | wiring handler guard `:46-50` |
| 2 | No `payment_target_type` on `org_order_payments_dtl` | ✅ | dropped `0337:148-153` |
| 3 | Generic targeting on voucher line `target_type/target_id` | ✅ | `0301`, `0357` CHECKs |
| 4 | GC/wallet/advance/credit/credit-note/loyalty ≠ real payment | ✅ | credit-application legs, `payment_nature_snapshot` |
| 5 | GC/wallet/credit must not create order-payment rows | ✅ | `stored-value.service.ts` (no order_payments writes) |
| 6 | Stored-value → credit-application/stored-value rows | ✅ | `applyStoredValueDebitTx`, credit apps |
| 7 | Invoice payment uses `INVOICE_PAYMENT` / `AR_INVOICE`(→`INVOICE`) | ✅ | `invoice-payment-wiring.handler.ts` |
| 8 | B2B statement uses `STATEMENT_PAYMENT` / `B2B_STATEMENT` | ✅ | `statement-payment-wiring.handler.ts` |
| 9 | Wallet top-up uses `WALLET_TOPUP` | ✅ | `voucher.ts` LINE_ROLE, fallback seed |
| 10 | Customer advance receipt uses `CUSTOMER_ADVANCE_RECEIPT` | ✅ | catalog + line roles |
| 11 | Customer credit issue uses `CUSTOMER_CREDIT_ISSUE` | ✅ | `voucher.ts:135`, catalog |
| 12 | Order with AR invoice → allocate to invoice, not order | ✅ | `customer-open-balance-query.service.ts:161` |
| 13 | `overpaid_amount` = unresolved excess only | ✅ | `order-financial-write.service.ts:767-774` |
| 14 | Excess never silently unresolved | ✅ | validator REQUIRED/MISMATCH errors |
| 15 | Remaining excess explicitly returned/reduced/allocated/fallback/blocked | ✅ | resolution catalog + validator |
| 16 | Fallback default `CUSTOMER_ADVANCE` | ✅ | `0357:655-681` seed |
| 17 | `RETURN_CHANGE` cash only | ✅ | validator `:132-159`, catalog `allowed_for_cash` |
| 18 | Card/gateway excess reduced/refunded explicitly | ✅ | `REDUCE_PAYMENT` + `VOID_OR_REFUND_EXCESS` (deferred) |
| 19 | Pending/authorized don't reduce outstanding | ✅ | `:722-723`, excluded from outstanding |
| 20 | Only completed/captured/settled count as paid | ✅ | `ORDER_PAYMENT_LIFECYCLE_STATUSES.COMPLETED=['COMPLETED','CAPTURED','SETTLED']` |
| 21 | Only APPLIED credits count | ✅ | `:689-692` |
| 22 | Commercial discounts reduce order value | ✅ | `resolveCanonicalTotalAmount` subtracts discount |
| 23 | GC/wallet/advance/credit don't reduce total/taxable | ✅ | credit-application path, not discount |
| 24 | Tax documents separate from AR invoices | ✅ | `0341_tax_documents_master_and_lines.sql`, ADR-007/043 |
| 25 | AR invoice receivable-only | ✅ | ADR-006/020, `ar-invoice.service.ts` |
| 26 | PAY_ON_COLLECTION is operational due, not AR | ✅ | `payOnCollectionAmount` vs `arReceivableAmount` split |
| — | **Save-to-Wallet disposition** | ❌ | **BLOCKER-1: CHECK rejects `SAVE_TO_CUSTOMER_WALLET`** |

**Settlement categories present:** REAL_PAYMENT, CREDIT_APPLICATION, AR_ALLOCATION, PAY_ON_COLLECTION_ALLOCATION, OVERPAYMENT_RESOLUTION, CUSTOMER_RECEIPT_ALLOCATION — all represented across catalogs, line roles, and services.

---

---

## Phase 1 Implementation Status (2026-06-18)

**Approach upgraded per direction:** instead of adding `SAVE_TO_CUSTOMER_WALLET` to the hardcoded CHECK (symptom fix), the root cause — catalog/audit drift — is removed by replacing the CHECK with a **foreign key to the catalog**.

| Item | Status |
|---|---|
| Migration `0378_overpay_disp_resolution_fk.sql` — drop CHECK `org_fin_overpay_disp_res_chk`, add FK `org_fin_overpay_disp_res_fk` → `sys_fin_overpay_res_cd(resolution_code)` (ON UPDATE/DELETE RESTRICT, NOT VALID + VALIDATE) | ✅ Created — **awaiting user apply** |
| Pre-apply discovery (live, read-only): 0 orphan rows; all 9 catalog codes present; FK target is PK | ✅ Verified |
| BLOCKER-2 fix — `settlement-catalog.test.ts` rewritten to real catalog + migration parity (no-op uniqueness assertion removed) | ✅ Done |
| Test B — `overpayment-disposition.wallet.test.ts` (wallet credited, audit row, idempotency, no-customer reject, `overpaid_amount → 0`) | ✅ Done |
| Validation: 16/16 tests pass · changed files typecheck clean · eslint clean | ✅ Done |
| Apply `0378` (user-run) → then full `npm test` + manual wallet-disposition QA | ⬜ Pending user |
| ADR-047 vocabulary/status refresh + `tech_settlement_catalogs.md` note | ⬜ Follow-up |

**Verdict after `0378` is applied and the suite re-run: 🟢 VALID.** The FK makes catalog↔audit drift structurally impossible — no future migration needs to touch a resolution-code list.

*Do not apply migrations via agent — `0378` is created for review; run it manually, confirm success, then re-run the suite.*
