-- ==================================================================
-- Migration 0162: Customer Category Categorization
-- ==================================================================
-- Purpose: Create sys_customer_category_cd (system catalog) and
--   org_customer_category_cf (tenant config), add customer_category_id
--   to org_customers_mst, backfill existing customers, seed function.
-- Mapping: guest->guest, stub->stub, walk_in->walk_in, full->walk_in, b2b->b2b
-- ==================================================================

BEGIN;

-- ==================================================================
-- 1. Create sys_customer_category_cd (system catalog)
-- ==================================================================
CREATE TABLE IF NOT EXISTS sys_customer_category_cd (
  code                VARCHAR(50) PRIMARY KEY,
  name                VARCHAR(250) NOT NULL,
  name2               VARCHAR(250),
  system_type         VARCHAR(50) NOT NULL,
  is_b2b              BOOLEAN NOT NULL DEFAULT false,
  is_individual       BOOLEAN NOT NULL DEFAULT true,
  is_reserved_system  BOOLEAN NOT NULL DEFAULT false,
  display_order       INTEGER DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by          VARCHAR(120),
  created_info        TEXT,
  updated_at          TIMESTAMP,
  updated_by          VARCHAR(120),
  updated_info        TEXT,
  rec_status          SMALLINT DEFAULT 1,
  rec_order           INTEGER,
  rec_notes           VARCHAR(200),
  CONSTRAINT chk_sys_cust_cat_code_upper CHECK (code = UPPER(code) AND code !~ '\s')
);

COMMENT ON TABLE sys_customer_category_cd IS 'System customer category catalog (guest, walk_in, stub, b2b)';
COMMENT ON COLUMN sys_customer_category_cd.system_type IS 'Lowercase: guest, walk_in, stub, b2b';
COMMENT ON COLUMN sys_customer_category_cd.is_reserved_system IS 'True = tenant cannot edit/delete';

-- ==================================================================
-- 2. Seed sys_customer_category_cd
-- ==================================================================
INSERT INTO sys_customer_category_cd (
  code, name, name2, system_type, is_b2b, is_individual, is_reserved_system, display_order, is_active, created_by, created_info
) VALUES
  ('GUEST', 'Guest', 'زائر', 'guest', false, true, true, 1, true, 'system_migration', 'Migration 0162'),
  ('WALK_IN', 'Walk-in', 'عميل عابر', 'walk_in', false, true, true, 2, true, 'system_migration', 'Migration 0162'),
  ('STUB', 'Stub', 'ملف أولي', 'stub', false, true, true, 3, true, 'system_migration', 'Migration 0162'),
  ('B2B', 'B2B', 'شركات', 'b2b', true, false, true, 4, true, 'system_migration', 'Migration 0162')
ON CONFLICT (code) DO NOTHING;

-- ==================================================================
-- 3. Create org_customer_category_cf (tenant config)
-- ==================================================================
CREATE TABLE IF NOT EXISTS org_customer_category_cf (
  id                   UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id        UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  code                 VARCHAR(50) NOT NULL,
  name                 VARCHAR(250) NOT NULL,
  name2                VARCHAR(250),
  system_category_code VARCHAR(50) REFERENCES sys_customer_category_cd(code) ON DELETE SET NULL,
  system_type          VARCHAR(50),
  is_b2b               BOOLEAN NOT NULL DEFAULT false,
  is_individual        BOOLEAN NOT NULL DEFAULT true,
  display_order        INTEGER DEFAULT 0,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by           VARCHAR(120),
  created_info         TEXT,
  updated_at           TIMESTAMP,
  updated_by           VARCHAR(120),
  updated_info         TEXT,
  rec_status           SMALLINT DEFAULT 1,
  rec_order            INTEGER,
  rec_notes            VARCHAR(200),
  CONSTRAINT pk_org_customer_category_cf PRIMARY KEY (id),
  CONSTRAINT uq_org_cust_cat_tenant_code UNIQUE (tenant_org_id, code),
  CONSTRAINT chk_org_cust_cat_code_upper CHECK (code = UPPER(code) AND code !~ '\s')
);

CREATE INDEX IF NOT EXISTS idx_org_cust_cat_tenant ON org_customer_category_cf(tenant_org_id);
CREATE INDEX IF NOT EXISTS idx_org_cust_cat_tenant_b2b ON org_customer_category_cf(tenant_org_id, is_b2b) WHERE is_active = true;

COMMENT ON TABLE org_customer_category_cf IS 'Tenant customer category config; links to sys_customer_category_cd when system_category_code set';
COMMENT ON COLUMN org_customer_category_cf.system_category_code IS 'FK to sys; NULL = tenant-created custom category';

-- ==================================================================
-- 4. Seed org_customer_category_cf for ALL existing tenants
-- ==================================================================
INSERT INTO org_customer_category_cf (
  tenant_org_id, system_category_code, code, name, name2, system_type, is_b2b, is_individual, display_order, is_active, created_by, created_info
)
SELECT
  t.id,
  s.code,
  s.code,
  s.name,
  s.name2,
  s.system_type,
  s.is_b2b,
  s.is_individual,
  s.display_order,
  s.is_active,
  'system_migration',
  'Migration 0162'
FROM org_tenants_mst t
CROSS JOIN sys_customer_category_cd s
WHERE s.is_active = true
ON CONFLICT (tenant_org_id, code) DO NOTHING;

-- ==================================================================
-- 5. Alter org_customers_mst - add customer_category_id
-- ==================================================================
ALTER TABLE org_customers_mst
  ADD COLUMN IF NOT EXISTS customer_category_id UUID REFERENCES org_customer_category_cf(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_org_customers_category ON org_customers_mst(tenant_org_id, customer_category_id);

COMMENT ON COLUMN org_customers_mst.customer_category_id IS 'FK to org_customer_category_cf; type aligns with category system_type';

-- ==================================================================
-- 6. Backfill customer_category_id (full -> walk_in per Option A)
-- ==================================================================
UPDATE org_customers_mst c
SET customer_category_id = (
  SELECT cf.id
  FROM org_customer_category_cf cf
  WHERE cf.tenant_org_id = c.tenant_org_id
    AND cf.system_category_code IS NOT NULL
    AND cf.system_type = CASE WHEN c.type = 'full' THEN 'walk_in' ELSE COALESCE(c.type, 'walk_in') END
  LIMIT 1
)
WHERE c.customer_category_id IS NULL
  AND c.type IN ('guest', 'stub', 'walk_in', 'full', 'b2b');

-- ==================================================================
-- 7. Create seed_tenant_customer_categories function (for platform)
-- ==================================================================
CREATE OR REPLACE FUNCTION seed_tenant_customer_categories(p_tenant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted INTEGER := 0;
BEGIN
  INSERT INTO org_customer_category_cf (
    tenant_org_id, system_category_code, code, name, name2, system_type, is_b2b, is_individual, display_order, is_active, created_by, created_info
  )
  SELECT
    p_tenant_id,
    s.code,
    s.code,
    s.name,
    s.name2,
    s.system_type,
    s.is_b2b,
    s.is_individual,
    s.display_order,
    s.is_active,
    'platform_seed',
    'seed_tenant_customer_categories'
  FROM sys_customer_category_cd s
  WHERE s.is_active = true
  ON CONFLICT (tenant_org_id, code) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION seed_tenant_customer_categories IS 'Seed org_customer_category_cf from sys_customer_category_cd for a tenant; idempotent';

-- ==================================================================
-- 8. RLS for org_customer_category_cf
-- ==================================================================
ALTER TABLE org_customer_category_cf ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_org_cust_cat ON org_customer_category_cf;
DROP POLICY IF EXISTS tenant_isolation_org_cust_cat_insert ON org_customer_category_cf;
DROP POLICY IF EXISTS tenant_isolation_org_cust_cat_update ON org_customer_category_cf;
DROP POLICY IF EXISTS tenant_isolation_org_cust_cat_delete ON org_customer_category_cf;
DROP POLICY IF EXISTS service_role_org_cust_cat_access ON org_customer_category_cf;

CREATE POLICY tenant_isolation_org_cust_cat ON org_customer_category_cf
  FOR SELECT USING (tenant_org_id = current_tenant_id());

CREATE POLICY tenant_isolation_org_cust_cat_insert ON org_customer_category_cf
  FOR INSERT WITH CHECK (tenant_org_id = current_tenant_id());

CREATE POLICY tenant_isolation_org_cust_cat_update ON org_customer_category_cf
  FOR UPDATE
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

CREATE POLICY tenant_isolation_org_cust_cat_delete ON org_customer_category_cf
  FOR DELETE USING (tenant_org_id = current_tenant_id());

CREATE POLICY service_role_org_cust_cat_access ON org_customer_category_cf
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

COMMIT;
