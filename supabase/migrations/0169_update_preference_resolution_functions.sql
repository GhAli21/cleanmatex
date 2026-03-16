-- ==================================================================
-- Migration: 0169_update_preference_resolution_functions.sql
-- Purpose: Update get_last_order_preferences and suggest_preferences_from_history
--          to query org_order_preferences_dtl instead of org_order_item_service_prefs
-- Part of: Customer/Order/Item/Pieces Preferences - Unified Plan
-- Do NOT apply - user runs migrations manually
-- Dependencies: 0166_create_org_order_preferences_dtl.sql
-- ==================================================================

BEGIN;

-- ==================================================================
-- get_last_order_preferences: Returns last order's service prefs and packing prefs per item
-- Uses org_order_preferences_dtl with prefs_level IN ('ITEM','PIECE')
-- ==================================================================
CREATE OR REPLACE FUNCTION get_last_order_preferences(
  p_tenant_org_id UUID,
  p_customer_id UUID
)
RETURNS TABLE(
  product_id UUID,
  service_category_code VARCHAR(120),
  packing_pref_code VARCHAR(50),
  service_pref_codes TEXT[]
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  -- Get most recent completed/preparing order for customer
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
      ARRAY_AGG(DISTINCT op.preference_code) FILTER (WHERE op.preference_code IS NOT NULL AND op.preference_sys_kind = 'service_prefs'),
      '{}'::TEXT[]
    ) AS service_pref_codes
  FROM org_order_items_dtl oi
  LEFT JOIN org_order_preferences_dtl op
    ON op.order_item_id = oi.id
    AND op.tenant_org_id = p_tenant_org_id
    AND op.rec_status = 1
  WHERE oi.order_id = v_order_id
    AND oi.tenant_org_id = p_tenant_org_id
  GROUP BY oi.id, oi.product_id, oi.service_category_code, oi.packing_pref_code;
END;
$$;

-- ==================================================================
-- suggest_preferences_from_history: Returns frequently used prefs for customer/product/category
-- Uses org_order_preferences_dtl
-- ==================================================================
CREATE OR REPLACE FUNCTION suggest_preferences_from_history(
  p_tenant_org_id UUID,
  p_customer_id UUID,
  p_product_code VARCHAR(120) DEFAULT NULL,
  p_service_category_code VARCHAR(120) DEFAULT NULL,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE(preference_code VARCHAR(50), usage_count BIGINT)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    op.preference_code::VARCHAR(50),
    COUNT(*)::BIGINT AS usage_count
  FROM org_order_preferences_dtl op
  JOIN org_order_items_dtl oi ON oi.id = op.order_item_id
  JOIN org_orders_mst o ON o.id = oi.order_id
  WHERE o.tenant_org_id = p_tenant_org_id
    AND o.customer_id = p_customer_id
    AND op.preference_sys_kind = 'service_prefs'
    AND (p_product_code IS NULL OR EXISTS (
      SELECT 1 FROM org_product_data_mst p
      WHERE p.id = oi.product_id AND p.tenant_org_id = p_tenant_org_id AND p.product_code = p_product_code
    ))
    AND (p_service_category_code IS NULL OR oi.service_category_code = p_service_category_code)
  GROUP BY op.preference_code
  ORDER BY usage_count DESC
  LIMIT p_limit;
END;
$$;

COMMIT;
