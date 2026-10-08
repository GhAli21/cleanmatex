-- =============================================================================
-- 0576_auth_session_screens_nav_cron.sql
-- Purpose:  User Session Lifecycle, Phase 4/6 — (1) sidebar entry for the tenant-wide "Active Sessions"
--           screen (/dashboard/users/sessions, permission user_sessions:read seeded in 0573), and
--           (2) the pg_cron job that runs fn_auth_sessions_sweep() every 5 minutes.
-- Depends:  0573 (user_sessions:* permissions), 0575 (fn_auth_sessions_sweep), existing nav nodes
--           'users' / 'users_list'.
-- Notes:    /dashboard/account/security is self-service (reached from the user menu, no sidebar row).
--           The sweep is a safety net: sessions are also ended lazily by fn_auth_session_validate; the
--           job closes sessions nobody touches again and purges ENDED rows older than 180 days.
-- Reversal (forward-only):
--   DELETE FROM sys_components_cd WHERE comp_code = 'users_sessions';
--   SELECT cron.unschedule('auth-session-sweep');
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Navigation: Team Members > Active Sessions
-- ---------------------------------------------------------------------------
-- 1a. Parent node. Already seeded on production-like databases (no-op there); some local databases were
--     built without it, so create it with the same values when absent (keeps the child attachable).
INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_id, parent_comp_code, label, label2, description, description2,
  comp_path, comp_icon, main_permission_code, display_order, comp_level, is_leaf, is_navigable,
  is_active, is_system, is_for_tenant_use, roles, permissions, feature_flag, badge, rec_status, created_info
)
VALUES (
  'users', NULL, NULL,
  'Team Members', 'أعضاء الفريق',
  'Manage team members and user access', 'إدارة أعضاء الفريق والوصول',
  '/dashboard/users', 'Users', 'users:read', 5, 0,
  FALSE, TRUE, TRUE, TRUE, TRUE,
  '["admin","super_admin","tenant_admin"]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, 1,
  'User_Session_Lifecycle Phase 4 — parent node for Active Sessions (created only when missing).'
)
ON CONFLICT (comp_code) DO NOTHING;

-- 1b. Child node: Active Sessions.
INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_id, parent_comp_code, label, label2, description, description2,
  comp_path, comp_icon, main_permission_code, display_order, comp_level, is_leaf, is_navigable,
  is_active, is_system, is_for_tenant_use, roles, permissions, feature_flag, badge, rec_status, created_info
)
VALUES (
  'users_sessions',
  (SELECT comp_id FROM public.sys_components_cd WHERE comp_code = 'users'),
  'users',
  'Active Sessions',
  'الجلسات النشطة',
  'See who is signed in, on which device, and sign users out',
  'عرض من قام بتسجيل الدخول وعلى أي جهاز وتسجيل خروج المستخدمين',
  '/dashboard/users/sessions',
  'MonitorSmartphone',
  'user_sessions:read',
  (SELECT COALESCE(MAX(display_order), 0) + 1 FROM public.sys_components_cd
    WHERE parent_comp_code = 'users' AND comp_code <> 'users_sessions'),
  (SELECT comp_level + 1 FROM public.sys_components_cd WHERE comp_code = 'users'),
  TRUE, TRUE, TRUE, TRUE, TRUE,
  '["super_admin","tenant_admin","admin"]'::jsonb,
  '["user_sessions:read"]'::jsonb,
  '[]'::jsonb,
  NULL,
  1,
  'User_Session_Lifecycle Phase 4 — tenant-wide active sessions screen.'
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
 WHERE comp_code = 'users' AND is_leaf IS DISTINCT FROM FALSE;

-- ---------------------------------------------------------------------------
-- 2. Scheduled sweep of the session registry (every 5 minutes)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Idempotent re-run: drop the previous registration of this job before scheduling it again.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'auth-session-sweep';

-- Runs as the job owner; the function is SECURITY DEFINER with a pinned search_path.
SELECT cron.schedule(
  'auth-session-sweep',
  '*/5 * * * *',
  $$ SELECT public.fn_auth_sessions_sweep(180) $$
);

-- ---------------------------------------------------------------------------
-- 3. Post-conditions
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sys_components_cd WHERE comp_code = 'users_sessions' AND parent_comp_id IS NOT NULL) THEN
    RAISE EXCEPTION '0576: users_sessions was not attached to the users node';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auth-session-sweep') THEN
    RAISE EXCEPTION '0576: auth-session-sweep cron job was not registered';
  END IF;
END $$;

COMMIT;
