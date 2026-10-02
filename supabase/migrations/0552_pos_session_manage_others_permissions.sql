-- =============================================================================
-- Migration 0552 — New RBAC permission codes enabling admin/supervisory
-- management of ANOTHER user's POS session: opening a session on another
-- user's behalf, and a tenant-wide "full manage" override that bypasses the
-- per-action others-permissions below.
--
-- Context: `pos_session:close_others` already exists (migration 0517) but is
-- not yet wired into any route/service — this migration's companion code
-- change finally wires it up, and adds the matching "open on behalf of
-- another user" counterpart plus a single override permission requested by
-- the product owner so that super_admin/tenant_admin/admin/branch_manager
-- can manage ANY user's POS session without needing the individual
-- open_others/close_others grants.
--
-- Format check: every code below matches ^[a-z0-9_]+:([a-z0-9_]+|\*)$
-- (CRITICAL RULE #13).
--
-- Scoping note: per explicit product decision, these permissions are NOT
-- branch-scoped at the server layer — there is no existing user-to-branch
-- assignment table in this codebase to enforce that against (the sibling
-- cash_drawer:view_all_branches permission has the same gap). Authorization
-- is permission-only; tighter scoping is a future enhancement if a branch-
-- assignment model is introduced.
--
-- Reversal (forward-only; this repo forbids editing applied migrations): a
-- future migration would first DELETE FROM sys_auth_role_default_permissions
-- WHERE permission_code IN ('pos_session:open_others',
-- 'pos_session:full_manage_others'), then DELETE FROM sys_auth_permissions
-- WHERE code IN the same two codes. Lossy for any tenant that has since
-- granted/revoked these at the user level via org_auth_user_permissions.
-- =============================================================================

BEGIN;

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('pos_session:open_others', 'Open POS Session for Another User', 'فتح جلسة نقطة بيع لمستخدم آخر',
   'actions', 'Open a POS session on behalf of another user (e.g. a supervisor starting a cashier''s shift)',
   'فتح جلسة نقطة بيع نيابة عن مستخدم آخر (مثل بدء مشرف لوردية أمين صندوق)',
   'POSSession', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('pos_session:full_manage_others', 'Fully Manage Any User''s POS Session', 'إدارة كاملة لجلسة نقطة بيع لأي مستخدم',
   'actions', 'Open, close, or force-close any user''s POS session tenant-wide, without requiring the individual open_others/close_others grants',
   'فتح أو إغلاق أو إغلاق قسري لجلسة نقطة بيع أي مستخدم على مستوى المستأجر، دون الحاجة لصلاحيات open_others/close_others المنفردة',
   'POSSession', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO NOTHING;

-- Seed-completeness self-check (§10.12 convention, matching migrations 0411/0517).
DO $$
DECLARE
  seeded_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO seeded_count
  FROM public.sys_auth_permissions
  WHERE code IN ('pos_session:open_others', 'pos_session:full_manage_others');

  IF seeded_count <> 2 THEN
    RAISE EXCEPTION 'not all 2 new pos_session manage-others permission codes were seeded (found %)', seeded_count;
  END IF;

  ASSERT EXISTS (
    SELECT 1 FROM public.sys_auth_permissions WHERE code = 'pos_session:close_others'
  ), 'pos_session:close_others unexpectedly missing — expected to already exist from migration 0517';
END $$;

-- -----------------------------------------------------------------------------
-- Role -> permission default grants
-- -----------------------------------------------------------------------------

-- Group 1 — opening ANOTHER user's POS session. Mirrors the exact role tier
-- already used for pos_session:close_others in migration 0517 (Group 4) —
-- these two "act on someone else's session" permissions should stay aligned.
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('supervisor', 'operator', 'branch_manager', 'finance_manager', 'admin', 'super_admin', 'tenant_admin')
  AND p.code = 'pos_session:open_others'
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- Group 2 — full tenant-wide override (open/close/force-close ANY user's
-- session, bypassing the individual others-permissions). Deliberately the
-- narrowest tier of the three pos_session manage-others codes, per explicit
-- product instruction: super_admin, tenant_admin, admin, branch_manager.
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('branch_manager', 'admin', 'super_admin', 'tenant_admin')
  AND p.code = 'pos_session:full_manage_others'
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- Role-grant verification.
DO $$
DECLARE
  v_grant_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_grant_count
  FROM public.sys_auth_role_default_permissions
  WHERE permission_code IN ('pos_session:open_others', 'pos_session:full_manage_others')
    AND is_active = true;

  RAISE NOTICE '✅ % role/permission grant rows now active for the 2 new codes', v_grant_count;

  ASSERT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions
    WHERE role_code = 'super_admin' AND permission_code = 'pos_session:full_manage_others'
  ), 'super_admin missing pos_session:full_manage_others grant';

  ASSERT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions
    WHERE role_code = 'tenant_admin' AND permission_code = 'pos_session:full_manage_others'
  ), 'tenant_admin missing pos_session:full_manage_others grant';

  ASSERT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions
    WHERE role_code = 'supervisor' AND permission_code = 'pos_session:open_others'
  ), 'supervisor missing pos_session:open_others grant';
END $$;

COMMIT;
