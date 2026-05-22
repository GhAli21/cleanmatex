-- =============================================================================
-- 0319_bvm_wiring_phase1a_permissions.sql
-- BVM Wiring Phase 1A — New permission codes
--
-- fin_vouchers:wire       — execute posting+wiring of a voucher
-- fin_vouchers:view_effects — view linked operational effects on a voucher
--
-- Both codes follow the resource:action naming convention and are seeded into
-- sys_auth_permissions with role grants in sys_auth_role_default_permissions.
-- =============================================================================

BEGIN;

-- ── Permission definitions ────────────────────────────────────────────────────

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
  created_by
) VALUES
  (
    'fin_vouchers:wire',
    'Wire Voucher Lines',
    'ربط بنود السند بالعمليات',
    'actions',
    'Execute wiring of posted voucher lines to operational tables (payments, cash movements, credit applications)',
    'ربط بنود السند المرحّلة بجداول العمليات التشغيلية (المدفوعات، الحركات النقدية، تطبيقات الائتمان)',
    'Finance',
    true,
    true,
    1,
    CURRENT_TIMESTAMP,
    'system_admin'
  ),
  (
    'fin_vouchers:view_effects',
    'View Voucher Linked Effects',
    'عرض تأثيرات السند المرتبطة',
    'read',
    'View operational records linked to a voucher (order payments, cash drawer movements)',
    'عرض السجلات التشغيلية المرتبطة بسند مالي (مدفوعات الطلبات، حركات الصندوق النقدي)',
    'Finance',
    true,
    true,
    1,
    CURRENT_TIMESTAMP,
    'system_admin'
  )
ON CONFLICT (code) DO NOTHING;

-- ── Role grants: fin_vouchers:wire — branch_manager and above ─────────────────

INSERT INTO public.sys_auth_role_default_permissions (
  role_code,
  permission_code,
  is_enabled,
  is_active,
  rec_status,
  created_at,
  created_by
)
SELECT
  r.code,
  p.code,
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('branch_manager', 'admin', 'tenant_admin', 'super_admin')
  AND p.code = 'fin_vouchers:wire'
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );

-- ── Role grants: fin_vouchers:view_effects — all roles ────────────────────────

INSERT INTO public.sys_auth_role_default_permissions (
  role_code,
  permission_code,
  is_enabled,
  is_active,
  rec_status,
  created_at,
  created_by
)
SELECT
  r.code,
  p.code,
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('cashier', 'operator', 'branch_manager', 'admin', 'tenant_admin', 'super_admin')
  AND p.code = 'fin_vouchers:view_effects'
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );

COMMIT;
