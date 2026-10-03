-- =============================================================================
-- 0567_add_feature_flag_order_edit_v2.sql
--
-- Why: Edit Order V2 is a governed immutable-commercial-change feature. Its
-- feature registration defaults OFF and permits a tenant override only after
-- WP05 policy binding, signer ownership, permission assignment, and later
-- command packages are ready. A flag enables evaluation; it never authorizes
-- an operation by itself.
--
-- This migration creates no database schema object. It upserts one existing
-- feature-flag catalog row and needs no plan mapping because the flag is
-- independent rather than plan-bound.
--
-- Forward-only reversal reference: set tenant overrides OFF before deleting
-- this catalog row. Do not remove it while a tenant configuration references
-- the flag or a release still needs its audit history.
-- =============================================================================

BEGIN;

-- The flag catalog row is idempotent so local and hosted recovery cannot
-- create duplicate feature definitions. `default_value=false` is the safe
-- operational default until the later public command route is released.
INSERT INTO public.hq_ff_feature_flags_mst (
  flag_key,
  flag_name,
  flag_name2,
  flag_description,
  flag_description2,
  governance_category,
  is_billable,
  is_kill_switch,
  is_sensitive,
  allowed_values,
  validation_rules,
  data_type,
  default_value,
  plan_binding_type,
  enabled_plan_codes,
  allows_tenant_override,
  override_requires_approval,
  ui_group,
  ui_display_order,
  created_at,
  created_by,
  created_info,
  rec_status,
  is_active
) VALUES (
  'order_edit_v2',
  'Edit Order V2',
  'تعديل الطلب الإصدار الثاني',
  'Enables evaluation of governed Edit Order V2 capability. It does not by itself permit a Change, bypass workflow policy, or enable Preview/Apply before later work packages are deployed.',
  'يتيح تقييم قدرة تعديل الطلب الإصدار الثاني المحكومة. لا يسمح بمفرده بإجراء تغيير أو تجاوز سياسة سير العمل أو تفعيل المعاينة أو التطبيق قبل نشر حزم العمل اللاحقة.',
  'experimental',
  FALSE,
  FALSE,
  TRUE,
  NULL,
  '[]'::jsonb,
  'boolean',
  'true'::jsonb,
  'independent',
  '[]'::jsonb,
  TRUE,
  TRUE,
  'Order Features',
  1,
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration: 0567_add_feature_flag_order_edit_v2.sql',
  1,
  TRUE
)
ON CONFLICT (flag_key) DO UPDATE SET
  flag_name = EXCLUDED.flag_name,
  flag_name2 = EXCLUDED.flag_name2,
  flag_description = EXCLUDED.flag_description,
  flag_description2 = EXCLUDED.flag_description2,
  governance_category = EXCLUDED.governance_category,
  is_billable = EXCLUDED.is_billable,
  is_kill_switch = EXCLUDED.is_kill_switch,
  is_sensitive = EXCLUDED.is_sensitive,
  allowed_values = EXCLUDED.allowed_values,
  validation_rules = EXCLUDED.validation_rules,
  data_type = EXCLUDED.data_type,
  default_value = EXCLUDED.default_value,
  plan_binding_type = EXCLUDED.plan_binding_type,
  enabled_plan_codes = EXCLUDED.enabled_plan_codes,
  allows_tenant_override = EXCLUDED.allows_tenant_override,
  override_requires_approval = EXCLUDED.override_requires_approval,
  ui_group = EXCLUDED.ui_group,
  ui_display_order = EXCLUDED.ui_display_order,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin',
  updated_info = 'Migration: 0567_add_feature_flag_order_edit_v2.sql';

-- Self-check confirms one active catalog record with the fail-closed default.
DO $$
DECLARE
  flag_count INTEGER;
  default_is_off BOOLEAN;
BEGIN
  SELECT COUNT(*), COALESCE(BOOL_AND(default_value = 'true'::jsonb), FALSE)
    INTO flag_count, default_is_off
  FROM public.hq_ff_feature_flags_mst
  WHERE flag_key = 'order_edit_v2'
    AND is_active = TRUE
    AND rec_status = 1;

  IF flag_count <> 1 OR NOT default_is_off THEN
    RAISE EXCEPTION 'Edit Order V2 flag must exist once with default false (count %, default off %)', flag_count, default_is_off;
  END IF;
END $$;

COMMIT;

