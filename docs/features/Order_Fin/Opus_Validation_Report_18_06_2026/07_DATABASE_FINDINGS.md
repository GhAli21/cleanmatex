# 07 — Database Findings

All facts below were read from the **live local DB** via read-only MCP queries on 2026-06-18, or from migration files.

## RLS coverage (78 finance tables swept)

- **77/78 have RLS enabled with ≥1 policy.** Newer tables (`org_fin_overpay_disp_dtl`, `org_fin_rcpt_alloc_policy_cf`, `org_fin_rcpt_alloc_preview_tr`) carry **2** policies (tenant_isolation + service_role); most older tables carry 1 (tenant_isolation). Single-policy is acceptable (service_role typically bypasses RLS), not a finding.
- **🟠 F-01 — `org_tax_doc_seq_counters`: `relrowsecurity=false`, 0 policies.** Columns: `tenant_org_id uuid NOT NULL`, `document_type`, `fiscal_year`, `last_sequence`, audit. The only finance `org_*` table without RLS. Access path (`tax-document-sequence.service.ts`) always filters by `tenant_org_id` + `FOR UPDATE`, so no live leak verified — but the DB safety net is absent on a fiscal-numbering table. **Fix:** enable RLS + tenant_isolation + service_role policies (additive migration). See [18 migrations](./16_RECOMMENDED_IMPLEMENTATION_PLAN.md#migrations).

## Idempotency / unique indexes (effect tables)

| Table | Idempotency unique | Per-voucher-line unique | Verdict |
|-------|--------------------|--------------------------|---------|
| `org_order_payments_dtl` | ✅ `uq_org_ord_pay_dtl_idempotency` | ✅ `uq_ord_pay_vch_line` | ✅ |
| `org_fin_voucher_trx_lines_dtl` | ✅ `uq_vch_trx_line_idempotency` | ✅ `uq_vch_trx_ln_voucher_line_no` | ✅ |
| `org_wallet_txn_dtl` | ✅ `uq_wallet_txn_idempotency` | ✅ `uq_wallet_txn_vch_line` | ✅ |
| `org_advance_txn_dtl` | ✅ `uq_advance_txn_idempotency` | ✅ `uq_advance_txn_vch_line` | ✅ |
| `org_credit_note_txn_dtl` | ✅ `uq_cn_txn_idempotency` | ✅ `uq_cn_txn_vch_line` | ✅ |
| `org_cash_drawer_movements_dtl` | — | ✅ `uq_cd_mov_vch_line` (CASH_IN only) | 🔵 F-07 (CASH_OUT uncovered) |
| `org_fin_overpay_disp_dtl` | ✅ two partial indexes (RETURN_CASH_CHANGE + simple) | n/a | ✅ |
| `org_fin_rcpt_alloc_preview_tr` | ✅ `uq_fin_rcpt_preview_idempotency` | n/a | ✅ |
| `org_invoice_payments_dtl` (AR) | via central `org_idempotency_keys` | `uq_oip_no (tenant,invoice,allocation_no)` | ✅ **idempotent via central cache** (corrected — not an effect-table index) |
| `org_idempotency_keys` (central cache; AR flows) | ✅ `uq_idempotency_key` (RLS on) | n/a | ✅ |
| `org_b2b_statements_mst` (allocation) | 🔴 **none** (master mutated in place; `idempotencyKey` ignored) | — | 🟡 F-02 / F-04 |

**F-02 conclusion (corrected after deep-dive):** the finance layer has **two** valid idempotency mechanisms — (1) effect-table partial unique indexes (order-payment, wallet, advance, credit-note, cash-in, overpay-disp, preview); (2) the central `org_idempotency_keys` cache via `withIdempotency`, used by **AR invoice allocation** (`ar-invoice.service.ts:290-343`, verified live: RLS on, unique `uq_idempotency_key`). **AR is idempotent.** Only the **B2B statement** path uses neither (ignores its key, mutates the master in place). Fix B2B only — reuse the central cache. **Do not add an AR idempotency index/migration** unless separately proven needed.

## Constraints (verified)

- `org_fin_overpay_disp_dtl`: ✅ `org_fin_overpay_disp_res_fk` (FK→catalog, validated), `org_order_overpay_disp_dtl_amt_chk` (`amount>0`, kept), `..._tenant_order_fk` (→`org_orders_mst(id,tenant_org_id)`), PK `(id)`. The old `org_fin_overpay_disp_res_chk` is **gone** (0378). Note residual `org_order_overpay_disp_dtl_*` constraint names from the 0360 rename (cosmetic, F-08).
- `sys_fin_overpay_res_cd`: PK `(resolution_code)` — valid FK target; 9 codes present incl. `SAVE_TO_CUSTOMER_WALLET`.
- `org_order_payments_dtl`: **no** `payment_target_type` column (dropped `0337`) — rules 1/2 ✅.

## Catalog drift

- ✅ No duplicate catalog tables — `0357` extends `sys_fin_vch_*` rather than creating long-name `sys_fin_voucher_*`.
- ✅ TS `OVERPAYMENT_RESOLUTIONS` now equals the `sys_fin_overpay_res_cd` set (enforced by the rewritten `settlement-catalog.test.ts`).
- 🔵 F-08 naming drift (full vs abbreviated voucher names) — cosmetic.

## Migration ordering / conditional branches

- `0300`–`0378` sequential; `0378` applied + verified.
- `0360` Part A (rename `org_order_overpay_disp_dtl`→`org_fin_overpay_disp_dtl` + CHECK recreate) is **gated** behind `IF org_fin_overpay_disp_dtl IS NULL AND org_order_overpay_disp_dtl IS NOT NULL`. On this DB it ran (constraint name residue confirms the rename happened), but its CHECK-recreate path is the one that omitted the wallet code — now superseded by 0378's FK. Benign post-0378.
- ⚪ No unsafe `DROP ... CASCADE` observed in the finance migrations inspected.

## Backfill / data-integrity SELECT previews (read-only — DO NOT run UPDATEs without approval)

> All previews returned/expected **0 rows** where noted from this session's checks. Re-run after any allocation hardening.

**P-1 — Orphan resolution codes (catalog FK integrity).** Returned 0 rows live.
```sql
SELECT d.resolution_code, count(*) FROM public.org_fin_overpay_disp_dtl d
LEFT JOIN public.sys_fin_overpay_res_cd c ON c.resolution_code=d.resolution_code
WHERE c.resolution_code IS NULL GROUP BY 1;
```

**P-2 — `overpaid_amount` integrity (rule 13).**
```sql
WITH disp AS (SELECT tenant_org_id,order_id,COALESCE(SUM(amount),0) disposed
  FROM org_fin_overpay_disp_dtl WHERE COALESCE(is_active,true) GROUP BY 1,2)
SELECT o.tenant_org_id,o.id,o.overpaid_amount,
  GREATEST(GREATEST(o.total_paid_amount+o.total_credit_applied_amount-o.total_amount,0)
    -COALESCE(o.change_returned_amount,0)-COALESCE(d.disposed,0),0) AS recomputed
FROM org_orders_mst o LEFT JOIN disp d ON d.tenant_org_id=o.tenant_org_id AND d.order_id=o.id
WHERE ABS(o.overpaid_amount - GREATEST(GREATEST(o.total_paid_amount+o.total_credit_applied_amount-o.total_amount,0)
    -COALESCE(o.change_returned_amount,0)-COALESCE(d.disposed,0),0)) > 0.001;
```

**P-3 — Pending/authorized payments wrongly reducing outstanding (rule 19).** Should be 0.
```sql
SELECT o.id, o.outstanding_amount, o.total_amount, o.total_paid_amount
FROM org_orders_mst o
WHERE EXISTS (SELECT 1 FROM org_order_payments_dtl p
  WHERE p.order_id=o.id AND p.tenant_org_id=o.tenant_org_id AND p.is_active
    AND UPPER(COALESCE(p.payment_status,'')) IN ('PENDING','AUTHORIZED'))
  AND o.outstanding_amount < (o.total_amount - o.total_paid_amount - o.total_credit_applied_amount) - 0.001;
```

**P-4 — AR-invoice-wins violations: orders paid directly while an open AR invoice exists (rule 12).**
```sql
SELECT o.id AS order_id, i.id AS invoice_id, i.status, i.outstanding_amount
FROM org_orders_mst o
JOIN org_invoice_mst i ON i.order_id=o.id AND i.tenant_org_id=o.tenant_org_id
WHERE i.is_active AND i.rec_status=1 AND i.outstanding_amount > 0.001
  AND EXISTS (SELECT 1 FROM org_order_payments_dtl p
    WHERE p.order_id=o.id AND p.tenant_org_id=o.tenant_org_id AND p.is_active
      AND p.created_at > i.created_at);
```

**P-5 — Voucher lines whose effect row is missing (wiring integrity).** Investigate any rows.
```sql
SELECT l.id, l.line_role, l.target_type, l.wiring_status
FROM org_fin_voucher_trx_lines_dtl l
WHERE l.line_role='ORDER_PAYMENT' AND l.line_status='POSTED'
  AND NOT EXISTS (SELECT 1 FROM org_order_payments_dtl p WHERE p.fin_voucher_trx_line_id=l.id);
```

**P-6 — B2B statement double-application probe (F-02).** Look for >1 STATEMENT_PAYMENT voucher line per (statement, idempotency-equivalent) once detail/idempotency lands.
```sql
SELECT target_id AS statement_id, COUNT(*) lines, SUM(amount) total
FROM org_fin_voucher_trx_lines_dtl
WHERE line_role='STATEMENT_PAYMENT' AND target_type='B2B_STATEMENT'
GROUP BY target_id HAVING COUNT(*) > 1;
```
