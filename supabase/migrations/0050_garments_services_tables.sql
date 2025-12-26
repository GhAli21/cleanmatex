-- ==================================================================
-- 0050_garments_services_tables.sql
-- Purpose: Create Garments & Services code tables
-- Author: CleanMateX Development Team
-- Created: 2025-01-22
-- PRD: PRD-SAAS-MNG-0006 - Core Data & Code Management
-- ==================================================================
-- This migration creates code tables for garments and services:
-- 1. sys_garment_type_cd - Garment types (SHIRT, PANTS, SUIT, etc.)
-- 2. sys_fabric_type_cd - Fabric types (COTTON, SILK, WOOL, etc.)
-- Note: sys_service_category_cd already exists but uses different column names.
--       This migration will enhance it to match the standard code table pattern.
-- ==================================================================

BEGIN;

-- ==================================================================
-- TABLE: sys_garment_type_cd
-- Purpose: Garment type codes
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_garment_type_cd (
  code VARCHAR(50) PRIMARY KEY,

  -- Display
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),                              -- Arabic
  description TEXT,
  description2 TEXT,                               -- Arabic

  -- UI
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),
  color VARCHAR(60),                               -- Hex color for UI

  -- Classification
  garment_category VARCHAR(50),                    -- 'top', 'bottom', 'outerwear', 'accessories', 'other'
  gender VARCHAR(20),                               -- 'men', 'women', 'unisex', 'children'
  care_instructions TEXT,                          -- Care instructions for this garment type

  -- Pricing
  default_base_price DECIMAL(10,2),
  requires_special_handling BOOLEAN DEFAULT false,
  handling_multiplier DECIMAL(5,2) DEFAULT 1.0,

  -- Workflow
  default_service_types VARCHAR(50)[],            -- Array of service type codes
  estimated_processing_hours INTEGER,

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,                  -- System garment types cannot be deleted
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,
  /*
    Example:
    {
      "common_fabrics": ["COTTON", "POLYESTER", "BLEND"],
      "typical_weight_kg": 0.5,
      "fragility": "low" | "medium" | "high",
      "requires_hanger": true,
      "fold_method": "standard" | "special"
    }
  */

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1
);

-- Indexes
CREATE INDEX idx_garment_type_active
  ON sys_garment_type_cd(is_active, display_order);

CREATE INDEX idx_garment_type_category
  ON sys_garment_type_cd(garment_category, is_active);

CREATE INDEX idx_garment_type_gender
  ON sys_garment_type_cd(gender, is_active);

-- Comments
COMMENT ON TABLE sys_garment_type_cd IS
  'Garment type codes (SHIRT, PANTS, SUIT, DRESS, etc.)';

COMMENT ON COLUMN sys_garment_type_cd.code IS
  'Unique garment type code (e.g., SHIRT, PANTS, SUIT, DRESS)';

COMMENT ON COLUMN sys_garment_type_cd.garment_category IS
  'Garment category (top, bottom, outerwear, accessories, other)';

-- ==================================================================
-- TABLE: sys_fabric_type_cd
-- Purpose: Fabric type codes
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_fabric_type_cd (
  code VARCHAR(50) PRIMARY KEY,

  -- Display
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),                              -- Arabic
  description TEXT,
  description2 TEXT,                               -- Arabic

  -- UI
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),
  color VARCHAR(60),                               -- Hex color for UI

  -- Classification
  fabric_category VARCHAR(50),                      -- 'natural', 'synthetic', 'blend', 'leather', 'other'
  care_level VARCHAR(20),                          -- 'delicate', 'normal', 'sturdy'
  temperature_max_celsius INTEGER,                  -- Maximum washing temperature

  -- Care Requirements
  requires_dry_clean BOOLEAN DEFAULT false,
  requires_hand_wash BOOLEAN DEFAULT false,
  can_bleach BOOLEAN DEFAULT false,
  can_iron BOOLEAN DEFAULT true,
  iron_temperature VARCHAR(20),                    -- 'low', 'medium', 'high', 'no_iron'

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,                  -- System fabric types cannot be deleted
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,
  /*
    Example:
    {
      "common_garments": ["SHIRT", "BLOUSE", "DRESS"],
      "shrinkage_risk": "low" | "medium" | "high",
      "colorfast": true,
      "wrinkle_resistant": false,
      "moisture_wicking": false
    }
  */

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1
);

-- Indexes
CREATE INDEX idx_fabric_type_active
  ON sys_fabric_type_cd(is_active, display_order);

CREATE INDEX idx_fabric_type_category
  ON sys_fabric_type_cd(fabric_category, is_active);

CREATE INDEX idx_fabric_type_care_level
  ON sys_fabric_type_cd(care_level, is_active);

-- Comments
COMMENT ON TABLE sys_fabric_type_cd IS
  'Fabric type codes (COTTON, SILK, WOOL, POLYESTER, etc.)';

COMMENT ON COLUMN sys_fabric_type_cd.code IS
  'Unique fabric type code (e.g., COTTON, SILK, WOOL, POLYESTER)';

COMMENT ON COLUMN sys_fabric_type_cd.fabric_category IS
  'Fabric category (natural, synthetic, blend, leather, other)';

-- ==================================================================
-- ENHANCE: sys_service_category_cd
-- Add standard code table columns if they don't exist
-- ==================================================================

-- Add code column if it doesn't exist (use service_category_code as code)
DO $$
BEGIN
  -- Add standard columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sys_service_category_cd' AND column_name = 'code'
  ) THEN
    ALTER TABLE sys_service_category_cd ADD COLUMN code VARCHAR(50);
    UPDATE sys_service_category_cd SET code = service_category_code;
    ALTER TABLE sys_service_category_cd ALTER COLUMN code SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_service_category_code_unique ON sys_service_category_cd(code);
  END IF;

  -- Add name column if it doesn't exist (map from ctg_name)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sys_service_category_cd' AND column_name = 'name'
  ) THEN
    ALTER TABLE sys_service_category_cd ADD COLUMN name VARCHAR(250);
    UPDATE sys_service_category_cd SET name = ctg_name;
    ALTER TABLE sys_service_category_cd ALTER COLUMN name SET NOT NULL;
  END IF;

  -- Add name2 column if it doesn't exist (map from ctg_name2)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sys_service_category_cd' AND column_name = 'name2'
  ) THEN
    ALTER TABLE sys_service_category_cd ADD COLUMN name2 VARCHAR(250);
    UPDATE sys_service_category_cd SET name2 = ctg_name2;
  END IF;

  -- Add description column if it doesn't exist (map from ctg_desc)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sys_service_category_cd' AND column_name = 'description'
  ) THEN
    ALTER TABLE sys_service_category_cd ADD COLUMN description TEXT;
    UPDATE sys_service_category_cd SET description = ctg_desc;
  END IF;

  -- Add description2 column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sys_service_category_cd' AND column_name = 'description2'
  ) THEN
    ALTER TABLE sys_service_category_cd ADD COLUMN description2 TEXT;
  END IF;

  -- Add display_order if it doesn't exist (map from rec_order)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sys_service_category_cd' AND column_name = 'display_order'
  ) THEN
    ALTER TABLE sys_service_category_cd ADD COLUMN display_order INTEGER DEFAULT 0;
    UPDATE sys_service_category_cd SET display_order = COALESCE(rec_order, 0);
  END IF;

  -- Add icon if it doesn't exist (map from service_category_icon)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sys_service_category_cd' AND column_name = 'icon'
  ) THEN
    ALTER TABLE sys_service_category_cd ADD COLUMN icon VARCHAR(100);
    UPDATE sys_service_category_cd SET icon = service_category_icon;
  END IF;

  -- Add color if it doesn't exist (map from service_category_color1)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sys_service_category_cd' AND column_name = 'color'
  ) THEN
    ALTER TABLE sys_service_category_cd ADD COLUMN color VARCHAR(60);
    UPDATE sys_service_category_cd SET color = service_category_color1;
  END IF;

  -- Add is_system if it doesn't exist (map from is_builtin)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sys_service_category_cd' AND column_name = 'is_system'
  ) THEN
    ALTER TABLE sys_service_category_cd ADD COLUMN is_system BOOLEAN DEFAULT true;
    UPDATE sys_service_category_cd SET is_system = is_builtin;
  END IF;

  -- Add metadata JSONB if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sys_service_category_cd' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE sys_service_category_cd ADD COLUMN metadata JSONB;
  END IF;

  -- Add created_by and updated_by if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sys_service_category_cd' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE sys_service_category_cd ADD COLUMN created_by UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sys_service_category_cd' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sys_service_category_cd ADD COLUMN updated_by UUID;
  END IF;
END $$;

-- ==================================================================
-- SEED DATA: sys_garment_type_cd
-- ==================================================================

INSERT INTO sys_garment_type_cd (
  code,
  name,
  name2,
  description,
  description2,
  display_order,
  icon,
  color,
  garment_category,
  gender,
  care_instructions,
  default_base_price,
  requires_special_handling,
  is_system,
  is_active,
  metadata
) VALUES
  -- Tops
  (
    'SHIRT',
    'Shirt',
    'قميص',
    'Men''s or women''s shirt',
    'قميص رجالي أو نسائي',
    1,
    'shirt',
    '#3B82F6',
    'top',
    'unisex',
    'Wash in cold water, hang dry or tumble dry low',
    NULL,
    false,
    true,
    true,
    '{"common_fabrics": ["COTTON", "POLYESTER", "BLEND"], "typical_weight_kg": 0.3, "fragility": "low", "requires_hanger": true, "fold_method": "standard"}'::jsonb
  ),
  (
    'BLOUSE',
    'Blouse',
    'بلوزة',
    'Women''s blouse',
    'بلوزة نسائية',
    2,
    'shirt',
    '#8B5CF6',
    'top',
    'women',
    'Hand wash or dry clean recommended',
    NULL,
    false,
    true,
    true,
    '{"common_fabrics": ["SILK", "COTTON", "POLYESTER"], "typical_weight_kg": 0.2, "fragility": "medium", "requires_hanger": true, "fold_method": "special"}'::jsonb
  ),
  (
    'T_SHIRT',
    'T-Shirt',
    'تي شيرت',
    'Casual t-shirt',
    'تي شيرت عادي',
    3,
    'shirt',
    '#10B981',
    'top',
    'unisex',
    'Machine wash cold, tumble dry low',
    NULL,
    false,
    true,
    true,
    '{"common_fabrics": ["COTTON", "BLEND"], "typical_weight_kg": 0.2, "fragility": "low", "requires_hanger": false, "fold_method": "standard"}'::jsonb
  ),
  -- Bottoms
  (
    'PANTS',
    'Pants',
    'بنطلون',
    'Men''s or women''s pants',
    'بنطلون رجالي أو نسائي',
    10,
    'pants',
    '#6366F1',
    'bottom',
    'unisex',
    'Wash in cold water, hang dry or tumble dry low',
    NULL,
    false,
    true,
    true,
    '{"common_fabrics": ["COTTON", "DENIM", "POLYESTER"], "typical_weight_kg": 0.5, "fragility": "low", "requires_hanger": true, "fold_method": "standard"}'::jsonb
  ),
  (
    'JEANS',
    'Jeans',
    'جينز',
    'Denim jeans',
    'جينز',
    11,
    'pants',
    '#3B82F6',
    'bottom',
    'unisex',
    'Wash inside out in cold water, hang dry',
    NULL,
    false,
    true,
    true,
    '{"common_fabrics": ["DENIM"], "typical_weight_kg": 0.6, "fragility": "low", "requires_hanger": false, "fold_method": "standard"}'::jsonb
  ),
  (
    'SKIRT',
    'Skirt',
    'تنورة',
    'Women''s skirt',
    'تنورة نسائية',
    12,
    'circle',
    '#EC4899',
    'bottom',
    'women',
    'Dry clean or hand wash recommended',
    NULL,
    false,
    true,
    true,
    '{"common_fabrics": ["COTTON", "SILK", "WOOL"], "typical_weight_kg": 0.3, "fragility": "medium", "requires_hanger": true, "fold_method": "special"}'::jsonb
  ),
  -- Outerwear
  (
    'JACKET',
    'Jacket',
    'جاكيت',
    'Jacket or blazer',
    'جاكيت أو بليزر',
    20,
    'coat',
    '#1F2937',
    'outerwear',
    'unisex',
    'Dry clean recommended',
    NULL,
    false,
    true,
    true,
    '{"common_fabrics": ["WOOL", "POLYESTER", "BLEND"], "typical_weight_kg": 0.8, "fragility": "medium", "requires_hanger": true, "fold_method": "special"}'::jsonb
  ),
  (
    'COAT',
    'Coat',
    'معطف',
    'Winter coat',
    'معطف شتوي',
    21,
    'coat',
    '#374151',
    'outerwear',
    'unisex',
    'Dry clean recommended',
    NULL,
    true,
    true,
    true,
    '{"common_fabrics": ["WOOL", "CASHMERE"], "typical_weight_kg": 1.2, "fragility": "high", "requires_hanger": true, "fold_method": "special"}'::jsonb
  ),
  (
    'SUIT',
    'Suit',
    'بدلة',
    'Men''s or women''s suit',
    'بدلة رجالية أو نسائية',
    22,
    'briefcase',
    '#111827',
    'outerwear',
    'unisex',
    'Dry clean only',
    NULL,
    true,
    true,
    true,
    '{"common_fabrics": ["WOOL", "BLEND"], "typical_weight_kg": 1.0, "fragility": "high", "requires_hanger": true, "fold_method": "special"}'::jsonb
  ),
  -- Dresses
  (
    'DRESS',
    'Dress',
    'فستان',
    'Women''s dress',
    'فستان نسائي',
    30,
    'sparkles',
    '#EC4899',
    'top',
    'women',
    'Dry clean or hand wash recommended',
    NULL,
    false,
    true,
    true,
    '{"common_fabrics": ["COTTON", "SILK", "POLYESTER"], "typical_weight_kg": 0.4, "fragility": "medium", "requires_hanger": true, "fold_method": "special"}'::jsonb
  ),
  (
    'FORMAL_DRESS',
    'Formal Dress',
    'فستان رسمي',
    'Formal evening dress',
    'فستان سهرة رسمي',
    31,
    'sparkles',
    '#BE185D',
    'top',
    'women',
    'Dry clean only',
    NULL,
    true,
    true,
    true,
    '{"common_fabrics": ["SILK", "SATIN"], "typical_weight_kg": 0.5, "fragility": "high", "requires_hanger": true, "fold_method": "special"}'::jsonb
  ),
  -- Accessories
  (
    'TIE',
    'Tie',
    'ربطة عنق',
    'Neck tie',
    'ربطة عنق',
    40,
    'minus',
    '#EF4444',
    'accessories',
    'men',
    'Dry clean only',
    NULL,
    true,
    true,
    true,
    '{"common_fabrics": ["SILK", "POLYESTER"], "typical_weight_kg": 0.05, "fragility": "high", "requires_hanger": false, "fold_method": "special"}'::jsonb
  ),
  (
    'SCARF',
    'Scarf',
    'وشاح',
    'Scarf or shawl',
    'وشاح أو شال',
    41,
    'square',
    '#F59E0B',
    'accessories',
    'unisex',
    'Hand wash or dry clean',
    NULL,
    false,
    true,
    true,
    '{"common_fabrics": ["SILK", "CASHMERE", "WOOL"], "typical_weight_kg": 0.1, "fragility": "medium", "requires_hanger": false, "fold_method": "standard"}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  garment_category = EXCLUDED.garment_category,
  gender = EXCLUDED.gender,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

-- ==================================================================
-- SEED DATA: sys_fabric_type_cd
-- ==================================================================

INSERT INTO sys_fabric_type_cd (
  code,
  name,
  name2,
  description,
  description2,
  display_order,
  icon,
  color,
  fabric_category,
  care_level,
  temperature_max_celsius,
  requires_dry_clean,
  requires_hand_wash,
  can_bleach,
  can_iron,
  iron_temperature,
  is_system,
  is_active,
  metadata
) VALUES
  -- Natural Fabrics
  (
    'COTTON',
    'Cotton',
    'قطن',
    '100% cotton fabric',
    'نسيج قطني 100%',
    1,
    'leaf',
    '#10B981',
    'natural',
    'normal',
    60,
    false,
    false,
    true,
    true,
    'high',
    true,
    true,
    '{"common_garments": ["SHIRT", "T_SHIRT", "PANTS"], "shrinkage_risk": "medium", "colorfast": true, "wrinkle_resistant": false, "moisture_wicking": true}'::jsonb
  ),
  (
    'SILK',
    'Silk',
    'حرير',
    'Silk fabric',
    'نسيج حريري',
    2,
    'sparkles',
    '#F59E0B',
    'natural',
    'delicate',
    30,
    true,
    true,
    false,
    true,
    'low',
    true,
    true,
    '{"common_garments": ["BLOUSE", "DRESS", "TIE"], "shrinkage_risk": "high", "colorfast": false, "wrinkle_resistant": false, "moisture_wicking": false}'::jsonb
  ),
  (
    'WOOL',
    'Wool',
    'صوف',
    'Wool fabric',
    'نسيج صوفي',
    3,
    'cloud',
    '#6366F1',
    'natural',
    'delicate',
    30,
    true,
    false,
    false,
    true,
    'low',
    true,
    true,
    '{"common_garments": ["COAT", "SUIT", "SCARF"], "shrinkage_risk": "high", "colorfast": true, "wrinkle_resistant": true, "moisture_wicking": true}'::jsonb
  ),
  (
    'LINEN',
    'Linen',
    'كتان',
    'Linen fabric',
    'نسيج كتاني',
    4,
    'leaf',
    '#84CC16',
    'natural',
    'normal',
    40,
    false,
    false,
    false,
    true,
    'high',
    true,
    true,
    '{"common_garments": ["SHIRT", "PANTS", "DRESS"], "shrinkage_risk": "medium", "colorfast": true, "wrinkle_resistant": false, "moisture_wicking": true}'::jsonb
  ),
  (
    'CASHMERE',
    'Cashmere',
    'كشمير',
    'Cashmere fabric',
    'نسيج كشمير',
    5,
    'cloud',
    '#8B5CF6',
    'natural',
    'delicate',
    30,
    true,
    true,
    false,
    true,
    'low',
    true,
    true,
    '{"common_garments": ["COAT", "SCARF"], "shrinkage_risk": "high", "colorfast": true, "wrinkle_resistant": true, "moisture_wicking": true}'::jsonb
  ),
  -- Synthetic Fabrics
  (
    'POLYESTER',
    'Polyester',
    'بوليستر',
    'Polyester fabric',
    'نسيج بوليستر',
    10,
    'zap',
    '#3B82F6',
    'synthetic',
    'normal',
    60,
    false,
    false,
    true,
    true,
    'medium',
    true,
    true,
    '{"common_garments": ["SHIRT", "PANTS", "JACKET"], "shrinkage_risk": "low", "colorfast": true, "wrinkle_resistant": true, "moisture_wicking": false}'::jsonb
  ),
  (
    'NYLON',
    'Nylon',
    'نايلون',
    'Nylon fabric',
    'نسيج نايلون',
    11,
    'zap',
    '#6366F1',
    'synthetic',
    'normal',
    40,
    false,
    false,
    false,
    true,
    'low',
    true,
    true,
    '{"common_garments": ["JACKET", "PANTS"], "shrinkage_risk": "low", "colorfast": true, "wrinkle_resistant": true, "moisture_wicking": false}'::jsonb
  ),
  (
    'RAYON',
    'Rayon',
    'رايون',
    'Rayon fabric',
    'نسيج رايون',
    12,
    'zap',
    '#8B5CF6',
    'synthetic',
    'delicate',
    40,
    true,
    true,
    false,
    true,
    'low',
    true,
    true,
    '{"common_garments": ["BLOUSE", "DRESS"], "shrinkage_risk": "high", "colorfast": false, "wrinkle_resistant": false, "moisture_wicking": false}'::jsonb
  ),
  -- Blends
  (
    'BLEND',
    'Blend',
    'مخلوط',
    'Fabric blend (mixed fibers)',
    'نسيج مخلوط (ألياف مختلطة)',
    20,
    'layers',
    '#6B7280',
    'blend',
    'normal',
    50,
    false,
    false,
    true,
    true,
    'medium',
    true,
    true,
    '{"common_garments": ["SHIRT", "PANTS", "JACKET"], "shrinkage_risk": "low", "colorfast": true, "wrinkle_resistant": true, "moisture_wicking": false}'::jsonb
  ),
  (
    'COTTON_POLYESTER',
    'Cotton-Polyester Blend',
    'مخلوط قطن-بوليستر',
    'Cotton and polyester blend',
    'مخلوط قطن وبوليستر',
    21,
    'layers',
    '#10B981',
    'blend',
    'normal',
    60,
    false,
    false,
    true,
    true,
    'high',
    true,
    true,
    '{"common_garments": ["SHIRT", "T_SHIRT", "PANTS"], "shrinkage_risk": "low", "colorfast": true, "wrinkle_resistant": true, "moisture_wicking": true}'::jsonb
  ),
  -- Special Fabrics
  (
    'DENIM',
    'Denim',
    'دنيم',
    'Denim fabric',
    'نسيج دنيم',
    30,
    'square',
    '#1E40AF',
    'natural',
    'sturdy',
    40,
    false,
    false,
    false,
    true,
    'high',
    true,
    true,
    '{"common_garments": ["JEANS", "JACKET"], "shrinkage_risk": "medium", "colorfast": true, "wrinkle_resistant": true, "moisture_wicking": false}'::jsonb
  ),
  (
    'LEATHER',
    'Leather',
    'جلد',
    'Leather material',
    'مادة جلدية',
    31,
    'shield',
    '#78350F',
    'leather',
    'sturdy',
    NULL,
    true,
    false,
    false,
    false,
    'no_iron',
    true,
    true,
    '{"common_garments": ["JACKET", "COAT"], "shrinkage_risk": "low", "colorfast": true, "wrinkle_resistant": true, "moisture_wicking": false}'::jsonb
  ),
  (
    'SATIN',
    'Satin',
    'ساتان',
    'Satin fabric',
    'نسيج ساتان',
    32,
    'sparkles',
    '#EC4899',
    'synthetic',
    'delicate',
    30,
    true,
    true,
    false,
    true,
    'low',
    true,
    true,
    '{"common_garments": ["DRESS", "BLOUSE"], "shrinkage_risk": "medium", "colorfast": false, "wrinkle_resistant": false, "moisture_wicking": false}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  fabric_category = EXCLUDED.fabric_category,
  care_level = EXCLUDED.care_level,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

-- ==================================================================
-- REGISTER TABLES IN REGISTRY
-- ==================================================================

INSERT INTO sys_code_tables_registry (
  table_name,
  display_name,
  display_name2,
  description,
  description2,
  category,
  display_order,
  is_editable,
  is_extensible,
  supports_tenant_override,
  requires_unique_name,
  metadata
) VALUES
  (
    'sys_garment_type_cd',
    'Garment Types',
    'أنواع الملابس',
    'Garment type codes',
    'رموز أنواع الملابس',
    'Garments & Services',
    1,
    true,
    true,
    false,
    true,
    '{"icon": "shirt", "color": "#3B82F6", "help_text": "Manage garment type codes"}'::jsonb
  ),
  (
    'sys_fabric_type_cd',
    'Fabric Types',
    'أنواع الأقمشة',
    'Fabric type codes',
    'رموز أنواع الأقمشة',
    'Garments & Services',
    2,
    true,
    true,
    false,
    true,
    '{"icon": "layers", "color": "#8B5CF6", "help_text": "Manage fabric type codes"}'::jsonb
  ),
  (
    'sys_service_category_cd',
    'Service Categories',
    'فئات الخدمات',
    'Service category codes',
    'رموز فئات الخدمات',
    'Garments & Services',
    3,
    true,
    true,
    false,
    true,
    '{"icon": "grid", "color": "#10B981", "help_text": "Manage service category codes"}'::jsonb
  )
ON CONFLICT (table_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  display_name2 = EXCLUDED.display_name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  category = EXCLUDED.category,
  display_order = EXCLUDED.display_order,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

COMMIT;

