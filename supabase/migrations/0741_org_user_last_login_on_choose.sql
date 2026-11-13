-- ============================================================
-- Migration: 0741_org_user_last_login_on_choose.sql
-- Purpose:   When a global user chooses one organization, stamp that
--            organization user's last_login_at and login_count.
--            A single-organization sign-in already stamps them in
--            record_login_attempt. The picker path did not.
--            The function body otherwise matches 0737.
-- Affected:  fn_auth_session_choose_tenant(uuid), fn_auth_own_tenants(),
--            fn_auth_session_register status CHOOSE_TENANT,
--            sys_auth_event_cd code TENANT_CHOSEN.
--            Drops fn_auth_session_choose_laundry and fn_auth_own_laundries.
-- Do not apply from the agent. Review, then apply.
-- ============================================================

BEGIN;

-- Binds the PENDING row to one membership. The tenant is read from that membership.
CREATE OR REPLACE FUNCTION fn_auth_session_choose_tenant(p_org_user_id UUID)
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

  UPDATE org_users_mst ou
  SET last_login_at = now(),
      login_count = COALESCE(ou.login_count, 0) + 1,
      updated_at = now()
  WHERE ou.id = v_member.id
    AND ou.tenant_org_id = v_member.tenant_org_id
    AND ou.user_id = v_uid;

  UPDATE sys_users_mst su
  SET last_chosen_tenant_id = v_member.tenant_org_id,
      updated_at = now(),
      updated_by = v_uid
  WHERE su.id = v_uid;

  PERFORM fn_auth_log_event(
    'TENANT_CHOSEN', 'SUCCESS', v_uid, v_member.tenant_org_id, v_sid,
    NULL, v_row.login_ip, v_row.user_agent, v_row.device_label, NULL, '{}'::jsonb, v_member.id
  );

  RETURN QUERY SELECT 'REGISTERED', v_row.id, v_member.tenant_org_id, v_new_dev,
                      (v_new_dev AND v_pol.new_device_alert), v_idle, v_pol.idle_warning_sec, v_expires, v_ended;
END;
$$;

COMMENT ON FUNCTION fn_auth_session_choose_tenant(UUID) IS 'Turns the caller PENDING sign-in into one organization. The membership must belong to auth.uid and be eligible. There is no tenant-id argument. On success, that organization user last_login_at and login_count are stamped.';
REVOKE EXECUTE ON FUNCTION fn_auth_session_choose_tenant(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_auth_session_choose_tenant(UUID) TO authenticated, service_role;

DROP FUNCTION fn_auth_session_choose_laundry(UUID);

-- Picker list. Return columns are tenant_name / tenant_name2.
-- A return-column rename cannot be done with CREATE OR REPLACE, so the old function is dropped.
CREATE OR REPLACE FUNCTION fn_auth_own_tenants()
RETURNS TABLE (
  org_user_id   UUID,
  tenant_org_id UUID,
  tenant_name   TEXT,
  tenant_name2  TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT ou.id, ou.tenant_org_id, t.name::TEXT, t.name2::TEXT
  FROM org_users_mst ou
  JOIN org_tenants_mst t ON t.id = ou.tenant_org_id
  WHERE ou.user_id = auth.uid()
    AND ou.tenant_org_id = t.id
    AND ou.is_active = true
    AND ou.is_membership_locked = false
    AND COALESCE(t.is_active, true) = true
    AND COALESCE(t.status, '') NOT IN ('suspended', 'SUSPENDED', 'inactive', 'INACTIVE')
    AND EXISTS (
      SELECT 1 FROM sys_users_mst su
      WHERE su.id = auth.uid()
        AND su.is_globally_locked = false
        AND (su.attack_locked_until IS NULL OR su.attack_locked_until <= now())
    )
  ORDER BY t.name;
$$;

COMMENT ON FUNCTION fn_auth_own_tenants() IS 'Picker list for the signed-in global user only. Returns membership id, tenant id, and the tenant name. It is not a staff directory.';
REVOKE EXECUTE ON FUNCTION fn_auth_own_tenants() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_auth_own_tenants() TO authenticated, service_role;

DROP FUNCTION fn_auth_own_laundries();

INSERT INTO sys_auth_event_cd (code, name, name2, description, description2, event_group, display_order, created_by, created_info)
VALUES (
  'TENANT_CHOSEN',
  'Tenant chosen',
  'اختيار المنشأة',
  'The global user bound this sign-in to one tenant.',
  'ربط المستخدم العام تسجيل الدخول بمنشأة واحدة.',
  'SESSION',
  45,
  'migration_0741',
  '0741'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  is_active = true,
  rec_status = 1;

delete from sys_auth_audit_log WHERE event_code = 'LAUNDRY_CHOSEN';
delete from sys_auth_event_cd WHERE code = 'LAUNDRY_CHOSEN';


CREATE OR REPLACE FUNCTION fn_auth_session_register(
  p_auth_session_id UUID,
  p_auth_user_id    UUID,
  p_remember_me     BOOLEAN DEFAULT false,
  p_ip_address      INET DEFAULT NULL,
  p_user_agent      TEXT DEFAULT NULL,
  p_device_label    TEXT DEFAULT NULL,
  p_device_id_hash  TEXT DEFAULT NULL
)
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
  v_member   org_users_mst%ROWTYPE;
  v_pol      RECORD;
  v_existing sys_auth_user_sessions_mst%ROWTYPE;
  v_remember BOOLEAN;
  v_active   INTEGER;
  v_eligible INTEGER;
  v_victim   UUID;
  v_ended    INTEGER := 0;
  v_idle     INTEGER;
  v_expires  TIMESTAMPTZ;
  v_new_dev  BOOLEAN := false;
  v_row_id   UUID;
BEGIN
  SELECT * INTO v_existing FROM sys_auth_user_sessions_mst s WHERE s.auth_session_id = p_auth_session_id;
  IF FOUND THEN
    RETURN QUERY SELECT 'ALREADY_REGISTERED', v_existing.id, v_existing.tenant_org_id, false, false,
                        v_existing.idle_timeout_sec, v_existing.idle_warning_sec, v_existing.expires_at, 0;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM sys_users_mst su
    WHERE su.id = p_auth_user_id
      AND (
        su.is_globally_locked = true
        OR (su.attack_locked_until IS NOT NULL AND su.attack_locked_until > now())
      )
  ) THEN
    RETURN QUERY SELECT 'LOCKED', NULL::UUID, NULL::UUID, false, false, 0, 0, NULL::TIMESTAMPTZ, 0;
    RETURN;
  END IF;

  SELECT count(*) INTO v_eligible
  FROM org_users_mst ou
  JOIN org_tenants_mst t ON t.id = ou.tenant_org_id
  WHERE ou.user_id = p_auth_user_id
    AND ou.tenant_org_id = t.id
    AND ou.is_active = true
    AND ou.is_membership_locked = false
    AND COALESCE(t.is_active, true) = true
    AND COALESCE(t.status, '') NOT IN ('suspended', 'SUSPENDED', 'inactive', 'INACTIVE');

  IF v_eligible = 0 THEN
    RETURN QUERY SELECT 'NO_MEMBERSHIP', NULL::UUID, NULL::UUID, false, false, 0, 0, NULL::TIMESTAMPTZ, 0;
    RETURN;
  END IF;

  IF v_eligible > 1 THEN
    RETURN QUERY SELECT 'CHOOSE_TENANT', NULL::UUID, NULL::UUID, false, false, 0, 0, NULL::TIMESTAMPTZ, 0;
    RETURN;
  END IF;

  SELECT ou.* INTO v_member
  FROM org_users_mst ou
  JOIN org_tenants_mst t ON t.id = ou.tenant_org_id
  WHERE ou.user_id = p_auth_user_id
    AND ou.tenant_org_id = t.id
    AND ou.is_active = true
    AND ou.is_membership_locked = false
    AND COALESCE(t.is_active, true) = true
    AND COALESCE(t.status, '') NOT IN ('suspended', 'SUSPENDED', 'inactive', 'INACTIVE');

  SELECT * INTO v_pol FROM fn_auth_session_policy(v_member.tenant_org_id);

  v_remember := COALESCE(p_remember_me, false) AND v_pol.remember_me_days > 0;
  v_idle := CASE WHEN v_remember THEN 0 ELSE v_pol.idle_timeout_min * 60 END;
  v_expires := now() + CASE WHEN v_remember
                            THEN make_interval(days => v_pol.remember_me_days)
                            ELSE make_interval(hours => v_pol.session_max_hours) END;

  IF v_pol.max_sessions > 0 THEN
    SELECT count(*) INTO v_active
    FROM sys_auth_user_sessions_mst s
    WHERE s.auth_user_id = p_auth_user_id AND s.status = 'ACTIVE' AND s.expires_at > now();

    IF v_active >= v_pol.max_sessions THEN
      IF v_pol.limit_policy = 'BLOCK_NEW' THEN
        PERFORM fn_auth_log_event(
          'SESSION_LIMIT_HIT', 'DENIED', p_auth_user_id, v_member.tenant_org_id, p_auth_session_id,
          NULL, p_ip_address, p_user_agent, p_device_label, 'BLOCK_NEW',
          jsonb_build_object('max_sessions', v_pol.max_sessions, 'active', v_active), v_member.id
        );
        RETURN QUERY SELECT 'BLOCKED_SESSION_LIMIT', NULL::UUID, v_member.tenant_org_id, false, false, 0, 0, NULL::TIMESTAMPTZ, 0;
        RETURN;
      END IF;

      WHILE v_active >= v_pol.max_sessions LOOP
        SELECT s.auth_session_id INTO v_victim
        FROM sys_auth_user_sessions_mst s
        WHERE s.auth_user_id = p_auth_user_id AND s.status = 'ACTIVE'
        ORDER BY s.last_activity_at ASC, s.created_at ASC
        LIMIT 1;
        EXIT WHEN v_victim IS NULL;
        PERFORM fn_auth_session_end_internal(v_victim, 'SESSION_LIMIT', NULL);
        v_ended := v_ended + 1;
        v_active := v_active - 1;
      END LOOP;

      PERFORM fn_auth_log_event(
        'SESSION_LIMIT_HIT', 'SUCCESS', p_auth_user_id, v_member.tenant_org_id, p_auth_session_id,
        NULL, p_ip_address, p_user_agent, p_device_label, 'REVOKE_OLDEST',
        jsonb_build_object('max_sessions', v_pol.max_sessions, 'ended_sessions', v_ended), v_member.id
      );
    END IF;
  END IF;

  IF p_device_id_hash IS NOT NULL THEN
    v_new_dev :=
      EXISTS (SELECT 1 FROM sys_auth_user_sessions_mst s WHERE s.auth_user_id = p_auth_user_id)
      AND NOT EXISTS (
        SELECT 1 FROM sys_auth_user_sessions_mst s
        WHERE s.auth_user_id = p_auth_user_id AND s.device_id_hash = p_device_id_hash
      );
  END IF;

  INSERT INTO sys_auth_user_sessions_mst (
    auth_session_id, auth_user_id, org_user_id, tenant_org_id, is_remember_me,
    idle_timeout_sec, idle_warning_sec, expires_at, login_ip, last_ip, user_agent, device_label, device_id_hash
  ) VALUES (
    p_auth_session_id, p_auth_user_id, v_member.id, v_member.tenant_org_id, v_remember,
    v_idle, v_pol.idle_warning_sec, v_expires, p_ip_address, p_ip_address, p_user_agent, p_device_label, p_device_id_hash
  )
  ON CONFLICT (auth_session_id) DO NOTHING
  RETURNING id INTO v_row_id;

  IF v_new_dev THEN
    PERFORM fn_auth_log_event(
      'NEW_DEVICE', 'SUCCESS', p_auth_user_id, v_member.tenant_org_id, p_auth_session_id,
      NULL, p_ip_address, p_user_agent, p_device_label, NULL, '{}'::jsonb, v_member.id
    );
  END IF;

  RETURN QUERY SELECT 'REGISTERED', v_row_id, v_member.tenant_org_id, v_new_dev,
                      (v_new_dev AND v_pol.new_device_alert), v_idle, v_pol.idle_warning_sec, v_expires, v_ended;
END;
$$;

COMMENT ON FUNCTION fn_auth_session_register(UUID, UUID, BOOLEAN, INET, TEXT, TEXT, TEXT) IS 'Binds a session only when the global user has exactly one eligible tenant. CHOOSE_TENANT inserts nothing. LOCKED denies a global or attack lock. Service role only.';

COMMIT;
