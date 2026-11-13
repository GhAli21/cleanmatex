-- ============================================================
-- Migration: 0736_sys_users_global_user_wording.sql
-- Purpose:   Staff identity is a global user (sys_users_mst) and a
--            laundry membership is an organization user (org_users_mst).
--            Migration 0734 is applied and called that staff identity a
--            person. Person stays reserved for customers (sys_person_mst),
--            which this file does not create. Catalog comments, event
--            display text, the HQ nav path, and the session-revoke
--            function name are corrected. Behavior is unchanged.
-- Affected:  sys_users_mst, org_users_mst, sys_auth_sess_end_rsn_cd,
--            sys_auth_event_cd, hq_navigation_cd,
--            fn_auth_sessions_revoke_global_user,
--            fn_auth_sessions_revoke_person (removed),
--            fn_sys_users_lock_revoke, fn_auth_resolve_login_identifier,
--            function comments listed below
-- Related:   0734_sys_users_multi_laundry.sql
-- ============================================================

BEGIN;

-- Catalog comments. 0734 used "person" for the staff global user.

COMMENT ON TABLE sys_users_mst IS 'Portable global user. One row per human login. Memberships live on org_users_mst. No password and no tenant.';
COMMENT ON COLUMN sys_users_mst.id IS 'Stable global user id. Set equal to auth.users.id at insert while Supabase is the provider.';
COMMENT ON COLUMN sys_users_mst.email IS 'Sign-in email, trimmed and lower-cased. NULL when the global user has no mailbox. Unique when set.';
COMMENT ON COLUMN sys_users_mst.user_code IS 'Global sign-in code, one per global user. Case-insensitive unique. Moved off the membership so two laundries can share it.';
COMMENT ON COLUMN sys_users_mst.status IS 'ACTIVE. Reserved so a later status does not require a new column. Inactive membership is not a global-user status.';
COMMENT ON CONSTRAINT chk_sys_users_status ON sys_users_mst IS 'Global user row stays ACTIVE. Laundry access is the membership is_active flag.';
COMMENT ON INDEX uq_sys_users_email IS 'One global user per normalized email. The create-screen race backstop.';
COMMENT ON INDEX uq_sys_users_phone IS 'One global user per verified E.164 mobile. The create-screen race backstop.';
COMMENT ON INDEX uq_sys_users_code_lower IS 'Case-insensitive sign-in code lookup. One code per global user, shared by every membership.';

COMMENT ON COLUMN org_users_mst.is_membership_locked IS 'Admin lock for this laundry only. Other memberships of the same global user stay usable.';
COMMENT ON INDEX idx_ou_user_active IS 'Eligible-laundry lookup for one global user. The picker reads id, tenant, and name only.';

-- Display text only. Event and end-reason codes stay so existing audit rows still match.

UPDATE sys_auth_sess_end_rsn_cd
SET description = 'HQ locked the global user for every laundry.',
    description2 = 'قفلت إدارة المنصة المستخدم العام في كل المنشآت.'
WHERE code = 'GLOBAL_LOCK';

UPDATE sys_auth_event_cd
SET description = 'An existing global user was added to a laundry.',
    description2 = 'أُضيف مستخدم عام موجود إلى منشأة.'
WHERE code = 'MEMBERSHIP_ATTACHED';

UPDATE sys_auth_event_cd
SET name = 'Global user locked by HQ',
    name2 = 'قفل المستخدم العام من إدارة المنصة'
WHERE code = 'USER_LOCKED_GLOBAL';

UPDATE sys_auth_event_cd
SET name = 'Global user unlocked by HQ',
    name2 = 'فتح المستخدم العام من إدارة المنصة'
WHERE code = 'USER_UNLOCKED_GLOBAL';

UPDATE sys_auth_event_cd
SET description = 'The global user bound this sign-in to one laundry.',
    description2 = 'ربط المستخدم العام تسجيل الدخول بمنشأة واحدة.'
WHERE code = 'LAUNDRY_CHOSEN';

-- Same body as 0734. The name no longer says person. Callers must use this name.

CREATE OR REPLACE FUNCTION fn_auth_sessions_revoke_global_user(
  p_auth_user_id UUID,
  p_reason       TEXT,
  p_actor        UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_sid   UUID;
  v_count INTEGER := 0;
BEGIN
  FOR v_sid IN
    SELECT s.auth_session_id
    FROM sys_auth_user_sessions_mst s
    WHERE s.auth_user_id = p_auth_user_id
      AND s.status IN ('ACTIVE', 'PENDING')
  LOOP
    IF fn_auth_session_end_internal(v_sid, p_reason, p_actor) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION fn_auth_sessions_revoke_global_user(UUID, TEXT, UUID) IS 'Ends every ACTIVE and PENDING session of one global user, in every laundry. Used by the global lock, the attack lock, and a password change.';
-- Service role only. The browser must not end another user's sessions.
REVOKE EXECUTE ON FUNCTION fn_auth_sessions_revoke_global_user(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_auth_sessions_revoke_global_user(UUID, TEXT, UUID) TO service_role;

-- The lock trigger must call the new name before the old function is dropped.

CREATE OR REPLACE FUNCTION fn_sys_users_lock_revoke()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_globally_locked = true AND OLD.is_globally_locked = false THEN
    PERFORM fn_auth_sessions_revoke_global_user(NEW.id, 'GLOBAL_LOCK', NEW.globally_locked_by);
  END IF;
  IF NEW.attack_locked_until IS NOT NULL
     AND NEW.attack_locked_until > now()
     AND NEW.attack_locked_until IS DISTINCT FROM OLD.attack_locked_until THEN
    PERFORM fn_auth_sessions_revoke_global_user(NEW.id, 'ATTACK_LOCK', NULL);
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_sys_users_lock_revoke() IS 'When HQ locks the global user, or a password-attack lock is set, every laundry session ends in that same statement.';
REVOKE EXECUTE ON FUNCTION fn_sys_users_lock_revoke() FROM PUBLIC, anon, authenticated;

COMMENT ON TRIGGER trg_sys_users_lock_revoke ON sys_users_mst IS 'Global lock and attack lock sign the global user out of every laundry.';

-- Nothing else calls the old name after the trigger replacement above.
DROP FUNCTION fn_auth_sessions_revoke_person(UUID, TEXT, UUID) RESTRICT;

COMMENT ON FUNCTION fn_org_users_revoke_sessions() IS 'Ends sessions of this membership only. Another laundry of the same global user is a different tenant_org_id and is left alone.';
COMMENT ON FUNCTION fn_auth_session_register(UUID, UUID, BOOLEAN, INET, TEXT, TEXT, TEXT) IS 'Binds a session only when the global user has exactly one eligible laundry. CHOOSE_LAUNDRY inserts nothing. LOCKED denies a global or attack lock. Service role only.';
COMMENT ON FUNCTION fn_auth_session_validate(BOOLEAN, INET) IS 'Validates the caller session. PENDING has no tenant and is not a business session. ACTIVE requires an unlocked membership and an unlocked global user. must_change_password is unchanged from 0581.';
COMMENT ON FUNCTION record_login_attempt(VARCHAR, BOOLEAN, INET, TEXT, TEXT) IS 'One attack counter on sys_users_mst for every laundry. Thresholds still come from AUTH_LOCKOUT_*. Setting attack_locked_until fires the global-user session revoke. Service role only.';
COMMENT ON FUNCTION fn_org_user_code_next() IS 'Next unused U-code. Skips codes already stored on the global user or still present on a membership row. Definer so the global-user table check works for the column default.';
COMMENT ON FUNCTION fn_auth_own_laundries() IS 'Picker list for the signed-in global user only. Returns membership id, tenant id, and the organization name. It is not a staff directory.';

-- Local variable renamed. The returned shape is the same as 0734.

CREATE OR REPLACE FUNCTION fn_auth_resolve_login_identifier(p_identifier TEXT)
RETURNS TABLE (
  auth_user_id  UUID,
  email         TEXT,
  org_user_id   UUID,
  tenant_org_id UUID,
  is_active     BOOLEAN,
  user_code     TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_ident TEXT := btrim(coalesce(p_identifier, ''));
  v_global_user sys_users_mst%ROWTYPE;
  v_count INTEGER;
BEGIN
  IF v_ident = '' THEN
    RETURN;
  END IF;

  IF position('@' IN v_ident) > 0 THEN
    SELECT * INTO v_global_user FROM sys_users_mst su WHERE su.email = lower(v_ident);
  ELSIF left(v_ident, 1) = '+' OR v_ident ~ '^[0-9]+$' THEN
    SELECT * INTO v_global_user FROM sys_users_mst su WHERE su.phone_e164 = v_ident;
  ELSE
    SELECT * INTO v_global_user FROM sys_users_mst su WHERE lower(su.user_code) = lower(v_ident);
  END IF;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_count
  FROM org_users_mst ou
  JOIN org_tenants_mst t ON t.id = ou.tenant_org_id
  WHERE ou.user_id = v_global_user.id
    AND ou.is_active = true
    AND ou.is_membership_locked = false
    AND COALESCE(t.is_active, true) = true
    AND COALESCE(t.status, '') NOT IN ('suspended', 'SUSPENDED', 'inactive', 'INACTIVE');

  IF v_count = 1 THEN
    RETURN QUERY
    SELECT v_global_user.id, v_global_user.email, ou.id, ou.tenant_org_id, ou.is_active, v_global_user.user_code
    FROM org_users_mst ou
    JOIN org_tenants_mst t ON t.id = ou.tenant_org_id
    WHERE ou.user_id = v_global_user.id
      AND ou.is_active = true
      AND ou.is_membership_locked = false
      AND COALESCE(t.is_active, true) = true
      AND COALESCE(t.status, '') NOT IN ('suspended', 'SUSPENDED', 'inactive', 'INACTIVE');
    RETURN;
  END IF;

  RETURN QUERY
  SELECT v_global_user.id, v_global_user.email, NULL::UUID, NULL::UUID, true, v_global_user.user_code;
END;
$$;

COMMENT ON FUNCTION fn_auth_resolve_login_identifier(TEXT) IS 'Resolves email, E.164 mobile, or user_code to one global user. Returns the membership only when exactly one laundry is eligible. Unknown identifiers return no row. Service role only.';

UPDATE hq_navigation_cd
SET description = 'Search one global user and see every laundry membership. HQ lock and attach live here.',
    description2 = 'ابحث عن مستخدم عام واحد واعرض عضويته في كل منشأة. القفل العام والربط هنا.',
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{detail_path}',
      '"/org-users-manage/[userId]"'::jsonb
    )
WHERE nav_code = 'hq_org_users';

COMMIT;
