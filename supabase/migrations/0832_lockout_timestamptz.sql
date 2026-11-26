-- Lockout instants become timestamptz.
-- Development data only: existing rows are not customer history.
-- The database session is UTC, and current writers store UTC walls, so the
-- conversion reads each naive value as UTC. A dev row written under another
-- session may move. That move is accepted.
-- sys_users_mst.attack_locked_until is already timestamptz and is not altered.
-- The 15-minute lock looked like 255 minutes because record_login_attempt
-- returned that instant as timestamp without time zone.

BEGIN;

-- The view casts locked_until and blocks the type change.
DROP VIEW public.admin_locked_accounts RESTRICT;

-- locked_until: membership lock expiry. Null when the membership is not locked.
ALTER TABLE public.org_users_mst
  ALTER COLUMN locked_until TYPE timestamptz
  USING locked_until AT TIME ZONE 'UTC';

COMMENT ON COLUMN public.org_users_mst.locked_until IS
  'UTC instant when a membership lock ends. Null when the membership is not locked. Distinct from sys_users_mst.attack_locked_until. Converted from a naive UTC wall.';

-- last_failed_login_at: last failed password attempt on the membership. Null after a reset.
ALTER TABLE public.org_users_mst
  ALTER COLUMN last_failed_login_at TYPE timestamptz
  USING last_failed_login_at AT TIME ZONE 'UTC';

COMMENT ON COLUMN public.org_users_mst.last_failed_login_at IS
  'UTC instant of the last failed password attempt on this membership. Null after a successful sign-in or a reset. Converted from a naive UTC wall.';

CREATE VIEW public.admin_locked_accounts AS
SELECT
  au.id AS user_id,
  au.email,
  ou.display_name,
  ou.tenant_org_id,
  ou.failed_login_attempts,
  ou.last_failed_login_at,
  ou.locked_until,
  ou.lock_reason,
  ou.updated_at,
  EXTRACT(EPOCH FROM (ou.locked_until - now())) / 60 AS minutes_remaining
FROM auth.users au
INNER JOIN public.org_users_mst ou ON au.id = ou.user_id
WHERE ou.locked_until IS NOT NULL
  AND ou.locked_until > now()
ORDER BY ou.locked_until DESC;

COMMENT ON VIEW public.admin_locked_accounts IS
  'Memberships whose lock expiry is still in the future. locked_until and last_failed_login_at are UTC instants. Service role only.';

REVOKE ALL ON TABLE public.admin_locked_accounts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.admin_locked_accounts TO service_role;

-- Return type cannot change with CREATE OR REPLACE. The body matches 0734.
DROP FUNCTION public.record_login_attempt(VARCHAR, BOOLEAN, INET, TEXT, TEXT) RESTRICT;

CREATE FUNCTION public.record_login_attempt(
  p_email         VARCHAR,
  p_success       BOOLEAN,
  p_ip_address    INET DEFAULT NULL,
  p_user_agent    TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS TABLE(log_id UUID, is_locked BOOLEAN, locked_until TIMESTAMPTZ, lock_reason VARCHAR)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_user_id         UUID;
  v_log_id          UUID;
  v_failed_attempts INTEGER;
  v_lock_until      TIMESTAMPTZ;
  v_lock_reason     VARCHAR;
  v_is_locked       BOOLEAN := false;
  v_max_failed_attempts INTEGER  := fn_auth_cfg_platform_int('AUTH_LOCKOUT_MAX_ATTEMPTS', 5);
  v_lockout_duration    INTERVAL := make_interval(mins => fn_auth_cfg_platform_int('AUTH_LOCKOUT_MINUTES', 15));
  v_reset_window        INTERVAL := make_interval(mins => fn_auth_cfg_platform_int('AUTH_LOCKOUT_WINDOW_MIN', 60));
BEGIN
  SELECT su.id INTO v_user_id
  FROM sys_users_mst su
  WHERE su.email = lower(btrim(p_email::TEXT))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    SELECT au.id INTO v_user_id
    FROM auth.users au
    WHERE lower(au.email::TEXT) = lower(btrim(p_email::TEXT))
    LIMIT 1;
  END IF;

  v_log_id := fn_auth_log_event(
    CASE WHEN p_success THEN 'LOGIN_SUCCESS' ELSE 'LOGIN_FAILURE' END,
    CASE WHEN p_success THEN 'SUCCESS' ELSE 'FAILURE' END,
    v_user_id, NULL, NULL, p_email::TEXT, p_ip_address, p_user_agent, NULL,
    CASE WHEN p_success THEN NULL ELSE left(p_error_message, 200) END,
    '{}'::jsonb
  );

  IF v_user_id IS NOT NULL THEN
    IF p_success THEN
      UPDATE sys_users_mst
      SET failed_login_attempts = 0,
          last_failed_login_at = NULL,
          attack_locked_until = NULL,
          attack_lock_reason = NULL,
          updated_at = now()
      WHERE id = v_user_id;

      -- One eligible laundry keeps the membership last-login stamp the current screen reads.
      -- Several laundries: the bind step stamps the chosen membership. This does not touch all of them.
      UPDATE org_users_mst ou
      SET last_login_at = now(),
          login_count = COALESCE(ou.login_count, 0) + 1,
          updated_at = now()
      WHERE ou.user_id = v_user_id
        AND ou.is_active = true
        AND (
          SELECT count(*) FROM org_users_mst x
          WHERE x.user_id = v_user_id AND x.is_active = true
        ) = 1;
    ELSE
      UPDATE sys_users_mst
      SET failed_login_attempts = CASE
            WHEN last_failed_login_at IS NULL OR last_failed_login_at < now() - v_reset_window THEN 1
            ELSE failed_login_attempts + 1
          END,
          last_failed_login_at = now(),
          updated_at = now()
      WHERE id = v_user_id
      RETURNING failed_login_attempts INTO v_failed_attempts;

      IF v_failed_attempts >= v_max_failed_attempts THEN
        v_lock_until := now() + v_lockout_duration;
        v_lock_reason := format('Account locked due to %s failed login attempts', v_max_failed_attempts);
        v_is_locked := true;

        UPDATE sys_users_mst
        SET attack_locked_until = v_lock_until,
            attack_lock_reason = v_lock_reason,
            updated_at = now()
        WHERE id = v_user_id;

        PERFORM fn_auth_log_event(
          'ACCOUNT_LOCKED', 'SUCCESS', v_user_id, NULL, NULL, p_email::TEXT, p_ip_address, p_user_agent, NULL,
          'TOO_MANY_FAILED_ATTEMPTS',
          jsonb_build_object('locked_until', v_lock_until, 'failed_attempts', v_failed_attempts)
        );
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT v_log_id, v_is_locked, v_lock_until, v_lock_reason;
END;
$$;

COMMENT ON FUNCTION public.record_login_attempt(VARCHAR, BOOLEAN, INET, TEXT, TEXT) IS
  'One attack counter on sys_users_mst for every laundry. Thresholds still come from AUTH_LOCKOUT_*. locked_until in the result is the UTC attack_locked_until instant. Service role only.';

REVOKE ALL ON FUNCTION public.record_login_attempt(VARCHAR, BOOLEAN, INET, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_login_attempt(VARCHAR, BOOLEAN, INET, TEXT, TEXT) TO service_role;

COMMIT;
