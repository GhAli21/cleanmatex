-- ============================================================
-- Migration: 0561_auth_security_hardening.sql
-- Purpose:   Close four verified auth/tenant-isolation holes before the
--            User Session Lifecycle program builds on them:
--            S1  current_tenant_id() trusted user-editable JWT metadata with no
--                membership check (231 RLS policies depend on it).
--            S2  server code read the same user-editable tenant id and fed it to Prisma
--                (bypasses RLS); fixed at the source with an auth.users guard trigger.
--            S3  sys_audit_log had RLS off and full DML granted to anon/authenticated.
--            S4  login-lockout / audit helper functions were executable by anon
--                (lock any account, reset lockouts, enumerate emails, forge audit rows).
--            admin_locked_accounts view exposed to anon/authenticated.
--            Also introduces the dedicated, typed, insert-only auth audit trail
--            (sys_auth_event_cd + sys_auth_audit_log + fn_auth_log_event) and re-points
--            record_login_attempt() at it (and drops switch_tenant_context), so no auth event is
--            written to sys_audit_log any more. sys_audit_log is only locked down here
--            (it is still exposed to anon today) and left for its non-auth uses.
-- Affected:  current_tenant_id(), fn_auth_guard_user_tenant_meta() + trigger on auth.users, sys_audit_log,
--            sys_auth_event_cd, sys_auth_audit_log, fn_auth_log_event(), switch_tenant_context() [dropped], record_login_attempt(),
--            is_account_locked(), unlock_account(), auto_unlock_expired_accounts(),
--            log_audit_event(), admin_locked_accounts
-- Related:   0003 (sys_audit_log, log_audit_event), 0004 (current_tenant_id),
--            0005 (lockout functions + view)
-- Callers:   web-admin login route and tenant-isolation monitor are switched to the
--            service-role client in the same change set (no browser/anon caller remains).
-- ============================================================

-- ------------------------------------------------------------
-- S1. current_tenant_id(): membership-validated tenant resolution
-- ------------------------------------------------------------
-- Resolves the caller's active tenant for RLS. A tenant id claimed in the JWT is honoured
-- ONLY when the caller holds an active org_users_mst membership in that tenant; otherwise
-- (missing, forged, stale or non-UUID claim) it falls back to the caller's most recently
-- used active membership. Source order for the claim:
--   1. top-level 'tenant_org_id' claim (set only by Supabase Auth / the access-token hook,
--      not user-writable) — forward-compatible with the session-registry migration;
--   2. user_metadata.tenant_org_id (user-writable, legacy) — now harmless because it is
--      validated against membership, so a forged value can never widen access.
-- SECURITY DEFINER so the membership read bypasses org_users_mst RLS (that table's own
-- policies call this function); search_path is pinned to prevent shadowing attacks.
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  WITH claimed AS (
    SELECT
      CASE
        WHEN raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN raw::uuid
        ELSE NULL
      END AS tenant_id
    FROM (
      SELECT NULLIF(
        COALESCE(
          auth.jwt() ->> 'tenant_org_id',
          auth.jwt() -> 'user_metadata' ->> 'tenant_org_id'
        ),
        ''
      ) AS raw
    ) r
  )
  SELECT COALESCE(
    -- Claimed tenant, accepted only with an active membership for the caller.
    (
      SELECT c.tenant_id
      FROM claimed c
      WHERE c.tenant_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM org_users_mst ou
          WHERE ou.user_id = auth.uid()
            AND ou.tenant_org_id = c.tenant_id
            AND ou.is_active = true
        )
    ),
    -- Fallback: most recently used active membership of the caller.
    (
      SELECT ou.tenant_org_id
      FROM org_users_mst ou
      WHERE ou.user_id = auth.uid()
        AND ou.is_active = true
      ORDER BY ou.last_login_at DESC NULLS LAST
      LIMIT 1
    )
  );
$$;

COMMENT ON FUNCTION current_tenant_id() IS
  'Caller active tenant for RLS. JWT-claimed tenant is honoured only with an active org_users_mst membership; else most recent active membership. Never trusts user-editable metadata alone.';

-- ------------------------------------------------------------
-- S2. auth.users trigger: user_metadata.tenant_org_id must be a tenant the user belongs to
-- ------------------------------------------------------------
-- ~25 server routes/services read user.user_metadata.tenant_org_id directly and feed it to
-- Prisma (which bypasses RLS). user_metadata is user-writable (supabase.auth.updateUser, or
-- signUp options.data), so those readers were exploitable. Rather than patch every reader,
-- guarantee at the source that the stored value is always a tenant the user actually belongs to:
--   INSERT: a tenant_org_id supplied at sign-up is stripped (no membership can exist yet);
--           legitimate users get it written at first login by ensureTenantInUserMetadata().
--   UPDATE: a CHANGED tenant_org_id must match an active org_users_mst membership of that user,
--           otherwise the update is rejected. Unchanged values never block unrelated updates
--           (e.g. profile edits of a since-deactivated user).
-- SECURITY DEFINER because GoTrue runs as supabase_auth_admin, which cannot read org_users_mst.
CREATE OR REPLACE FUNCTION fn_auth_guard_user_tenant_meta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_new_tenant TEXT;
  v_old_tenant TEXT;
BEGIN
  v_new_tenant := NULLIF(NEW.raw_user_meta_data ->> 'tenant_org_id', '');

  IF TG_OP = 'INSERT' THEN
    IF v_new_tenant IS NOT NULL THEN
      NEW.raw_user_meta_data := NEW.raw_user_meta_data - 'tenant_org_id';
    END IF;
    RETURN NEW;
  END IF;

  v_old_tenant := NULLIF(OLD.raw_user_meta_data ->> 'tenant_org_id', '');

  -- Only a changed, non-empty value needs proof of membership.
  IF v_new_tenant IS NOT NULL AND v_new_tenant IS DISTINCT FROM v_old_tenant THEN
    IF v_new_tenant !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR NOT EXISTS (
         SELECT 1
         FROM org_users_mst ou
         WHERE ou.user_id = NEW.id
           AND ou.tenant_org_id = v_new_tenant::uuid
           AND ou.is_active = true
       ) THEN
      RAISE EXCEPTION 'tenant_org_id in user metadata must be a tenant the user belongs to'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_auth_guard_user_tenant_meta() IS
  'BEFORE INSERT/UPDATE guard on auth.users: strips tenant_org_id on sign-up and rejects a changed tenant_org_id the user has no active org_users_mst membership in.';

-- Trigger name is prefixed trg_ so it sorts predictably among auth.users triggers; fires only
-- when raw_user_meta_data is written, so password/last-sign-in updates pay no cost.
-- auth.users is owned by supabase_auth_admin, not the migration role, so DROP TRIGGER and
-- COMMENT ON TRIGGER (both need ownership) are not allowed; CREATE TRIGGER only needs the TRIGGER
-- privilege. The trigger is therefore created conditionally (idempotent re-runs) and its purpose is
-- documented here instead of via COMMENT ON TRIGGER:
--   trg_auth_guard_user_tenant_meta enforces that user_metadata.tenant_org_id can only ever hold a
--   tenant the user is an active member of (see fn_auth_guard_user_tenant_meta()).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_auth_guard_user_tenant_meta'
      AND tgrelid = 'auth.users'::regclass
  ) THEN
    CREATE TRIGGER trg_auth_guard_user_tenant_meta
      BEFORE INSERT OR UPDATE OF raw_user_meta_data ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION fn_auth_guard_user_tenant_meta();
  END IF;
END
$$;

-- Internal trigger function: never callable as an RPC by API roles.
REVOKE EXECUTE ON FUNCTION fn_auth_guard_user_tenant_meta() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- S3. sys_audit_log: server-only table
-- ------------------------------------------------------------
-- Audit rows hold emails, IPs, user agents and old/new values for every tenant. They must
-- never be reachable with the public anon key or a tenant user's JWT. Access is service-role
-- only (server API routes add an explicit tenant_org_id filter); SECURITY DEFINER functions
-- such as log_audit_event keep writing because the function owner bypasses RLS.
ALTER TABLE sys_audit_log ENABLE ROW LEVEL SECURITY;

-- Default-deny: no policy is created on purpose, so anon/authenticated match zero rows even
-- if a grant is re-added by mistake.
REVOKE ALL ON TABLE sys_audit_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE sys_audit_log TO service_role;

COMMENT ON TABLE sys_audit_log IS
  'Platform audit trail (auth + security events). RLS enabled with no policies: service-role / SECURITY DEFINER access only. Server code must filter by tenant_org_id explicitly.';

-- ------------------------------------------------------------
-- Dedicated authentication audit trail: sys_auth_event_cd + sys_auth_audit_log
-- ------------------------------------------------------------
-- Authentication/session events get their own typed, insert-only table instead of the generic
-- sys_audit_log: login rows there carry tenant_org_id = NULL and have no user-membership or
-- session identity, so they cannot be queried per user/session/tenant, have no distinct
-- retention, and share a table with unrelated rows. This migration creates the table and
-- re-points the login-lockout path at it; later session-lifecycle migrations write here too.

-- Catalog of auth event codes (bilingual labels for UI rendering of the trail).
CREATE TABLE sys_auth_event_cd (
  code          TEXT PRIMARY KEY,                       -- Stable event identifier, mirrored by TypeScript constants (exact string).
  name          TEXT NOT NULL,                          -- English label shown in the activity UI.
  name2         TEXT,                                   -- Arabic label shown in the activity UI.
  description   TEXT,                                   -- English explanation of when the event is recorded.
  description2  TEXT,                                   -- Arabic explanation of when the event is recorded.
  event_group   TEXT NOT NULL
                CHECK (event_group IN ('LOGIN', 'SESSION', 'SECURITY', 'CONFIG')), -- UI grouping / filtering.
  display_order INTEGER NOT NULL DEFAULT 0,             -- Sort order within the catalog.
  is_active     BOOLEAN NOT NULL DEFAULT true,          -- false = retired code (kept so historical rows still resolve).
  rec_status    SMALLINT NOT NULL DEFAULT 1,            -- 1 = active, 0 = soft-deleted (never hard-delete).
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),     -- Row creation time.
  created_by    TEXT,                                   -- Creator identifier (user id / migration tag).
  created_info  TEXT,                                   -- Free-form creation context.
  updated_at    TIMESTAMPTZ,                            -- Last modification time.
  updated_by    TEXT,                                   -- Last modifier identifier.
  updated_info  TEXT                                    -- Free-form modification context.
);

COMMENT ON TABLE  sys_auth_event_cd IS 'Catalog of authentication/session audit event codes (global, platform-managed).';
COMMENT ON COLUMN sys_auth_event_cd.code IS 'Stable event code; referenced by sys_auth_audit_log.event_code and mirrored in lib/constants.';
COMMENT ON COLUMN sys_auth_event_cd.name IS 'English display label.';
COMMENT ON COLUMN sys_auth_event_cd.name2 IS 'Arabic display label.';
COMMENT ON COLUMN sys_auth_event_cd.description IS 'English description of when the event is recorded.';
COMMENT ON COLUMN sys_auth_event_cd.description2 IS 'Arabic description of when the event is recorded.';
COMMENT ON COLUMN sys_auth_event_cd.event_group IS 'UI grouping: LOGIN, SESSION, SECURITY or CONFIG.';
COMMENT ON COLUMN sys_auth_event_cd.display_order IS 'Sort order within the catalog.';
COMMENT ON COLUMN sys_auth_event_cd.is_active IS 'false = retired code kept for historical rows.';
COMMENT ON COLUMN sys_auth_event_cd.rec_status IS '1 = active, 0 = soft-deleted.';
COMMENT ON COLUMN sys_auth_event_cd.created_at IS 'Row creation time.';
COMMENT ON COLUMN sys_auth_event_cd.created_by IS 'Creator identifier.';
COMMENT ON COLUMN sys_auth_event_cd.created_info IS 'Creation context.';
COMMENT ON COLUMN sys_auth_event_cd.updated_at IS 'Last modification time.';
COMMENT ON COLUMN sys_auth_event_cd.updated_by IS 'Last modifier identifier.';
COMMENT ON COLUMN sys_auth_event_cd.updated_info IS 'Modification context.';

INSERT INTO sys_auth_event_cd (code, name, name2, description, description2, event_group, display_order, created_by, created_info) VALUES
  ('LOGIN_SUCCESS',           'Sign-in succeeded',          'تسجيل دخول ناجح',               'A user authenticated successfully.',                         'نجحت مصادقة المستخدم.',                         'LOGIN',    10, 'migration', '0561'),
  ('LOGIN_FAILURE',           'Sign-in failed',             'فشل تسجيل الدخول',              'A sign-in attempt was rejected (bad credentials or blocked).', 'تم رفض محاولة تسجيل الدخول.',                   'LOGIN',    20, 'migration', '0561'),
  ('ACCOUNT_LOCKED',          'Account locked',             'تم قفل الحساب',                 'Too many failed attempts triggered a temporary lockout.',    'تسبب كثرة المحاولات الفاشلة في قفل مؤقت للحساب.', 'LOGIN',    30, 'migration', '0561'),
  ('LOGOUT',                  'Signed out',                 'تسجيل الخروج',                  'The user ended their own session.',                          'أنهى المستخدم جلسته.',                           'SESSION',  40, 'migration', '0561'),
  ('SESSION_IDLE_TIMEOUT',    'Session timed out (idle)',   'انتهت الجلسة لعدم النشاط',      'The session ended after the idle-timeout period.',           'انتهت الجلسة بعد مدة عدم النشاط.',               'SESSION',  50, 'migration', '0561'),
  ('SESSION_ABSOLUTE_TIMEOUT','Session expired',            'انتهت مدة الجلسة القصوى',       'The session reached its maximum lifetime.',                  'بلغت الجلسة الحد الأقصى لمدتها.',                'SESSION',  60, 'migration', '0561'),
  ('SESSION_REVOKED',         'Session revoked',            'تم إلغاء الجلسة',               'A session was ended by the user, an admin or a policy.',     'تم إنهاء الجلسة بواسطة المستخدم أو المسؤول أو سياسة.', 'SESSION', 70, 'migration', '0561'),
  ('PASSWORD_CHANGED',        'Password changed',           'تم تغيير كلمة المرور',          'The user password was changed or reset.',                    'تم تغيير كلمة مرور المستخدم أو إعادة تعيينها.',  'SECURITY', 90, 'migration', '0561'),
  ('NEW_DEVICE',              'New device sign-in',         'تسجيل دخول من جهاز جديد',       'A sign-in came from a device not seen before for this user.', 'تم تسجيل الدخول من جهاز لم يُستخدم من قبل.',    'SECURITY', 100, 'migration', '0561'),
  ('SESSION_LIMIT_HIT',       'Session limit reached',      'تم بلوغ حد الجلسات',            'The concurrent-session limit was applied.',                  'تم تطبيق حد الجلسات المتزامنة.',                 'SECURITY', 110, 'migration', '0561'),
  ('CONFIG_CHANGED',          'Security settings changed',  'تم تغيير إعدادات الأمان',       'Authentication/session configuration was modified.',         'تم تعديل إعدادات المصادقة والجلسات.',            'CONFIG',   120, 'migration', '0561');

ALTER TABLE sys_auth_event_cd ENABLE ROW LEVEL SECURITY;

-- Catalog is non-sensitive reference data: any signed-in user may read it (UI label lookup).
CREATE POLICY auth_event_cd_read ON sys_auth_event_cd
  FOR SELECT TO authenticated
  USING (is_active = true AND rec_status = 1);
COMMENT ON POLICY auth_event_cd_read ON sys_auth_event_cd IS 'Authenticated users may read active catalog rows; no write policy (platform-managed via migrations/HQ).';

REVOKE ALL ON TABLE sys_auth_event_cd FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE sys_auth_event_cd FROM authenticated;
GRANT SELECT ON TABLE sys_auth_event_cd TO authenticated;
GRANT ALL ON TABLE sys_auth_event_cd TO service_role;

-- Insert-only trail of authentication/session events. Never updated or deleted by application
-- code (retention purge runs as the table owner in a later migration).
CREATE TABLE sys_auth_audit_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- Event identifier (also returned as log_id by record_login_attempt).
  auth_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,           -- Subject user; NULL for attempts against unknown emails; SET NULL keeps the trail if the user is deleted.
  org_user_id      UUID REFERENCES org_users_mst(id) ON DELETE SET NULL,        -- Subject's membership row in tenant_org_id when known; SET NULL keeps history if the membership is removed.
  tenant_org_id    UUID REFERENCES org_tenants_mst(id) ON DELETE SET NULL,      -- Tenant the event belongs to; NULL for pre-tenant events (failed sign-ins, multi-tenant sign-in before selection).
  auth_session_id  UUID,                                  -- Supabase auth.sessions id (JWT session_id claim); no FK because auth.sessions rows are deleted on revoke.
  event_code       TEXT NOT NULL REFERENCES sys_auth_event_cd(code),            -- What happened; see sys_auth_event_cd.
  outcome          TEXT NOT NULL
                   CHECK (outcome IN ('SUCCESS', 'FAILURE', 'DENIED')),         -- Result of the action; DENIED = blocked by policy.
  reason_code      TEXT,                                  -- Optional machine reason (e.g. end reason, failure cause).
  login_identifier TEXT,                                  -- Email typed at sign-in; kept for failures where no auth_user_id resolves.
  ip_address       INET,                                  -- Client IP as seen by the server.
  user_agent       TEXT,                                  -- Raw User-Agent header.
  device_label     TEXT,                                  -- Human-readable device summary derived from the User-Agent (e.g. "Chrome on Windows").
  details          JSONB NOT NULL DEFAULT '{}'::jsonb,    -- Event-specific context (old/new config values, limits, counters); never secrets.
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()     -- Event time (server clock); the only timestamp because rows are immutable.
);

COMMENT ON TABLE  sys_auth_audit_log IS 'Insert-only authentication/session audit trail. Written only by SECURITY DEFINER functions; users read own rows, tenant admins read their tenant rows.';
COMMENT ON COLUMN sys_auth_audit_log.id IS 'Event identifier.';
COMMENT ON COLUMN sys_auth_audit_log.auth_user_id IS 'Subject auth user; NULL when the attempt targeted an unknown email or the user was deleted.';
COMMENT ON COLUMN sys_auth_audit_log.org_user_id IS 'Subject membership row (org_users_mst.id) in tenant_org_id when known.';
COMMENT ON COLUMN sys_auth_audit_log.tenant_org_id IS 'Owning tenant; NULL for pre-tenant events.';
COMMENT ON COLUMN sys_auth_audit_log.auth_session_id IS 'Supabase session id the event relates to (no FK; sessions are deleted on revoke).';
COMMENT ON COLUMN sys_auth_audit_log.event_code IS 'Event type, FK to sys_auth_event_cd.';
COMMENT ON COLUMN sys_auth_audit_log.outcome IS 'SUCCESS, FAILURE or DENIED (blocked by policy).';
COMMENT ON COLUMN sys_auth_audit_log.reason_code IS 'Optional machine-readable reason.';
COMMENT ON COLUMN sys_auth_audit_log.login_identifier IS 'Email entered at sign-in; for failures without a resolved user.';
COMMENT ON COLUMN sys_auth_audit_log.ip_address IS 'Client IP address.';
COMMENT ON COLUMN sys_auth_audit_log.user_agent IS 'Raw User-Agent string.';
COMMENT ON COLUMN sys_auth_audit_log.device_label IS 'Readable device summary.';
COMMENT ON COLUMN sys_auth_audit_log.details IS 'Event-specific JSON context; never contains secrets.';
COMMENT ON COLUMN sys_auth_audit_log.created_at IS 'Event time (server clock).';

-- Per-user history (own activity screen, admin user activity tab), newest first.
CREATE INDEX idx_auth_audit_user_time ON sys_auth_audit_log (auth_user_id, created_at DESC);
-- Tenant-wide security feed for tenant admins, newest first.
CREATE INDEX idx_auth_audit_tenant_time ON sys_auth_audit_log (tenant_org_id, created_at DESC);
-- "Everything that happened to this session" lookups and revoke forensics.
CREATE INDEX idx_auth_audit_session ON sys_auth_audit_log (auth_session_id) WHERE auth_session_id IS NOT NULL;
-- Retention purge scans by age.
CREATE INDEX idx_auth_audit_created ON sys_auth_audit_log (created_at);
-- membership FK maintenance (ON DELETE SET NULL lookups).
CREATE INDEX idx_auth_audit_org_user ON sys_auth_audit_log (org_user_id) WHERE org_user_id IS NOT NULL;

ALTER TABLE sys_auth_audit_log ENABLE ROW LEVEL SECURITY;

-- Users may read their own trail.
CREATE POLICY auth_audit_read_own ON sys_auth_audit_log
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());
COMMENT ON POLICY auth_audit_read_own ON sys_auth_audit_log IS 'A signed-in user can read only their own authentication events.';

-- Tenant admins may read events stamped with their tenant (defense in depth: the web-admin API
-- also enforces audit:read and an explicit tenant_org_id filter).
CREATE POLICY auth_audit_read_tenant_admin ON sys_auth_audit_log
  FOR SELECT TO authenticated
  USING (tenant_org_id = current_tenant_id() AND is_admin());
COMMENT ON POLICY auth_audit_read_tenant_admin ON sys_auth_audit_log IS 'Tenant admins can read authentication events of their own tenant only.';

-- No INSERT/UPDATE/DELETE policies and no grants: the trail is append-only and written solely by
-- SECURITY DEFINER functions (owner bypasses RLS) or the service role.
REVOKE ALL ON TABLE sys_auth_audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE sys_auth_audit_log TO authenticated;
GRANT SELECT, INSERT ON TABLE sys_auth_audit_log TO service_role;

-- Single writer used by every auth/session function and server route. Resolves org_user_id from
-- (auth_user_id, tenant_org_id) when the caller does not supply it.
CREATE OR REPLACE FUNCTION fn_auth_log_event(
  p_event_code       TEXT,
  p_outcome          TEXT,
  p_auth_user_id     UUID DEFAULT NULL,
  p_tenant_org_id    UUID DEFAULT NULL,
  p_auth_session_id  UUID DEFAULT NULL,
  p_login_identifier TEXT DEFAULT NULL,
  p_ip_address       INET DEFAULT NULL,
  p_user_agent       TEXT DEFAULT NULL,
  p_device_label     TEXT DEFAULT NULL,
  p_reason_code      TEXT DEFAULT NULL,
  p_details          JSONB DEFAULT '{}'::jsonb,
  p_org_user_id      UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_org_user_id UUID := p_org_user_id;
  v_id          UUID;
BEGIN
  IF v_org_user_id IS NULL AND p_auth_user_id IS NOT NULL AND p_tenant_org_id IS NOT NULL THEN
    SELECT ou.id INTO v_org_user_id
    FROM org_users_mst ou
    WHERE ou.user_id = p_auth_user_id
      AND ou.tenant_org_id = p_tenant_org_id;
  END IF;

  INSERT INTO sys_auth_audit_log (
    auth_user_id, org_user_id, tenant_org_id, auth_session_id, event_code, outcome,
    reason_code, login_identifier, ip_address, user_agent, device_label, details
  ) VALUES (
    p_auth_user_id, v_org_user_id, p_tenant_org_id, p_auth_session_id, p_event_code, p_outcome,
    p_reason_code, p_login_identifier, p_ip_address, p_user_agent, p_device_label,
    COALESCE(p_details, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION fn_auth_log_event(TEXT, TEXT, UUID, UUID, UUID, TEXT, INET, TEXT, TEXT, TEXT, JSONB, UUID) IS
  'Single append-only writer for sys_auth_audit_log; resolves org_user_id from (user, tenant) when omitted. Service-role/definer callers only.';

-- Internal writer: API roles must never forge audit events.
REVOKE EXECUTE ON FUNCTION fn_auth_log_event(TEXT, TEXT, UUID, UUID, UUID, TEXT, INET, TEXT, TEXT, TEXT, JSONB, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_auth_log_event(TEXT, TEXT, UUID, UUID, UUID, TEXT, INET, TEXT, TEXT, TEXT, JSONB, UUID)
  TO service_role;

-- Re-create record_login_attempt with the SAME signature, return shape and lockout rules as 0005
-- (5 failures within 1 hour => 15-minute lock; thresholds move to config in a later migration)
-- but log to sys_auth_audit_log instead of sys_audit_log. A successful sign-in is stamped with the
-- user's most recently used active tenant so it appears in that tenant's activity feed.
CREATE OR REPLACE FUNCTION record_login_attempt(
  p_email         VARCHAR,
  p_success       BOOLEAN,
  p_ip_address    INET DEFAULT NULL,
  p_user_agent    TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS TABLE(log_id UUID, is_locked BOOLEAN, locked_until TIMESTAMP, lock_reason VARCHAR)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id         UUID;
  v_tenant_id       UUID;
  v_log_id          UUID;
  v_failed_attempts INTEGER;
  v_lock_until      TIMESTAMP;
  v_lock_reason     VARCHAR;
  v_is_locked       BOOLEAN := false;

  -- Configuration constants (moved to sys_auth_admin_config_cf by a later migration)
  c_max_failed_attempts CONSTANT INTEGER  := 5;
  c_lockout_duration    CONSTANT INTERVAL := INTERVAL '15 minutes';
  c_reset_window        CONSTANT INTERVAL := INTERVAL '1 hour';
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email
  LIMIT 1;

  IF p_success AND v_user_id IS NOT NULL THEN
    SELECT ou.tenant_org_id INTO v_tenant_id
    FROM org_users_mst ou
    WHERE ou.user_id = v_user_id AND ou.is_active = true
    ORDER BY ou.last_login_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  v_log_id := fn_auth_log_event(
    CASE WHEN p_success THEN 'LOGIN_SUCCESS' ELSE 'LOGIN_FAILURE' END,
    CASE WHEN p_success THEN 'SUCCESS' ELSE 'FAILURE' END,
    v_user_id, v_tenant_id, NULL, p_email::TEXT, p_ip_address, p_user_agent, NULL,
    CASE WHEN p_success THEN NULL ELSE left(p_error_message, 200) END,
    '{}'::jsonb
  );

  IF v_user_id IS NOT NULL THEN
    IF p_success THEN
      UPDATE org_users_mst
      SET failed_login_attempts = 0,
          last_failed_login_at  = NULL,
          locked_until          = NULL,
          lock_reason           = NULL,
          last_login_at         = NOW(),
          login_count           = COALESCE(login_count, 0) + 1,
          updated_at            = NOW()
      WHERE user_id = v_user_id;
    ELSE
      UPDATE org_users_mst
      SET failed_login_attempts = CASE
            WHEN last_failed_login_at IS NULL OR last_failed_login_at < NOW() - c_reset_window THEN 1
            ELSE failed_login_attempts + 1
          END,
          last_failed_login_at = NOW(),
          updated_at           = NOW()
      WHERE user_id = v_user_id
      RETURNING failed_login_attempts INTO v_failed_attempts;

      IF v_failed_attempts >= c_max_failed_attempts THEN
        v_lock_until  := NOW() + c_lockout_duration;
        v_lock_reason := format('Account locked due to %s failed login attempts', c_max_failed_attempts);
        v_is_locked   := true;

        UPDATE org_users_mst
        SET locked_until = v_lock_until,
            lock_reason  = v_lock_reason,
            updated_at   = NOW()
        WHERE user_id = v_user_id;

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

COMMENT ON FUNCTION record_login_attempt(VARCHAR, BOOLEAN, INET, TEXT, TEXT) IS
  'Records a sign-in attempt in sys_auth_audit_log and applies the failed-attempt lockout (5 in 1h => 15 min). Service-role only.';

-- switch_tenant_context() is retired: a session is bound to exactly one tenant at sign-in (one auth
-- account per tenant membership; to use another tenant the user signs out and signs in there), so
-- there is no in-session tenant switch. Its only side effect beyond a membership check was a
-- tenant_switch row in sys_audit_log, which this migration also stops producing. RESTRICT: fail
-- loudly if any database object still depends on it. Front-end callers are removed in the same change set.
DROP FUNCTION IF EXISTS switch_tenant_context(UUID) RESTRICT;


-- ------------------------------------------------------------
-- S4. Lockout / audit helper functions: service-role only
-- ------------------------------------------------------------
-- These SECURITY DEFINER functions mutate lockout state or write audit rows. They are called
-- only from server code (login route, admin tooling) using the service-role key. Previously
-- anon could call them to lock arbitrary accounts, clear a lockout via p_success=true,
-- enumerate registered emails, or forge audit entries.
REVOKE EXECUTE ON FUNCTION record_login_attempt(VARCHAR, BOOLEAN, INET, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_login_attempt(VARCHAR, BOOLEAN, INET, TEXT, TEXT)
  TO service_role;

REVOKE EXECUTE ON FUNCTION is_account_locked(VARCHAR)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION is_account_locked(VARCHAR)
  TO service_role;

REVOKE EXECUTE ON FUNCTION unlock_account(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION unlock_account(UUID, UUID, TEXT)
  TO service_role;

REVOKE EXECUTE ON FUNCTION auto_unlock_expired_accounts()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION auto_unlock_expired_accounts()
  TO service_role;

REVOKE EXECUTE ON FUNCTION log_audit_event(UUID, UUID, VARCHAR, VARCHAR, UUID, JSONB, JSONB, INET, TEXT, VARCHAR, VARCHAR, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION log_audit_event(UUID, UUID, VARCHAR, VARCHAR, UUID, JSONB, JSONB, INET, TEXT, VARCHAR, VARCHAR, TEXT)
  TO service_role;

-- ------------------------------------------------------------
-- admin_locked_accounts view: service-role only
-- ------------------------------------------------------------
-- The view lists locked accounts across tenants (emails, lock reasons); it was granted full DML
-- to anon/authenticated. Admin tooling reads it through the service role.
REVOKE ALL ON TABLE admin_locked_accounts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE admin_locked_accounts TO service_role;

-- ROLLBACK PLAN (only if a legitimate browser caller is discovered):
--   re-GRANT EXECUTE on the five functions to authenticated (never anon) and restore the
--   previous current_tenant_id() body from 0004_auth_rls.sql. Do NOT re-grant anon.
