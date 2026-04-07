-- ==================================================================
-- Migration: 0219_erp_lite_nav_ops_surfaces.sql
-- Purpose: Seed navigation entries for the four new ERP-Lite Phase 4
--          tenant operations UI surfaces:
--            - Finance Readiness Dashboard (/dashboard/erp-lite)
--            - Usage Mapping Console       (/dashboard/erp-lite/usage-maps)
--            - Exception Workbench         (/dashboard/erp-lite/exceptions)
--            - Period Management           (/dashboard/erp-lite/periods)
--            - Posting Audit Viewer        (/dashboard/erp-lite/posting-audit)
--
--          Also updates the ERP-Lite parent route to point to the
--          new readiness dashboard as its default landing page.
--
-- Depends on:
--   - 0177_erp_lite_phase1_navigation.sql (parent comp_code 'erp_lite')
--   - 0218_erp_lite_auth_deltas.sql (feature flags + permissions)
--
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 1. Update parent ERP-Lite nav entry default path → readiness
--    Previously /dashboard/erp-lite/reports; now /dashboard/erp-lite
--    which will render the Finance Readiness Dashboard.
-- ------------------------------------------------------------------
UPDATE public.sys_components_cd
SET
  comp_path  = '/dashboard/erp-lite',
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin',
  updated_info = 'Migration 0219: default path → readiness dashboard'
WHERE comp_code = 'erp_lite'
  AND comp_path = '/dashboard/erp-lite/reports';

-- ------------------------------------------------------------------
-- 2. Insert new child navigation entries
--    display_order continues from 8 (branch_pl = 8 in 0177)
-- ------------------------------------------------------------------
INSERT INTO public.sys_components_cd (
  comp_code,
  parent_comp_code,
  label,
  label2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  main_permission_code,
  feature_flag,
  rec_status
) VALUES
  -- Finance Readiness Dashboard (replaces /dashboard/erp-lite landing)
  (
    'erp_lite_readiness',
    'erp_lite',
    'Finance Readiness',
    'الجاهزية المالية',
    '/dashboard/erp-lite/readiness',
    'ShieldCheck',
    1,
    9,
    true, true, true, true, true,
    '["super_admin","tenant_admin","admin"]'::jsonb,
    'erp_lite:view',
    '["erp_lite_readiness_enabled"]'::jsonb,
    1
  ),
  -- Usage Mapping Console
  (
    'erp_lite_usage_maps',
    'erp_lite',
    'Usage Mapping',
    'تعيين الاستخدام',
    '/dashboard/erp-lite/usage-maps',
    'ArrowLeftRight',
    1,
    10,
    true, true, true, true, true,
    '["super_admin","tenant_admin","admin"]'::jsonb,
    'erp_lite_usage_map:view',
    '["erp_lite_usage_map_enabled"]'::jsonb,
    1
  ),
  -- Exception Workbench
  (
    'erp_lite_exceptions',
    'erp_lite',
    'Exception Workbench',
    'منضدة الاستثناءات',
    '/dashboard/erp-lite/exceptions',
    'AlertTriangle',
    1,
    11,
    true, true, true, true, true,
    '["super_admin","tenant_admin","admin"]'::jsonb,
    'erp_lite_exceptions:view',
    '["erp_lite_exceptions_enabled"]'::jsonb,
    1
  ),
  -- Period Management
  (
    'erp_lite_periods',
    'erp_lite',
    'Period Management',
    'إدارة الفترات المحاسبية',
    '/dashboard/erp-lite/periods',
    'CalendarRange',
    1,
    12,
    true, true, true, true, true,
    '["super_admin","tenant_admin","admin"]'::jsonb,
    'erp_lite_periods:view',
    '["erp_lite_periods_enabled"]'::jsonb,
    1
  ),
  -- Posting Audit Viewer
  (
    'erp_lite_post_audit',
    'erp_lite',
    'Posting Audit',
    'مراجعة الترحيل',
    '/dashboard/erp-lite/posting-audit',
    'FileSearch',
    1,
    13,
    true, true, true, true, true,
    '["super_admin","tenant_admin","admin"]'::jsonb,
    'erp_lite_post_audit:view',
    '["erp_lite_post_audit_enabled"]'::jsonb,
    1
  )
ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code    = EXCLUDED.parent_comp_code,
  label               = EXCLUDED.label,
  label2              = EXCLUDED.label2,
  comp_path           = EXCLUDED.comp_path,
  comp_icon           = EXCLUDED.comp_icon,
  comp_level          = EXCLUDED.comp_level,
  display_order       = EXCLUDED.display_order,
  is_leaf             = EXCLUDED.is_leaf,
  is_navigable        = EXCLUDED.is_navigable,
  is_active           = EXCLUDED.is_active,
  is_for_tenant_use   = EXCLUDED.is_for_tenant_use,
  roles               = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  feature_flag        = EXCLUDED.feature_flag,
  updated_at          = CURRENT_TIMESTAMP,
  updated_by          = 'system_admin',
  updated_info        = 'Migration 0219 ERP-Lite ops surfaces';

-- ------------------------------------------------------------------
-- 3. Wire parent_comp_id for new children (mirrors 0177 pattern)
-- ------------------------------------------------------------------
UPDATE public.sys_components_cd child
SET parent_comp_id = parent.comp_id
FROM public.sys_components_cd parent
WHERE child.parent_comp_code = 'erp_lite'
  AND parent.comp_code = 'erp_lite'
  AND (child.parent_comp_id IS NULL OR child.parent_comp_id <> parent.comp_id);

COMMIT;
