-- ==================================================================
-- 0045_catalog_system_2027_architecture.sql
-- Purpose: Create product catalog architecture for 2027+ scalability
-- Author: CleanMateX Development Team
-- Created: 2025-01-26
-- PRD: Product Catalog System Redesign
-- ==================================================================
-- This migration creates:
-- 1. sys_item_type_cd - Item type classifications (TOPS, BOTTOMS, RETAIL_GOODS, etc.)
-- 2. sys_service_prod_templates_cd - Product templates for tenant initialization
-- 3. Enhances org_product_data_mst with item_type_code
-- 4. Adds RETAIL_ITEMS service category
-- 5. Drops unused sys_service_type_cd table
-- ==================================================================

BEGIN;

-- ==================================================================
-- PART 1: CREATE sys_item_type_cd TABLE
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_item_type_cd (
  item_type_code VARCHAR(50) PRIMARY KEY,

  -- Display (bilingual)
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),                          -- Arabic
  description TEXT,
  description2 TEXT,                           -- Arabic

  -- UI
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),
  color VARCHAR(60),

  -- Classification
  is_garment BOOLEAN DEFAULT true,             -- Garment vs non-garment
  is_retail BOOLEAN DEFAULT false,             -- Retail product type

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,              -- System types cannot be deleted
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,

  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER
);

-- Indexes
CREATE INDEX idx_item_type_active ON sys_item_type_cd(is_active, display_order);
CREATE INDEX idx_item_type_garment ON sys_item_type_cd(is_garment) WHERE is_garment = true;
CREATE INDEX idx_item_type_retail ON sys_item_type_cd(is_retail) WHERE is_retail = true;

-- Comments
COMMENT ON TABLE sys_item_type_cd IS 'Item type classifications (TOPS, BOTTOMS, RETAIL_GOODS, etc.)';
COMMENT ON COLUMN sys_item_type_cd.is_garment IS 'True for garment types (TOPS, BOTTOMS), false for retail goods';
COMMENT ON COLUMN sys_item_type_cd.is_retail IS 'True for retail product types';
COMMENT ON COLUMN sys_item_type_cd.is_system IS 'True for system types that cannot be deleted';

-- ==================================================================
-- PART 2: CREATE sys_service_prod_templates_cd TABLE
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_service_prod_templates_cd (
  -- Primary key
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_code VARCHAR(50) UNIQUE NOT NULL,

  -- Display (bilingual)
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),                          -- Arabic
  description TEXT,
  description2 TEXT,                           -- Arabic
  hint_text TEXT,
  hint_text2 TEXT,                             -- Arabic

  -- Multi-dimensional classification
  service_category_code VARCHAR(120),          -- FK to sys_service_category_cd
  item_type_code VARCHAR(50),                  -- FK to sys_item_type_cd

  -- Product characteristics
  is_retail_item BOOLEAN DEFAULT false,
  product_group1 VARCHAR(60),                  -- Optional additional grouping
  product_group2 VARCHAR(60),
  product_group3 VARCHAR(60),

  -- Pricing configuration
  price_type VARCHAR(20),                      -- 'PER_PC', 'PER_KG', 'PER_SQM', 'FIXED'
  product_unit VARCHAR(60),                    -- 'PC', 'KG', 'SUIT', 'SET', 'PAIR', 'UNIT'
  default_sell_price DECIMAL(19,4),            -- Template price (reference only)
  default_express_sell_price DECIMAL(19,4),    -- Template express price
  product_cost DECIMAL(19,4),                  -- Suggested cost
  min_sell_price DECIMAL(19,4),                -- Suggested minimum

  -- Quantity & measurement
  min_quantity INTEGER DEFAULT 1,
  pieces_per_product INTEGER DEFAULT 1,        -- For multi-piece items (suits=2)

  -- Turnaround times
  turnaround_hh NUMERIC(4,2),                  -- Standard turnaround hours
  turnaround_hh_express NUMERIC(4,2),          -- Express turnaround hours
  multiplier_express NUMERIC(4,2) DEFAULT 1.50, -- Express price multiplier
  extra_days INTEGER DEFAULT 0,

  -- Workflow
  default_workflow_steps VARCHAR(50)[],        -- Array: ['WF_SIMPLE', 'WF_STANDARD']

  -- Requirements
  requires_item_count BOOLEAN DEFAULT true,
  requires_weight BOOLEAN DEFAULT false,
  requires_dimensions BOOLEAN DEFAULT false,

  -- Seeding control
  is_to_seed BOOLEAN DEFAULT true,             -- Auto-seed on tenant init?
  seed_priority INTEGER DEFAULT 100,           -- Lower = seed first (10-1000)
  seed_options JSONB,                          -- Seeding configuration options
  /*
    Example seed_options:
    {
      "include_pricing": true,
      "include_cost": false,
      "include_workflow": true,
      "required_for": ["basic", "standard", "premium"]
    }
  */

  -- Availability
  is_express_available BOOLEAN DEFAULT true,
  is_subscription_available BOOLEAN DEFAULT true,

  -- Metadata
  tags JSON,                                   -- ['shirt', 'formal', 'business']
  id_sku VARCHAR(100),                         -- Template SKU
  metadata JSONB,                              -- Additional flexible data

  -- UI branding
  product_color1 VARCHAR(60),
  product_color2 VARCHAR(60),
  product_color3 VARCHAR(60),
  product_icon VARCHAR(120),
  product_image TEXT,

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
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Foreign keys
  CONSTRAINT fk_template_category
    FOREIGN KEY (service_category_code)
    REFERENCES sys_service_category_cd(service_category_code)
    ON DELETE SET NULL,

  CONSTRAINT fk_template_item_type
    FOREIGN KEY (item_type_code)
    REFERENCES sys_item_type_cd(item_type_code)
    ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_templates_category ON sys_service_prod_templates_cd(service_category_code);
CREATE INDEX idx_templates_item_type ON sys_service_prod_templates_cd(item_type_code);
CREATE INDEX idx_templates_seed ON sys_service_prod_templates_cd(is_to_seed, seed_priority) WHERE is_active = true;
CREATE INDEX idx_templates_retail ON sys_service_prod_templates_cd(is_retail_item) WHERE is_retail_item = true;
CREATE INDEX idx_templates_active ON sys_service_prod_templates_cd(is_active, rec_order);

-- Comments
COMMENT ON TABLE sys_service_prod_templates_cd IS 'Master catalog of product templates for tenant initialization';
COMMENT ON COLUMN sys_service_prod_templates_cd.template_code IS 'Unique template code (e.g., SHRT_BUS, DETERGENT_500ML)';
COMMENT ON COLUMN sys_service_prod_templates_cd.is_to_seed IS 'Auto-seed this template on new tenant initialization';
COMMENT ON COLUMN sys_service_prod_templates_cd.seed_priority IS 'Seeding priority (lower numbers seed first, range: 10-1000)';
COMMENT ON COLUMN sys_service_prod_templates_cd.default_sell_price IS 'Template price (reference only, NOT used in production)';
COMMENT ON COLUMN sys_service_prod_templates_cd.service_category_code IS 'Service category (DRY_CLEAN, LAUNDRY, RETAIL_ITEMS, etc.)';
COMMENT ON COLUMN sys_service_prod_templates_cd.item_type_code IS 'Item type (TOPS, BOTTOMS, RETAIL_GOODS, etc.)';

-- ==================================================================
-- PART 3: DROP UNUSED sys_service_type_cd TABLE
-- ==================================================================

-- This table was created in migration 0043 but never seeded
-- We are replacing it with sys_service_prod_templates_cd
DROP TABLE IF EXISTS sys_service_type_cd CASCADE;

-- ==================================================================
-- PART 4: ENHANCE org_product_data_mst TABLE
-- ==================================================================

-- Add item_type_code column
ALTER TABLE org_product_data_mst
  ADD COLUMN IF NOT EXISTS item_type_code VARCHAR(50);

-- Add foreign key
ALTER TABLE org_product_data_mst
  ADD CONSTRAINT fk_product_item_type
    FOREIGN KEY (item_type_code)
    REFERENCES sys_item_type_cd(item_type_code)
    ON DELETE SET NULL;

-- Add index
CREATE INDEX IF NOT EXISTS idx_products_item_type
  ON org_product_data_mst(tenant_org_id, item_type_code);

-- Add comment
COMMENT ON COLUMN org_product_data_mst.item_type_code IS 'Item type classification (TOPS, BOTTOMS, RETAIL_GOODS, etc.)';

-- ==================================================================
-- PART 5: ADD RETAIL_ITEMS SERVICE CATEGORY
-- ==================================================================

-- Add 7th service category for retail products
INSERT INTO sys_service_category_cd (
  service_category_code,
  ctg_name,
  ctg_name2,
  ctg_desc,
  turnaround_hh,
  turnaround_hh_express,
  multiplier_express,
  is_builtin,
  has_fee,
  is_mandatory,
  is_active,
  rec_order,
  service_category_icon
) VALUES (
  'RETAIL_ITEMS',
  'Retail Items',
  'منتجات التجزئة',
  'Retail products sold to customers (detergents, hangers, bags, etc.)',
  0.00,          -- Instant availability
  0.00,          -- No express option
  1.00,          -- No express multiplier
  true,
  false,         -- No processing fee
  false,
  true,
  7,
  'ShoppingCart'
)
ON CONFLICT (service_category_code) DO NOTHING;

-- ==================================================================
-- PART 6: ENABLE RETAIL_ITEMS FOR EXISTING TENANTS
-- ==================================================================

-- Add RETAIL_ITEMS category to all existing active tenants
INSERT INTO org_service_category_cf (
  tenant_org_id,
  service_category_code,
  rec_order,
  is_active,
  created_at,
  created_by
)
SELECT
  id,
  'RETAIL_ITEMS',
  7,
  true,
  CURRENT_TIMESTAMP,
  'system_migration_0045'
FROM org_tenants_mst
WHERE is_active = true
ON CONFLICT (tenant_org_id, service_category_code) DO NOTHING;

COMMIT;

-- ==================================================================
-- END OF MIGRATION
-- ==================================================================
