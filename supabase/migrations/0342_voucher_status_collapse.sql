-- Phase A: Voucher status triple-column collapse
-- Drops legacy `status` column from org_fin_vouchers_mst.
--
-- Background: org_fin_vouchers_mst has three status-related columns:
--   status        (draft/issued/voided)  — legacy, pre-BVM. REMOVE.
--   voucher_status (DRAFT/POSTED/CANCELLED/REVERSED/PARTIALLY_REVERSED) — BVM canonical. KEEP.
--   posting_status (NOT_POSTED/POSTED/POSTING_FAILED) — GL state. KEEP.
--
-- Legacy value mapping (applied in migration 0328):
--   draft  → DRAFT
--   issued → POSTED
--   voided → CANCELLED
--
-- Pre-condition: all TS readers migrated (Steps A-1 through A-4); typecheck + build green.

BEGIN;

-- Safety guard: abort if any row still has NULL voucher_status
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM org_fin_vouchers_mst WHERE voucher_status IS NULL LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Abort: found NULL voucher_status rows. Run backfill first before dropping legacy status column.';
  END IF;
END $$;

-- Drop legacy status column (backfilled + synced in migration 0328)
ALTER TABLE org_fin_vouchers_mst DROP COLUMN IF EXISTS status RESTRICT;

-- Enforce NOT NULL on voucher_status now that all rows are confirmed to have a value
ALTER TABLE org_fin_vouchers_mst ALTER COLUMN voucher_status SET NOT NULL;

-- posting_status kept — tracks GL posting state, separate concern from BVM lifecycle.
-- Old CHECK constraint on `status` (draft|issued|voided) drops automatically with the column.

COMMIT;
