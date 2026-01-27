-- ==================================================================
-- Order Item Pieces Detail Table
-- Migration: 0073_org_order_item_pieces_dtl
-- Purpose: Create table for piece-level tracking of order items
--          Used when USE_TRACK_BY_PIECE tenant setting is enabled
-- Created: 2026-01-XX
-- ==================================================================

BEGIN;

-- ==================================================================
-- CREATE TABLE: org_order_item_pieces_dtl
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_order_item_pieces_dtl (
  -- Primary key
  id                   UUID                 NOT NULL DEFAULT gen_random_uuid(),
  
  -- Tenant and order references
  tenant_org_id        UUID                 NOT NULL,
  order_id             UUID                 NOT NULL,
  order_item_id        UUID                 NOT NULL,
  
  -- Piece identification
  piece_seq            INTEGER              NOT NULL,
  piece_code           TEXT                 GENERATED ALWAYS AS (
    order_id::text || '-' || order_item_id::text || '-' || piece_seq
  ) STORED,
  
  -- Product and service category
  service_category_code VARCHAR(120)         NULL,
  product_id           UUID                 NULL,
  
  -- Scanning and tracking
  scan_state           TEXT                 NULL,
  barcode              TEXT                 NULL,
  
  -- Pricing
  quantity             INTEGER              NULL DEFAULT 1,
  price_per_unit       DECIMAL(19,4)        NOT NULL,
  total_price          DECIMAL(19,4)        NOT NULL,
  
  -- Status and workflow
  is_ready             BOOLEAN              not null default false,
  piece_status         TEXT                 NULL DEFAULT 'processing',
  piece_stage          TEXT                 NULL,
  is_rejected          BOOLEAN              NULL DEFAULT false,
  issue_id             UUID                 NULL,
  
  -- Location tracking
  rack_location        TEXT                 NULL,
  
  -- Step tracking
  last_step_at         TIMESTAMP            NULL,
  last_step_by         TEXT                 NULL,
  last_step            TEXT                 NULL,
  
  -- Notes
  notes                TEXT                 NULL,
  
  -- Item details
  color                VARCHAR(50)          NULL,
  brand                VARCHAR(100)         NULL,
  has_stain            BOOLEAN              NULL,
  has_damage           BOOLEAN              NULL,
  
  -- Metadata
  metadata             JSONB                NULL DEFAULT '{}'::jsonb,
  
  -- Audit fields
  created_at           TIMESTAMP            NULL DEFAULT CURRENT_TIMESTAMP,
  rec_order            INTEGER              NULL,
  rec_notes            TEXT                 NULL,
  rec_status           SMALLINT             NULL DEFAULT 1,
  created_by           TEXT                 NULL,
  created_info         TEXT                 NULL,
  updated_at           TIMESTAMP            NULL,
  updated_by           TEXT                 NULL,
  updated_info         TEXT                 NULL,
  
  -- Primary key constraint
  CONSTRAINT PK_ORG_ORDER_ITEM_PIECES_DTL PRIMARY KEY (id),
  
  -- Unique constraint: one piece_seq per order_item_id within tenant
  CONSTRAINT AK_PIECE_SEQ_UNIQUE_ORD_ITEM UNIQUE (tenant_org_id, order_id, order_item_id, piece_seq)
);

-- ==================================================================
-- TABLE AND COLUMN COMMENTS
-- ==================================================================

COMMENT ON TABLE org_order_item_pieces_dtl IS 
  'Items Pieces, Optional table if in settings USE_TRACK_BY_PIECE is true';

COMMENT ON COLUMN org_order_item_pieces_dtl.piece_code IS 
  'Generated always as (order_id::text || ''-'' || order_item_id::text || ''-'' || piece_seq) stored';

COMMENT ON COLUMN org_order_item_pieces_dtl.scan_state IS 
  'expected, scanned, missing, wrong';

COMMENT ON COLUMN org_order_item_pieces_dtl.piece_status IS 
  'intake, processing, qa, ready';

-- ==================================================================
-- FOREIGN KEY CONSTRAINTS
-- ==================================================================

-- Foreign key to order item
ALTER TABLE org_order_item_pieces_dtl
  ADD CONSTRAINT FK_ORG_ORDE_REFERENCE_ORG_ORDE 
  FOREIGN KEY (order_item_id)
  REFERENCES org_order_items_dtl(id)
  ON DELETE RESTRICT 
  ON UPDATE RESTRICT;

-- Foreign key to tenant (for tenant isolation)
ALTER TABLE org_order_item_pieces_dtl
  ADD CONSTRAINT FK_ORG_PIECES_TENANT
  FOREIGN KEY (tenant_org_id)
  REFERENCES org_tenants_mst(id)
  ON DELETE CASCADE;

-- Foreign key to order (for referential integrity)
ALTER TABLE org_order_item_pieces_dtl
  ADD CONSTRAINT FK_ORG_PIECES_ORDER
  FOREIGN KEY (order_id)
  REFERENCES org_orders_mst(id)
  ON DELETE CASCADE;

-- Optional: Foreign key to product (if product_id is set)
ALTER TABLE org_order_item_pieces_dtl
  ADD CONSTRAINT FK_ORG_PIECES_PRODUCT
  FOREIGN KEY (product_id)
  REFERENCES org_product_data_mst(id)
  ON DELETE SET NULL;

-- Optional: Composite FK to service category (if service_category_code is set)
ALTER TABLE org_order_item_pieces_dtl
  ADD CONSTRAINT FK_ORG_PIECES_SERVICE_CATEGORY
  FOREIGN KEY (tenant_org_id, service_category_code)
  REFERENCES org_service_category_cf(tenant_org_id, service_category_code)
  ON DELETE SET NULL;

-- ==================================================================
-- INDEXES (Performance Optimization)
-- ==================================================================

-- Tenant isolation index
CREATE INDEX IF NOT EXISTS idx_order_pieces_tenant 
  ON org_order_item_pieces_dtl(tenant_org_id);

-- Order item lookup
CREATE INDEX IF NOT EXISTS idx_order_pieces_order_item 
  ON org_order_item_pieces_dtl(order_id, order_item_id);

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_order_pieces_status 
  ON org_order_item_pieces_dtl(tenant_org_id, piece_status);

-- Scan state filtering
CREATE INDEX IF NOT EXISTS idx_order_pieces_scan_state 
  ON org_order_item_pieces_dtl(tenant_org_id, scan_state);

-- Barcode lookup (partial index for non-null barcodes)
CREATE INDEX IF NOT EXISTS idx_order_pieces_barcode 
  ON org_order_item_pieces_dtl(barcode) 
  WHERE barcode IS NOT NULL;

-- Rejection filtering
CREATE INDEX IF NOT EXISTS idx_order_pieces_rejected 
  ON org_order_item_pieces_dtl(tenant_org_id, is_rejected) 
  WHERE is_rejected = true;

-- Rack location lookup
CREATE INDEX IF NOT EXISTS idx_order_pieces_rack_location 
  ON org_order_item_pieces_dtl(tenant_org_id, rack_location) 
  WHERE rack_location IS NOT NULL;

-- Created date for sorting
CREATE INDEX IF NOT EXISTS idx_order_pieces_created 
  ON org_order_item_pieces_dtl(tenant_org_id, created_at DESC);

-- Composite index for common queries (order + item + status)
CREATE INDEX IF NOT EXISTS idx_order_pieces_order_item_status 
  ON org_order_item_pieces_dtl(order_id, order_item_id, piece_status);

-- ==================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==================================================================

-- Enable RLS
ALTER TABLE org_order_item_pieces_dtl ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy (using current_tenant_id() function)
DROP POLICY IF EXISTS tenant_isolation_org_order_pieces ON org_order_item_pieces_dtl;
CREATE POLICY tenant_isolation_org_order_pieces ON org_order_item_pieces_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_org_order_pieces ON org_order_item_pieces_dtl IS 
  'Allow users to access order item pieces for their current tenant';

-- Service role policy (for admin operations)
DROP POLICY IF EXISTS service_role_org_order_pieces ON org_order_item_pieces_dtl;
CREATE POLICY service_role_org_order_pieces ON org_order_item_pieces_dtl
  FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
  );

COMMENT ON POLICY service_role_org_order_pieces ON org_order_item_pieces_dtl IS 
  'Allow service role to access all order item pieces';

-- ==================================================================
-- CHECK CONSTRAINTS
-- ==================================================================

-- Ensure quantity is positive
ALTER TABLE org_order_item_pieces_dtl
  ADD CONSTRAINT chk_pieces_quantity_positive
  CHECK (quantity IS NULL OR quantity > 0);

-- Ensure price_per_unit is non-negative
ALTER TABLE org_order_item_pieces_dtl
  ADD CONSTRAINT chk_pieces_price_non_negative
  CHECK (price_per_unit >= 0);

-- Ensure total_price is non-negative
ALTER TABLE org_order_item_pieces_dtl
  ADD CONSTRAINT chk_pieces_total_price_non_negative
  CHECK (total_price >= 0);

-- Ensure piece_seq is positive
ALTER TABLE org_order_item_pieces_dtl
  ADD CONSTRAINT chk_pieces_seq_positive
  CHECK (piece_seq > 0);

COMMIT;

