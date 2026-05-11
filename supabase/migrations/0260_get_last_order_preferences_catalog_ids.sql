-- ==================================================================
-- Migration: 0260_get_last_order_preferences_catalog_ids.sql
-- Purpose: Extend get_last_order_preferences to return tenant catalog FKs
--          (packing CF id, service pref rows with preference_id) for Repeat
--          Last Order and aligned org_order_preferences_dtl.preference_id.
-- Dependencies: 0169_update_preference_resolution_functions.sql
-- Do NOT execute from agent — user applies migrations.
-- ==================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.get_last_order_preferences(UUID, UUID);

CREATE FUNCTION public.get_last_order_preferences(
  p_tenant_org_id UUID,
  p_customer_id UUID
)
RETURNS TABLE(
  product_id UUID,
  service_category_code VARCHAR(120),
  packing_pref_code VARCHAR(50),
  service_pref_codes TEXT[],
  packing_pref_cf_id UUID,
  service_prefs_catalog JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  SELECT o.id INTO v_order_id
  FROM org_orders_mst o
  WHERE o.tenant_org_id = p_tenant_org_id
    AND o.customer_id = p_customer_id
    AND o.rec_status = 1
  ORDER BY o.created_at DESC
  LIMIT 1;

  IF v_order_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    oi.product_id,
    oi.service_category_code::VARCHAR(120),
    oi.packing_pref_code,
    COALESCE(
      (
        SELECT ARRAY_AGG(sq.preference_code ORDER BY sq.preference_code)
        FROM (
          SELECT DISTINCT ON (op.preference_code)
            op.preference_code
          FROM org_order_preferences_dtl op
          WHERE op.order_item_id = oi.id
            AND op.tenant_org_id = p_tenant_org_id
            AND op.rec_status = 1
            AND op.preference_sys_kind = 'service_prefs'
            AND op.preference_code IS NOT NULL
          ORDER BY op.preference_code, op.prefs_no NULLS LAST
        ) sq
      ),
      '{}'::TEXT[]
    ) AS service_pref_codes,
    (
      SELECT op.preference_id
      FROM org_order_preferences_dtl op
      WHERE op.order_item_id = oi.id
        AND op.tenant_org_id = p_tenant_org_id
        AND op.rec_status = 1
        AND op.preference_sys_kind = 'packing_prefs'
      ORDER BY op.prefs_no NULLS LAST
      LIMIT 1
    ) AS packing_pref_cf_id,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'preference_code', sq.preference_code,
            'preference_id', sq.preference_id
          )
          ORDER BY sq.preference_code
        )
        FROM (
          SELECT DISTINCT ON (op.preference_code)
            op.preference_code,
            op.preference_id
          FROM org_order_preferences_dtl op
          WHERE op.order_item_id = oi.id
            AND op.tenant_org_id = p_tenant_org_id
            AND op.rec_status = 1
            AND op.preference_sys_kind = 'service_prefs'
            AND op.preference_code IS NOT NULL
          ORDER BY op.preference_code, op.prefs_no NULLS LAST
        ) sq
      ),
      '[]'::JSONB
    ) AS service_prefs_catalog
  FROM org_order_items_dtl oi
  WHERE oi.order_id = v_order_id
    AND oi.tenant_org_id = p_tenant_org_id;
END;
$$;

COMMIT;
