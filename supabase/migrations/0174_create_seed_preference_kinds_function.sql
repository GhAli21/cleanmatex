-- ==================================================================
-- Migration: 0174_create_seed_preference_kinds_function.sql
-- Purpose: Create function to seed preference kinds for a tenant
-- Dependencies: 0171_create_preference_kind_tables.sql
-- Do NOT apply — user reviews and applies manually.
-- ==================================================================

BEGIN;

-- ==================================================================
-- FUNCTION: seed_tenant_preference_kinds
-- ==================================================================

CREATE OR REPLACE FUNCTION seed_tenant_preference_kinds(
  p_tenant_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted_count INTEGER := 0;
BEGIN
  -- Validate tenant exists
  IF NOT EXISTS (
    SELECT 1 FROM org_tenants_mst
    WHERE id = p_tenant_id AND rec_status = 1
  ) THEN
    RAISE EXCEPTION 'Tenant % not found', p_tenant_id;
  END IF;

  -- Insert missing preference kinds (matching migration 0171 SECTION 4)
  INSERT INTO org_preference_kind_cf (
    tenant_org_id,
    kind_code,
    is_show_in_quick_bar,
    is_show_for_customer,
    rec_order,
    is_active,
    created_by
  )
  SELECT
    p_tenant_id,
    s.kind_code,
    s.is_show_in_quick_bar,
    s.is_show_for_customer,
    s.rec_order,
    true,
    'tenant_catalog_seed'
  FROM sys_preference_kind_cd s
  WHERE s.is_active = true
  ON CONFLICT (tenant_org_id, kind_code) DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  RETURN v_inserted_count;
END;
$$;

COMMENT ON FUNCTION seed_tenant_preference_kinds(UUID) IS 'Seeds org_preference_kind_cf from sys_preference_kind_cd for a tenant. Returns count of inserted rows.';

COMMIT;
