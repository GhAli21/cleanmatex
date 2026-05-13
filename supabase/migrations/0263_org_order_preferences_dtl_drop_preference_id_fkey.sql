-- ==================================================================
-- Migration: 0263_org_order_preferences_dtl_drop_preference_id_fkey.sql
-- Purpose: Drop FK org_order_preferences_dtl.preference_id →
--          org_service_preference_cf(id). preference_id is polymorphic:
--          service/color/condition rows → org_service_preference_cf.id;
--          packing_prefs → org_packing_preference_cf.id (same UUID column).
--          Recalculate ready-by using a join on org_service_preference_cf.id
--          (0166 mistakenly referenced cf.preference_id, which does not exist).
-- Do NOT apply — user runs migrations manually.
-- ==================================================================

BEGIN;

ALTER TABLE org_order_preferences_dtl
  DROP CONSTRAINT IF EXISTS org_order_preferences_dtl_preference_id_fkey;

COMMENT ON COLUMN org_order_preferences_dtl.preference_id IS
  'Polymorphic catalog row id: org_service_preference_cf.id (service_prefs, color, conditions, …) or org_packing_preference_cf.id when preference_sys_kind = packing_prefs. No FK; resolve using preference_sys_kind + tenant + preference_code when id is null.';

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
    cf.tenant_org_id = op.tenant_org_id
    AND cf.id = op.preference_id
  )
  WHERE op.order_id = p_order_id
    AND op.tenant_org_id = p_tenant_org_id
    AND op.rec_status = 1;

  v_base_ready := NOW() + (p_base_turnaround_hours * INTERVAL '1 hour');
  RETURN v_base_ready + (v_extra_minutes * INTERVAL '1 minute');
END;
$$;

COMMENT ON FUNCTION calculate_ready_by_with_preferences IS
  'Ready-by: sums extra_turnaround_minutes from org_service_preference_cf for order pref rows whose preference_id matches a service catalog row; packing-linked ids do not match and contribute 0.';

COMMIT;
