-- ==================================================================
-- Migration: 0218_erp_lite_auth_deltas.sql
-- Purpose: Add missing ERP-Lite permissions and feature flags for
--          new Phase 4 tenant operations UI surfaces.
--          Closes DELTA-AUTH-001 (usage-map permissions) and
--          DELTA-AUTH-002 (post audit view permission).
--
-- New permissions (previously missing from migration 0176):
--   erp_lite_usage_map:view/create/edit/activate/inactivate/validate
--   erp_lite_post_audit:view
--
-- New feature flags (for new UI surfaces):
--   erp_lite_usage_map_enabled   -- Usage Mapping Console
--   erp_lite_exceptions_enabled  -- Exception Workbench
--   erp_lite_periods_enabled     -- Period Management
--   erp_lite_readiness_enabled   -- Finance Readiness Dashboard
--   erp_lite_post_audit_enabled  -- Posting Audit Viewer
--
-- Default role assignments: super_admin, tenant_admin
--
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 1. New permissions
-- ------------------------------------------------------------------
INSERT INTO public.sys_auth_permissions (
  code,
  name,
  name2,
  category,
  description,
  description2,
  category_main,
  is_active,
  is_enabled,
  rec_status,
  created_at,
  created_by,
  created_info
) VALUES
  -- Usage Mapping Console (DELTA-AUTH-001)
  (
    'erp_lite_usage_map:view',
    'View Usage Mapping Console',
    'عرض وحدة تعيين الاستخدام',
    'crud',
    'View ERP-Lite usage code to account mappings',
    'عرض تعيينات رموز الاستخدام إلى الحسابات في ERP-Lite',
    'ERP-Lite',
    true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0218'
  ),
  (
    'erp_lite_usage_map:create',
    'Create Usage Mappings',
    'إنشاء تعيينات الاستخدام',
    'crud',
    'Create new ERP-Lite usage code to account mappings',
    'إنشاء تعيينات جديدة لرموز الاستخدام إلى الحسابات في ERP-Lite',
    'ERP-Lite',
    true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0218'
  ),
  (
    'erp_lite_usage_map:edit',
    'Edit Usage Mappings',
    'تعديل تعيينات الاستخدام',
    'crud',
    'Edit ERP-Lite usage code to account mappings',
    'تعديل تعيينات رموز الاستخدام إلى الحسابات في ERP-Lite',
    'ERP-Lite',
    true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0218'
  ),
  (
    'erp_lite_usage_map:activate',
    'Activate Usage Mappings',
    'تفعيل تعيينات الاستخدام',
    'actions',
    'Activate an ERP-Lite usage mapping to make it the runtime account',
    'تفعيل تعيين الاستخدام لجعله الحساب الفعّال في وقت التشغيل',
    'ERP-Lite',
    true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0218'
  ),
  (
    'erp_lite_usage_map:inactivate',
    'Inactivate Usage Mappings',
    'إلغاء تفعيل تعيينات الاستخدام',
    'actions',
    'Inactivate an ERP-Lite usage mapping',
    'إلغاء تفعيل تعيين الاستخدام في ERP-Lite',
    'ERP-Lite',
    true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0218'
  ),
  (
    'erp_lite_usage_map:validate',
    'Validate Usage Mappings',
    'التحقق من تعيينات الاستخدام',
    'actions',
    'Run validation checks on ERP-Lite usage mappings before activation',
    'تشغيل فحوصات التحقق على تعيينات الاستخدام في ERP-Lite قبل التفعيل',
    'ERP-Lite',
    true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0218'
  ),
  -- Posting Audit Viewer (DELTA-AUTH-002)
  (
    'erp_lite_post_audit:view',
    'View Posting Audit Trail',
    'عرض سجل مراجعة الترحيل',
    'reports',
    'View ERP-Lite posting execution audit trail including journals, logs, and snapshots',
    'عرض سجل تدقيق تنفيذ الترحيل في ERP-Lite بما يشمل القيود والسجلات واللقطات',
    'ERP-Lite',
    true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0218'
  )
ON CONFLICT (code) DO UPDATE SET
  name          = EXCLUDED.name,
  name2         = EXCLUDED.name2,
  category      = EXCLUDED.category,
  description   = EXCLUDED.description,
  description2  = EXCLUDED.description2,
  category_main = EXCLUDED.category_main,
  is_enabled    = EXCLUDED.is_enabled,
  is_active     = EXCLUDED.is_active,
  updated_at    = CURRENT_TIMESTAMP,
  updated_by    = 'system_admin',
  updated_info  = 'Migration 0218 ERP-Lite auth deltas';

-- ------------------------------------------------------------------
-- 2. Default role assignments for new permissions
--    super_admin and tenant_admin get all new permissions by default.
-- ------------------------------------------------------------------
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code,
  is_enabled, is_active, rec_status, created_at, created_by, created_info
)
SELECT
  r.code, p.code,
  true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0218 ERP-Lite auth deltas'
FROM sys_auth_roles r
CROSS JOIN sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin')
  AND p.code IN (
    'erp_lite_usage_map:view',
    'erp_lite_usage_map:create',
    'erp_lite_usage_map:edit',
    'erp_lite_usage_map:activate',
    'erp_lite_usage_map:inactivate',
    'erp_lite_usage_map:validate',
    'erp_lite_post_audit:view'
  )
  AND NOT EXISTS (
    SELECT 1 FROM sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- ------------------------------------------------------------------
-- 3. New feature flags for Phase 4 tenant operations UI surfaces
--
-- Seeded into hq_ff_feature_flags_mst (HQ governance table).
-- CleanMateX tenant app consumes them via HQ API — NEVER query
-- hq_ff_feature_flags_mst directly from cleanmatex at runtime.
-- ------------------------------------------------------------------
INSERT INTO public.hq_ff_feature_flags_mst (
  flag_key,
  flag_name,
  flag_name2,
  flag_description,
  flag_description2,
  plan_binding_type,
  data_type,
  default_value,
  ui_group,
  governance_category,
  ui_display_order,
  is_active,
  created_at,
  created_by,
  created_info
) VALUES
  (
    'erp_lite_usage_map_enabled',
    'ERP-Lite Usage Mapping Console',
    'وحدة تعيين الاستخدام - ERP-Lite',
    'Enable the tenant Usage Mapping Console for ERP-Lite finance accounts',
    'تفعيل وحدة تعيين الاستخدام للحسابات المالية في ERP-Lite للمستأجر',
    'plan_bound', 'boolean', 'false'::jsonb,
    'ERP-Lite', 'tenant_feature', 10,
    true, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0218'
  ),
  (
    'erp_lite_exceptions_enabled',
    'ERP-Lite Exception Workbench',
    'منضدة استثناءات الترحيل - ERP-Lite',
    'Enable the tenant Exception Workbench for ERP-Lite posting exceptions',
    'تفعيل منضدة استثناءات الترحيل في ERP-Lite للمستأجر',
    'plan_bound', 'boolean', 'false'::jsonb,
    'ERP-Lite', 'tenant_feature', 11,
    true, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0218'
  ),
  (
    'erp_lite_periods_enabled',
    'ERP-Lite Period Management',
    'إدارة الفترات المحاسبية - ERP-Lite',
    'Enable the tenant Period Management screen for ERP-Lite accounting periods',
    'تفعيل شاشة إدارة الفترات المحاسبية في ERP-Lite للمستأجر',
    'plan_bound', 'boolean', 'false'::jsonb,
    'ERP-Lite', 'tenant_feature', 12,
    true, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0218'
  ),
  (
    'erp_lite_readiness_enabled',
    'ERP-Lite Finance Readiness Dashboard',
    'لوحة الجاهزية المالية - ERP-Lite',
    'Enable the tenant Finance Readiness Dashboard for ERP-Lite',
    'تفعيل لوحة الجاهزية المالية في ERP-Lite للمستأجر',
    'plan_bound', 'boolean', 'false'::jsonb,
    'ERP-Lite', 'tenant_feature', 13,
    true, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0218'
  ),
  (
    'erp_lite_post_audit_enabled',
    'ERP-Lite Posting Audit Viewer',
    'عارض مراجعة الترحيل - ERP-Lite',
    'Enable the Posting Audit Viewer screen for ERP-Lite journal execution history',
    'تفعيل شاشة عارض مراجعة الترحيل لسجل تنفيذ القيود في ERP-Lite',
    'plan_bound', 'boolean', 'false'::jsonb,
    'ERP-Lite', 'tenant_feature', 14,
    true, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0218'
  )
ON CONFLICT (flag_key) DO UPDATE SET
  flag_name          = EXCLUDED.flag_name,
  flag_name2         = EXCLUDED.flag_name2,
  flag_description   = EXCLUDED.flag_description,
  flag_description2  = EXCLUDED.flag_description2,
  plan_binding_type  = EXCLUDED.plan_binding_type,
  ui_group           = EXCLUDED.ui_group,
  governance_category = EXCLUDED.governance_category,
  ui_display_order   = EXCLUDED.ui_display_order,
  is_active          = EXCLUDED.is_active,
  updated_at         = CURRENT_TIMESTAMP,
  updated_by         = 'system_admin',
  updated_info       = 'Migration 0218 ERP-Lite auth deltas';

COMMIT;
