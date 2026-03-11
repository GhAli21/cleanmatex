-- ==================================================================
-- Migration: 0139_order_service_preferences_schema.sql
-- Purpose: Order Service Preferences feature - schema, catalogs, tenant config,
--          order/piece tables, customer prefs, functions, RLS
-- Created: 2026-03-12
-- Do NOT apply - user runs migrations manually
-- ==================================================================

BEGIN;

-- ==================================================================
-- SECTION 1: Add SERVICE_PREF to sys_stng_categories_cd
-- ==================================================================

INSERT INTO sys_stng_categories_cd (
  stng_category_code,
  stng_category_name,
  stng_category_name2,
  stng_category_desc,
  stng_category_desc2,
  stng_category_order,
  stng_category_icon,
  created_by,
  is_active
) VALUES (
  'SERVICE_PREF',
  'Service Preferences',
  'تفضيلات الخدمة',
  'Service and packing preferences for orders',
  'تفضيلات الخدمة والتغليف للطلبات',
  9,
  'package',
  'system_admin',
  true
)
ON CONFLICT (stng_category_code) DO UPDATE SET
  stng_category_name = EXCLUDED.stng_category_name,
  stng_category_name2 = EXCLUDED.stng_category_name2,
  stng_category_desc = EXCLUDED.stng_category_desc,
  stng_category_desc2 = EXCLUDED.stng_category_desc2,
  stng_category_order = EXCLUDED.stng_category_order,
  stng_category_icon = EXCLUDED.stng_category_icon,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin';

-- ==================================================================
-- SECTION 2: System Catalogs
-- ==================================================================

-- sys_service_preference_cd
CREATE TABLE IF NOT EXISTS sys_service_preference_cd (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  preference_category VARCHAR(30) NOT NULL,
  applies_to_fabric_types TEXT[],
  is_incompatible_with TEXT[],
  default_extra_price DECIMAL(19,4) DEFAULT 0,
  workflow_impact TEXT,
  extra_turnaround_minutes INTEGER DEFAULT 0,
  sustainability_score INTEGER DEFAULT 0,
  keywords TEXT[],
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),
  is_active BOOLEAN DEFAULT true NOT NULL,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(120),
  updated_at TIMESTAMPTZ,
  updated_by VARCHAR(120)
);

COMMENT ON TABLE sys_service_preference_cd IS 'System-wide service preference catalog (starch, perfume, delicate, etc.)';
COMMENT ON COLUMN sys_service_preference_cd.preference_category IS 'washing, processing, finishing';
COMMENT ON COLUMN sys_service_preference_cd.extra_turnaround_minutes IS 'Additional SLA minutes for ready-by calculation';

-- sys_packing_preference_cd
CREATE TABLE IF NOT EXISTS sys_packing_preference_cd (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  requires_equipment TEXT,
  maps_to_packaging_type VARCHAR(50) REFERENCES sys_pck_packaging_type_cd(code),
  sustainability_score INTEGER DEFAULT 0,
  consumes_inventory_item TEXT,
  keywords TEXT[],
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),
  is_active BOOLEAN DEFAULT true NOT NULL,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(120),
  updated_at TIMESTAMPTZ,
  updated_by VARCHAR(120)
);

COMMENT ON TABLE sys_packing_preference_cd IS 'System-wide packing preference catalog (hang, fold, box, etc.)';
COMMENT ON COLUMN sys_packing_preference_cd.maps_to_packaging_type IS 'FK to sys_pck_packaging_type_cd: HANGER, BAG, BOX, ROLL, MIXED';

-- Seed sys_service_preference_cd
INSERT INTO sys_service_preference_cd (code, name, name2, preference_category, default_extra_price, workflow_impact, extra_turnaround_minutes, sustainability_score, keywords, display_order, is_incompatible_with)
VALUES
  ('STARCH_LIGHT', 'Light Starch', 'نشا خفيف', 'processing', 0.2000, 'add_step', 0, 0, ARRAY['light starch','نشا خفيف','little starch'], 1, ARRAY['STARCH_HEAVY']),
  ('STARCH_HEAVY', 'Heavy Starch', 'نشا قوي', 'processing', 0.3000, 'add_step', 0, 0, ARRAY['heavy starch','نشا قوي','extra starch'], 2, ARRAY['STARCH_LIGHT','DELICATE']),
  ('PERFUME', 'Perfume', 'عطر', 'finishing', 0.1000, 'add_step', 0, -2, ARRAY['perfume','fragrance','عطر'], 3, NULL),
  ('SEPARATE_WASH', 'Separate Wash', 'غسيل منفصل', 'washing', 0.5000, 'separate_batch', 180, 0, ARRAY['separate wash','غسيل منفصل'], 4, NULL),
  ('DELICATE', 'Delicate Handling', 'عناية خاصة', 'washing', 0.3000, 'route_to_station', 60, 0, ARRAY['delicate','عناية خاصة'], 5, ARRAY['STARCH_HEAVY']),
  ('STEAM_PRESS', 'Steam Press', 'كوي بالبخار', 'finishing', 0.2000, 'route_to_station', 0, 0, ARRAY['steam press','كوي بالبخار'], 6, NULL),
  ('ANTI_BACTERIAL', 'Anti-Bacterial Wash', 'غسيل مضاد للبكتيريا', 'washing', 0.4000, 'add_step', 30, 0, ARRAY['anti bacterial','مضاد للبكتيريا'], 7, NULL),
  ('HAND_WASH', 'Hand Wash Only', 'غسيل يدوي فقط', 'washing', 0.5000, 'route_to_station', 120, 5, ARRAY['hand wash','غسيل يدوي'], 8, ARRAY['SEPARATE_WASH']),
  ('BLEACH_FREE', 'No Bleach', 'بدون مبيض', 'washing', 0.0000, NULL, 0, 3, ARRAY['no bleach','بدون مبيض'], 9, NULL),
  ('ECO_WASH', 'Eco-Friendly Wash', 'غسيل صديق للبيئة', 'washing', 0.3000, 'route_to_station', 30, 10, ARRAY['eco wash','صديق للبيئة'], 10, NULL)
ON CONFLICT (code) DO NOTHING;

-- Seed sys_packing_preference_cd (maps_to_packaging_type: HANGER, BAG, BOX per sys_pck_packaging_type_cd)
INSERT INTO sys_packing_preference_cd (code, name, name2, requires_equipment, maps_to_packaging_type, sustainability_score, consumes_inventory_item, keywords, display_order)
VALUES
  ('HANG', 'Hang on Hanger', 'تعليق على شماعة', 'hanger', 'HANGER', -2, 'hanger', ARRAY['hang','hanger','علق','شماعة'], 1),
  ('FOLD', 'Fold', 'طي', NULL, 'BAG', 5, NULL, ARRAY['fold','طي'], 2),
  ('FOLD_TISSUE', 'Fold with Tissue', 'طي مع ورق حرير', 'tissue_paper', 'BAG', 3, 'tissue_paper', ARRAY['fold tissue','ورق حرير'], 3),
  ('BOX', 'Box', 'تعبئة في صندوق', 'box', 'BOX', -3, 'box', ARRAY['box','صندوق'], 4),
  ('GARMENT_BAG', 'Garment Bag', 'كيس ملابس', 'garment_bag', 'BAG', -1, 'garment_bag', ARRAY['garment bag','كيس ملابس'], 5),
  ('VACUUM_SEAL', 'Vacuum Seal', 'تغليف بالتفريغ', 'vacuum_machine', 'BAG', -5, 'vacuum_bag', ARRAY['vacuum','تفريغ'], 6),
  ('ROLL', 'Roll', 'لف', NULL, 'BAG', 5, NULL, ARRAY['roll','لف'], 7)
ON CONFLICT (code) DO NOTHING;

-- ==================================================================
-- SECTION 3: Tenant Config Tables
-- ==================================================================

-- org_service_preference_cf
CREATE TABLE IF NOT EXISTS org_service_preference_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  preference_code VARCHAR(50) NOT NULL REFERENCES sys_service_preference_cd(code),
  is_system_code BOOLEAN DEFAULT true,
  name VARCHAR(250),
  name2 VARCHAR(250),
  extra_price DECIMAL(19,4) DEFAULT 0,
  is_included_in_base BOOLEAN DEFAULT false,
  extra_turnaround_minutes INTEGER,
  applies_to_services TEXT[],
  applies_to_products TEXT[],
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  branch_id UUID,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by VARCHAR(120),
  updated_info TEXT,
  UNIQUE(tenant_org_id, preference_code)
);

CREATE INDEX IF NOT EXISTS idx_org_svc_pref_cf_tenant ON org_service_preference_cf(tenant_org_id);
CREATE INDEX IF NOT EXISTS idx_org_svc_pref_cf_active ON org_service_preference_cf(tenant_org_id, is_active) WHERE is_active = true;

-- org_packing_preference_cf
CREATE TABLE IF NOT EXISTS org_packing_preference_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  packing_pref_code VARCHAR(50) NOT NULL REFERENCES sys_packing_preference_cd(code),
  is_system_code BOOLEAN DEFAULT true,
  name VARCHAR(250),
  name2 VARCHAR(250),
  extra_price DECIMAL(19,4) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by VARCHAR(120),
  updated_info TEXT,
  UNIQUE(tenant_org_id, packing_pref_code)
);

CREATE INDEX IF NOT EXISTS idx_org_pck_pref_cf_tenant ON org_packing_preference_cf(tenant_org_id);

-- org_preference_bundles_cf (Care packages)
CREATE TABLE IF NOT EXISTS org_preference_bundles_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  bundle_code VARCHAR(50) NOT NULL,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  preference_codes TEXT[] NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(19,4) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by VARCHAR(120),
  updated_info TEXT,
  UNIQUE(tenant_org_id, bundle_code)
);

CREATE INDEX IF NOT EXISTS idx_org_pref_bundles_tenant ON org_preference_bundles_cf(tenant_org_id);

-- ==================================================================
-- SECTION 4: ALTER org_order_items_dtl and org_order_item_pieces_dtl
-- ==================================================================

ALTER TABLE org_order_items_dtl
  ADD COLUMN IF NOT EXISTS packing_pref_code VARCHAR(50) REFERENCES sys_packing_preference_cd(code),
  ADD COLUMN IF NOT EXISTS packing_pref_is_override BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS packing_pref_source VARCHAR(30),
  ADD COLUMN IF NOT EXISTS service_pref_charge DECIMAL(19,4) DEFAULT 0;

ALTER TABLE org_order_item_pieces_dtl
  ADD COLUMN IF NOT EXISTS packing_pref_code VARCHAR(50) REFERENCES sys_packing_preference_cd(code),
  ADD COLUMN IF NOT EXISTS service_pref_charge DECIMAL(19,4) DEFAULT 0;

-- ==================================================================
-- SECTION 5: ALTER org_product_data_mst
-- ==================================================================

ALTER TABLE org_product_data_mst
  ADD COLUMN IF NOT EXISTS default_packing_pref VARCHAR(50) REFERENCES sys_packing_preference_cd(code);

-- ==================================================================
-- SECTION 6: Order Item Service Prefs
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_order_item_service_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  order_id UUID NOT NULL,
  order_item_id UUID NOT NULL,
  preference_code VARCHAR(50) NOT NULL REFERENCES sys_service_preference_cd(code),
  preference_category VARCHAR(30),
  source VARCHAR(30) DEFAULT 'manual',
  extra_price DECIMAL(19,4) NOT NULL DEFAULT 0,
  branch_id UUID,
  processing_confirmed BOOLEAN DEFAULT false,
  confirmed_by VARCHAR(120),
  confirmed_at TIMESTAMPTZ,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by VARCHAR(120),
  updated_info TEXT,
  FOREIGN KEY (order_item_id) REFERENCES org_order_items_dtl(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES org_orders_mst(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_org_ord_itm_svc_prefs_item ON org_order_item_service_prefs(order_item_id);
CREATE INDEX IF NOT EXISTS idx_org_ord_itm_svc_prefs_tenant ON org_order_item_service_prefs(tenant_org_id);

-- ==================================================================
-- SECTION 7: Order Item Piece Service Prefs (org_order_item_pc_prefs, ≤30 chars)
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_order_item_pc_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  order_id UUID NOT NULL,
  order_item_id UUID NOT NULL,
  order_item_piece_id UUID NOT NULL,
  preference_code VARCHAR(50) NOT NULL REFERENCES sys_service_preference_cd(code),
  preference_category VARCHAR(30),
  source VARCHAR(30) DEFAULT 'manual',
  extra_price DECIMAL(19,4) NOT NULL DEFAULT 0,
  branch_id UUID,
  processing_confirmed BOOLEAN DEFAULT false,
  confirmed_by VARCHAR(120),
  confirmed_at TIMESTAMPTZ,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by VARCHAR(120),
  updated_info TEXT,
  FOREIGN KEY (order_item_piece_id) REFERENCES org_order_item_pieces_dtl(id) ON DELETE CASCADE,
  FOREIGN KEY (order_item_id) REFERENCES org_order_items_dtl(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES org_orders_mst(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_org_ord_pc_prefs_piece ON org_order_item_pc_prefs(order_item_piece_id);
CREATE INDEX IF NOT EXISTS idx_org_ord_pc_prefs_tenant ON org_order_item_pc_prefs(tenant_org_id);

-- ==================================================================
-- SECTION 8: Customer Service Prefs
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_customer_service_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  preference_code VARCHAR(50) NOT NULL REFERENCES sys_service_preference_cd(code),
  source VARCHAR(30) DEFAULT 'manual',
  is_active BOOLEAN DEFAULT true,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by VARCHAR(120),
  updated_info TEXT,
  FOREIGN KEY (customer_id) REFERENCES org_customers_mst(id) ON DELETE CASCADE,
  UNIQUE(tenant_org_id, customer_id, preference_code)
);

CREATE INDEX IF NOT EXISTS idx_org_cust_svc_prefs_cust ON org_customer_service_prefs(tenant_org_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_org_cust_svc_prefs_active ON org_customer_service_prefs(tenant_org_id, customer_id) WHERE is_active = true;

-- org_customer_pref_changelog (audit)
CREATE TABLE IF NOT EXISTS org_customer_pref_changelog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  preference_code VARCHAR(50) NOT NULL,
  action VARCHAR(20) NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by VARCHAR(120),
  changed_info TEXT,
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_org_cust_pref_chg_cust ON org_customer_pref_changelog(tenant_org_id, customer_id);

-- ==================================================================
-- SECTION 9: Database Functions
-- ==================================================================

-- resolve_item_preferences: returns resolved prefs for item (customer + product + service category)
CREATE OR REPLACE FUNCTION resolve_item_preferences(
  p_tenant_org_id UUID,
  p_customer_id UUID,
  p_product_code VARCHAR(120),
  p_service_category_code VARCHAR(120)
)
RETURNS TABLE(preference_code VARCHAR(50), source VARCHAR(30))
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Customer standing prefs
  RETURN QUERY
  SELECT csp.preference_code, csp.source::VARCHAR(30)
  FROM org_customer_service_prefs csp
  WHERE csp.tenant_org_id = p_tenant_org_id
    AND csp.customer_id = p_customer_id
    AND csp.is_active = true;
END;
$$;

-- fn_log_customer_pref_change: trigger for org_customer_service_prefs
CREATE OR REPLACE FUNCTION fn_log_customer_pref_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO org_customer_pref_changelog (tenant_org_id, customer_id, preference_code, action, new_value, changed_by, changed_info)
    VALUES (NEW.tenant_org_id, NEW.customer_id, NEW.preference_code, 'INSERT', to_jsonb(NEW), NEW.created_by, NEW.created_info);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO org_customer_pref_changelog (tenant_org_id, customer_id, preference_code, action, old_value, new_value, changed_by, changed_info)
    VALUES (NEW.tenant_org_id, NEW.customer_id, NEW.preference_code, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), NEW.updated_by, NEW.updated_info);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO org_customer_pref_changelog (tenant_org_id, customer_id, preference_code, action, old_value, changed_by, changed_info)
    VALUES (OLD.tenant_org_id, OLD.customer_id, OLD.preference_code, 'DELETE', to_jsonb(OLD), OLD.updated_by, OLD.updated_info);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_customer_pref_change ON org_customer_service_prefs;
CREATE TRIGGER trg_log_customer_pref_change
  AFTER INSERT OR UPDATE OR DELETE ON org_customer_service_prefs
  FOR EACH ROW EXECUTE FUNCTION fn_log_customer_pref_change();

-- calculate_ready_by_with_preferences: stub - integrates extra_turnaround_minutes from prefs
CREATE OR REPLACE FUNCTION calculate_ready_by_with_preferences(
  p_order_id UUID,
  p_tenant_org_id UUID,
  p_base_turnaround_hours NUMERIC
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_extra_minutes INTEGER := 0;
  v_base_ready TIMESTAMPTZ;
BEGIN
  SELECT COALESCE(SUM(ssp.extra_turnaround_minutes), 0) INTO v_extra_minutes
  FROM org_order_item_service_prefs oisp
  JOIN sys_service_preference_cd ssp ON ssp.code = oisp.preference_code
  JOIN org_order_items_dtl oi ON oi.id = oisp.order_item_id
  WHERE oi.order_id = p_order_id AND oi.tenant_org_id = p_tenant_org_id;

  v_base_ready := NOW() + (p_base_turnaround_hours * INTERVAL '1 hour');
  RETURN v_base_ready + (v_extra_minutes * INTERVAL '1 minute');
END;
$$;

-- ==================================================================
-- SECTION 10: RLS Policies
-- ==================================================================

ALTER TABLE org_service_preference_cf ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_packing_preference_cf ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_preference_bundles_cf ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_order_item_service_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_order_item_pc_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_customer_service_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_customer_pref_changelog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_org_service_preference_cf ON org_service_preference_cf;
CREATE POLICY tenant_isolation_org_service_preference_cf ON org_service_preference_cf
  FOR ALL USING (tenant_org_id = current_tenant_id()) WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_org_packing_preference_cf ON org_packing_preference_cf;
CREATE POLICY tenant_isolation_org_packing_preference_cf ON org_packing_preference_cf
  FOR ALL USING (tenant_org_id = current_tenant_id()) WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_org_preference_bundles_cf ON org_preference_bundles_cf;
CREATE POLICY tenant_isolation_org_preference_bundles_cf ON org_preference_bundles_cf
  FOR ALL USING (tenant_org_id = current_tenant_id()) WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_org_order_item_service_prefs ON org_order_item_service_prefs;
CREATE POLICY tenant_isolation_org_order_item_service_prefs ON org_order_item_service_prefs
  FOR ALL USING (tenant_org_id = current_tenant_id()) WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_org_order_item_pc_prefs ON org_order_item_pc_prefs;
CREATE POLICY tenant_isolation_org_order_item_pc_prefs ON org_order_item_pc_prefs
  FOR ALL USING (tenant_org_id = current_tenant_id()) WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_org_customer_service_prefs ON org_customer_service_prefs;
CREATE POLICY tenant_isolation_org_customer_service_prefs ON org_customer_service_prefs
  FOR ALL USING (tenant_org_id = current_tenant_id()) WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_org_customer_pref_changelog ON org_customer_pref_changelog;
CREATE POLICY tenant_isolation_org_customer_pref_changelog ON org_customer_pref_changelog
  FOR ALL USING (tenant_org_id = current_tenant_id()) WITH CHECK (tenant_org_id = current_tenant_id());

-- Service role policies for admin operations
DROP POLICY IF EXISTS service_role_org_service_preference_cf ON org_service_preference_cf;
CREATE POLICY service_role_org_service_preference_cf ON org_service_preference_cf FOR ALL USING (auth.jwt() ->> 'role' = 'service_role') WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS service_role_org_packing_preference_cf ON org_packing_preference_cf;
CREATE POLICY service_role_org_packing_preference_cf ON org_packing_preference_cf FOR ALL USING (auth.jwt() ->> 'role' = 'service_role') WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS service_role_org_preference_bundles_cf ON org_preference_bundles_cf;
CREATE POLICY service_role_org_preference_bundles_cf ON org_preference_bundles_cf FOR ALL USING (auth.jwt() ->> 'role' = 'service_role') WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS service_role_org_order_item_service_prefs ON org_order_item_service_prefs;
CREATE POLICY service_role_org_order_item_service_prefs ON org_order_item_service_prefs FOR ALL USING (auth.jwt() ->> 'role' = 'service_role') WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS service_role_org_order_item_pc_prefs ON org_order_item_pc_prefs;
CREATE POLICY service_role_org_order_item_pc_prefs ON org_order_item_pc_prefs FOR ALL USING (auth.jwt() ->> 'role' = 'service_role') WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS service_role_org_customer_service_prefs ON org_customer_service_prefs;
CREATE POLICY service_role_org_customer_service_prefs ON org_customer_service_prefs FOR ALL USING (auth.jwt() ->> 'role' = 'service_role') WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS service_role_org_customer_pref_changelog ON org_customer_pref_changelog;
CREATE POLICY service_role_org_customer_pref_changelog ON org_customer_pref_changelog FOR ALL USING (auth.jwt() ->> 'role' = 'service_role') WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

COMMIT;
