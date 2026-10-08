-- 0578_rbac_pos_session_least_privilege.sql
-- Purpose:
--   Migration 0396 seeded the six legacy POS-session permissions (pos_session:view, :view_all,
--   :open, :pause_resume, :close, :force_close) with `WHERE 1=1 -- ALL roles r.code IN (...)`:
--   the intended role filter was commented out, so every one of the 19 roles received all six
--   (operator received five). A viewer, driver, laundry worker or B2B customer could therefore
--   open, close and FORCE-CLOSE POS sessions and list every cashier's sessions, and the rollover
--   job's supervisor notifications (recipients = holders of pos_session:force_close) reach
--   every user.
--
--   This migration replaces that blanket grant with a least-privilege matrix aligned to who can
--   actually take money (the roles that hold orders:collect_payment / cash_drawer:open_session):
--
--     permission                  roles
--     --------------------------  ---------------------------------------------------------------
--     pos_session:view            super_admin, tenant_admin, admin, branch_manager, finance_manager,
--                                 operator, cashier, supervisor, accountant
--     pos_session:view_all        super_admin, tenant_admin, admin, branch_manager, finance_manager,
--                                 supervisor, accountant
--     pos_session:open            super_admin, tenant_admin, admin, branch_manager, finance_manager,
--     pos_session:pause_resume    operator, cashier                      (own-shift operations)
--     pos_session:close
--     pos_session:force_close     super_admin, tenant_admin, admin, branch_manager, finance_manager,
--                                 supervisor                             (supervision)
--
-- Safety:
--   - Data-only: no schema change. Touches only the six permission codes above in
--     public.sys_auth_role_default_permissions; every other permission is left alone.
--   - Per-user overrides (org_auth_user_permissions / org_auth_user_resource_permissions) are
--     untouched, so a tenant that deliberately granted a user one of these keeps it: the rebuild
--     below re-applies overrides after recomputing role-derived grants.
--   - Role defaults feed cmx_effective_permissions only through cmx_rebuild_user_permissions, so
--     every user who held any of the six codes is rebuilt at the end (same approach as 0400).
--   - Idempotent: re-running deletes nothing further and inserts nothing already present.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Intended matrix (session-local; vanishes at COMMIT)
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE _pos_session_perm_matrix (
  role_code       TEXT NOT NULL,
  permission_code TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _pos_session_perm_matrix (role_code, permission_code)
SELECT r.role_code, p.permission_code
FROM (VALUES
  ('pos_session:view',         ARRAY['super_admin','tenant_admin','admin','branch_manager','finance_manager','operator','cashier','supervisor','accountant']),
  ('pos_session:view_all',     ARRAY['super_admin','tenant_admin','admin','branch_manager','finance_manager','supervisor','accountant']),
  ('pos_session:open',         ARRAY['super_admin','tenant_admin','admin','branch_manager','finance_manager','operator','cashier']),
  ('pos_session:pause_resume', ARRAY['super_admin','tenant_admin','admin','branch_manager','finance_manager','operator','cashier']),
  ('pos_session:close',        ARRAY['super_admin','tenant_admin','admin','branch_manager','finance_manager','operator','cashier']),
  ('pos_session:force_close',  ARRAY['super_admin','tenant_admin','admin','branch_manager','finance_manager','supervisor'])
) AS p(permission_code, roles)
CROSS JOIN LATERAL unnest(p.roles) AS r(role_code);

-- Guard: every role and permission in the matrix must exist (fail loudly, never skip silently).
DO $$
DECLARE
  v_missing TEXT;
BEGIN
  SELECT string_agg(DISTINCT m.role_code, ', ') INTO v_missing
  FROM _pos_session_perm_matrix m
  WHERE NOT EXISTS (SELECT 1 FROM public.sys_auth_roles r WHERE r.code = m.role_code);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Unknown role(s) in POS-session matrix: %', v_missing;
  END IF;

  SELECT string_agg(DISTINCT m.permission_code, ', ') INTO v_missing
  FROM _pos_session_perm_matrix m
  WHERE NOT EXISTS (SELECT 1 FROM public.sys_auth_permissions p WHERE p.code = m.permission_code);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Unknown permission(s) in POS-session matrix: %', v_missing;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Remember who holds any of the six codes today (their cache is rebuilt in step 5)
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE _pos_session_perm_users ON COMMIT DROP AS
SELECT DISTINCT ep.user_id, ep.tenant_org_id
FROM public.cmx_effective_permissions ep
WHERE ep.permission_code IN (SELECT DISTINCT permission_code FROM _pos_session_perm_matrix);

-- -----------------------------------------------------------------------------
-- 3. Revoke every default grant of the six codes that is not in the matrix
-- -----------------------------------------------------------------------------
DELETE FROM public.sys_auth_role_default_permissions d
WHERE d.permission_code IN (SELECT DISTINCT permission_code FROM _pos_session_perm_matrix)
  AND NOT EXISTS (
    SELECT 1
    FROM _pos_session_perm_matrix m
    WHERE m.role_code = d.role_code
      AND m.permission_code = d.permission_code
  );

-- -----------------------------------------------------------------------------
-- 4. Make sure every matrix grant exists and is live (insert missing, re-enable switched-off)
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT m.role_code, m.permission_code, TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM _pos_session_perm_matrix m
WHERE NOT EXISTS (
  SELECT 1
  FROM public.sys_auth_role_default_permissions e
  WHERE e.role_code = m.role_code
    AND e.permission_code = m.permission_code
);

UPDATE public.sys_auth_role_default_permissions d
SET is_enabled = TRUE,
    is_active  = TRUE,
    updated_at = CURRENT_TIMESTAMP,
    updated_by = 'system_admin'
FROM _pos_session_perm_matrix m
WHERE d.role_code = m.role_code
  AND d.permission_code = m.permission_code
  AND (d.is_enabled IS DISTINCT FROM TRUE OR d.is_active IS DISTINCT FROM TRUE);

-- -----------------------------------------------------------------------------
-- 5. Rebuild the effective-permission cache of every user who held one of the codes
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_user          RECORD;
  v_rebuilt_count INTEGER := 0;
BEGIN
  FOR v_user IN SELECT user_id, tenant_org_id FROM _pos_session_perm_users LOOP
    PERFORM public.cmx_rebuild_user_permissions(v_user.user_id, v_user.tenant_org_id);
    v_rebuilt_count := v_rebuilt_count + 1;
  END LOOP;
  RAISE NOTICE 'POS-session permissions: effective permissions rebuilt for % user/tenant rows', v_rebuilt_count;
END $$;

-- -----------------------------------------------------------------------------
-- 6. Verification: the defaults now equal the matrix exactly
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_extra   INTEGER;
  v_missing INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_extra
  FROM public.sys_auth_role_default_permissions d
  WHERE d.permission_code IN (SELECT DISTINCT permission_code FROM _pos_session_perm_matrix)
    AND NOT EXISTS (
      SELECT 1 FROM _pos_session_perm_matrix m
      WHERE m.role_code = d.role_code AND m.permission_code = d.permission_code
    );

  SELECT COUNT(*) INTO v_missing
  FROM _pos_session_perm_matrix m
  WHERE NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions d
    WHERE d.role_code = m.role_code AND d.permission_code = m.permission_code
      AND d.is_active = TRUE AND d.is_enabled = TRUE
  );

  IF v_extra <> 0 OR v_missing <> 0 THEN
    RAISE EXCEPTION 'POS-session role defaults diverge from the matrix (% extra, % missing)', v_extra, v_missing;
  END IF;

  RAISE NOTICE 'POS-session role defaults match the least-privilege matrix';
END $$;

COMMIT;
