-- =============================================================================
-- Migration 0573 — RBAC permissions + navigation for the User Session Lifecycle program
--
-- Feature: docs/features/User_Session_Lifecycle (Phase 1 — Security & Sessions settings)
--
-- Permissions (resource:action, CRITICAL RULES #11/#13) — all four codes used by the program are
-- seeded together in this single dedicated migration:
--   auth_config:read     — view the effective authentication/session policy (Security & Sessions screen)
--   auth_config:update   — change tenant overrides of the policy (also gated by plan flag
--                          session_timeout_control)
--   user_sessions:read   — list active sessions of users in the tenant (sessions screens, later phase)
--   user_sessions:revoke — sign users out / revoke their sessions (sessions screens, later phase)
-- Default roles: super_admin, tenant_admin, admin (mandatory base set).
--
-- Navigation (dual-write half 2 of 2, CRITICAL RULE #10): `settings_security` leaf under the existing
-- `config_settings` node at /dashboard/settings/security. The other half — web-admin/config/navigation.ts
-- (`settings_security` key) — is updated in the same change set. The sessions screens' menu entry is
-- added with those screens in a later migration (the route does not exist yet).
--
-- Reversal (forward-only):
--   DELETE FROM sys_components_cd WHERE comp_code = 'settings_security';
--   DELETE FROM sys_auth_role_default_permissions WHERE permission_code IN (...four codes...);
--   DELETE FROM sys_auth_permissions WHERE code IN (...four codes...);
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Permission definitions (sys_auth_permissions)
-- ---------------------------------------------------------------------------
INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('auth_config:read',
   'View security settings', 'عرض إعدادات الأمان', 'crud',
   'View the effective sign-in and session policy (idle timeout, session length, session limits, lockout)',
   'عرض سياسة تسجيل الدخول والجلسات الفعّالة (مهلة عدم النشاط، مدة الجلسة، حدود الجلسات، القفل)',
   'Security', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('auth_config:update',
   'Change security settings', 'تغيير إعدادات الأمان', 'crud',
   'Change the tenant overrides of the sign-in and session policy within the limits set by the platform',
   'تغيير تخصيصات المنشأة لسياسة تسجيل الدخول والجلسات ضمن الحدود التي تحددها المنصة',
   'Security', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('user_sessions:read',
   'View user sessions', 'عرض جلسات المستخدمين', 'crud',
   'View the active sign-in sessions of users in the organization',
   'عرض جلسات تسجيل الدخول النشطة للمستخدمين في المنشأة',
   'Security', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('user_sessions:revoke',
   'Sign users out', 'تسجيل خروج المستخدمين', 'crud',
   'End the sessions of users in the organization (sign them out of one or all devices)',
   'إنهاء جلسات المستخدمين في المنشأة (تسجيل خروجهم من جهاز واحد أو جميع الأجهزة)',
   'Security', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO UPDATE SET
  name          = EXCLUDED.name,
  name2         = EXCLUDED.name2,
  category      = EXCLUDED.category,
  description   = EXCLUDED.description,
  description2  = EXCLUDED.description2,
  category_main = EXCLUDED.category_main,
  is_active     = EXCLUDED.is_active,
  is_enabled    = EXCLUDED.is_enabled,
  rec_status    = EXCLUDED.rec_status,
  updated_at    = CURRENT_TIMESTAMP;

-- ---------------------------------------------------------------------------
-- 2. Default role assignments (sys_auth_role_default_permissions)
-- ---------------------------------------------------------------------------
-- Re-enable any pre-existing rows first (idempotent re-run), then insert the missing ones.
UPDATE public.sys_auth_role_default_permissions
SET is_enabled = true, is_active = true, rec_status = 1, updated_at = CURRENT_TIMESTAMP
WHERE role_code IN ('super_admin', 'tenant_admin', 'admin')
  AND permission_code IN ('auth_config:read', 'auth_config:update', 'user_sessions:read', 'user_sessions:revoke');

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin')
  AND p.code IN ('auth_config:read', 'auth_config:update', 'user_sessions:read', 'user_sessions:revoke')
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );

-- ---------------------------------------------------------------------------
-- 3. Navigation: Security & Sessions settings screen
-- ---------------------------------------------------------------------------
INSERT INTO public.sys_components_cd (
  comp_code,
  parent_comp_id,
  parent_comp_code,
  label,
  label2,
  description,
  description2,
  comp_path,
  comp_icon,
  main_permission_code,
  display_order,
  comp_level,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  permissions,
  feature_flag,
  badge,
  rec_status,
  created_info
)
VALUES (
  'settings_security',
  (SELECT comp_id FROM public.sys_components_cd WHERE comp_code = 'config_settings'),
  'config_settings',
  'Security & Sessions',
  'الأمان والجلسات',
  'Sign-in and session policy: idle timeout, session length, concurrent sessions, new-device alerts',
  'سياسة تسجيل الدخول والجلسات: مهلة عدم النشاط، مدة الجلسة، الجلسات المتزامنة، تنبيهات الأجهزة الجديدة',
  '/dashboard/settings/security',
  'ShieldCheck',
  'auth_config:read',
  (SELECT COALESCE(MAX(display_order), 0) + 1 FROM public.sys_components_cd WHERE parent_comp_code = 'config_settings' AND comp_code <> 'settings_security'),
  (SELECT comp_level + 1 FROM public.sys_components_cd WHERE comp_code = 'config_settings'),
  TRUE, TRUE, TRUE, TRUE, TRUE,
  '["super_admin","tenant_admin","admin"]'::jsonb,
  '["auth_config:read"]'::jsonb,
  '[]'::jsonb,
  NULL,
  1,
  'User_Session_Lifecycle Phase 1 — security and session policy screen.'
)
ON CONFLICT (comp_code) DO UPDATE
SET
  parent_comp_id       = EXCLUDED.parent_comp_id,
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  description          = EXCLUDED.description,
  description2         = EXCLUDED.description2,
  comp_path            = EXCLUDED.comp_path,
  comp_icon            = EXCLUDED.comp_icon,
  main_permission_code = EXCLUDED.main_permission_code,
  display_order        = EXCLUDED.display_order,
  comp_level           = EXCLUDED.comp_level,
  is_leaf              = TRUE,
  is_navigable         = TRUE,
  is_active            = TRUE,
  roles                = EXCLUDED.roles,
  permissions          = EXCLUDED.permissions,
  updated_at           = CURRENT_TIMESTAMP;

-- The parent already has children; keep it a node.
UPDATE public.sys_components_cd
   SET is_leaf = FALSE
 WHERE comp_code = 'config_settings' AND is_leaf IS DISTINCT FROM FALSE;

-- ---------------------------------------------------------------------------
-- 4. Post-conditions
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT count(*) FROM public.sys_auth_permissions
      WHERE code IN ('auth_config:read', 'auth_config:update', 'user_sessions:read', 'user_sessions:revoke')) <> 4 THEN
    RAISE EXCEPTION '0573: expected 4 permissions to be seeded';
  END IF;
  IF (SELECT count(*) FROM public.sys_auth_role_default_permissions
      WHERE role_code IN ('super_admin', 'tenant_admin', 'admin')
        AND permission_code IN ('auth_config:read', 'auth_config:update', 'user_sessions:read', 'user_sessions:revoke')
        AND is_enabled) <> 12 THEN
    RAISE EXCEPTION '0573: expected 12 default role permission rows (3 roles x 4 permissions)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sys_components_cd WHERE comp_code = 'settings_security' AND parent_comp_id IS NOT NULL) THEN
    RAISE EXCEPTION '0573: settings_security was not attached to the config_settings node';
  END IF;
END $$;

COMMIT;
