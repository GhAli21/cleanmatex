-- ==================================================================
-- 0109_enforce_branch_id_inv_stock_tr.sql
-- Purpose: Enforce branch_id NOT NULL on org_inv_stock_tr
--          All stock transactions must be associated with a branch.
-- Dependencies: 0103_inventory_branch_and_deduct.sql
-- ==================================================================

BEGIN;

-- ==================================================================
-- PART 1: BACKFILL NULL branch_ids
-- Assign the tenant's main branch (or first active branch) to any
-- existing transactions that have no branch set.
-- ==================================================================

UPDATE org_inv_stock_tr t
SET branch_id = (
  SELECT b.id
  FROM org_branches_mst b
  WHERE b.tenant_org_id = t.tenant_org_id
    AND b.is_active = true
  ORDER BY COALESCE(b.is_main, false) DESC, b.created_at NULLS LAST, b.id
  LIMIT 1
)
WHERE t.branch_id IS NULL
  AND EXISTS (
    SELECT 1 FROM org_branches_mst b
    WHERE b.tenant_org_id = t.tenant_org_id AND b.is_active = true
  );

-- ==================================================================
-- PART 2: DROP any remaining NULL rows (tenants with no branches -
-- edge case: soft-deleted or test data with no branch at all)
-- We mark them with a sentinel reference_type so they are auditable.
-- ==================================================================

-- Log count before cleanup (for audit awareness)
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM org_inv_stock_tr WHERE branch_id IS NULL;
  IF v_count > 0 THEN
    RAISE NOTICE 'org_inv_stock_tr: % rows still have NULL branch_id after backfill (tenants with no active branches). These will be set to rec_status=0 (soft-deleted).', v_count;
    -- Soft-delete orphaned rows rather than hard delete
    UPDATE org_inv_stock_tr
    SET rec_status = 0,
        is_active = false,
        notes = COALESCE(notes, '') || ' [branch_id enforcement migration: no branch found]'
    WHERE branch_id IS NULL;
  END IF;
END $$;

-- ==================================================================
-- PART 3: ADD NOT NULL CONSTRAINT
-- ==================================================================

ALTER TABLE org_inv_stock_tr
  ALTER COLUMN branch_id SET NOT NULL;

COMMENT ON COLUMN org_inv_stock_tr.branch_id IS 'Branch where stock movement occurred. Required — all stock transactions must be branch-scoped.';

-- ==================================================================
-- PART 4: UPDATE CHECK CONSTRAINT (add branch_id to documentation)
-- No change to data constraint — just update the table comment
-- ==================================================================

COMMENT ON TABLE org_inv_stock_tr IS 'Inventory stock movement transactions. Branch-scoped: branch_id is mandatory.';

-- ==================================================================
-- PART 5: ENSURE INDEX EXISTS (already created in 0103 but safety check)
-- ==================================================================

CREATE INDEX IF NOT EXISTS idx_inv_stock_tr_branch_product
  ON org_inv_stock_tr (tenant_org_id, branch_id, product_id, transaction_date DESC);

COMMIT;
