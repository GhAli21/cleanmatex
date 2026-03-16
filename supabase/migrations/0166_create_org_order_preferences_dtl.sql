-- ==================================================================
-- Migration: 0166_create_org_order_preferences_dtl.sql
-- Purpose: Create unified org_order_preferences_dtl, migrate data from
--          org_order_item_service_prefs and org_order_item_pc_prefs,
--          drop old tables, migrate org_customer_service_prefs FK.
--          calculate_ready_by_with_preferences uses org_service_preference_cf only.
-- Part of: Customer/Order/Item/Pieces Preferences - Unified Plan
-- Tenant init/maintenance: Handled by SAAS HQ Platform (cleanmatexsaas).
-- Do NOT apply - user runs migrations manually
-- ==================================================================

BEGIN;

-- ==================================================================
-- SECTION 1: Create org_order_preferences_dtl
-- ==================================================================

CREATE TABLE org_order_preferences_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES org_orders_mst(id) ON DELETE CASCADE,
  branch_id UUID,
  prefs_no INTEGER NOT NULL,
  prefs_level VARCHAR(20) NOT NULL CHECK (prefs_level IN ('ORDER','ITEM','PIECE')),
  order_item_id UUID REFERENCES org_order_items_dtl(id) ON DELETE CASCADE,
  order_item_piece_id UUID REFERENCES org_order_item_pieces_dtl(id) ON DELETE CASCADE,
  preference_id UUID REFERENCES org_service_preference_cf(id),
  preference_code TEXT NOT NULL,
  preference_sys_kind VARCHAR(30),
  preference_category VARCHAR(30),
  prefs_owner_type VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
  prefs_source VARCHAR(50) NOT NULL DEFAULT 'ORDER_CREATE',
  extra_price DECIMAL(19,4) DEFAULT 0,
  processing_confirmed BOOLEAN DEFAULT false,
  confirmed_by VARCHAR(120),
  confirmed_at TIMESTAMPTZ,
  rec_status SMALLINT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(120),
  updated_at TIMESTAMPTZ,
  updated_by VARCHAR(120),
  CONSTRAINT chk_ord_pref_item_req CHECK (
    (prefs_level = 'ORDER' AND order_item_id IS NULL AND order_item_piece_id IS NULL) OR
    (prefs_level = 'ITEM' AND order_item_id IS NOT NULL AND order_item_piece_id IS NULL) OR
    (prefs_level = 'PIECE' AND order_item_id IS NOT NULL AND order_item_piece_id IS NOT NULL)
  )
);

COMMENT ON TABLE org_order_preferences_dtl IS 'Unified order preferences at ORDER/ITEM/PIECE level (replaces org_order_item_service_prefs and org_order_item_pc_prefs)';
COMMENT ON COLUMN org_order_preferences_dtl.prefs_level IS 'Granularity: ORDER, ITEM, PIECE';
COMMENT ON COLUMN org_order_preferences_dtl.preference_id IS 'Live link to org_service_preference_cf; nullable for historical';
COMMENT ON COLUMN org_order_preferences_dtl.preference_code IS 'Historical; no FK';
COMMENT ON COLUMN org_order_preferences_dtl.preference_sys_kind IS 'service_prefs, condition_stain, condition_damag, color, note';

CREATE INDEX idx_ord_pref_tenant_order ON org_order_preferences_dtl(tenant_org_id, order_id);
CREATE INDEX idx_ord_pref_tenant_item ON org_order_preferences_dtl(tenant_org_id, order_item_id) WHERE order_item_id IS NOT NULL;
CREATE INDEX idx_ord_pref_tenant_piece ON org_order_preferences_dtl(tenant_org_id, order_item_piece_id) WHERE order_item_piece_id IS NOT NULL;
CREATE INDEX idx_ord_pref_preference_id ON org_order_preferences_dtl(preference_id) WHERE preference_id IS NOT NULL;

-- ==================================================================
-- SECTION 2: Migrate org_order_item_service_prefs -> org_order_preferences_dtl (ITEM)
-- ==================================================================

INSERT INTO org_order_preferences_dtl (
  id, tenant_org_id, order_id, branch_id, prefs_no, prefs_level,
  order_item_id, order_item_piece_id, preference_id, preference_code,
  preference_sys_kind, preference_category, prefs_owner_type, prefs_source,
  extra_price, processing_confirmed, confirmed_by, confirmed_at,
  rec_status, created_at, created_by, updated_at, updated_by
)
SELECT
  oisp.id,
  oisp.tenant_org_id,
  oisp.order_id,
  oisp.branch_id,
  ROW_NUMBER() OVER (PARTITION BY oisp.order_item_id ORDER BY oisp.created_at, oisp.id)::INTEGER AS prefs_no,
  'ITEM'::VARCHAR(20),
  oisp.order_item_id,
  NULL,
  (SELECT cf.id FROM org_service_preference_cf cf WHERE cf.tenant_org_id = oisp.tenant_org_id AND cf.preference_code = oisp.preference_code LIMIT 1),
  oisp.preference_code,
  'service_prefs'::VARCHAR(30),
  oisp.preference_category,
  'SYSTEM'::VARCHAR(20),
  COALESCE(NULLIF(oisp.source, ''), 'ORDER_CREATE')::VARCHAR(50),
  COALESCE(oisp.extra_price, 0),
  COALESCE(oisp.processing_confirmed, false),
  oisp.confirmed_by,
  oisp.confirmed_at,
  COALESCE(oisp.rec_status, 1),
  oisp.created_at,
  oisp.created_by,
  oisp.updated_at,
  oisp.updated_by
FROM org_order_item_service_prefs oisp;

-- ==================================================================
-- SECTION 3: Migrate org_order_item_pc_prefs -> org_order_preferences_dtl (PIECE)
-- ==================================================================

INSERT INTO org_order_preferences_dtl (
  id, tenant_org_id, order_id, branch_id, prefs_no, prefs_level,
  order_item_id, order_item_piece_id, preference_id, preference_code,
  preference_sys_kind, preference_category, prefs_owner_type, prefs_source,
  extra_price, processing_confirmed, confirmed_by, confirmed_at,
  rec_status, created_at, created_by, updated_at, updated_by
)
SELECT
  opc.id,
  opc.tenant_org_id,
  opc.order_id,
  opc.branch_id,
  ROW_NUMBER() OVER (PARTITION BY opc.order_item_piece_id ORDER BY opc.created_at, opc.id)::INTEGER AS prefs_no,
  'PIECE'::VARCHAR(20),
  opc.order_item_id,
  opc.order_item_piece_id,
  (SELECT cf.id FROM org_service_preference_cf cf WHERE cf.tenant_org_id = opc.tenant_org_id AND cf.preference_code = opc.preference_code LIMIT 1),
  opc.preference_code,
  COALESCE(
    (SELECT ssp.preference_sys_kind FROM sys_service_preference_cd ssp WHERE ssp.code = opc.preference_code LIMIT 1),
    'service_prefs'
  )::VARCHAR(30),
  opc.preference_category,
  'SYSTEM'::VARCHAR(20),
  COALESCE(NULLIF(opc.source, ''), 'ORDER_CREATE')::VARCHAR(50),
  COALESCE(opc.extra_price, 0),
  COALESCE(opc.processing_confirmed, false),
  opc.confirmed_by,
  opc.confirmed_at,
  COALESCE(opc.rec_status, 1),
  opc.created_at,
  opc.created_by,
  opc.updated_at,
  opc.updated_by
FROM org_order_item_pc_prefs opc;

-- ==================================================================
-- SECTION 4: Ensure org_service_preference_cf has extra_turnaround_minutes
-- ==================================================================

ALTER TABLE org_service_preference_cf
  ADD COLUMN IF NOT EXISTS extra_turnaround_minutes INTEGER DEFAULT 0;

-- Backfill from sys_service_preference_cd where org row has NULL
UPDATE org_service_preference_cf cf
SET extra_turnaround_minutes = COALESCE(ssp.extra_turnaround_minutes, 0)
FROM sys_service_preference_cd ssp
WHERE ssp.code = cf.preference_code
  AND cf.extra_turnaround_minutes IS NULL;

COMMENT ON COLUMN org_service_preference_cf.extra_turnaround_minutes IS 'Additional SLA minutes for ready-by calculation; tenant override of sys catalog';

-- ==================================================================
-- SECTION 5: Update calculate_ready_by_with_preferences - use org_service_preference_cf only
-- ==================================================================

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
  SELECT COALESCE(SUM(COALESCE(cf.extra_turnaround_minutes, 0)), 0)::INTEGER INTO v_extra_minutes
  FROM org_order_preferences_dtl op
  JOIN org_service_preference_cf cf ON (
    cf.tenant_org_id = op.tenant_org_id AND cf.preference_id = op.preference_id
  )
  WHERE op.order_id = p_order_id
    AND op.tenant_org_id = p_tenant_org_id
    AND op.rec_status = 1;

  v_base_ready := NOW() + (p_base_turnaround_hours * INTERVAL '1 hour');
  RETURN v_base_ready + (v_extra_minutes * INTERVAL '1 minute');
END;
$$;

COMMENT ON FUNCTION calculate_ready_by_with_preferences IS 'Ready-by calculation using extra_turnaround_minutes from org_service_preference_cf only';

-- ==================================================================
-- SECTION 6: Drop old tables (drop triggers/functions that depend on them first)
-- ==================================================================

DROP TABLE IF EXISTS org_order_item_pc_prefs CASCADE;
DROP TABLE IF EXISTS org_order_item_service_prefs CASCADE;

-- ==================================================================
-- SECTION 7: Migrate org_customer_service_prefs - add preference_cf_id, drop preference_code FK
-- ==================================================================

ALTER TABLE org_customer_service_prefs
  ADD COLUMN IF NOT EXISTS preference_cf_id UUID REFERENCES org_service_preference_cf(id);

-- Backfill preference_cf_id from org_service_preference_cf lookup
UPDATE org_customer_service_prefs csp
SET preference_cf_id = cf.id
FROM org_service_preference_cf cf
WHERE cf.tenant_org_id = csp.tenant_org_id
  AND cf.preference_code = csp.preference_code
  AND csp.preference_cf_id IS NULL;

-- Drop FK on preference_code (keep column for historical)
ALTER TABLE org_customer_service_prefs
  DROP CONSTRAINT IF EXISTS org_customer_service_prefs_preference_code_fkey;

COMMENT ON COLUMN org_customer_service_prefs.preference_cf_id IS 'Live link to org_service_preference_cf; nullable for historical';
COMMENT ON COLUMN org_customer_service_prefs.preference_code IS 'Denormalized for historical; no FK';

-- ==================================================================
-- SECTION 8: RLS for org_order_preferences_dtl (Phase 9)
-- ==================================================================

ALTER TABLE org_order_preferences_dtl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_org_order_preferences_dtl ON org_order_preferences_dtl;
CREATE POLICY tenant_isolation_org_order_preferences_dtl ON org_order_preferences_dtl
  FOR ALL USING (tenant_org_id = current_tenant_id()) WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS service_role_org_order_preferences_dtl ON org_order_preferences_dtl;
CREATE POLICY service_role_org_order_preferences_dtl ON org_order_preferences_dtl
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role') WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

COMMIT;
