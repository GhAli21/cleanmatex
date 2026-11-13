-- ============================================================
-- Migration: 0734_sys_users_multi_laundry.sql
-- Purpose:   One staff person can belong to many laundries. The sign-in
--            session, not a unique auth user, chooses the laundry.
--            Dropping UNIQUE(user_id) and replacing current_tenant_id()
--            are one change: an old LIMIT 1 would otherwise pick an
--            arbitrary laundry.
-- Affected:  sys_users_mst, org_users_mst, sys_auth_user_sessions_mst,
--            sys_auth_event_cd, sys_auth_sess_end_rsn_cd,
--            current_tenant_id, fn_auth_session_end_internal,
--            fn_auth_session_validate, fn_auth_session_register,
--            fn_auth_sessions_sweep, record_login_attempt,
--            fn_auth_resolve_login_identifier, fn_org_user_code_next,
--            hq_permissions, hq_navigation_cd
-- Related:   0563 (one membership per auth user), 0570 (lockout catalog),
--            0575 (session registry), 0581 (must_change_password),
--            0602 (hq_permissions), 0701 (hq_navigation_cd)
-- Not applied by the agent. Review, then apply.
-- Customers (sys_person_mst) are not in this file.
-- ============================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- ------------------------------------------------------------
-- Person. No tenant. Id is born equal to auth.users.id so
-- existing user_id columns stay one lookup. No FK to auth.users:
-- a later identity provider keeps this id and changes idp_subject.
-- ------------------------------------------------------------
CREATE TABLE sys_users_mst (
  id                    UUID PRIMARY KEY,
  email                 TEXT,
  phone_e164            TEXT,
  user_code             TEXT NOT NULL,
  name                  TEXT,
  name2                 TEXT,
  idp_provider          TEXT NOT NULL DEFAULT 'supabase',
  idp_subject           TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'ACTIVE',
  is_globally_locked    BOOLEAN NOT NULL DEFAULT false,
  globally_locked_at    TIMESTAMPTZ,
  globally_locked_by    UUID,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  last_failed_login_at  TIMESTAMPTZ,
  attack_locked_until   TIMESTAMPTZ,
  attack_lock_reason    TEXT,
  last_chosen_tenant_id UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            TEXT,
  created_info          TEXT,
  updated_at            TIMESTAMPTZ,
  updated_by            TEXT,
  updated_info          TEXT,
  CONSTRAINT chk_sys_users_status CHECK (status = 'ACTIVE'),
  CONSTRAINT chk_sys_users_email CHECK (email IS NULL OR email = lower(btrim(email))),
  CONSTRAINT chk_sys_users_phone CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  CONSTRAINT chk_sys_users_code CHECK (user_code ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$'),
  CONSTRAINT chk_sys_users_attempts CHECK (failed_login_attempts >= 0),
  CONSTRAINT fk_sys_users_hint_tenant FOREIGN KEY (last_chosen_tenant_id) REFERENCES org_tenants_mst (id) ON DELETE SET NULL
);

COMMENT ON TABLE sys_users_mst IS 'Portable staff person. One row per human login. Memberships live on org_users_mst. No password and no tenant.';
COMMENT ON COLUMN sys_users_mst.id IS 'Stable person id. Set equal to auth.users.id at insert while Supabase is the provider.';
COMMENT ON COLUMN sys_users_mst.email IS 'Sign-in email, trimmed and lower-cased. NULL when the person has no mailbox. Unique when set.';
COMMENT ON COLUMN sys_users_mst.phone_e164 IS 'Verified login mobile in E.164. NULL until verified. Not a laundry contact number.';
COMMENT ON COLUMN sys_users_mst.user_code IS 'Global sign-in code, one per person. Case-insensitive unique. Moved off the membership so two laundries can share it.';
COMMENT ON COLUMN sys_users_mst.name IS 'English display name copied from the membership at backfill. Not a link key.';
COMMENT ON COLUMN sys_users_mst.name2 IS 'Arabic display name. Not a link key.';
COMMENT ON COLUMN sys_users_mst.idp_provider IS 'Identity provider key. Today supabase. A later provider changes this and idp_subject, not this id.';
COMMENT ON COLUMN sys_users_mst.idp_subject IS 'Subject at the current provider. Today the same uuid as id, stored as text.';
COMMENT ON COLUMN sys_users_mst.status IS 'ACTIVE. Reserved so a later status does not require a new column. Inactive membership is not a person status.';
COMMENT ON COLUMN sys_users_mst.is_globally_locked IS 'HQ lock. While true, every laundry is denied, including unlocked memberships.';
COMMENT ON COLUMN sys_users_mst.globally_locked_at IS 'When the HQ lock was set. NULL while unlocked.';
COMMENT ON COLUMN sys_users_mst.globally_locked_by IS 'HQ actor uuid who set the global lock. NULL while unlocked.';
COMMENT ON COLUMN sys_users_mst.failed_login_attempts IS 'One password-attack counter for every laundry. A per-membership counter would reset the budget.';
COMMENT ON COLUMN sys_users_mst.last_failed_login_at IS 'Time of the last failed password attempt. Drives the counting window.';
COMMENT ON COLUMN sys_users_mst.attack_locked_until IS 'Password-attack lock expiry. NULL when not attack-locked. Distinct from the HQ lock and the membership lock.';
COMMENT ON COLUMN sys_users_mst.attack_lock_reason IS 'Why the attack lock was set. No password and no token.';
COMMENT ON COLUMN sys_users_mst.last_chosen_tenant_id IS 'Hint for which laundry to highlight in the picker. Never the session authority.';
COMMENT ON COLUMN sys_users_mst.created_at IS 'Row creation time.';
COMMENT ON COLUMN sys_users_mst.created_by IS 'Creator identifier. Backfill uses migration_0734.';
COMMENT ON COLUMN sys_users_mst.created_info IS 'Creation context.';
COMMENT ON COLUMN sys_users_mst.updated_at IS 'Last modification time.';
COMMENT ON COLUMN sys_users_mst.updated_by IS 'Last modifier identifier.';
COMMENT ON COLUMN sys_users_mst.updated_info IS 'Modification context.';
COMMENT ON CONSTRAINT chk_sys_users_status ON sys_users_mst IS 'Person row stays ACTIVE. Laundry access is the membership is_active flag.';
COMMENT ON CONSTRAINT chk_sys_users_email ON sys_users_mst IS 'Stored email is already trimmed and lower-cased so the unique index cannot be bypassed by case.';
COMMENT ON CONSTRAINT chk_sys_users_phone ON sys_users_mst IS 'Stored phone is E.164. Unverified numbers stay NULL and are not identity keys.';
COMMENT ON CONSTRAINT chk_sys_users_code ON sys_users_mst IS 'Same user_code shape as 0563: 3-30 chars, no @.';
COMMENT ON CONSTRAINT chk_sys_users_attempts ON sys_users_mst IS 'The attack counter cannot go negative.';
COMMENT ON CONSTRAINT fk_sys_users_hint_tenant ON sys_users_mst IS 'Optional highlight hint. SET NULL if that organization is removed. Not used by current_tenant_id().';

CREATE UNIQUE INDEX uq_sys_users_email ON sys_users_mst (email) WHERE email IS NOT NULL;
COMMENT ON INDEX uq_sys_users_email IS 'One person per normalized email. The create-screen race backstop.';

CREATE UNIQUE INDEX uq_sys_users_phone ON sys_users_mst (phone_e164) WHERE phone_e164 IS NOT NULL;
COMMENT ON INDEX uq_sys_users_phone IS 'One person per verified E.164 mobile. The create-screen race backstop.';

CREATE UNIQUE INDEX uq_sys_users_code_lower ON sys_users_mst (lower(user_code));
COMMENT ON INDEX uq_sys_users_code_lower IS 'Case-insensitive sign-in code lookup. One code per person, shared by every membership.';

ALTER TABLE sys_users_mst ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE sys_users_mst FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE sys_users_mst TO service_role;

-- One person per existing membership. 0563 still guarantees one membership per auth user here.
-- Phone stays NULL: a membership phone is not a verified login mobile.
INSERT INTO sys_users_mst (
  id, email, phone_e164, user_code, name, name2, idp_provider, idp_subject,
  failed_login_attempts, last_failed_login_at, attack_locked_until, attack_lock_reason,
  created_by, created_info
)
SELECT
  ou.user_id,
  NULLIF(lower(btrim(au.email::TEXT)), ''),
  NULL,
  ou.user_code,
  ou.name,
  ou.name2,
  'supabase',
  ou.user_id::TEXT,
  COALESCE(ou.failed_login_attempts, 0),
  ou.last_failed_login_at,
  ou.locked_until,
  ou.lock_reason,
  'migration_0734',
  'Backfill from the single membership. Phone is left NULL because membership phone is not a verified login mobile.'
FROM org_users_mst ou
JOIN auth.users au ON au.id = ou.user_id;

DO $$
DECLARE
  v_missing INTEGER;
BEGIN
  SELECT count(*) INTO v_missing
  FROM org_users_mst ou
  WHERE NOT EXISTS (SELECT 1 FROM sys_users_mst su WHERE su.id = ou.user_id);
  IF v_missing > 0 THEN
    RAISE EXCEPTION '0734: % memberships have no sys_users_mst row', v_missing;
  END IF;
END $$;

-- Membership lock removes one laundry. Old locked_until stays historical attack-lock data.
ALTER TABLE org_users_mst
  ADD COLUMN is_membership_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN membership_locked_at TIMESTAMPTZ,
  ADD COLUMN membership_locked_by UUID;

COMMENT ON COLUMN org_users_mst.is_membership_locked IS 'Admin lock for this laundry only. Other memberships of the same person stay usable.';
COMMENT ON COLUMN org_users_mst.membership_locked_at IS 'When this membership was locked. NULL while unlocked.';
COMMENT ON COLUMN org_users_mst.membership_locked_by IS 'Actor who locked this membership. NULL while unlocked.';

CREATE INDEX idx_ou_user_active ON org_users_mst (user_id, is_active);
COMMENT ON INDEX idx_ou_user_active IS 'Eligible-laundry lookup for one person. The picker reads id, tenant, and name only.';

-- The person now owns the code. Two memberships must not collide on a global unique here.
DROP INDEX uq_org_users_user_code_lower;

-- Same migration as the current_tenant_id() replacement below.
ALTER TABLE org_users_mst DROP CONSTRAINT uq_org_users_mst_user_id;

-- ------------------------------------------------------------
-- A session may be pending: person known, laundry not chosen.
-- ------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'sys_auth_user_sessions_mst'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE sys_auth_user_sessions_mst DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE sys_auth_user_sessions_mst ALTER COLUMN tenant_org_id DROP NOT NULL;

ALTER TABLE sys_auth_user_sessions_mst
  ADD CONSTRAINT chk_auth_sess_status CHECK (status IN ('ACTIVE', 'PENDING', 'ENDED'));
ALTER TABLE sys_auth_user_sessions_mst
  ADD CONSTRAINT chk_auth_sess_ended_shape CHECK (
    (status = 'ACTIVE' AND tenant_org_id IS NOT NULL AND org_user_id IS NOT NULL AND end_reason_code IS NULL AND ended_at IS NULL)
    OR (status = 'PENDING' AND tenant_org_id IS NULL AND org_user_id IS NULL AND end_reason_code IS NULL AND ended_at IS NULL)
    OR (status = 'ENDED' AND end_reason_code IS NOT NULL AND ended_at IS NOT NULL)
  );

COMMENT ON COLUMN sys_auth_user_sessions_mst.tenant_org_id IS 'Laundry bound for an ACTIVE session. NULL while PENDING, before a laundry is chosen.';
COMMENT ON COLUMN sys_auth_user_sessions_mst.status IS 'PENDING = password accepted, laundry not chosen. ACTIVE = one laundry until logout. ENDED = closed.';
COMMENT ON CONSTRAINT chk_auth_sess_status ON sys_auth_user_sessions_mst IS 'PENDING is the only pre-laundry state. Business RLS treats it as no tenant.';
COMMENT ON CONSTRAINT chk_auth_sess_ended_shape ON sys_auth_user_sessions_mst IS 'ACTIVE has a membership and no end data. PENDING has neither laundry nor end data. ENDED has an end reason and time.';

CREATE INDEX idx_auth_sess_pend_exp ON sys_auth_user_sessions_mst (expires_at) WHERE status = 'PENDING';
COMMENT ON INDEX idx_auth_sess_pend_exp IS 'Sweep of abandoned pickers whose short expiry has passed.';

INSERT INTO sys_auth_sess_end_rsn_cd (code, name, name2, description, description2, display_order, created_by, created_info)
VALUES
  ('MEMBERSHIP_LOCKED', 'Membership locked', 'قفل العضوية', 'This laundry locked the membership.', 'قفلت هذه المنشأة العضوية.', 110, 'migration_0734', '0734'),
  ('GLOBAL_LOCK', 'Locked by HQ', 'قفل إدارة المنصة', 'HQ locked the person for every laundry.', 'قفلت إدارة المنصة الشخص في كل المنشآت.', 120, 'migration_0734', '0734'),
  ('ATTACK_LOCK', 'Password attack lock', 'قفل محاولات كلمة المرور', 'Too many failed password attempts.', 'محاولات كلمة مرور فاشلة أكثر من الحد.', 130, 'migration_0734', '0734')
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_auth_event_cd (code, name, name2, description, description2, event_group, display_order, created_by, created_info)
VALUES
  ('MEMBERSHIP_ATTACHED', 'Membership added', 'إضافة عضوية', 'An existing person was added to a laundry.', 'أُضيف شخص موجود إلى منشأة.', 'SECURITY', 130, 'migration_0734', '0734'),
  ('MEMBERSHIP_REACTIVATED', 'Membership reactivated', 'إعادة تفعيل العضوية', 'An inactive membership at this laundry was turned back on.', 'أُعيد تفعيل عضوية متوقفة في هذه المنشأة.', 'SECURITY', 140, 'migration_0734', '0734'),
  ('MEMBERSHIP_DEACTIVATED', 'Membership deactivated', 'إيقاف العضوية', 'This laundry turned the membership off. Other laundries are unchanged.', 'أوقفت هذه المنشأة العضوية. المنشآت الأخرى لم تتغير.', 'SECURITY', 150, 'migration_0734', '0734'),
  ('MEMBERSHIP_LOCKED', 'Membership locked', 'قفل العضوية', 'This laundry locked the membership.', 'قفلت هذه المنشأة العضوية.', 'SECURITY', 160, 'migration_0734', '0734'),
  ('MEMBERSHIP_UNLOCKED', 'Membership unlocked', 'فتح العضوية', 'This laundry unlocked the membership.', 'فتحت هذه المنشأة العضوية.', 'SECURITY', 170, 'migration_0734', '0734'),
  ('USER_LOCKED_GLOBAL', 'Person locked by HQ', 'قفل الشخص من إدارة المنصة', 'HQ denied every laundry.', 'منعت إدارة المنصة كل المنشآت.', 'SECURITY', 180, 'migration_0734', '0734'),
  ('USER_UNLOCKED_GLOBAL', 'Person unlocked by HQ', 'فتح الشخص من إدارة المنصة', 'HQ cleared the global lock. A laundry lock can still apply.', 'أزالت إدارة المنصة القفل العام. قد يبقى قفل منشأة.', 'SECURITY', 190, 'migration_0734', '0734'),
  ('ACCOUNT_UNLOCKED', 'Attack lock cleared', 'إزالة قفل المحاولات', 'HQ cleared the password-attack lock for every laundry.', 'أزالت إدارة المنصة قفل محاولات كلمة المرور لكل المنشآت.', 'LOGIN', 35, 'migration_0734', '0734'),
  ('LAUNDRY_CHOSEN', 'Laundry chosen', 'اختيار المنشأة', 'The person bound this sign-in to one laundry.', 'ربط الشخص تسجيل الدخول بمنشأة واحدة.', 'SESSION', 45, 'migration_0734', '0734')
ON CONFLICT (code) DO NOTHING;

-- LOGIN_FAILURE and ACCOUNT_LOCKED already exist from 0561. They stay the failed-attempt codes.

-- Pending rows must be endable. The 0575 helper only matched ACTIVE, so a global lock could not close a picker.
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
    AND status IN ('ACTIVE', 'PENDING')
  RETURNING * INTO v_row;

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

COMMENT ON FUNCTION fn_auth_session_end_internal(UUID, TEXT, UUID) IS 'Ends one ACTIVE or PENDING session, deletes the Supabase auth session, and writes the audit row. Idempotent. Internal helper.';

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_sid UUID;
BEGIN
  BEGIN
    v_sid := NULLIF(auth.jwt() ->> 'session_id', '')::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
  END;

  IF auth.uid() IS NULL OR v_sid IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT s.tenant_org_id
    FROM sys_auth_user_sessions_mst s
    JOIN org_users_mst ou
      ON ou.id = s.org_user_id
     AND ou.user_id = s.auth_user_id
     AND ou.tenant_org_id = s.tenant_org_id
     AND ou.is_active = true
     AND ou.is_membership_locked = false
    JOIN sys_users_mst su
      ON su.id = s.auth_user_id
     AND su.is_globally_locked = false
     AND (su.attack_locked_until IS NULL OR su.attack_locked_until <= now())
    WHERE s.auth_session_id = v_sid
      AND s.auth_user_id = auth.uid()
      AND s.status = 'ACTIVE'
  );
END;
$$;

COMMENT ON FUNCTION current_tenant_id() IS 'RLS tenant = the caller ACTIVE session laundry. PENDING, a locked membership, a global lock, and an attack lock return NULL. JWT tenant claims are ignored.';

CREATE OR REPLACE FUNCTION fn_auth_sessions_revoke_person(
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

COMMENT ON FUNCTION fn_auth_sessions_revoke_person(UUID, TEXT, UUID) IS 'Ends every ACTIVE and PENDING session of one person, in every laundry. Used by the global lock, the attack lock, and a password change.';
REVOKE EXECUTE ON FUNCTION fn_auth_sessions_revoke_person(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_auth_sessions_revoke_person(UUID, TEXT, UUID) TO service_role;

CREATE OR REPLACE FUNCTION fn_sys_users_lock_revoke()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_globally_locked = true AND OLD.is_globally_locked = false THEN
    PERFORM fn_auth_sessions_revoke_person(NEW.id, 'GLOBAL_LOCK', NEW.globally_locked_by);
  END IF;
  IF NEW.attack_locked_until IS NOT NULL
     AND NEW.attack_locked_until > now()
     AND NEW.attack_locked_until IS DISTINCT FROM OLD.attack_locked_until THEN
    PERFORM fn_auth_sessions_revoke_person(NEW.id, 'ATTACK_LOCK', NULL);
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_sys_users_lock_revoke() IS 'When HQ locks the person, or a password-attack lock is set, every laundry session ends in that same statement.';
REVOKE EXECUTE ON FUNCTION fn_sys_users_lock_revoke() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_sys_users_lock_revoke
  AFTER UPDATE OF is_globally_locked, attack_locked_until ON sys_users_mst
  FOR EACH ROW
  EXECUTE FUNCTION fn_sys_users_lock_revoke();
COMMENT ON TRIGGER trg_sys_users_lock_revoke ON sys_users_mst IS 'Global lock and attack lock sign the person out of every laundry.';

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

  IF OLD.is_membership_locked = false AND NEW.is_membership_locked = true THEN
    PERFORM fn_auth_sessions_revoke(NEW.user_id, NEW.tenant_org_id, 'MEMBERSHIP_LOCKED', NULL, NEW.membership_locked_by);
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_org_users_revoke_sessions() IS 'Ends sessions of this membership only. Another laundry of the same person is a different tenant_org_id and is left alone.';

DROP TRIGGER trg_org_users_revoke_sessions ON org_users_mst;
CREATE TRIGGER trg_org_users_revoke_sessions
  AFTER UPDATE OF is_active, is_membership_locked OR DELETE ON org_users_mst
  FOR EACH ROW
  EXECUTE FUNCTION fn_org_users_revoke_sessions();
COMMENT ON TRIGGER trg_org_users_revoke_sessions ON org_users_mst IS 'Ends this laundry''s sessions when the membership is deactivated, locked, or removed.';

-- Binds a laundry only when exactly one eligible membership exists.
-- More than one returns CHOOSE_LAUNDRY and inserts nothing.
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
    AND ou.is_active = true
    AND ou.is_membership_locked = false
    AND COALESCE(t.is_active, true) = true
    AND COALESCE(t.status, '') NOT IN ('suspended', 'SUSPENDED', 'inactive', 'INACTIVE');

  IF v_eligible = 0 THEN
    RETURN QUERY SELECT 'NO_MEMBERSHIP', NULL::UUID, NULL::UUID, false, false, 0, 0, NULL::TIMESTAMPTZ, 0;
    RETURN;
  END IF;

  IF v_eligible > 1 THEN
    RETURN QUERY SELECT 'CHOOSE_LAUNDRY', NULL::UUID, NULL::UUID, false, false, 0, 0, NULL::TIMESTAMPTZ, 0;
    RETURN;
  END IF;

  SELECT ou.* INTO v_member
  FROM org_users_mst ou
  JOIN org_tenants_mst t ON t.id = ou.tenant_org_id
  WHERE ou.user_id = p_auth_user_id
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

COMMENT ON FUNCTION fn_auth_session_register(UUID, UUID, BOOLEAN, INET, TEXT, TEXT, TEXT) IS 'Binds a session only when the person has exactly one eligible laundry. CHOOSE_LAUNDRY inserts nothing. LOCKED denies a global or attack lock. Service role only.';

CREATE OR REPLACE FUNCTION fn_auth_session_validate(p_touch BOOLEAN DEFAULT false, p_ip_address INET DEFAULT NULL)
RETURNS TABLE(
  state                  TEXT,
  end_reason             TEXT,
  tenant_org_id          UUID,
  idle_remaining_sec     INTEGER,
  absolute_remaining_sec INTEGER,
  idle_warning_sec       INTEGER,
  must_change_password   BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_sid    UUID;
  v_uid    UUID := auth.uid();
  v_row    sys_auth_user_sessions_mst%ROWTYPE;
  v_must   BOOLEAN;
  v_locked BOOLEAN;
  v_global BOOLEAN;
  v_attack BOOLEAN;
  v_idle_remaining INTEGER;
  v_abs_remaining  INTEGER;
BEGIN
  BEGIN
    v_sid := NULLIF(auth.jwt() ->> 'session_id', '')::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    v_sid := NULL;
  END;

  IF v_uid IS NULL OR v_sid IS NULL THEN
    RETURN QUERY SELECT 'NO_SESSION', NULL::TEXT, NULL::UUID, NULL::INTEGER, NULL::INTEGER, NULL::INTEGER, false;
    RETURN;
  END IF;

  SELECT * INTO v_row
  FROM sys_auth_user_sessions_mst s
  WHERE s.auth_session_id = v_sid AND s.auth_user_id = v_uid;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_REGISTERED', NULL::TEXT, NULL::UUID, NULL::INTEGER, NULL::INTEGER, NULL::INTEGER, false;
    RETURN;
  END IF;

  IF v_row.status = 'ENDED' THEN
    RETURN QUERY SELECT 'ENDED', v_row.end_reason_code, v_row.tenant_org_id, 0, 0, v_row.idle_warning_sec, false;
    RETURN;
  END IF;

  IF v_row.status = 'PENDING' THEN
    IF now() >= v_row.expires_at THEN
      PERFORM fn_auth_session_end_internal(v_sid, 'ABSOLUTE_TIMEOUT', NULL);
      RETURN QUERY SELECT 'ENDED', 'ABSOLUTE_TIMEOUT', NULL::UUID, 0, 0, v_row.idle_warning_sec, false;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'PENDING', NULL::TEXT, NULL::UUID, NULL::INTEGER, NULL::INTEGER, v_row.idle_warning_sec, false;
    RETURN;
  END IF;

  SELECT su.is_globally_locked,
         (su.attack_locked_until IS NOT NULL AND su.attack_locked_until > now())
    INTO v_global, v_attack
  FROM sys_users_mst su
  WHERE su.id = v_uid;

  IF COALESCE(v_global, false) THEN
    PERFORM fn_auth_session_end_internal(v_sid, 'GLOBAL_LOCK', NULL);
    RETURN QUERY SELECT 'ENDED', 'GLOBAL_LOCK', v_row.tenant_org_id, 0, 0, v_row.idle_warning_sec, false;
    RETURN;
  END IF;

  IF COALESCE(v_attack, false) THEN
    PERFORM fn_auth_session_end_internal(v_sid, 'ATTACK_LOCK', NULL);
    RETURN QUERY SELECT 'ENDED', 'ATTACK_LOCK', v_row.tenant_org_id, 0, 0, v_row.idle_warning_sec, false;
    RETURN;
  END IF;

  SELECT ou.pwd_must_change, ou.is_membership_locked
    INTO v_must, v_locked
  FROM org_users_mst ou
  WHERE ou.id = v_row.org_user_id
    AND ou.user_id = v_uid
    AND ou.tenant_org_id = v_row.tenant_org_id
    AND ou.is_active = true;

  IF NOT FOUND THEN
    PERFORM fn_auth_session_end_internal(v_sid, 'USER_DEACTIVATED', NULL);
    RETURN QUERY SELECT 'ENDED', 'USER_DEACTIVATED', v_row.tenant_org_id, 0, 0, v_row.idle_warning_sec, false;
    RETURN;
  END IF;

  IF v_locked THEN
    PERFORM fn_auth_session_end_internal(v_sid, 'MEMBERSHIP_LOCKED', NULL);
    RETURN QUERY SELECT 'ENDED', 'MEMBERSHIP_LOCKED', v_row.tenant_org_id, 0, 0, v_row.idle_warning_sec, false;
    RETURN;
  END IF;

  IF now() >= v_row.expires_at THEN
    PERFORM fn_auth_session_end_internal(v_sid, 'ABSOLUTE_TIMEOUT', NULL);
    RETURN QUERY SELECT 'ENDED', 'ABSOLUTE_TIMEOUT', v_row.tenant_org_id, 0, 0, v_row.idle_warning_sec, false;
    RETURN;
  END IF;

  IF v_row.idle_timeout_sec > 0 AND now() >= v_row.last_activity_at + make_interval(secs => v_row.idle_timeout_sec) THEN
    PERFORM fn_auth_session_end_internal(v_sid, 'IDLE_TIMEOUT', NULL);
    RETURN QUERY SELECT 'ENDED', 'IDLE_TIMEOUT', v_row.tenant_org_id, 0, 0, v_row.idle_warning_sec, false;
    RETURN;
  END IF;

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

  RETURN QUERY SELECT 'ACTIVE', NULL::TEXT, v_row.tenant_org_id, v_idle_remaining, v_abs_remaining, v_row.idle_warning_sec,
                      COALESCE(v_must, false);
END;
$$;

COMMENT ON FUNCTION fn_auth_session_validate(BOOLEAN, INET) IS 'Validates the caller session. PENDING has no tenant and is not a business session. ACTIVE requires an unlocked membership and an unlocked person. must_change_password is unchanged from 0581.';

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
             WHEN s.status = 'PENDING' THEN 'ABSOLUTE_TIMEOUT'
             WHEN s.expires_at <= now() THEN 'ABSOLUTE_TIMEOUT'
             WHEN s.idle_timeout_sec > 0
                  AND s.last_activity_at + make_interval(secs => s.idle_timeout_sec) <= now() THEN 'IDLE_TIMEOUT'
             ELSE 'SECURITY'
           END
    FROM sys_auth_user_sessions_mst s
    WHERE (
        s.status = 'ACTIVE'
        AND (
          s.expires_at <= now()
          OR (s.idle_timeout_sec > 0 AND s.last_activity_at + make_interval(secs => s.idle_timeout_sec) <= now())
          OR NOT EXISTS (SELECT 1 FROM auth.sessions a WHERE a.id = s.auth_session_id)
        )
      )
      OR (s.status = 'PENDING' AND s.expires_at <= now())
  LOOP
    IF fn_auth_session_end_internal(v_sid, v_why, NULL) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  DELETE FROM sys_auth_user_sessions_mst
  WHERE status = 'ENDED' AND ended_at < now() - make_interval(days => p_retention_days);

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION fn_auth_sessions_sweep(INTEGER) IS 'Ends expired ACTIVE sessions and abandoned PENDING pickers, then purges old ENDED rows. A pending row is not treated as a missing Supabase session.';

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
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id         UUID;
  v_log_id          UUID;
  v_failed_attempts INTEGER;
  v_lock_until      TIMESTAMP;
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

COMMENT ON FUNCTION record_login_attempt(VARCHAR, BOOLEAN, INET, TEXT, TEXT) IS 'One attack counter on sys_users_mst for every laundry. Thresholds still come from AUTH_LOCKOUT_*. Setting attack_locked_until fires the person-wide session revoke. Service role only.';

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
  v_person sys_users_mst%ROWTYPE;
  v_count INTEGER;
BEGIN
  IF v_ident = '' THEN
    RETURN;
  END IF;

  IF position('@' IN v_ident) > 0 THEN
    SELECT * INTO v_person FROM sys_users_mst su WHERE su.email = lower(v_ident);
  ELSIF left(v_ident, 1) = '+' OR v_ident ~ '^[0-9]+$' THEN
    SELECT * INTO v_person FROM sys_users_mst su WHERE su.phone_e164 = v_ident;
  ELSE
    SELECT * INTO v_person FROM sys_users_mst su WHERE lower(su.user_code) = lower(v_ident);
  END IF;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_count
  FROM org_users_mst ou
  JOIN org_tenants_mst t ON t.id = ou.tenant_org_id
  WHERE ou.user_id = v_person.id
    AND ou.is_active = true
    AND ou.is_membership_locked = false
    AND COALESCE(t.is_active, true) = true
    AND COALESCE(t.status, '') NOT IN ('suspended', 'SUSPENDED', 'inactive', 'INACTIVE');

  IF v_count = 1 THEN
    RETURN QUERY
    SELECT v_person.id, v_person.email, ou.id, ou.tenant_org_id, ou.is_active, v_person.user_code
    FROM org_users_mst ou
    JOIN org_tenants_mst t ON t.id = ou.tenant_org_id
    WHERE ou.user_id = v_person.id
      AND ou.is_active = true
      AND ou.is_membership_locked = false
      AND COALESCE(t.is_active, true) = true
      AND COALESCE(t.status, '') NOT IN ('suspended', 'SUSPENDED', 'inactive', 'INACTIVE');
    RETURN;
  END IF;

  RETURN QUERY
  SELECT v_person.id, v_person.email, NULL::UUID, NULL::UUID, true, v_person.user_code;
END;
$$;

COMMENT ON FUNCTION fn_auth_resolve_login_identifier(TEXT) IS 'Resolves email, E.164 mobile, or user_code to one person. Returns the membership only when exactly one laundry is eligible. Unknown identifiers return no row. Service role only.';

CREATE OR REPLACE FUNCTION fn_org_user_code_next()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code TEXT;
BEGIN
  LOOP
    v_code := 'U' || lpad(nextval('org_user_code_seq')::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM sys_users_mst su WHERE lower(su.user_code) = lower(v_code)
      UNION ALL
      SELECT 1 FROM org_users_mst ou WHERE lower(ou.user_code) = lower(v_code)
    );
  END LOOP;
  RETURN v_code;
END;
$$;

COMMENT ON FUNCTION fn_org_user_code_next() IS 'Next unused U-code. Skips codes already stored on the person or still present on a membership row. Definer so the person-table check works for the column default.';

CREATE OR REPLACE FUNCTION fn_auth_own_laundries()
RETURNS TABLE (
  org_user_id   UUID,
  tenant_org_id UUID,
  laundry_name  TEXT,
  laundry_name2 TEXT
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

COMMENT ON FUNCTION fn_auth_own_laundries() IS 'Picker list for the signed-in person only. Returns membership id, tenant id, and the organization name. It is not a staff directory.';
REVOKE EXECUTE ON FUNCTION fn_auth_own_laundries() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_auth_own_laundries() TO authenticated, service_role;

INSERT INTO hq_permissions (
  permission_code, permission_name, permission_name_ar,
  resource_code, action_code, is_system, is_active, created_info
)
VALUES
  ('hq_org_users:read', 'Read organization users', 'عرض مستخدمي المنشآت', 'hq_org_users', 'read', true, true, '0734 org users workspace'),
  ('hq_org_users:lock', 'Lock organization users', 'قفل مستخدمي المنشآت', 'hq_org_users', 'lock', true, true, '0734 org users workspace'),
  ('hq_org_users:attach', 'Attach organization users', 'ربط مستخدمي المنشآت', 'hq_org_users', 'attach', true, true, '0734 org users workspace')
ON CONFLICT (permission_code) DO NOTHING;

INSERT INTO hq_role_permissions (role_code, permission_code, created_info)
SELECT DISTINCT rp.role_code, seed.code, '0734 roles that already manage tenants'
FROM hq_role_permissions rp
CROSS JOIN (
  VALUES ('hq_org_users:read'), ('hq_org_users:lock'), ('hq_org_users:attach')
) AS seed(code)
WHERE rp.permission_code IN ('tenant_users.manage', 'tenants.manage', '*')
ON CONFLICT (role_code, permission_code) DO NOTHING;

INSERT INTO hq_navigation_cd (
  nav_code, parent_nav_code, section_code, label, label2, description, description2,
  nav_path, nav_icon, main_permission_code, nav_level, display_order,
  is_leaf, is_navigable, is_active, is_system, metadata, rec_status, created_by
)
VALUES (
  'hq_org_users',
  NULL,
  'tenant_gov',
  'Organization Users',
  'مستخدمو المنشآت',
  'Search one staff person and see every laundry membership. HQ lock and attach live here.',
  'ابحث عن موظف واحد واعرض عضويته في كل منشأة. القفل العام والربط هنا.',
  '/org-users-manage',
  'Users',
  'hq_org_users:read',
  1,
  115,
  true,
  true,
  true,
  true,
  '{"detail_path": "/org-users-manage/[personId]", "workspace": true}'::jsonb,
  1,
  'migration_0734'
)
ON CONFLICT (nav_code) DO UPDATE SET
  parent_nav_code = EXCLUDED.parent_nav_code,
  section_code = EXCLUDED.section_code,
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  nav_path = EXCLUDED.nav_path,
  nav_icon = EXCLUDED.nav_icon,
  main_permission_code = EXCLUDED.main_permission_code,
  nav_level = EXCLUDED.nav_level,
  display_order = EXCLUDED.display_order,
  is_leaf = EXCLUDED.is_leaf,
  is_navigable = EXCLUDED.is_navigable,
  is_active = EXCLUDED.is_active,
  metadata = EXCLUDED.metadata,
  updated_at = now(),
  updated_by = 'migration_0734',
  updated_count = COALESCE(hq_navigation_cd.updated_count, 0) + 1;

COMMIT;
