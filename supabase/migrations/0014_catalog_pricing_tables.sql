-- ==================================================================
-- 0014_catalog_pricing_tables.sql
-- Purpose: Add flexible pricing tables for catalog management
-- Author: CleanMateX Development Team
-- Created: 2025-10-31
-- Dependencies: 0001_core_schema.sql
-- PRD: 007_catalog_service_management_dev_prd.md
-- ==================================================================
-- This migration creates:
-- - org_price_lists_mst: Price list headers (standard, express, VIP, seasonal)
-- - org_price_list_items_dtl: Price list line items
-- - RLS policies for tenant isolation
-- - Indexes for performance
-- ==================================================================

BEGIN;

-- ==================================================================
-- ADD MISSING UNIQUE CONSTRAINT FOR COMPOSITE FOREIGN KEYS
-- ==================================================================

-- Add unique constraint for tenant+product for foreign key reference
-- Note: id is already unique as PK, so (tenant_org_id, id) is effectively unique
-- but we need to create an explicit unique constraint for FK reference
ALTER TABLE org_product_data_mst
  ADD CONSTRAINT uk_org_products_tenant_id 
  UNIQUE (tenant_org_id, id);

-- ==================================================================
-- PRICE LIST MASTER TABLE
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_price_lists_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  name2 VARCHAR(255),                    -- Arabic name
  description TEXT,
  description2 TEXT,                     -- Arabic description
  price_list_type VARCHAR(50) NOT NULL,  -- 'standard', 'express', 'vip', 'seasonal', 'b2b'
  effective_from DATE,
  effective_to DATE,
  is_default BOOLEAN DEFAULT FALSE,      -- Default price list for type
  priority INTEGER DEFAULT 0,            -- Higher priority overrides lower
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Foreign keys
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  
  -- Constraints
  CONSTRAINT valid_price_list_type CHECK (
    price_list_type IN ('standard', 'express', 'vip', 'seasonal', 'b2b', 'promotional')
  ),
  CONSTRAINT valid_date_range CHECK (
    effective_from IS NULL OR effective_to IS NULL OR effective_from <= effective_to
  )
);

COMMENT ON TABLE org_price_lists_mst IS 'Tenant price list headers for flexible pricing strategies';
COMMENT ON COLUMN org_price_lists_mst.name IS 'Price list name (English)';
COMMENT ON COLUMN org_price_lists_mst.name2 IS 'Price list name (Arabic)';
COMMENT ON COLUMN org_price_lists_mst.price_list_type IS 'Type: standard, express, vip, seasonal, b2b, promotional';
COMMENT ON COLUMN org_price_lists_mst.effective_from IS 'Start date for this price list (NULL = always active)';
COMMENT ON COLUMN org_price_lists_mst.effective_to IS 'End date for this price list (NULL = no expiry)';
COMMENT ON COLUMN org_price_lists_mst.is_default IS 'Default price list for this type';
COMMENT ON COLUMN org_price_lists_mst.priority IS 'Priority for overlapping price lists (higher wins)';

-- ==================================================================
-- PRICE LIST ITEMS DETAIL TABLE
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_price_list_items_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  price_list_id UUID NOT NULL,
  product_id UUID NOT NULL,
  price NUMERIC(10,3) NOT NULL,
  discount_percent NUMERIC(5,2) DEFAULT 0,  -- Optional discount
  min_quantity INTEGER DEFAULT 1,            -- Minimum quantity for this price
  max_quantity INTEGER,                      -- Maximum quantity (NULL = unlimited)
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Foreign keys with composite tenant isolation
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  FOREIGN KEY (price_list_id) REFERENCES org_price_lists_mst(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_org_id, product_id) REFERENCES org_product_data_mst(tenant_org_id, id) ON DELETE CASCADE,
  
  -- Constraints
  CONSTRAINT positive_price CHECK (price >= 0),
  CONSTRAINT valid_discount CHECK (discount_percent >= 0 AND discount_percent <= 100),
  CONSTRAINT valid_quantity_range CHECK (
    min_quantity > 0 AND (max_quantity IS NULL OR max_quantity >= min_quantity)
  ),
  CONSTRAINT unique_price_list_product UNIQUE (price_list_id, product_id, min_quantity)
);

COMMENT ON TABLE org_price_list_items_dtl IS 'Price list line items linking products to prices';
COMMENT ON COLUMN org_price_list_items_dtl.price IS 'Price for this product in this price list';
COMMENT ON COLUMN org_price_list_items_dtl.discount_percent IS 'Optional discount percentage';
COMMENT ON COLUMN org_price_list_items_dtl.min_quantity IS 'Minimum quantity for this price tier';
COMMENT ON COLUMN org_price_list_items_dtl.max_quantity IS 'Maximum quantity for this price tier (NULL = unlimited)';

-- ==================================================================
-- INDEXES
-- ==================================================================

-- Price Lists
CREATE INDEX IF NOT EXISTS idx_price_lists_tenant 
  ON org_price_lists_mst(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_price_lists_tenant_active 
  ON org_price_lists_mst(tenant_org_id, is_active);

CREATE INDEX IF NOT EXISTS idx_price_lists_type 
  ON org_price_lists_mst(tenant_org_id, price_list_type, is_active);

CREATE INDEX IF NOT EXISTS idx_price_lists_dates 
  ON org_price_lists_mst(tenant_org_id, effective_from, effective_to) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_price_lists_default 
  ON org_price_lists_mst(tenant_org_id, price_list_type, is_default) 
  WHERE is_active = true AND is_default = true;

-- Price List Items
CREATE INDEX IF NOT EXISTS idx_price_list_items_tenant 
  ON org_price_list_items_dtl(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_price_list_items_list 
  ON org_price_list_items_dtl(price_list_id);

CREATE INDEX IF NOT EXISTS idx_price_list_items_product 
  ON org_price_list_items_dtl(tenant_org_id, product_id);

CREATE INDEX IF NOT EXISTS idx_price_list_items_active 
  ON org_price_list_items_dtl(price_list_id, is_active);

-- ==================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==================================================================

-- Enable RLS
ALTER TABLE org_price_lists_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_price_list_items_dtl ENABLE ROW LEVEL SECURITY;

-- Price Lists Policies
CREATE POLICY tenant_isolation_policy ON org_price_lists_mst
  FOR ALL
  USING (tenant_org_id = (auth.jwt() ->> 'tenant_org_id')::uuid);

CREATE POLICY service_role_policy ON org_price_lists_mst
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Price List Items Policies
CREATE POLICY tenant_isolation_policy ON org_price_list_items_dtl
  FOR ALL
  USING (tenant_org_id = (auth.jwt() ->> 'tenant_org_id')::uuid);

CREATE POLICY service_role_policy ON org_price_list_items_dtl
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ==================================================================
-- HELPER FUNCTIONS
-- ==================================================================

-- Function to get active price for a product
CREATE OR REPLACE FUNCTION get_product_price(
  p_tenant_org_id UUID,
  p_product_id UUID,
  p_price_list_type VARCHAR(50) DEFAULT 'standard',
  p_quantity INTEGER DEFAULT 1,
  p_effective_date DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC(10,3)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_price NUMERIC(10,3);
BEGIN
  -- Get price from active price list
  SELECT pli.price * (1 - COALESCE(pli.discount_percent, 0) / 100)
  INTO v_price
  FROM org_price_list_items_dtl pli
  JOIN org_price_lists_mst pl ON pli.price_list_id = pl.id
  WHERE pli.tenant_org_id = p_tenant_org_id
    AND pli.product_id = p_product_id
    AND pli.is_active = true
    AND pl.is_active = true
    AND pl.price_list_type = p_price_list_type
    AND (pl.effective_from IS NULL OR pl.effective_from <= p_effective_date)
    AND (pl.effective_to IS NULL OR pl.effective_to >= p_effective_date)
    AND pli.min_quantity <= p_quantity
    AND (pli.max_quantity IS NULL OR pli.max_quantity >= p_quantity)
  ORDER BY pl.priority DESC, pli.min_quantity DESC
  LIMIT 1;
  
  -- If no price list price found, fall back to product default price
  IF v_price IS NULL THEN
    SELECT 
      CASE 
        WHEN p_price_list_type = 'express' THEN COALESCE(default_express_sell_price, default_sell_price)
        ELSE default_sell_price
      END
    INTO v_price
    FROM org_product_data_mst
    WHERE tenant_org_id = p_tenant_org_id
      AND id = p_product_id
      AND is_active = true;
  END IF;
  
  RETURN v_price;
END;
$$;

COMMENT ON FUNCTION get_product_price IS 'Get active price for a product considering price lists and quantity tiers';

COMMIT;

