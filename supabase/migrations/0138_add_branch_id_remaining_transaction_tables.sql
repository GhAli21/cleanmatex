-- Migration 0138: Add branch_id to remaining transaction tables
-- Completes full branch coverage across all operational transaction tables
-- Tables covered: org_order_items_dtl, org_order_item_pieces_dtl,
--   org_order_item_processing_steps, org_asm_exceptions_tr,
--   org_dlv_stops_dtl, org_dlv_pod_tr, org_qa_decisions_tr,
--   org_pck_packing_lists_mst
-- Pattern: nullable UUID, composite FK (branch_id, tenant_org_id) → org_branches_mst(id, tenant_org_id),
--          partial index WHERE branch_id IS NOT NULL, backfill from parent chain

BEGIN;

-- =============================================================================
-- 1. org_order_items_dtl
-- =============================================================================
ALTER TABLE org_order_items_dtl
  ADD COLUMN IF NOT EXISTS branch_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_ord_items_branch' AND table_name = 'org_order_items_dtl'
  ) THEN
    ALTER TABLE org_order_items_dtl
      ADD CONSTRAINT fk_ord_items_branch
      FOREIGN KEY (branch_id, tenant_org_id)
      REFERENCES org_branches_mst(id, tenant_org_id)
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ord_items_branch
  ON org_order_items_dtl(tenant_org_id, branch_id)
  WHERE branch_id IS NOT NULL;

COMMENT ON COLUMN org_order_items_dtl.branch_id IS 'Branch where order item was processed';

-- Backfill from order
UPDATE org_order_items_dtl i
SET branch_id = o.branch_id
FROM org_orders_mst o
WHERE i.order_id = o.id
  AND i.branch_id IS NULL
  AND o.branch_id IS NOT NULL;

-- =============================================================================
-- 2. org_order_item_pieces_dtl
-- =============================================================================
ALTER TABLE org_order_item_pieces_dtl
  ADD COLUMN IF NOT EXISTS branch_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_ord_pieces_branch' AND table_name = 'org_order_item_pieces_dtl'
  ) THEN
    ALTER TABLE org_order_item_pieces_dtl
      ADD CONSTRAINT fk_ord_pieces_branch
      FOREIGN KEY (branch_id, tenant_org_id)
      REFERENCES org_branches_mst(id, tenant_org_id)
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ord_pieces_branch
  ON org_order_item_pieces_dtl(tenant_org_id, branch_id)
  WHERE branch_id IS NOT NULL;

COMMENT ON COLUMN org_order_item_pieces_dtl.branch_id IS 'Branch where garment piece was processed';

-- Backfill from order
UPDATE org_order_item_pieces_dtl p
SET branch_id = o.branch_id
FROM org_orders_mst o
WHERE p.order_id = o.id
  AND p.branch_id IS NULL
  AND o.branch_id IS NOT NULL;

-- =============================================================================
-- 3. org_order_item_processing_steps
-- =============================================================================
ALTER TABLE org_order_item_processing_steps
  ADD COLUMN IF NOT EXISTS branch_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_ord_proc_steps_branch' AND table_name = 'org_order_item_processing_steps'
  ) THEN
    ALTER TABLE org_order_item_processing_steps
      ADD CONSTRAINT fk_ord_proc_steps_branch
      FOREIGN KEY (branch_id, tenant_org_id)
      REFERENCES org_branches_mst(id, tenant_org_id)
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ord_proc_steps_branch
  ON org_order_item_processing_steps(tenant_org_id, branch_id)
  WHERE branch_id IS NOT NULL;

COMMENT ON COLUMN org_order_item_processing_steps.branch_id IS 'Branch where processing step was executed';

-- Backfill from order
UPDATE org_order_item_processing_steps s
SET branch_id = o.branch_id
FROM org_orders_mst o
WHERE s.order_id = o.id
  AND s.branch_id IS NULL
  AND o.branch_id IS NOT NULL;

-- =============================================================================
-- 4. org_asm_exceptions_tr
-- (org_asm_tasks_mst already has branch_id — use it as backfill source)
-- =============================================================================
ALTER TABLE org_asm_exceptions_tr
  ADD COLUMN IF NOT EXISTS branch_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_asm_exc_branch' AND table_name = 'org_asm_exceptions_tr'
  ) THEN
    ALTER TABLE org_asm_exceptions_tr
      ADD CONSTRAINT fk_asm_exc_branch
      FOREIGN KEY (branch_id, tenant_org_id)
      REFERENCES org_branches_mst(id, tenant_org_id)
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_asm_exc_branch
  ON org_asm_exceptions_tr(tenant_org_id, branch_id)
  WHERE branch_id IS NOT NULL;

COMMENT ON COLUMN org_asm_exceptions_tr.branch_id IS 'Branch where assembly exception occurred';

-- Backfill from assembly task (task already has branch_id)
UPDATE org_asm_exceptions_tr e
SET branch_id = t.branch_id
FROM org_asm_tasks_mst t
WHERE e.task_id = t.id
  AND e.branch_id IS NULL
  AND t.branch_id IS NOT NULL;

-- =============================================================================
-- 5. org_dlv_stops_dtl
-- (org_dlv_routes_mst already has branch_id — use as primary backfill source)
-- =============================================================================
ALTER TABLE org_dlv_stops_dtl
  ADD COLUMN IF NOT EXISTS branch_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_dlv_stops_branch' AND table_name = 'org_dlv_stops_dtl'
  ) THEN
    ALTER TABLE org_dlv_stops_dtl
      ADD CONSTRAINT fk_dlv_stops_branch
      FOREIGN KEY (branch_id, tenant_org_id)
      REFERENCES org_branches_mst(id, tenant_org_id)
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dlv_stops_branch
  ON org_dlv_stops_dtl(tenant_org_id, branch_id)
  WHERE branch_id IS NOT NULL;

COMMENT ON COLUMN org_dlv_stops_dtl.branch_id IS 'Branch originating this delivery stop';

-- Backfill from delivery route (primary source)
UPDATE org_dlv_stops_dtl s
SET branch_id = r.branch_id
FROM org_dlv_routes_mst r
WHERE s.route_id = r.id
  AND s.branch_id IS NULL
  AND r.branch_id IS NOT NULL;

-- Fallback: backfill from order
UPDATE org_dlv_stops_dtl s
SET branch_id = o.branch_id
FROM org_orders_mst o
WHERE s.order_id = o.id
  AND s.branch_id IS NULL
  AND o.branch_id IS NOT NULL;

-- =============================================================================
-- 6. org_dlv_pod_tr
-- (backfill via org_dlv_stops_dtl which was just filled above)
-- =============================================================================
ALTER TABLE org_dlv_pod_tr
  ADD COLUMN IF NOT EXISTS branch_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_dlv_pod_branch' AND table_name = 'org_dlv_pod_tr'
  ) THEN
    ALTER TABLE org_dlv_pod_tr
      ADD CONSTRAINT fk_dlv_pod_branch
      FOREIGN KEY (branch_id, tenant_org_id)
      REFERENCES org_branches_mst(id, tenant_org_id)
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dlv_pod_branch
  ON org_dlv_pod_tr(tenant_org_id, branch_id)
  WHERE branch_id IS NOT NULL;

COMMENT ON COLUMN org_dlv_pod_tr.branch_id IS 'Branch associated with this proof of delivery';

-- Backfill from stop (stop was filled in step 5 above)
UPDATE org_dlv_pod_tr p
SET branch_id = s.branch_id
FROM org_dlv_stops_dtl s
WHERE p.stop_id = s.id
  AND p.branch_id IS NULL
  AND s.branch_id IS NOT NULL;

-- =============================================================================
-- 7. org_qa_decisions_tr
-- =============================================================================
ALTER TABLE org_qa_decisions_tr
  ADD COLUMN IF NOT EXISTS branch_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_qa_dec_branch' AND table_name = 'org_qa_decisions_tr'
  ) THEN
    ALTER TABLE org_qa_decisions_tr
      ADD CONSTRAINT fk_qa_dec_branch
      FOREIGN KEY (branch_id, tenant_org_id)
      REFERENCES org_branches_mst(id, tenant_org_id)
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_qa_dec_branch
  ON org_qa_decisions_tr(tenant_org_id, branch_id)
  WHERE branch_id IS NOT NULL;

COMMENT ON COLUMN org_qa_decisions_tr.branch_id IS 'Branch where QA decision was made';

-- Backfill from order
UPDATE org_qa_decisions_tr q
SET branch_id = o.branch_id
FROM org_orders_mst o
WHERE q.order_id = o.id
  AND q.branch_id IS NULL
  AND o.branch_id IS NOT NULL;

-- =============================================================================
-- 8. org_pck_packing_lists_mst
-- =============================================================================
ALTER TABLE org_pck_packing_lists_mst
  ADD COLUMN IF NOT EXISTS branch_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_pck_list_branch' AND table_name = 'org_pck_packing_lists_mst'
  ) THEN
    ALTER TABLE org_pck_packing_lists_mst
      ADD CONSTRAINT fk_pck_list_branch
      FOREIGN KEY (branch_id, tenant_org_id)
      REFERENCES org_branches_mst(id, tenant_org_id)
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pck_list_branch
  ON org_pck_packing_lists_mst(tenant_org_id, branch_id)
  WHERE branch_id IS NOT NULL;

COMMENT ON COLUMN org_pck_packing_lists_mst.branch_id IS 'Branch where packing was performed';

-- Backfill from order (primary source)
UPDATE org_pck_packing_lists_mst p
SET branch_id = o.branch_id
FROM org_orders_mst o
WHERE p.order_id = o.id
  AND p.branch_id IS NULL
  AND o.branch_id IS NOT NULL;

-- Fallback: backfill from assembly task
UPDATE org_pck_packing_lists_mst p
SET branch_id = t.branch_id
FROM org_asm_tasks_mst t
WHERE p.task_id = t.id
  AND p.branch_id IS NULL
  AND t.branch_id IS NOT NULL;

COMMIT;
