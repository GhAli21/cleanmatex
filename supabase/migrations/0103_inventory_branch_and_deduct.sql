-- ==================================================================
-- 0103_inventory_branch_and_deduct.sql
-- Purpose: Add branch-level stock tracking (org_inv_stock_by_branch),
--          add branch_id to org_inv_stock_tr, and create deduct_retail_stock_for_order function
-- Dependencies: 0101_inventory_stock_management.sql, 0102_sync_retail_item_category_triggers.sql
-- ==================================================================

BEGIN;

-- ==================================================================
-- PART 1: CREATE org_inv_stock_by_branch
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_inv_stock_by_branch (
  tenant_org_id       UUID        NOT NULL,
  product_id          UUID        NOT NULL,
  branch_id           UUID        NOT NULL,
  qty_on_hand         DECIMAL(19,4) DEFAULT 0,
  reorder_point       DECIMAL(19,4) DEFAULT 0,
  min_stock_level     DECIMAL(19,4) DEFAULT 0,
  max_stock_level     DECIMAL(19,4),
  last_purchase_cost  DECIMAL(19,4),
  storage_location    VARCHAR(100),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ,
  created_by          TEXT,
  updated_by          TEXT,

  PRIMARY KEY (tenant_org_id, product_id, branch_id),

  CONSTRAINT fk_inv_stock_branch_tenant
    FOREIGN KEY (tenant_org_id)
    REFERENCES org_tenants_mst (id) ON DELETE CASCADE,

  CONSTRAINT fk_inv_stock_branch_product
    FOREIGN KEY (product_id, tenant_org_id)
    REFERENCES org_product_data_mst (id, tenant_org_id),

  CONSTRAINT fk_inv_stock_branch_branch
    FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES org_branches_mst (id, tenant_org_id)
);

COMMENT ON TABLE org_inv_stock_by_branch IS 'Branch-level inventory stock for retail items';

CREATE INDEX IF NOT EXISTS idx_inv_stock_branch_tenant
  ON org_inv_stock_by_branch (tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_inv_stock_branch_product
  ON org_inv_stock_by_branch (tenant_org_id, product_id);

CREATE INDEX IF NOT EXISTS idx_inv_stock_branch_branch
  ON org_inv_stock_by_branch (tenant_org_id, branch_id);

ALTER TABLE org_inv_stock_by_branch ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_inv_stock_by_branch ON org_inv_stock_by_branch
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()))
  WITH CHECK (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

CREATE POLICY service_role_org_inv_stock_by_branch ON org_inv_stock_by_branch
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ==================================================================
-- PART 2: ADD branch_id TO org_inv_stock_tr
-- ==================================================================

ALTER TABLE org_inv_stock_tr
  ADD COLUMN IF NOT EXISTS branch_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_inv_stock_tr_branch'
      AND table_name = 'org_inv_stock_tr'
  ) THEN
    ALTER TABLE org_inv_stock_tr
      ADD CONSTRAINT fk_inv_stock_tr_branch
      FOREIGN KEY (branch_id, tenant_org_id)
      REFERENCES org_branches_mst (id, tenant_org_id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN org_inv_stock_tr.branch_id IS 'Branch where stock movement occurred (NULL for legacy/single-branch)';

CREATE INDEX IF NOT EXISTS idx_inv_stock_tr_branch
  ON org_inv_stock_tr (tenant_org_id, branch_id, product_id, transaction_date DESC);

-- ==================================================================
-- PART 3: DROP OLD deduct_retail_stock_for_order (2-arg version)
-- ==================================================================

DROP FUNCTION IF EXISTS deduct_retail_stock_for_order(UUID, UUID);

-- ==================================================================
-- PART 4: CREATE deduct_retail_stock_for_order (3-arg with p_branch_id)
-- ==================================================================

CREATE OR REPLACE FUNCTION deduct_retail_stock_for_order(
  p_order_id       UUID,
  p_tenant_org_id UUID,
  p_branch_id     UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_qty_to_deduct DECIMAL(19,4);
  v_qty_before    DECIMAL(19,4);
  v_qty_after     DECIMAL(19,4);
  v_trans_no      VARCHAR(30);
  v_seq           INT := 0;
  v_today         VARCHAR(8);
BEGIN
  v_today := to_char(now(), 'YYYYMMDD');

  FOR r IN (
    SELECT oi.product_id, oi.quantity, p.is_retail_item
    FROM org_order_items_dtl oi
    JOIN org_product_data_mst p ON p.id = oi.product_id AND p.tenant_org_id = oi.tenant_org_id
    WHERE oi.order_id = p_order_id
      AND oi.tenant_org_id = p_tenant_org_id
      AND oi.product_id IS NOT NULL
      AND p.is_retail_item = true
      AND p.service_category_code = 'RETAIL_ITEMS'
  ) LOOP
    v_qty_to_deduct := r.quantity;

    IF p_branch_id IS NOT NULL THEN
      -- Branch-level: deduct from org_inv_stock_by_branch
      SELECT qty_on_hand INTO v_qty_before
      FROM org_inv_stock_by_branch
      WHERE tenant_org_id = p_tenant_org_id
        AND product_id = r.product_id
        AND branch_id = p_branch_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: Product % has no stock record for branch %', r.product_id, p_branch_id;
      END IF;

      v_qty_after := v_qty_before - v_qty_to_deduct;
      IF v_qty_after < 0 THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: Product % has insufficient stock (available: %, required: %)', r.product_id, v_qty_before, v_qty_to_deduct;
      END IF;

      UPDATE org_inv_stock_by_branch
      SET qty_on_hand = v_qty_after, updated_at = now()
      WHERE tenant_org_id = p_tenant_org_id
        AND product_id = r.product_id
        AND branch_id = p_branch_id;

    ELSE
      -- Legacy: deduct from org_product_data_mst.qty_on_hand
      SELECT qty_on_hand INTO v_qty_before
      FROM org_product_data_mst
      WHERE id = r.product_id
        AND tenant_org_id = p_tenant_org_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: Product % not found', r.product_id;
      END IF;

      v_qty_after := COALESCE(v_qty_before, 0) - v_qty_to_deduct;
      IF v_qty_after < 0 THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: Product % has insufficient stock (available: %, required: %)', r.product_id, COALESCE(v_qty_before, 0), v_qty_to_deduct;
      END IF;

      UPDATE org_product_data_mst
      SET qty_on_hand = v_qty_after, updated_at = now()
      WHERE id = r.product_id
        AND tenant_org_id = p_tenant_org_id;
    END IF;

    -- Insert stock transaction
    v_seq := v_seq + 1;
    v_trans_no := 'STK-' || v_today || '-' || lpad(v_seq::text, 4, '0');

    INSERT INTO org_inv_stock_tr (
      tenant_org_id, product_id, branch_id,
      transaction_no, transaction_type, quantity,
      qty_before, qty_after,
      reference_type, reference_id, reference_no,
      reason, is_active, rec_status
    ) VALUES (
      p_tenant_org_id, r.product_id, p_branch_id,
      v_trans_no, 'STOCK_OUT', -v_qty_to_deduct,
      v_qty_before, v_qty_after,
      'ORDER', p_order_id,
      (SELECT order_no FROM org_orders_mst WHERE id = p_order_id AND tenant_org_id = p_tenant_org_id),
      'Order sale deduction',
      true, 1
    );
  END LOOP;
END;
$$;

COMMENT ON FUNCTION deduct_retail_stock_for_order(UUID, UUID, UUID) IS
  'Deduct stock for retail items in an order. When p_branch_id provided: deduct from org_inv_stock_by_branch. When NULL: deduct from org_product_data_mst.qty_on_hand (legacy).';

-- ==================================================================
-- PART 5: DATA MIGRATION - Seed org_inv_stock_by_branch from qty_on_hand
-- ==================================================================
-- For each tenant with retail items, get first/default branch and copy qty_on_hand
INSERT INTO org_inv_stock_by_branch (
  tenant_org_id, product_id, branch_id,
  qty_on_hand, reorder_point, min_stock_level, max_stock_level,
  last_purchase_cost, storage_location
)
SELECT
  p.tenant_org_id,
  p.id,
  b.id,
  COALESCE(p.qty_on_hand, 0),
  COALESCE(p.reorder_point, 0),
  COALESCE(p.min_stock_level, 0),
  p.max_stock_level,
  p.last_purchase_cost,
  p.storage_location
FROM org_product_data_mst p
JOIN org_branches_mst b ON b.tenant_org_id = p.tenant_org_id AND b.is_active = true
WHERE p.is_retail_item = true
  AND p.service_category_code = 'RETAIL_ITEMS'
  AND p.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM org_inv_stock_by_branch s
    WHERE s.tenant_org_id = p.tenant_org_id
      AND s.product_id = p.id
      AND s.branch_id = b.id
  )
  AND b.id = (
    SELECT id FROM org_branches_mst
    WHERE tenant_org_id = p.tenant_org_id AND is_active = true
    ORDER BY COALESCE(is_main, false) DESC, s_date ASC
    LIMIT 1
  );

COMMIT;
