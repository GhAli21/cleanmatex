-- ==================================================================
-- 0100_inventory_stock_management.sql
-- Purpose: Add inventory stock tracking columns to org_product_data_mst
--          and create stock transaction table for movement history
-- Dependencies: 0001_core_schema.sql, 0045_catalog_system_2027_architecture.sql
-- ==================================================================

BEGIN;

-- ==================================================================
-- PART 1: ADD INVENTORY COLUMNS TO org_product_data_mst
-- ==================================================================

ALTER TABLE org_product_data_mst
  ADD COLUMN IF NOT EXISTS qty_on_hand        DECIMAL(19,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reorder_point      DECIMAL(19,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_stock_level    DECIMAL(19,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_stock_level    DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS last_purchase_cost DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS storage_location   VARCHAR(100);

COMMENT ON COLUMN org_product_data_mst.qty_on_hand IS 'Current quantity on hand (inventory tracking)';
COMMENT ON COLUMN org_product_data_mst.reorder_point IS 'Quantity threshold for low-stock alert';
COMMENT ON COLUMN org_product_data_mst.min_stock_level IS 'Minimum stock level allowed';
COMMENT ON COLUMN org_product_data_mst.max_stock_level IS 'Maximum stock level capacity';
COMMENT ON COLUMN org_product_data_mst.last_purchase_cost IS 'Cost from the most recent purchase';
COMMENT ON COLUMN org_product_data_mst.storage_location IS 'Physical storage location / bin';

-- Index for low-stock alert queries (retail items where qty <= reorder_point)
CREATE INDEX IF NOT EXISTS idx_prod_low_stock
  ON org_product_data_mst (tenant_org_id, qty_on_hand, reorder_point)
  WHERE is_retail_item = true AND is_active = true;

-- Index for inventory listing (retail items)
CREATE INDEX IF NOT EXISTS idx_prod_retail_active
  ON org_product_data_mst (tenant_org_id, is_retail_item, is_active)
  WHERE is_retail_item = true;

-- ==================================================================
-- PART 2: CREATE org_inv_stock_tr (Stock Transactions)
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_inv_stock_tr (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID        NOT NULL,
  product_id        UUID        NOT NULL,
  transaction_no    VARCHAR(30),
  transaction_date  TIMESTAMPTZ NOT NULL DEFAULT now(),
  transaction_type  VARCHAR(20) NOT NULL,
  quantity          DECIMAL(19,4) NOT NULL,
  unit_cost         DECIMAL(19,4),
  total_cost        DECIMAL(19,4),
  qty_before        DECIMAL(19,4),
  qty_after         DECIMAL(19,4),
  reference_type    VARCHAR(30),
  reference_id      UUID,
  reference_no      VARCHAR(50),
  reason            VARCHAR(200),
  notes             TEXT,
  processed_by      UUID,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  rec_status        SMALLINT    DEFAULT 1,
  created_at        TIMESTAMPTZ DEFAULT now(),
  created_by        TEXT,
  created_info      TEXT,
  updated_at        TIMESTAMPTZ,
  updated_by        TEXT,
  updated_info      TEXT,

  -- Composite unique for tenant isolation
  CONSTRAINT uk_inv_stock_tr_tenant UNIQUE (tenant_org_id, id),

  -- Foreign keys
  CONSTRAINT fk_inv_stock_tenant
    FOREIGN KEY (tenant_org_id)
    REFERENCES org_tenants_mst (id) ON DELETE CASCADE,

  CONSTRAINT fk_inv_stock_product
    FOREIGN KEY (product_id, tenant_org_id)
    REFERENCES org_product_data_mst (id, tenant_org_id),

  -- Validate transaction_type
  CONSTRAINT chk_inv_stock_type
    CHECK (transaction_type IN ('STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT'))
);

COMMENT ON TABLE  org_inv_stock_tr IS 'Inventory stock movement transactions';
COMMENT ON COLUMN org_inv_stock_tr.product_id IS 'FK to org_product_data_mst (retail item)';
COMMENT ON COLUMN org_inv_stock_tr.transaction_type IS 'STOCK_IN | STOCK_OUT | ADJUSTMENT';
COMMENT ON COLUMN org_inv_stock_tr.quantity IS 'Positive for IN, negative for OUT';
COMMENT ON COLUMN org_inv_stock_tr.qty_before IS 'Snapshot: qty_on_hand before transaction';
COMMENT ON COLUMN org_inv_stock_tr.qty_after IS 'Snapshot: qty_on_hand after transaction';
COMMENT ON COLUMN org_inv_stock_tr.reference_type IS 'ORDER | PURCHASE | MANUAL';

-- Indexes
CREATE INDEX idx_inv_stock_tenant
  ON org_inv_stock_tr (tenant_org_id);

CREATE INDEX idx_inv_stock_product
  ON org_inv_stock_tr (tenant_org_id, product_id, transaction_date DESC);

CREATE INDEX idx_inv_stock_type
  ON org_inv_stock_tr (tenant_org_id, transaction_type);

CREATE INDEX idx_inv_stock_date
  ON org_inv_stock_tr (tenant_org_id, transaction_date DESC);

-- ==================================================================
-- PART 3: RLS POLICIES
-- ==================================================================

ALTER TABLE org_inv_stock_tr ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_inv_stock_tr ON org_inv_stock_tr
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()))
  WITH CHECK (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

CREATE POLICY service_role_org_inv_stock_tr ON org_inv_stock_tr
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ==================================================================
-- PART 4: TRIGGER FOR updated_at
-- ==================================================================

CREATE OR REPLACE FUNCTION trg_inv_stock_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_inv_stock_updated
  BEFORE UPDATE ON org_inv_stock_tr
  FOR EACH ROW
  EXECUTE FUNCTION trg_inv_stock_updated();

COMMIT;
