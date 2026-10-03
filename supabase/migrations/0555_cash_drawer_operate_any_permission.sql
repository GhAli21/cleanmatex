-- =============================================================================
-- Migration 0555 — New RBAC permission `cash_drawer:operate_any` (B3-1,
-- POS Session & Cash Drawer Hardening).
--
-- Why: the tenant/drawer setting `drawer_assignment_mode = ASSIGNED_ONLY` now
-- restricts opening, counting/closing and taking cash on a drawer to its
-- `assigned_user_id`. A supervisor must still be able to step in (cashier off
-- sick, drawer re-assigned late). The plan suggested "holders of
-- cash_drawer:close_session", but cashiers and operators hold that code (they
-- close their own sessions), which would make ASSIGNED_ONLY toothless — so the
-- override is its own permission, granted to the management tier only.
--
-- Format check: matches ^[a-z0-9_]+:([a-z0-9_]+|\*)$ (CRITICAL RULE #13).
--
-- Role grants mirror cash_drawer:approve_variance minus accountant (an
-- accountant reviews, but does not operate a till): super_admin, tenant_admin,
-- admin, branch_manager, finance_manager.
--
-- Reversal (forward-only): DELETE FROM sys_auth_role_default_permissions WHERE
-- permission_code = 'cash_drawer:operate_any', then DELETE FROM
-- sys_auth_permissions WHERE code = 'cash_drawer:operate_any'. Lossy for any
-- tenant that granted it at user level via org_auth_user_permissions.
-- =============================================================================

BEGIN;

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('cash_drawer:operate_any', 'Operate Any Cash Drawer', 'تشغيل أي درج نقد',
   'actions',
   'Open, count, close and take cash on a cash drawer even when it is assigned to another user (supervisor override of the ASSIGNED_ONLY drawer setting)',
   'فتح أي درج نقد وجرده وإغلاقه واستلام النقد فيه حتى لو كان مخصصًا لمستخدم آخر (تجاوز المشرف لإعداد الدرج المخصص فقط)',
   'CashDrawer', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO NOTHING;

-- Role defaults: management tier only (see header). Re-enable if a row already exists, else insert.
UPDATE public.sys_auth_role_default_permissions
   SET is_enabled = TRUE, is_active = TRUE, rec_status = 1, updated_at = CURRENT_TIMESTAMP
 WHERE role_code IN ('super_admin', 'tenant_admin', 'admin', 'branch_manager', 'finance_manager')
   AND permission_code = 'cash_drawer:operate_any';

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'
  FROM public.sys_auth_roles r
 CROSS JOIN public.sys_auth_permissions p
 WHERE r.code IN ('super_admin', 'tenant_admin', 'admin', 'branch_manager', 'finance_manager')
   AND p.code = 'cash_drawer:operate_any'
   AND NOT EXISTS (
     SELECT 1 FROM public.sys_auth_role_default_permissions e
      WHERE e.role_code = r.code AND e.permission_code = p.code
   );

-- Seed-completeness self-check (§10.12 convention, matching migrations 0411/0517/0552).
DO $$
DECLARE
  seeded_count INTEGER;
  grant_count  INTEGER;
BEGIN
  SELECT COUNT(*) INTO seeded_count FROM public.sys_auth_permissions WHERE code = 'cash_drawer:operate_any';
  IF seeded_count <> 1 THEN
    RAISE EXCEPTION 'cash_drawer:operate_any was not seeded (found % rows)', seeded_count;
  END IF;

  SELECT COUNT(*) INTO grant_count
    FROM public.sys_auth_role_default_permissions
   WHERE permission_code = 'cash_drawer:operate_any' AND is_active AND is_enabled;
  IF grant_count < 5 THEN
    RAISE EXCEPTION 'cash_drawer:operate_any role defaults incomplete (found % active grants, expected 5)', grant_count;
  END IF;
END $$;

COMMIT;
