# 18 — Exact Migrations Needed

All **additive**; none destructive. Create-for-review only (never auto-apply). Next sequence after `0378` is `0379`.

### 0379 — `tax_doc_seq_counters_rls` (F-01) — GA gate
- **Purpose:** Enable RLS + tenant_isolation + service_role policies on `org_tax_doc_seq_counters`.
- **Safe SQL summary:** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` + `CREATE POLICY tenant_isolation_... FOR ALL USING/WITH CHECK (tenant_org_id = current_tenant_id());` + service_role policy.
- **Risk:** Low — must confirm the sequence service's connection role can still write (add service_role policy so server writes are unaffected). No data change.
- **Type:** additive. **Approval:** required. **Rollback:** `DISABLE ROW LEVEL SECURITY` + `DROP POLICY`.

### 0380 — `b2b_statement_payment_detail` (F-04 only — **optional**)
- **Purpose:** Audit symmetry for B2B statement allocation (detail rows). **The F-02 idempotency fix itself needs NO migration** — reuse the existing `org_idempotency_keys` cache (`withIdempotency`) in `b2b-statement-payment.service.ts`. This migration is only if you also want a queryable detail table (F-04).
- **NOT NEEDED for AR:** AR allocation is already idempotent via `org_idempotency_keys`. **Do not add an AR idempotency index/migration.**
- **Safe SQL summary:** `CREATE TABLE org_b2b_statement_payments_dtl (... statement_id, amount, voucher_id, idempotency_key, audit ...)` + RLS + `CREATE UNIQUE INDEX ... (tenant_org_id, idempotency_key) WHERE idempotency_key IS NOT NULL`. (Alternative: just add the idempotency cache usage in-service with no new table — but the detail table also closes F-04.)
- **Risk:** Medium — preview for existing duplicate statement payments first ([12 D-1/D-2](./12_DATA_INTEGRITY_AND_BACKFILL_PREVIEWS.md)); ensure partial unique on non-null keys avoids legacy collisions.
- **Type:** additive. **Approval:** required. **Rollback:** drop table/index.

### 0381 — `cash_out_change_idempotency` (F-07) — hardening
- **Purpose:** Make CASH_OUT (change) drawer rows replay-safe.
- **Safe SQL summary:** partial unique index on `org_cash_drawer_movements_dtl (fin_voucher_id, movement_type, order_payment_id) WHERE movement_type='CASH_OUT'` (or attach `fin_voucher_trx_line_id`).
- **Risk:** Low — verify no existing duplicate change rows before adding unique ([07 P-5 style probe]).
- **Type:** additive. **Approval:** required. **Rollback:** drop index.

### 0382 — `tax_doc_fiscal_total` (F-05) — scope-dependent (Phase 7)
- **Purpose:** Store fiscal total on `org_tax_documents_mst` + tax-category line fields to enable decomposition + reconciliation.
- **Safe SQL summary:** `ALTER TABLE org_tax_documents_mst ADD COLUMN fiscal_total_amount DECIMAL(19,4);` + tax-doc line category columns.
- **Risk:** Medium — couples to tax-engine work; sequence migrations as the engine lands.
- **Type:** additive. **Approval:** required. **Rollback:** drop columns.

### (optional) 0383 — `retire_unwired_finance_flags` (F-03, only if retiring)
- **Purpose:** Deactivate `overpayment_disposition_v1` / `customer_receipt_allocation_v1` seeds if the decision is "permission-gated only."
- **Risk:** Low. **Type:** additive (update seed `is_active=false`). **Approval:** required (product decision first).

> **Already applied this session:** `0378_overpay_disp_resolution_fk.sql` (FK replaces hardcoded CHECK) — verified live.
