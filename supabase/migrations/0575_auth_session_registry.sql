-- ============================================================
-- Migration: 0575_auth_session_registry.sql
-- Purpose:   Server-authoritative session registry for the User Session Lifecycle program.
--            One row per Supabase auth session (JWT `session_id`), bound to exactly ONE tenant at
--            sign-in (one auth account per tenant membership, migration 0563). Enables idle /
--            absolute timeout, listing and revoking sessions/devices, concurrent-session limits,
--            new-device detection, and revocation on password change / deactivation.
--            Policy values (idle minutes, session length, limits, remember-me, alerts) are resolved
--            from the auth config tables (0570) and SNAPSHOTTED onto the session at sign-in.
-- Affected:  new: sys_auth_sess_end_rsn_cd, sys_auth_user_sessions_mst,
--            fn_auth_session_policy(), fn_auth_session_end_internal(), fn_auth_session_register(),
--            fn_auth_session_validate(), fn_auth_session_end(), fn_auth_sessions_revoke(),
--            fn_auth_sessions_sweep(), fn_org_users_revoke_sessions() + trigger on org_users_mst
-- Related:   0561 (sys_auth_audit_log / fn_auth_log_event), 0563 (user_code, 1 account per tenant),
--            0570 (auth admin config), 0568 (audit immutability)
-- Not here:  pg_cron scheduling of fn_auth_sessions_sweep() (separate migration — extension/permission
--            dependent); notification emission for new-device alerts (application layer).
-- ============================================================

-- ------------------------------------------------------------
-- End-reason catalog
-- ------------------------------------------------------------
-- Why a session ended. Stable codes mirrored by lib/constants/auth-session.ts.
CREATE TABLE sys_auth_sess_end_rsn_cd (
  code          TEXT PRIMARY KEY,                       -- Stable end-reason identifier (exact string mirrored in TypeScript).
  name          TEXT NOT NULL,                          -- English label shown in session lists.
  name2         TEXT,                                   -- Arabic label shown in session lists.
  description   TEXT,                                   -- English explanation.
  description2  TEXT,                                   -- Arabic explanation.
  display_order INTEGER NOT NULL DEFAULT 0,             -- Sort order in filters/legends.
  is_active     BOOLEAN NOT NULL DEFAULT true,          -- false = retired code kept for historical rows.
  rec_status    SMALLINT NOT NULL DEFAULT 1,            -- 1 = active, 0 = soft-deleted (never hard-delete).
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),     -- Row creation time.
  created_by    TEXT,                                   -- Creator identifier.
  created_info  TEXT,                                   -- Creation context.
  updated_at    TIMESTAMPTZ,                            -- Last modification time.
  updated_by    TEXT,                                   -- Last modifier identifier.
  updated_info  TEXT                                    -- Modification context.
);

COMMENT ON TABLE  sys_auth_sess_end_rsn_cd IS 'Catalog of reasons a user session ended (global, platform-managed).';
COMMENT ON COLUMN sys_auth_sess_end_rsn_cd.code IS 'Stable end-reason code referenced by sys_auth_user_sessions_mst.end_reason_code.';
COMMENT ON COLUMN sys_auth_sess_end_rsn_cd.name IS 'English label.';
COMMENT ON COLUMN sys_auth_sess_end_rsn_cd.name2 IS 'Arabic label.';
COMMENT ON COLUMN sys_auth_sess_end_rsn_cd.description IS 'English description.';
COMMENT ON COLUMN sys_auth_sess_end_rsn_cd.description2 IS 'Arabic description.';
COMMENT ON COLUMN sys_auth_sess_end_rsn_cd.display_order IS 'Sort order.';
COMMENT ON COLUMN sys_auth_sess_end_rsn_cd.is_active IS 'false = retired code.';
COMMENT ON COLUMN sys_auth_sess_end_rsn_cd.rec_status IS '1 = active, 0 = soft-deleted.';
COMMENT ON COLUMN sys_auth_sess_end_rsn_cd.created_at IS 'Row creation time.';
COMMENT ON COLUMN sys_auth_sess_end_rsn_cd.created_by IS 'Creator identifier.';
COMMENT ON COLUMN sys_auth_sess_end_rsn_cd.created_info IS 'Creation context.';
COMMENT ON COLUMN sys_auth_sess_end_rsn_cd.updated_at IS 'Last modification time.';
COMMENT ON COLUMN sys_auth_sess_end_rsn_cd.updated_by IS 'Last modifier identifier.';
COMMENT ON COLUMN sys_auth_sess_end_rsn_cd.updated_info IS 'Modification context.';

INSERT INTO sys_auth_sess_end_rsn_cd (code, name, name2, description, description2, display_order, created_by, created_info) VALUES
  ('USER_LOGOUT',        'Signed out',                'تسجيل خروج',                 'The user signed out.',                                        'سجّل المستخدم خروجه.',                              10, 'migration', '0575'),
  ('IDLE_TIMEOUT',       'Idle timeout',              'انتهاء المهلة لعدم النشاط',  'No activity for longer than the idle timeout.',               'لا نشاط لمدة تتجاوز مهلة عدم النشاط.',               20, 'migration', '0575'),
  ('ABSOLUTE_TIMEOUT',   'Session expired',           'انتهاء مدة الجلسة',          'The session reached its maximum lifetime.',                   'بلغت الجلسة الحد الأقصى لمدتها.',                   30, 'migration', '0575'),
  ('USER_REVOKED',       'Ended by the user',         'أنهاها المستخدم',            'The user ended this session from another device.',            'أنهى المستخدم هذه الجلسة من جهاز آخر.',             40, 'migration', '0575'),
  ('ADMIN_REVOKED',      'Ended by an administrator', 'أنهاها مسؤول',              'An administrator ended this session.',                        'أنهى مسؤول هذه الجلسة.',                            50, 'migration', '0575'),
  ('PASSWORD_CHANGED',   'Password changed',          'تغيير كلمة المرور',          'The password was changed or reset.',                          'تم تغيير كلمة المرور أو إعادة تعيينها.',            60, 'migration', '0575'),
  ('USER_DEACTIVATED',   'Account deactivated',       'تعطيل الحساب',               'The user account was deactivated.',                           'تم تعطيل حساب المستخدم.',                           70, 'migration', '0575'),
  ('MEMBERSHIP_REMOVED', 'Access removed',            'إزالة الوصول',               'The user was removed from the organization.',                 'تمت إزالة المستخدم من المنشأة.',                    80, 'migration', '0575'),
  ('SESSION_LIMIT',      'Session limit reached',     'بلوغ حد الجلسات',            'Ended to make room for a newer sign-in (concurrent session limit).', 'أُنهيت لإفساح المجال لتسجيل دخول أحدث (حد الجلسات المتزامنة).', 90, 'migration', '0575'),
  ('SECURITY',           'Security',                  'أمان',                       'Ended for a security reason or because the platform session no longer exists.', 'أُنهيت لسبب أمني أو لأن جلسة المنصة لم تعد موجودة.', 100, 'migration', '0575');

ALTER TABLE sys_auth_sess_end_rsn_cd ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_sess_end_rsn_read ON sys_auth_sess_end_rsn_cd
  FOR SELECT TO authenticated
  USING (is_active = true AND rec_status = 1);
COMMENT ON POLICY auth_sess_end_rsn_read ON sys_auth_sess_end_rsn_cd IS 'Authenticated users may read active end reasons; no write policy.';

REVOKE ALL ON TABLE sys_auth_sess_end_rsn_cd FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE sys_auth_sess_end_rsn_cd FROM authenticated;
GRANT SELECT ON TABLE sys_auth_sess_end_rsn_cd TO authenticated;
GRANT ALL ON TABLE sys_auth_sess_end_rsn_cd TO service_role;

-- ------------------------------------------------------------
-- Session registry
-- ------------------------------------------------------------
-- One row per Supabase auth session. Written ONLY by the SECURITY DEFINER functions below (and read by
-- server routes / the owner via RLS policies). Rows are kept after the session ends (status ENDED) as
-- history for the sessions screens and security forensics; the sweep job purges old ended rows.
CREATE TABLE sys_auth_user_sessions_mst (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),   -- Registry row identifier (used by the UI to address a session).
  auth_session_id  UUID NOT NULL UNIQUE,                         -- Supabase auth.sessions id = JWT `session_id` claim; no FK because auth.sessions rows are deleted on revoke.
  auth_user_id     UUID NOT NULL
                   REFERENCES auth.users(id) ON DELETE CASCADE,  -- Session owner; sessions are removed with the account.
  org_user_id      UUID
                   REFERENCES org_users_mst(id) ON DELETE SET NULL, -- Owner's membership row (single tenant); SET NULL keeps history if the membership is deleted.
  tenant_org_id    UUID NOT NULL
                   REFERENCES org_tenants_mst(id) ON DELETE CASCADE, -- Tenant fixed for the session lifetime (no in-session switching).
  status           TEXT NOT NULL DEFAULT 'ACTIVE'
                   CHECK (status IN ('ACTIVE', 'ENDED')),        -- ACTIVE until ended by logout/timeout/revoke.
  end_reason_code  TEXT REFERENCES sys_auth_sess_end_rsn_cd(code), -- Why it ended; NULL while ACTIVE.
  ended_at         TIMESTAMPTZ,                                  -- When it ended; NULL while ACTIVE.
  ended_by         UUID,                                         -- Auth user who ended it (self or an admin); NULL for system/timeouts.
  login_method     TEXT NOT NULL DEFAULT 'PASSWORD',             -- How the user authenticated (extensible: PASSWORD, later OTP/SSO).
  is_remember_me   BOOLEAN NOT NULL DEFAULT false,               -- "Remember me" sign-in: long lifetime, idle timeout disabled.
  idle_timeout_sec INTEGER NOT NULL DEFAULT 0
                   CHECK (idle_timeout_sec >= 0),                -- Snapshot: seconds without activity before sign-out; 0 = no idle timeout.
  idle_warning_sec INTEGER NOT NULL DEFAULT 60
                   CHECK (idle_warning_sec >= 0),                -- Snapshot: seconds before idle expiry when the UI warns the user.
  expires_at       TIMESTAMPTZ NOT NULL,                         -- Absolute expiry (session max length or remember-me days); never extended by activity.
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),           -- Last real user activity (client heartbeat); drives the idle timeout.
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),           -- Last time the server validated this session (any request).
  login_ip         INET,                                         -- Client IP at sign-in.
  last_ip          INET,                                         -- Client IP at the last activity touch.
  user_agent       TEXT,                                         -- Raw User-Agent at sign-in.
  device_label     TEXT,                                         -- Readable device summary (e.g. "Chrome on Windows").
  device_id_hash   TEXT,                                         -- Hash of the long-lived device cookie; identifies "the same browser" across sessions.
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),           -- Row creation time (= sign-in time).
  updated_at       TIMESTAMPTZ,                                  -- Last modification time.
  CONSTRAINT chk_auth_sess_ended_shape CHECK (
    (status = 'ACTIVE' AND end_reason_code IS NULL AND ended_at IS NULL)
    OR (status = 'ENDED' AND end_reason_code IS NOT NULL AND ended_at IS NOT NULL)
  )
);

COMMENT ON TABLE  sys_auth_user_sessions_mst IS 'Registry of user sign-in sessions (one row per Supabase auth session), bound to one tenant. Written only by SECURITY DEFINER fn_auth_session_* functions.';
COMMENT ON COLUMN sys_auth_user_sessions_mst.id IS 'Registry row id; the handle the UI uses to address a session.';
COMMENT ON COLUMN sys_auth_user_sessions_mst.auth_session_id IS 'auth.sessions.id (JWT session_id claim); unique; no FK because auth.sessions rows are deleted on revoke.';
COMMENT ON COLUMN sys_auth_user_sessions_mst.auth_user_id IS 'Session owner (auth.users.id); cascade-deleted with the account.';
COMMENT ON COLUMN sys_auth_user_sessions_mst.org_user_id IS 'Owner membership (org_users_mst.id); SET NULL on membership delete so history survives.';
COMMENT ON COLUMN sys_auth_user_sessions_mst.tenant_org_id IS 'Tenant the session is bound to for its whole lifetime.';
COMMENT ON COLUMN sys_auth_user_sessions_mst.status IS 'ACTIVE or ENDED.';
COMMENT ON COLUMN sys_auth_user_sessions_mst.end_reason_code IS 'Why the session ended (sys_auth_sess_end_rsn_cd); NULL while ACTIVE.';
COMMENT ON COLUMN sys_auth_user_sessions_mst.ended_at IS 'End time; NULL while ACTIVE.';
COMMENT ON COLUMN sys_auth_user_sessions_mst.ended_by IS 'Auth user who ended the session (self/admin); NULL for system-driven ends.';
COMMENT ON COLUMN sys_auth_user_sessions_mst.login_method IS 'Authentication method used at sign-in.';
COMMENT ON COLUMN sys_auth_user_sessions_mst.is_remember_me IS 'Remember-me sign-in: long lifetime and no idle timeout.';
COMMENT ON COLUMN sys_auth_user_sessions_mst.idle_timeout_sec IS 'Snapshot of the idle timeout in seconds (0 = off).';
COMMENT ON COLUMN sys_auth_user_sessions_mst.idle_warning_sec IS 'Snapshot of the idle warning lead time in seconds.';
COMMENT ON COLUMN sys_auth_user_sessions_mst.expires_at IS 'Absolute expiry; activity never extends it.';
COMMENT ON COLUMN sys_auth_user_sessions_mst.last_activity_at IS 'Last real user activity (heartbeat); basis of the idle timeout.';
COMMENT ON COLUMN sys_auth_user_sessions_mst.last_seen_at IS 'Last server-side validation of the session.';
COMMENT ON COLUMN sys_auth_user_sessions_mst.login_ip IS 'Client IP at sign-in.';
COMMENT ON COLUMN sys_auth_user_sessions_mst.last_ip IS 'Client IP at the latest activity touch.';
COMMENT ON COLUMN sys_auth_user_sessions_mst.user_agent IS 'Raw User-Agent at sign-in.';
COMMENT ON COLUMN sys_auth_user_sessions_mst.device_label IS 'Readable device summary.';
COMMENT ON COLUMN sys_auth_user_sessions_mst.device_id_hash IS 'Hash of the device cookie; identifies the same browser across sessions (new-device detection).';
COMMENT ON COLUMN sys_auth_user_sessions_mst.created_at IS 'Row creation time = sign-in time.';
COMMENT ON COLUMN sys_auth_user_sessions_mst.updated_at IS 'Last modification time.';
COMMENT ON CONSTRAINT chk_auth_sess_ended_shape ON sys_auth_user_sessions_mst IS
  'ACTIVE rows have no end data; ENDED rows must have an end reason and end time.';

-- A user's active sessions (concurrency limit, "my sessions" screen, revoke-others).
CREATE INDEX idx_auth_sess_user_status ON sys_auth_user_sessions_mst (auth_user_id, status);
-- Tenant admin screen: active sessions of the tenant ordered by recent activity.
CREATE INDEX idx_auth_sess_tenant_status ON sys_auth_user_sessions_mst (tenant_org_id, status, last_activity_at DESC);
-- Sweep job: find ACTIVE sessions past their absolute expiry.
CREATE INDEX idx_auth_sess_active_expiry ON sys_auth_user_sessions_mst (expires_at) WHERE status = 'ACTIVE';
-- New-device detection: has this user ever signed in from this browser.
CREATE INDEX idx_auth_sess_user_device ON sys_auth_user_sessions_mst (auth_user_id, device_id_hash) WHERE device_id_hash IS NOT NULL;
-- Retention purge of old ended rows.
CREATE INDEX idx_auth_sess_ended_at ON sys_auth_user_sessions_mst (ended_at) WHERE status = 'ENDED';
-- FK maintenance for ON DELETE SET NULL on the membership.
CREATE INDEX idx_auth_sess_org_user ON sys_auth_user_sessions_mst (org_user_id) WHERE org_user_id IS NOT NULL;

ALTER TABLE sys_auth_user_sessions_mst ENABLE ROW LEVEL SECURITY;

-- A user can read their own sessions (account "my sessions" screen).
CREATE POLICY auth_sess_read_own ON sys_auth_user_sessions_mst
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());
COMMENT ON POLICY auth_sess_read_own ON sys_auth_user_sessions_mst IS 'A signed-in user can read only their own sessions.';

-- Tenant admins can read the sessions of their own tenant (defense in depth: the web-admin API also
-- enforces user_sessions:read and an explicit tenant_org_id filter).
CREATE POLICY auth_sess_read_tenant_admin ON sys_auth_user_sessions_mst
  FOR SELECT TO authenticated
  USING (tenant_org_id = current_tenant_id() AND is_admin());
COMMENT ON POLICY auth_sess_read_tenant_admin ON sys_auth_user_sessions_mst IS 'Tenant admins can read sessions of their own tenant only.';

-- No write policies and no write grants: sessions are created/changed only by SECURITY DEFINER functions.
REVOKE ALL ON TABLE sys_auth_user_sessions_mst FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE sys_auth_user_sessions_mst TO authenticated;
GRANT SELECT ON TABLE sys_auth_user_sessions_mst TO service_role;

-- ------------------------------------------------------------
-- Policy resolution
-- ------------------------------------------------------------
-- Effective session policy for a tenant as one typed row (wrapper over fn_auth_config_effective).
CREATE OR REPLACE FUNCTION fn_auth_session_policy(p_tenant_org_id UUID)
RETURNS TABLE (
  idle_timeout_min  INTEGER,
  idle_warning_sec  INTEGER,
  session_max_hours INTEGER,
  remember_me_days  INTEGER,
  max_sessions      INTEGER,
  limit_policy      TEXT,
  new_device_alert  BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    COALESCE(max(effective_value::INTEGER) FILTER (WHERE config_code = 'AUTH_IDLE_TIMEOUT_MIN'), 30),
    COALESCE(max(effective_value::INTEGER) FILTER (WHERE config_code = 'AUTH_IDLE_WARNING_SEC'), 60),
    COALESCE(max(effective_value::INTEGER) FILTER (WHERE config_code = 'AUTH_SESSION_MAX_HOURS'), 12),
    COALESCE(max(effective_value::INTEGER) FILTER (WHERE config_code = 'AUTH_REMEMBER_ME_DAYS'), 7),
    COALESCE(max(effective_value::INTEGER) FILTER (WHERE config_code = 'AUTH_MAX_SESSIONS_PER_USER'), 0),
    COALESCE(max(effective_value) FILTER (WHERE config_code = 'AUTH_SESSION_LIMIT_POLICY'), 'REVOKE_OLDEST'),
    COALESCE(bool_or(effective_value = 'true') FILTER (WHERE config_code = 'AUTH_NEW_DEVICE_ALERT'), true)
  FROM fn_auth_config_effective(p_tenant_org_id);
$$;
COMMENT ON FUNCTION fn_auth_session_policy(UUID) IS
  'Effective session policy for a tenant (idle, warning, max length, remember-me, concurrency, new-device alert) with safe defaults if a catalog item is missing. Definer/service callers only.';
REVOKE EXECUTE ON FUNCTION fn_auth_session_policy(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_auth_session_policy(UUID) TO service_role;

-- ------------------------------------------------------------
-- Ending sessions
-- ------------------------------------------------------------
-- Single place that ends a session: marks the registry row ENDED, deletes the Supabase auth session
-- (which also kills its refresh token, so the browser cannot mint new access tokens), and writes the
-- audit event. Idempotent: ending an already-ended or unknown session is a no-op returning false.
-- Internal helper — no API-role grants; called by the public functions below.
CREATE OR REPLACE FUNCTION fn_auth_session_end_internal(
  p_auth_session_id UUID,
  p_reason          TEXT,
  p_actor           UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_row   sys_auth_user_sessions_mst%ROWTYPE;
  v_event TEXT;
BEGIN
  UPDATE sys_auth_user_sessions_mst
  SET status = 'ENDED',
      end_reason_code = p_reason,
      ended_at = now(),
      ended_by = p_actor,
      updated_at = now()
  WHERE auth_session_id = p_auth_session_id
    AND status = 'ACTIVE'
  RETURNING * INTO v_row;

  -- Kill the Supabase session regardless (also covers sessions that were never registered).
  DELETE FROM auth.sessions WHERE id = p_auth_session_id;

  IF v_row.id IS NULL THEN
    RETURN false;
  END IF;

  v_event := CASE p_reason
    WHEN 'USER_LOGOUT' THEN 'LOGOUT'
    WHEN 'IDLE_TIMEOUT' THEN 'SESSION_IDLE_TIMEOUT'
    WHEN 'ABSOLUTE_TIMEOUT' THEN 'SESSION_ABSOLUTE_TIMEOUT'
    ELSE 'SESSION_REVOKED'
  END;

  -- The audit write must never block ending a session. When the end is triggered by deleting a user or a
  -- tenant (cascade from auth.users / org_tenants_mst -> org_users_mst), the audit row's FKs point at rows
  -- that are being deleted in the same statement; swallow only that foreign-key case.
  BEGIN
    PERFORM fn_auth_log_event(
      v_event, 'SUCCESS', v_row.auth_user_id, v_row.tenant_org_id, v_row.auth_session_id,
      NULL, v_row.last_ip, v_row.user_agent, v_row.device_label, p_reason,
      jsonb_build_object('ended_by', p_actor), v_row.org_user_id
    );
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  RETURN true;
END;
$$;
COMMENT ON FUNCTION fn_auth_session_end_internal(UUID, TEXT, UUID) IS
  'Ends one session: marks the registry row ENDED, deletes the Supabase auth session (kills refresh) and logs the audit event. Idempotent. Internal helper.';
REVOKE EXECUTE ON FUNCTION fn_auth_session_end_internal(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;

-- Public wrapper used by the server (logout route, revoke-one).
CREATE OR REPLACE FUNCTION fn_auth_session_end(
  p_auth_session_id UUID,
  p_reason          TEXT,
  p_actor           UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT fn_auth_session_end_internal(p_auth_session_id, p_reason, p_actor);
$$;
COMMENT ON FUNCTION fn_auth_session_end(UUID, TEXT, UUID) IS
  'Server entry point to end one session (logout, revoke). The caller (service role) must have authorized the target session.';
REVOKE EXECUTE ON FUNCTION fn_auth_session_end(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_auth_session_end(UUID, TEXT, UUID) TO service_role;

-- End every ACTIVE session of a user in a tenant, optionally keeping one (e.g. "sign out other devices",
-- password change). Explicit tenant predicate; returns how many sessions were ended.
CREATE OR REPLACE FUNCTION fn_auth_sessions_revoke(
  p_auth_user_id          UUID,
  p_tenant_org_id         UUID,
  p_reason                TEXT,
  p_except_auth_session_id UUID DEFAULT NULL,
  p_actor                 UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sid   UUID;
  v_count INTEGER := 0;
BEGIN
  FOR v_sid IN
    SELECT s.auth_session_id
    FROM sys_auth_user_sessions_mst s
    WHERE s.auth_user_id = p_auth_user_id
      AND s.tenant_org_id = p_tenant_org_id
      AND s.status = 'ACTIVE'
      AND (p_except_auth_session_id IS NULL OR s.auth_session_id <> p_except_auth_session_id)
  LOOP
    IF fn_auth_session_end_internal(v_sid, p_reason, p_actor) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;
COMMENT ON FUNCTION fn_auth_sessions_revoke(UUID, UUID, TEXT, UUID, UUID) IS
  'Ends all ACTIVE sessions of a user in a tenant (optionally keeping one); returns the count. Service role / trigger use.';
REVOKE EXECUTE ON FUNCTION fn_auth_sessions_revoke(UUID, UUID, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_auth_sessions_revoke(UUID, UUID, TEXT, UUID, UUID) TO service_role;

-- ------------------------------------------------------------
-- Registration (called by the login route right after Supabase authenticates the user)
-- ------------------------------------------------------------
-- Registers a new session: resolves the tenant from the user's single membership, snapshots the effective
-- policy, applies the concurrent-session limit, detects a new device and inserts the registry row.
-- Result status: REGISTERED | ALREADY_REGISTERED (idempotent retry) | BLOCKED_SESSION_LIMIT (nothing
-- inserted; the caller must delete the just-created auth session and refuse sign-in) | NO_MEMBERSHIP.
-- Remember-me sessions get the long lifetime and NO idle timeout (an idle timeout would defeat
-- "remember me" after a browser restart); absolute expiry still applies.
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
  v_victim   UUID;
  v_ended    INTEGER := 0;
  v_idle     INTEGER;
  v_expires  TIMESTAMPTZ;
  v_new_dev  BOOLEAN := false;
  v_row_id   UUID;
BEGIN
  -- Idempotent retry: the same auth session was already registered.
  SELECT * INTO v_existing FROM sys_auth_user_sessions_mst s WHERE s.auth_session_id = p_auth_session_id;
  IF FOUND THEN
    RETURN QUERY SELECT 'ALREADY_REGISTERED', v_existing.id, v_existing.tenant_org_id, false, false,
                        v_existing.idle_timeout_sec, v_existing.idle_warning_sec, v_existing.expires_at, 0;
    RETURN;
  END IF;

  -- Tenant = the user's single active membership (one account per tenant, migration 0563).
  SELECT * INTO v_member FROM org_users_mst ou WHERE ou.user_id = p_auth_user_id AND ou.is_active = true LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NO_MEMBERSHIP', NULL::UUID, NULL::UUID, false, false, 0, 0, NULL::TIMESTAMPTZ, 0;
    RETURN;
  END IF;

  SELECT * INTO v_pol FROM fn_auth_session_policy(v_member.tenant_org_id);

  -- Remember-me only counts when the policy allows it (remember_me_days > 0).
  v_remember := COALESCE(p_remember_me, false) AND v_pol.remember_me_days > 0;
  v_idle := CASE WHEN v_remember THEN 0 ELSE v_pol.idle_timeout_min * 60 END;
  v_expires := now() + CASE WHEN v_remember
                            THEN make_interval(days => v_pol.remember_me_days)
                            ELSE make_interval(hours => v_pol.session_max_hours) END;

  -- ─── Concurrent-session limit ──────────────────────────────────────────
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

      -- REVOKE_OLDEST: end least-recently-active sessions until there is room for the new one.
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

  -- ─── New-device detection ──────────────────────────────────────────────
  -- A device is "new" when the user has signed in before but never from this browser. A user's very
  -- first sign-in is not flagged (nothing to compare against).
  IF p_device_id_hash IS NOT NULL THEN
    v_new_dev :=
      EXISTS (SELECT 1 FROM sys_auth_user_sessions_mst s WHERE s.auth_user_id = p_auth_user_id)
      AND NOT EXISTS (SELECT 1 FROM sys_auth_user_sessions_mst s
                      WHERE s.auth_user_id = p_auth_user_id AND s.device_id_hash = p_device_id_hash);
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
COMMENT ON FUNCTION fn_auth_session_register(UUID, UUID, BOOLEAN, INET, TEXT, TEXT, TEXT) IS
  'Registers a new session at sign-in: tenant from the single membership, policy snapshot, concurrent-session limit (REVOKE_OLDEST/BLOCK_NEW), new-device detection. Service role only.';
REVOKE EXECUTE ON FUNCTION fn_auth_session_register(UUID, UUID, BOOLEAN, INET, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_auth_session_register(UUID, UUID, BOOLEAN, INET, TEXT, TEXT, TEXT) TO service_role;

-- ------------------------------------------------------------
-- Validation (called by the proxy / server auth helpers / activity heartbeat)
-- ------------------------------------------------------------
-- Validates the CALLER's own session (identified by the JWT claims, never by a parameter, so a user can
-- only ever validate themselves). Enforces membership, absolute expiry and idle timeout; ends the
-- session (and deletes the Supabase session) when a limit is exceeded. p_touch = true records real user
-- activity (extends the idle window) — only the explicit activity heartbeat may pass true; ordinary
-- request validation must pass false so background traffic never keeps a session alive.
-- State: ACTIVE | ENDED | NOT_REGISTERED | NO_SESSION.
CREATE OR REPLACE FUNCTION fn_auth_session_validate(
  p_touch      BOOLEAN DEFAULT false,
  p_ip_address INET DEFAULT NULL
)
RETURNS TABLE (
  state                  TEXT,
  end_reason             TEXT,
  tenant_org_id          UUID,
  idle_remaining_sec     INTEGER,
  absolute_remaining_sec INTEGER,
  idle_warning_sec       INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_sid    UUID;
  v_uid    UUID := auth.uid();
  v_row    sys_auth_user_sessions_mst%ROWTYPE;
  v_active BOOLEAN;
  v_idle_remaining INTEGER;
  v_abs_remaining  INTEGER;
BEGIN
  BEGIN
    v_sid := NULLIF(auth.jwt() ->> 'session_id', '')::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    v_sid := NULL;
  END;

  IF v_uid IS NULL OR v_sid IS NULL THEN
    RETURN QUERY SELECT 'NO_SESSION', NULL::TEXT, NULL::UUID, NULL::INTEGER, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  SELECT * INTO v_row
  FROM sys_auth_user_sessions_mst s
  WHERE s.auth_session_id = v_sid AND s.auth_user_id = v_uid;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_REGISTERED', NULL::TEXT, NULL::UUID, NULL::INTEGER, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  IF v_row.status = 'ENDED' THEN
    RETURN QUERY SELECT 'ENDED', v_row.end_reason_code, v_row.tenant_org_id, 0, 0, v_row.idle_warning_sec;
    RETURN;
  END IF;

  -- Membership still active?
  SELECT EXISTS (
    SELECT 1 FROM org_users_mst ou
    WHERE ou.user_id = v_uid AND ou.tenant_org_id = v_row.tenant_org_id AND ou.is_active = true
  ) INTO v_active;
  IF NOT v_active THEN
    PERFORM fn_auth_session_end_internal(v_sid, 'USER_DEACTIVATED', NULL);
    RETURN QUERY SELECT 'ENDED', 'USER_DEACTIVATED', v_row.tenant_org_id, 0, 0, v_row.idle_warning_sec;
    RETURN;
  END IF;

  IF now() >= v_row.expires_at THEN
    PERFORM fn_auth_session_end_internal(v_sid, 'ABSOLUTE_TIMEOUT', NULL);
    RETURN QUERY SELECT 'ENDED', 'ABSOLUTE_TIMEOUT', v_row.tenant_org_id, 0, 0, v_row.idle_warning_sec;
    RETURN;
  END IF;

  IF v_row.idle_timeout_sec > 0 AND now() >= v_row.last_activity_at + make_interval(secs => v_row.idle_timeout_sec) THEN
    PERFORM fn_auth_session_end_internal(v_sid, 'IDLE_TIMEOUT', NULL);
    RETURN QUERY SELECT 'ENDED', 'IDLE_TIMEOUT', v_row.tenant_org_id, 0, 0, v_row.idle_warning_sec;
    RETURN;
  END IF;

  -- Active. Touch only on the explicit heartbeat, and at most every 15 s to bound write volume.
  IF p_touch AND v_row.last_activity_at < now() - interval '15 seconds' THEN
    UPDATE sys_auth_user_sessions_mst
    SET last_activity_at = now(), last_seen_at = now(), last_ip = COALESCE(p_ip_address, last_ip), updated_at = now()
    WHERE id = v_row.id
    RETURNING last_activity_at INTO v_row.last_activity_at;
  ELSIF v_row.last_seen_at < now() - interval '60 seconds' THEN
    UPDATE sys_auth_user_sessions_mst SET last_seen_at = now() WHERE id = v_row.id;
  END IF;

  v_abs_remaining := GREATEST(0, floor(extract(epoch FROM (v_row.expires_at - now())))::INTEGER);
  v_idle_remaining := CASE
    WHEN v_row.idle_timeout_sec = 0 THEN NULL
    ELSE GREATEST(0, floor(extract(epoch FROM (v_row.last_activity_at + make_interval(secs => v_row.idle_timeout_sec) - now())))::INTEGER)
  END;

  RETURN QUERY SELECT 'ACTIVE', NULL::TEXT, v_row.tenant_org_id, v_idle_remaining, v_abs_remaining, v_row.idle_warning_sec;
END;
$$;
COMMENT ON FUNCTION fn_auth_session_validate(BOOLEAN, INET) IS
  'Validates the caller''s own session from JWT claims: membership, absolute expiry, idle timeout (ends + deletes the Supabase session when exceeded). p_touch=true records real activity (heartbeat only).';
REVOKE EXECUTE ON FUNCTION fn_auth_session_validate(BOOLEAN, INET) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_auth_session_validate(BOOLEAN, INET) TO authenticated;

-- ------------------------------------------------------------
-- Sweep (scheduled in a later migration)
-- ------------------------------------------------------------
-- Ends sessions nobody validated (browser closed): past absolute expiry or idle timeout, or whose
-- Supabase session no longer exists (signed out through the platform directly), then purges ended rows
-- older than the retention window. Returns how many sessions it ended.
CREATE OR REPLACE FUNCTION fn_auth_sessions_sweep(p_retention_days INTEGER DEFAULT 180)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_sid   UUID;
  v_why   TEXT;
  v_count INTEGER := 0;
BEGIN
  FOR v_sid, v_why IN
    SELECT s.auth_session_id,
           CASE
             WHEN s.expires_at <= now() THEN 'ABSOLUTE_TIMEOUT'
             WHEN s.idle_timeout_sec > 0
                  AND s.last_activity_at + make_interval(secs => s.idle_timeout_sec) <= now() THEN 'IDLE_TIMEOUT'
             ELSE 'SECURITY'
           END
    FROM sys_auth_user_sessions_mst s
    WHERE s.status = 'ACTIVE'
      AND (
        s.expires_at <= now()
        OR (s.idle_timeout_sec > 0 AND s.last_activity_at + make_interval(secs => s.idle_timeout_sec) <= now())
        OR NOT EXISTS (SELECT 1 FROM auth.sessions a WHERE a.id = s.auth_session_id)
      )
  LOOP
    IF fn_auth_session_end_internal(v_sid, v_why, NULL) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- Retention: ended history is kept for p_retention_days (the audit trail keeps its own copy of events).
  DELETE FROM sys_auth_user_sessions_mst
  WHERE status = 'ENDED' AND ended_at < now() - make_interval(days => p_retention_days);

  RETURN v_count;
END;
$$;
COMMENT ON FUNCTION fn_auth_sessions_sweep(INTEGER) IS
  'Ends ACTIVE sessions past absolute/idle limits or whose Supabase session vanished, then purges ENDED rows older than the retention window. Returns sessions ended. Run by a scheduled job.';
REVOKE EXECUTE ON FUNCTION fn_auth_sessions_sweep(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_auth_sessions_sweep(INTEGER) TO service_role;

-- ------------------------------------------------------------
-- Revoke sessions when a membership is deactivated or removed
-- ------------------------------------------------------------
-- Covers every write path (tenant API, HQ platform-api, SQL): deactivating or deleting an org_users_mst
-- row immediately ends that user's sessions in that tenant (deleting the Supabase session also stops
-- token refresh). Existing access tokens die at their short expiry; the proxy/guard rejects ended
-- sessions on the next request.
CREATE OR REPLACE FUNCTION fn_org_users_revoke_sessions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM fn_auth_sessions_revoke(OLD.user_id, OLD.tenant_org_id, 'MEMBERSHIP_REMOVED', NULL, NULL);
    RETURN OLD;
  END IF;

  IF OLD.is_active = true AND NEW.is_active = false THEN
    PERFORM fn_auth_sessions_revoke(NEW.user_id, NEW.tenant_org_id, 'USER_DEACTIVATED', NULL, NULL);
  END IF;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION fn_org_users_revoke_sessions() IS
  'Trigger function on org_users_mst: ends the user''s sessions in the tenant when the membership is deactivated or deleted.';
REVOKE EXECUTE ON FUNCTION fn_org_users_revoke_sessions() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_org_users_revoke_sessions
  AFTER UPDATE OF is_active OR DELETE ON org_users_mst
  FOR EACH ROW
  EXECUTE FUNCTION fn_org_users_revoke_sessions();
COMMENT ON TRIGGER trg_org_users_revoke_sessions ON org_users_mst IS
  'Ends the user''s sessions when the membership is deactivated or removed.';

-- ROLLBACK PLAN:
--   DROP TRIGGER trg_org_users_revoke_sessions ON org_users_mst; DROP FUNCTION fn_org_users_revoke_sessions();
--   DROP FUNCTION fn_auth_sessions_sweep(INTEGER), fn_auth_session_validate(BOOLEAN, INET),
--     fn_auth_session_register(UUID, UUID, BOOLEAN, INET, TEXT, TEXT, TEXT), fn_auth_sessions_revoke(UUID, UUID, TEXT, UUID, UUID),
--     fn_auth_session_end(UUID, TEXT, UUID), fn_auth_session_end_internal(UUID, TEXT, UUID), fn_auth_session_policy(UUID);
--   DROP TABLE sys_auth_user_sessions_mst; DROP TABLE sys_auth_sess_end_rsn_cd;
