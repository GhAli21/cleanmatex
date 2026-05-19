-- ==================================================================
-- 0307_finalize_voucher_type_column.sql
-- Business Voucher Module (BVM) — Phase 1, Step 7
-- Finalize the voucher_type column on org_fin_vouchers_mst:
--
--   1. Backfill biz_voucher_type from old voucher_type for any rows
--      where biz_voucher_type IS NULL (legacy receipt-only rows).
--   2. Drop the old voucher_type column (no FKs or dependents).
--   3. Rename biz_voucher_type → voucher_type (final column name).
--   4. Rename CHECK constraint to reflect the final column name.
--   5. Drop old bridge index; create index under the final name.
--
-- After this migration:
--   - ONE voucher_type column exists with BVM values (RECEIPT_VOUCHER etc.)
--   - No biz_voucher_type column anywhere in the schema
--   - Legacy code (voucher-service.ts, billing/vouchers UI) must be
--     updated to use the new enum values in Phase 3.
-- ==================================================================

BEGIN;

-- ── 1. Backfill biz_voucher_type from legacy voucher_type values ──

UPDATE org_fin_vouchers_mst
SET biz_voucher_type = CASE voucher_type
  WHEN 'RECEIPT'    THEN 'RECEIPT_VOUCHER'
  WHEN 'PAYMENT'    THEN 'PAYMENT_VOUCHER'
  WHEN 'CREDIT'     THEN 'REFUND_VOUCHER'
  WHEN 'ADJUSTMENT' THEN 'ADJUSTMENT_VOUCHER'
  ELSE 'RECEIPT_VOUCHER'
END
WHERE biz_voucher_type IS NULL
  AND voucher_type IS NOT NULL;

-- ── 2. Drop the old voucher_type column ──────────────────────────

ALTER TABLE org_fin_vouchers_mst DROP COLUMN IF EXISTS voucher_type;

-- ── 3. Rename bridge column to the final name ─────────────────────

ALTER TABLE org_fin_vouchers_mst RENAME COLUMN biz_voucher_type TO voucher_type;

-- ── 4. Rename CHECK constraint to reflect the final column name ───

ALTER TABLE org_fin_vouchers_mst
  RENAME CONSTRAINT chk_fin_biz_voucher_type TO chk_fin_voucher_type;

-- ── 5. Replace bridge index with final index ──────────────────────

DROP INDEX IF EXISTS idx_fin_vouchers_biz_type;

CREATE INDEX IF NOT EXISTS idx_fin_vouchers_type
  ON org_fin_vouchers_mst (tenant_org_id, voucher_type, voucher_status);

COMMIT;
