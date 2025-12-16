-- ==================================================================
-- 0056_catalog_redesign_business_types.sql
-- Purpose: Redesign catalog system with normalized items and business type filtering
-- Author: CleanMateX Development Team
-- Created: 2025-01-27
-- PRD: Catalog Redesign with Business Types
-- Dependencies: 0045_catalog_system_2027_architecture.sql, 0046_seed_catalog_reference_data.sql
-- ==================================================================
-- This migration:
-- 1. Creates sys_items_data_list_cd - Master catalog of item definitions
-- 2. Creates sys_main_business_type_cd - Business type codes
-- 3. Creates sys_business_type_template_cf - Join table for business type filtering
-- 4. Modifies sys_service_prod_templates_cd to use composite key (item_code, service_category_code)
-- 5. Adds business_type_code to org_tenants_mst
-- 6. Migrates existing data from templates and products to items table
-- ==================================================================

BEGIN;

-- ==================================================================
-- PART 1: CREATE sys_items_data_list_cd TABLE
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_items_data_list_cd (
  item_code VARCHAR(60) PRIMARY KEY,
  
  -- Display fields (keep ALL from source tables)
  item_name TEXT NOT NULL,
  item_name2 TEXT NULL,  -- Arabic
  hint_text TEXT NULL,
  hint_text2 TEXT NULL,  -- Arabic
  
  -- Basic classification
  item_type_code VARCHAR(60) NULL,  -- FK to sys_item_type_cd
  is_retail_item BOOLEAN DEFAULT false,
  
  -- UI/Branding (keep ALL from source tables)
  item_color1 TEXT NULL,
  item_color2 TEXT NULL,
  item_color3 TEXT NULL,
  item_icon TEXT NULL,
  item_image TEXT NULL,
  
  -- Metadata (keep ALL from source tables)
  tags JSON NULL,
  id_sku TEXT NULL,
  metadata JSONB NULL,
  
  -- Audit
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_order INTEGER NULL,
  rec_notes TEXT NULL,
  rec_status SMALLINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NULL,
  created_info TEXT NULL,
  updated_at TIMESTAMP NULL,
  updated_by TEXT NULL,
  updated_info TEXT NULL,
  
  CONSTRAINT fk_item_type FOREIGN KEY (item_type_code) 
    REFERENCES sys_item_type_cd(item_type_code) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_items_item_type ON sys_items_data_list_cd(item_type_code);
CREATE INDEX idx_items_retail ON sys_items_data_list_cd(is_retail_item) WHERE is_retail_item = true;
CREATE INDEX idx_items_active ON sys_items_data_list_cd(is_active, rec_order);

-- Comments
COMMENT ON TABLE sys_items_data_list_cd IS 'Master catalog of basic item definitions extracted from templates and tenant products';
COMMENT ON COLUMN sys_items_data_list_cd.item_code IS 'Unique item code (e.g., SHRT_BUS, DETERGENT_500ML)';
COMMENT ON COLUMN sys_items_data_list_cd.item_type_code IS 'Item type classification (TOPS, BOTTOMS, RETAIL_GOODS, etc.)';

-- ==================================================================
-- PART 2: EXTRACT UNIQUE ITEMS FROM sys_service_prod_templates_cd
-- ==================================================================

INSERT INTO sys_items_data_list_cd (
  item_code, item_name, item_name2, hint_text, hint_text2,
  item_type_code, is_retail_item,
  item_color1, item_color2, item_color3, item_icon, item_image,
  tags, id_sku,
  is_active, rec_order, rec_status, created_at, created_by
)
SELECT DISTINCT ON (template_code)
  template_code AS item_code,
  name AS item_name,
  name2 AS item_name2,
  hint_text,
  hint_text2,
  item_type_code,
  is_retail_item,
  product_color1 AS item_color1,
  product_color2 AS item_color2,
  product_color3 AS item_color3,
  product_icon AS item_icon,
  product_image AS item_image,
  tags,
  id_sku,
  is_active,
  rec_order,
  rec_status,
  created_at,
  created_by
FROM sys_service_prod_templates_cd
WHERE template_code IS NOT NULL
ORDER BY template_code, created_at DESC
ON CONFLICT (item_code) DO NOTHING;

-- ==================================================================
-- PART 3: EXTRACT UNIQUE ITEMS FROM org_product_data_mst
-- ==================================================================

INSERT INTO sys_items_data_list_cd (
  item_code, item_name, item_name2, hint_text,
  item_type_code, is_retail_item,
  item_color1, item_color2, item_color3, item_icon, item_image,
  tags, id_sku,
  is_active, rec_order, rec_status, created_at, created_by
)
SELECT DISTINCT ON (product_code)
  product_code AS item_code,
  product_name AS item_name,
  product_name2 AS item_name2,
  hint_text,
  COALESCE(item_type_code, 
    CASE product_group1
      WHEN 'TOPS' THEN 'TOPS'
      WHEN 'BOTTOMS' THEN 'BOTTOMS'
      WHEN 'FULL_BODY' THEN 'FULL_BODY'
      WHEN 'OUTERWEAR' THEN 'OUTERWEAR'
      WHEN 'INTIMATE' THEN 'INTIMATE'
      WHEN 'SPECIAL' THEN 'SPECIAL'
      WHEN 'HOUSEHOLD' THEN 'HOUSEHOLD'
      WHEN 'RETAIL_GOODS' THEN 'RETAIL_GOODS'
      WHEN 'ACCESSORIES' THEN 'ACCESSORIES'
      ELSE 'OTHER'
    END
  ) AS item_type_code,
  is_retail_item,
  product_color1 AS item_color1,
  product_color2 AS item_color2,
  product_color3 AS item_color3,
  product_icon AS item_icon,
  product_image AS item_image,
  tags,
  id_sku,
  is_active,
  rec_order,
  rec_status,
  created_at,
  created_by
FROM org_product_data_mst
WHERE product_code IS NOT NULL
  AND product_code NOT IN (SELECT item_code FROM sys_items_data_list_cd)
ORDER BY product_code, created_at DESC
ON CONFLICT (item_code) DO NOTHING;

-- ==================================================================
-- PART 4: CREATE sys_main_business_type_cd TABLE
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_main_business_type_cd (
  business_type_code VARCHAR(60) PRIMARY KEY,
  business_type_name TEXT NOT NULL,
  business_type_name2 TEXT NULL,  -- Arabic
  business_type_desc TEXT NULL,
  business_type_desc2 TEXT NULL,  -- Arabic
  
  -- UI/Branding
  business_type_color1 TEXT NULL,
  business_type_color2 TEXT NULL,
  business_type_color3 TEXT NULL,
  business_type_icon TEXT NULL,
  business_type_image TEXT NULL,
  
  -- Configuration metadata
  default_settings JSONB NULL,  -- Default tenant settings for this business type
  default_features JSONB NULL,  -- Default features enabled
  
  -- Audit
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_order INTEGER NULL,
  rec_notes TEXT NULL,
  rec_status SMALLINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NULL,
  created_info TEXT NULL,
  updated_at TIMESTAMP NULL,
  updated_by TEXT NULL,
  updated_info TEXT NULL
);

-- Indexes
CREATE INDEX idx_business_type_active ON sys_main_business_type_cd(is_active, rec_order);

-- Comments
COMMENT ON TABLE sys_main_business_type_cd IS 'Master list of business types (small laundry, medium dry-clean, mini-shop, etc.)';
COMMENT ON COLUMN sys_main_business_type_cd.business_type_code IS 'Unique business type code (e.g., SMALL_LAUNDRY, MEDIUM_DRY_CLEAN, MINI_SHOP)';
COMMENT ON COLUMN sys_main_business_type_cd.default_settings IS 'Default tenant settings JSONB for this business type';
COMMENT ON COLUMN sys_main_business_type_cd.default_features IS 'Default features JSONB enabled for this business type';

-- ==================================================================
-- PART 5: MODIFY sys_service_prod_templates_cd TABLE
-- ==================================================================

-- Step 1: Add item_code column (nullable initially)
ALTER TABLE sys_service_prod_templates_cd 
  ADD COLUMN IF NOT EXISTS item_code VARCHAR(60);

-- Step 2: Map template_code to item_code in templates
UPDATE sys_service_prod_templates_cd t
SET item_code = i.item_code
FROM sys_items_data_list_cd i
WHERE t.template_code = i.item_code
  AND t.item_code IS NULL;

-- Step 3: Make item_code NOT NULL after population
ALTER TABLE sys_service_prod_templates_cd 
  ALTER COLUMN item_code SET NOT NULL;

-- Step 4: Drop old constraints
-- Drop primary key constraint (PostgreSQL auto-generates constraint name)
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Find the primary key constraint name
  SELECT constraint_name INTO v_constraint_name
  FROM information_schema.table_constraints
  WHERE table_name = 'sys_service_prod_templates_cd'
    AND constraint_type = 'PRIMARY KEY'
  LIMIT 1;
  
  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE sys_service_prod_templates_cd DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

-- Drop unique constraint on template_code if it exists
ALTER TABLE sys_service_prod_templates_cd 
  DROP CONSTRAINT IF EXISTS sys_service_prod_templates_cd_template_code_key;

-- Step 5: Create composite primary key
ALTER TABLE sys_service_prod_templates_cd
  ADD CONSTRAINT PK_SYS_SERVICE_PROD_TEMPLATES_ 
  PRIMARY KEY (item_code, service_category_code);

-- Step 6: Add foreign key to items table
ALTER TABLE sys_service_prod_templates_cd
  ADD CONSTRAINT fk_template_item 
  FOREIGN KEY (item_code) 
  REFERENCES sys_items_data_list_cd(item_code) 
  ON DELETE CASCADE;

-- Step 7: Update indexes
DROP INDEX IF EXISTS idx_templates_category;
CREATE INDEX idx_templates_item_category ON sys_service_prod_templates_cd(item_code, service_category_code);
CREATE INDEX idx_templates_category ON sys_service_prod_templates_cd(service_category_code);
CREATE INDEX idx_templates_item_code ON sys_service_prod_templates_cd(item_code);

-- Comments
COMMENT ON COLUMN sys_service_prod_templates_cd.item_code IS 'Foreign key to sys_items_data_list_cd - references the base item definition';
COMMENT ON COLUMN sys_service_prod_templates_cd.service_category_code IS 'Service category code - together with item_code forms composite primary key';

-- ==================================================================
-- PART 6: CREATE sys_business_type_template_cf JOIN TABLE
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_business_type_template_cf (
  item_code VARCHAR(60) NOT NULL,
  service_category_code VARCHAR(120) NOT NULL,
  business_type_code VARCHAR(60) NOT NULL,
  
  -- Availability control
  is_enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,  -- Auto-seed for this business type?
  
  -- Ordering
  rec_order INTEGER NULL,
  
  -- Audit
  rec_notes TEXT NULL,
  rec_status SMALLINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NULL,
  created_info TEXT NULL,
  updated_at TIMESTAMP NULL,
  updated_by TEXT NULL,
  updated_info TEXT NULL,
  
  PRIMARY KEY (item_code, service_category_code, business_type_code),
  
  CONSTRAINT fk_btt_item_template 
    FOREIGN KEY (item_code, service_category_code) 
    REFERENCES sys_service_prod_templates_cd(item_code, service_category_code) 
    ON DELETE CASCADE,
  
  CONSTRAINT fk_btt_business_type 
    FOREIGN KEY (business_type_code) 
    REFERENCES sys_main_business_type_cd(business_type_code) 
    ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_btt_business_type ON sys_business_type_template_cf(business_type_code);
CREATE INDEX idx_btt_template ON sys_business_type_template_cf(item_code, service_category_code);
CREATE INDEX idx_btt_enabled ON sys_business_type_template_cf(business_type_code, is_enabled) WHERE is_enabled = true;

-- Comments
COMMENT ON TABLE sys_business_type_template_cf IS 'Join table linking templates to business types - determines which products are available per business type';
COMMENT ON COLUMN sys_business_type_template_cf.is_enabled IS 'Whether this template is enabled for this business type';
COMMENT ON COLUMN sys_business_type_template_cf.is_default IS 'Whether this template should be auto-seeded for this business type during tenant initialization';

-- ==================================================================
-- PART 7: ADD business_type_code TO org_tenants_mst
-- ==================================================================

ALTER TABLE org_tenants_mst 
  ADD COLUMN IF NOT EXISTS business_type_code VARCHAR(60);

ALTER TABLE org_tenants_mst
  DROP CONSTRAINT IF EXISTS fk_tenant_business_type;

ALTER TABLE org_tenants_mst
  ADD CONSTRAINT fk_tenant_business_type 
  FOREIGN KEY (business_type_code) 
  REFERENCES sys_main_business_type_cd(business_type_code) 
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_business_type ON org_tenants_mst(business_type_code);

-- Comments
COMMENT ON COLUMN org_tenants_mst.business_type_code IS 'Business type code - determines which product templates are available for this tenant';

-- ==================================================================
-- PART 8: SEED INITIAL BUSINESS TYPES
-- ==================================================================

INSERT INTO sys_main_business_type_cd (
  business_type_code,
  business_type_name,
  business_type_name2,
  business_type_desc,
  business_type_desc2,
  business_type_icon,
  is_active,
  rec_order,
  rec_status,
  created_by
) VALUES
('SMALL_LAUNDRY', 'Small Laundry', 'مغسلة صغيرة', 'Small-scale laundry business with basic services', 'مغسلة صغيرة الحجم مع خدمات أساسية', 'WashingMachine', true, 10, 1, 'system_seed'),
('MEDIUM_DRY_CLEAN', 'Medium Dry Clean', 'تنظيف جاف متوسط', 'Medium-scale dry cleaning business', 'مغسلة تنظيف جاف متوسطة الحجم', 'DryClean', true, 20, 1, 'system_seed'),
('MINI_SHOP', 'Mini Shop', 'متجر صغير', 'Small retail shop with limited services', 'متجر صغير مع خدمات محدودة', 'Store', true, 30, 1, 'system_seed'),
('FULL_SERVICE', 'Full Service Laundry', 'مغسلة خدمة كاملة', 'Full-service laundry with all services', 'مغسلة خدمة كاملة مع جميع الخدمات', 'Sparkles', true, 40, 1, 'system_seed'),
('INDUSTRIAL', 'Industrial Laundry', 'مغسلة صناعية', 'Large-scale industrial laundry operation', 'عملية غسيل صناعية كبيرة الحجم', 'Factory', true, 50, 1, 'system_seed')
ON CONFLICT (business_type_code) DO NOTHING;

-- ==================================================================
-- PART 9: INITIALIZE BUSINESS TYPE TEMPLATE ASSOCIATIONS
-- ==================================================================
-- By default, make all existing templates available to all business types
-- Platform admins can later customize which templates are available per business type

INSERT INTO sys_business_type_template_cf (
  item_code,
  service_category_code,
  business_type_code,
  is_enabled,
  is_default,
  rec_status,
  created_by
)
SELECT 
  t.item_code,
  t.service_category_code,
  bt.business_type_code,
  true AS is_enabled,
  t.is_to_seed AS is_default,  -- Use template's is_to_seed as default
  1 AS rec_status,
  'system_migration_0056' AS created_by
FROM sys_service_prod_templates_cd t
CROSS JOIN sys_main_business_type_cd bt
WHERE t.is_active = true
  AND bt.is_active = true
ON CONFLICT (item_code, service_category_code, business_type_code) DO NOTHING;

-- ==================================================================
-- MIGRATION SUMMARY
-- ==================================================================

DO $$
DECLARE
  v_items_count INTEGER;
  v_business_types_count INTEGER;
  v_template_associations_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_items_count FROM sys_items_data_list_cd;
  SELECT COUNT(*) INTO v_business_types_count FROM sys_main_business_type_cd;
  SELECT COUNT(*) INTO v_template_associations_count FROM sys_business_type_template_cf;

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'MIGRATION 0056 COMPLETED SUCCESSFULLY';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Items created: %', v_items_count;
  RAISE NOTICE 'Business types created: %', v_business_types_count;
  RAISE NOTICE 'Template-business type associations: %', v_template_associations_count;
  RAISE NOTICE '=================================================================';
END $$;

COMMIT;

-- ==================================================================
-- END OF MIGRATION
-- ==================================================================

