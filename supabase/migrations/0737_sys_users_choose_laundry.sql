-- ============================================================
-- Migration: 0737_sys_users_choose_laundry.sql
-- Purpose:   When a global user has more than one laundry, password
--            success must not open a business session. 0734 returns
--            CHOOSE_LAUNDRY and inserts nothing. This file writes the
--            short-lived PENDING row and the function that binds one
--            eligible membership. The membership id is checked in the
--            database. A client tenant id is not an argument.
-- Affected:  fn_auth_session_open_picker, fn_auth_session_choose_laundry,
--            sys_auth_user_sessions_mst, sys_users_mst.last_chosen_tenant_id
-- Related:   0734_sys_users_multi_laundry.sql
-- ============================================================

BEGIN;

-- Opens the picker credential. The caller is the signed-in global user
-- (auth.uid and the JWT session_id). Ten minutes is long enough to choose
-- and short enough that an abandoned picker is not a business session.
CREATE OR REPLACE FUNCTION fn_auth_session_open_picker(
  p_remember_me    BOOLEAN DEFAULT false,
  p_ip_address     INET DEFAULT NULL,
  p_user_agent     TEXT DEFAULT NULL,
  p_device_label   TEXT DEFAULT NULL,
  p_device_id_hash TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_sid      UUID;
  v_existing sys_auth_user_sessions_mst%ROWTYPE;
  v_eligible INTEGER;
BEGIN
  BEGIN
    v_sid := NULLIF(auth.jwt() ->> 'session_id', '')::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    v_sid := NULL;
  END;

  IF v_uid IS NULL OR v_sid IS NULL THEN
    RETURN 'NO_SESSION';
  END IF;

  IF EXISTS (
    SELECT 1 FROM sys_users_mst su
    WHERE su.id = v_uid
      AND (
        su.is_globally_locked = true
        OR (su.attack_locked_until IS NOT NULL AND su.attack_locked_until > now())
      )
  ) THEN
    RETURN 'LOCKED';
  END IF;

  SELECT * INTO v_existing
  FROM sys_auth_user_sessions_mst s
  WHERE s.auth_session_id = v_sid
    AND s.auth_user_id = v_uid;

  IF FOUND THEN
    IF v_existing.status = 'PENDING' AND v_existing.expires_at > now() THEN
      RETURN 'PENDING';
    END IF;
    RETURN 'ALREADY_REGISTERED';
  END IF;

  SELECT count(*) INTO v_eligible
  FROM org_users_mst ou
  JOIN org_tenants_mst t ON t.id = ou.tenant_org_id
  WHERE ou.user_id = v_uid
    AND ou.tenant_org_id = t.id
    AND ou.is_active = true
    AND ou.is_membership_locked = false
    AND COALESCE(t.is_active, true) = true
    AND COALESCE(t.status, '') NOT IN ('suspended', 'SUSPENDED', 'inactive', 'INACTIVE');

  IF v_eligible < 2 THEN
    RETURN 'NOT_REQUIRED';
  END IF;

  INSERT INTO sys_auth_user_sessions_mst (
    auth_session_id, auth_user_id, org_user_id, tenant_org_id, status, is_remember_me,
    idle_timeout_sec, idle_warning_sec, expires_at, login_ip, last_ip, user_agent, device_label, device_id_hash
  ) VALUES (
    v_sid, v_uid, NULL, NULL, 'PENDING', COALESCE(p_remember_me, false),
    0, 0, now() + interval '10 minutes', p_ip_address, p_ip_address, p_user_agent, p_device_label, p_device_id_hash
  );

  RETURN 'PENDING';
END;
$$;

COMMENT ON FUNCTION fn_auth_session_open_picker(BOOLEAN, INET, TEXT, TEXT, TEXT) IS 'Writes the short PENDING sign-in row when the global user has more than one eligible laundry. Business RLS stays empty until a laundry is chosen. Authenticated caller only.';
REVOKE EXECUTE ON FUNCTION fn_auth_session_open_picker(BOOLEAN, INET, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_auth_session_open_picker(BOOLEAN, INET, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- Binds the PENDING row to one membership. The tenant is read from that membership.
CREATE OR REPLACE FUNCTION fn_auth_session_choose_laundry(p_org_user_id UUID)
RETURNS TABLE (
  result_status    TEXT,
  session_row_id   UUID,
  tenant_org_id    UUID,
  new_device       BOOLEAN,
  alert_new_device BOOLEAN,
  idle_timeout_sec INTEGER,
  idle_warning_sec INTEGER,
  expires_at       TIMESTAMPTZ,
  ended_sessions   INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_sid      UUID;
  v_row      sys_auth_user_sessions_mst%ROWTYPE;
  v_member   org_users_mst%ROWTYPE;
  v_pol      RECORD;
  v_remember BOOLEAN;
  v_active   INTEGER;
  v_victim   UUID;
  v_ended    INTEGER := 0;
  v_idle     INTEGER;
  v_expires  TIMESTAMPTZ;
  v_new_dev  BOOLEAN := false;
BEGIN
  BEGIN
    v_sid := NULLIF(auth.jwt() ->> 'session_id', '')::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    v_sid := NULL;
  END;

  IF v_uid IS NULL OR v_sid IS NULL OR p_org_user_id IS NULL THEN
    RETURN QUERY SELECT 'NO_SESSION', NULL::UUID, NULL::UUID, false, false, 0, 0, NULL::TIMESTAMPTZ, 0;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM sys_users_mst su
    WHERE su.id = v_uid
      AND (
        su.is_globally_locked = true
        OR (su.attack_locked_until IS NOT NULL AND su.attack_locked_until > now())
      )
  ) THEN
    RETURN QUERY SELECT 'LOCKED', NULL::UUID, NULL::UUID, false, false, 0, 0, NULL::TIMESTAMPTZ, 0;
    RETURN;
  END IF;

  SELECT * INTO v_row
  FROM sys_auth_user_sessions_mst s
  WHERE s.auth_session_id = v_sid
    AND s.auth_user_id = v_uid
    AND s.status = 'PENDING'
    AND s.expires_at > now();

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NO_PENDING', NULL::UUID, NULL::UUID, false, false, 0, 0, NULL::TIMESTAMPTZ, 0;
    RETURN;
  END IF;

  SELECT ou.* INTO v_member
  FROM org_users_mst ou
  JOIN org_tenants_mst t ON t.id = ou.tenant_org_id
  WHERE ou.id = p_org_user_id
    AND ou.user_id = v_uid
    AND ou.tenant_org_id = t.id
    AND ou.is_active = true
    AND ou.is_membership_locked = false
    AND COALESCE(t.is_active, true) = true
    AND COALESCE(t.status, '') NOT IN ('suspended', 'SUSPENDED', 'inactive', 'INACTIVE');

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NO_MEMBERSHIP', NULL::UUID, NULL::UUID, false, false, 0, 0, NULL::TIMESTAMPTZ, 0;
    RETURN;
  END IF;

  SELECT * INTO v_pol FROM fn_auth_session_policy(v_member.tenant_org_id);
  v_remember := v_row.is_remember_me AND v_pol.remember_me_days > 0;
  v_idle := CASE WHEN v_remember THEN 0 ELSE v_pol.idle_timeout_min * 60 END;
  v_expires := now() + CASE WHEN v_remember
                            THEN make_interval(days => v_pol.remember_me_days)
                            ELSE make_interval(hours => v_pol.session_max_hours) END;

  IF v_pol.max_sessions > 0 THEN
    SELECT count(*) INTO v_active
    FROM sys_auth_user_sessions_mst s
    WHERE s.auth_user_id = v_uid AND s.status = 'ACTIVE' AND s.expires_at > now();

    IF v_active >= v_pol.max_sessions THEN
      IF v_pol.limit_policy = 'BLOCK_NEW' THEN
        RETURN QUERY SELECT 'BLOCKED_SESSION_LIMIT', NULL::UUID, v_member.tenant_org_id, false, false, 0, 0, NULL::TIMESTAMPTZ, 0;
        RETURN;
      END IF;

      WHILE v_active >= v_pol.max_sessions LOOP
        SELECT s.auth_session_id INTO v_victim
        FROM sys_auth_user_sessions_mst s
        WHERE s.auth_user_id = v_uid AND s.status = 'ACTIVE'
        ORDER BY s.last_activity_at ASC, s.created_at ASC
        LIMIT 1;
        EXIT WHEN v_victim IS NULL;
        PERFORM fn_auth_session_end_internal(v_victim, 'SESSION_LIMIT', NULL);
        v_ended := v_ended + 1;
        v_active := v_active - 1;
      END LOOP;
    END IF;
  END IF;

  IF v_row.device_id_hash IS NOT NULL THEN
    v_new_dev :=
      EXISTS (SELECT 1 FROM sys_auth_user_sessions_mst s WHERE s.auth_user_id = v_uid AND s.status <> 'PENDING')
      AND NOT EXISTS (
        SELECT 1 FROM sys_auth_user_sessions_mst s
        WHERE s.auth_user_id = v_uid AND s.device_id_hash = v_row.device_id_hash AND s.id <> v_row.id
      );
  END IF;

  UPDATE sys_auth_user_sessions_mst s
  SET status = 'ACTIVE',
      org_user_id = v_member.id,
      tenant_org_id = v_member.tenant_org_id,
      is_remember_me = v_remember,
      idle_timeout_sec = v_idle,
      idle_warning_sec = v_pol.idle_warning_sec,
      expires_at = v_expires,
      last_activity_at = now(),
      updated_at = now()
  WHERE s.id = v_row.id
    AND s.auth_user_id = v_uid
    AND s.status = 'PENDING';

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NO_PENDING', NULL::UUID, NULL::UUID, false, false, 0, 0, NULL::TIMESTAMPTZ, 0;
    RETURN;
  END IF;

  UPDATE sys_users_mst su
  SET last_chosen_tenant_id = v_member.tenant_org_id,
      updated_at = now(),
      updated_by = v_uid
  WHERE su.id = v_uid;

  PERFORM fn_auth_log_event(
    'LAUNDRY_CHOSEN', 'SUCCESS', v_uid, v_member.tenant_org_id, v_sid,
    NULL, v_row.login_ip, v_row.user_agent, v_row.device_label, NULL, '{}'::jsonb, v_member.id
  );

  RETURN QUERY SELECT 'REGISTERED', v_row.id, v_member.tenant_org_id, v_new_dev,
                      (v_new_dev AND v_pol.new_device_alert), v_idle, v_pol.idle_warning_sec, v_expires, v_ended;
END;
$$;

COMMENT ON FUNCTION fn_auth_session_choose_laundry(UUID) IS 'Turns the caller PENDING sign-in into one laundry. The membership must belong to auth.uid and be eligible. There is no tenant-id argument, so a client cannot name another laundry.';
REVOKE EXECUTE ON FUNCTION fn_auth_session_choose_laundry(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_auth_session_choose_laundry(UUID) TO authenticated, service_role;

COMMIT;
