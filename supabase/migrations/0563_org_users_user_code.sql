-- ============================================================
-- Migration: 0563_org_users_user_code.sql
-- Purpose:   Identity model for the User Session Lifecycle program:
--            * one auth account per tenant membership (a session is bound to exactly one tenant;
--              to use another tenant the user signs out and signs in with that tenant's account);
--            * a platform-wide unique, human-friendly user_code that can be used to sign in
--              instead of an email;
--            * current_tenant_id() becomes a pure membership lookup (JWT / user_metadata claims
--              are no longer consulted);
--            * a service-role-only resolver that maps a typed sign-in identifier (email or
--              user_code) to the auth account;
--            * automatic audit of user_code changes in sys_auth_audit_log.
-- Affected:  org_users_mst, current_tenant_id(), sys_auth_event_cd,
--            new: org_user_code_seq, fn_org_user_code_next(), fn_auth_resolve_login_identifier(),
--                 fn_org_users_user_code_audit() + trigger
-- Related:   0561 (auth hardening, sys_auth_audit_log / fn_auth_log_event)
-- ============================================================

-- ------------------------------------------------------------
-- Pre-check: one auth account may belong to only one tenant
-- ------------------------------------------------------------
-- The new UNIQUE (user_id) below would fail on multi-tenant users; fail early with a clear message
-- (at the time of writing the data has 0 such users) so the owner can split the accounts first.
DO $$
DECLARE
  v_dupes INTEGER;
BEGIN
  SELECT count(*) INTO v_dupes
  FROM (SELECT user_id FROM org_users_mst GROUP BY user_id HAVING count(*) > 1) d;

  IF v_dupes > 0 THEN
    RAISE EXCEPTION
      '0563 aborted: % auth user(s) belong to more than one tenant in org_users_mst. Split them into one auth account per tenant before applying.',
      v_dupes;
  END IF;
END
$$;

-- ------------------------------------------------------------
-- user_code generation
-- ------------------------------------------------------------
-- Source of auto-generated user codes ('U' + zero-padded number). Not reused or reset: gaps are fine.
CREATE SEQUENCE org_user_code_seq START WITH 1 INCREMENT BY 1 NO CYCLE;
COMMENT ON SEQUENCE org_user_code_seq IS
  'Counter behind auto-generated org_users_mst.user_code values (U000001, U000002, ...).';

-- Returns the next unused auto-generated user code. Loops past codes that an admin already chose
-- manually (e.g. a hand-typed "U000007") so generation can never collide. Volatile (uses nextval).
CREATE OR REPLACE FUNCTION fn_org_user_code_next()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code TEXT;
BEGIN
  LOOP
    v_code := 'U' || lpad(nextval('org_user_code_seq')::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM org_users_mst WHERE lower(user_code) = lower(v_code));
  END LOOP;
  RETURN v_code;
END;
$$;

COMMENT ON FUNCTION fn_org_user_code_next() IS
  'Next unused auto-generated user code (U + 6 digits); skips codes already taken by manual entries. Used as the column default of org_users_mst.user_code.';

-- Used only as a column DEFAULT (evaluated by the inserting role) and by admin tooling.
GRANT EXECUTE ON FUNCTION fn_org_user_code_next() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION fn_org_user_code_next() FROM PUBLIC, anon;

-- ------------------------------------------------------------
-- org_users_mst: user_code + one account per tenant
-- ------------------------------------------------------------
-- Added in steps (nullable -> backfill -> default + NOT NULL) because fn_org_user_code_next() reads
-- org_users_mst.user_code itself and so cannot run while the column is still being added.
ALTER TABLE org_users_mst
  ADD COLUMN user_code TEXT;  -- Platform-wide unique sign-in code (case-insensitive); alternative to email at sign-in.

-- Backfill existing memberships with generated codes (numbering order is not significant).
UPDATE org_users_mst
SET user_code = fn_org_user_code_next()
WHERE user_code IS NULL;

-- From now on any insert that omits user_code (HQ platform-api, Prisma, SQL) gets one automatically.
ALTER TABLE org_users_mst
  ALTER COLUMN user_code SET DEFAULT fn_org_user_code_next(),
  ALTER COLUMN user_code SET NOT NULL;

COMMENT ON COLUMN org_users_mst.user_code IS
  'Platform-wide unique (case-insensitive) sign-in code, 3-30 chars [A-Za-z0-9._-], never containing @. Auto-generated (U000001...) unless an admin sets one. Alternative to email at sign-in.';

-- Format: 3-30 chars, starts alphanumeric, only letters/digits/dot/underscore/hyphen. No '@' so a
-- code can never be mistaken for an email by the sign-in identifier resolver.
ALTER TABLE org_users_mst
  ADD CONSTRAINT chk_org_users_user_code
  CHECK (user_code ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$');
COMMENT ON CONSTRAINT chk_org_users_user_code ON org_users_mst IS
  'user_code format: 3-30 chars, starts alphanumeric, only letters, digits, dot, underscore, hyphen (never @).';

-- Case-insensitive platform-wide uniqueness; also the lookup index for sign-in by user_code.
CREATE UNIQUE INDEX uq_org_users_user_code_lower ON org_users_mst (lower(user_code));
COMMENT ON INDEX uq_org_users_user_code_lower IS
  'Enforces platform-wide case-insensitive uniqueness of user_code and serves sign-in lookups by code.';

-- One auth account <-> one tenant membership. The existing UNIQUE (user_id, tenant_org_id) is kept
-- so composite FKs that reference it keep working; this narrower unique is what enforces the rule.
ALTER TABLE org_users_mst
  ADD CONSTRAINT uq_org_users_mst_user_id UNIQUE (user_id);
COMMENT ON CONSTRAINT uq_org_users_mst_user_id ON org_users_mst IS
  'One auth account per tenant membership: a session is bound to a single tenant; another tenant needs its own account.';

-- ------------------------------------------------------------
-- current_tenant_id(): membership-only
-- ------------------------------------------------------------
-- With exactly one membership per auth account the caller's tenant is simply that membership, so
-- JWT / user_metadata claims are no longer consulted at all (nothing user-editable can influence
-- tenant resolution). Inactive membership => NULL => RLS denies. SECURITY DEFINER bypasses the
-- org_users_mst RLS (whose own policies call this function); search_path pinned.
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT ou.tenant_org_id
  FROM org_users_mst ou
  WHERE ou.user_id = auth.uid()
    AND ou.is_active = true
  LIMIT 1;
$$;

COMMENT ON FUNCTION current_tenant_id() IS
  'Caller tenant for RLS = tenant of the caller''s single active org_users_mst membership. Ignores JWT/user_metadata claims.';

-- ------------------------------------------------------------
-- Sign-in identifier resolver
-- ------------------------------------------------------------
-- Maps what the user typed (email, or user_code) to the auth account. Identifiers containing '@'
-- are treated as emails, everything else as a user_code. Returns no row when nothing matches so the
-- caller can answer with one generic "invalid credentials" message (no account enumeration).
-- Service role only: it exposes emails for codes, so it must never be callable with anon/user keys.
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
BEGIN
  IF v_ident = '' THEN
    RETURN;
  END IF;

  IF position('@' IN v_ident) > 0 THEN
    RETURN QUERY
    SELECT au.id, au.email::TEXT, ou.id, ou.tenant_org_id, ou.is_active, ou.user_code
    FROM auth.users au
    JOIN org_users_mst ou ON ou.user_id = au.id
    WHERE lower(au.email) = lower(v_ident)
    LIMIT 1;
  ELSE
    RETURN QUERY
    SELECT au.id, au.email::TEXT, ou.id, ou.tenant_org_id, ou.is_active, ou.user_code
    FROM org_users_mst ou
    JOIN auth.users au ON au.id = ou.user_id
    WHERE lower(ou.user_code) = lower(v_ident)
    LIMIT 1;
  END IF;
END;
$$;

COMMENT ON FUNCTION fn_auth_resolve_login_identifier(TEXT) IS
  'Resolves a typed sign-in identifier (email if it contains @, else user_code) to the auth account + its single membership. Service role only; returns no row when unknown.';

REVOKE EXECUTE ON FUNCTION fn_auth_resolve_login_identifier(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_auth_resolve_login_identifier(TEXT) TO service_role;

-- ------------------------------------------------------------
-- Audit of user_code changes
-- ------------------------------------------------------------
INSERT INTO sys_auth_event_cd (code, name, name2, description, description2, event_group, display_order, created_by, created_info)
VALUES (
  'USER_CODE_CHANGED',
  'User code changed',
  'تم تغيير رمز المستخدم',
  'A user''s sign-in code was changed.',
  'تم تغيير رمز تسجيل دخول المستخدم.',
  'SECURITY',
  125,
  'migration',
  '0563'
);

-- Records every user_code change regardless of the code path (admin API, SQL, HQ). The acting
-- user is captured when the change comes from a signed-in session (auth.uid()); service-role
-- changes carry a NULL actor and are attributable via the API route's own logging.
CREATE OR REPLACE FUNCTION fn_org_users_user_code_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NEW.user_code IS DISTINCT FROM OLD.user_code THEN
    PERFORM fn_auth_log_event(
      'USER_CODE_CHANGED', 'SUCCESS', NEW.user_id, NEW.tenant_org_id, NULL, NULL, NULL, NULL, NULL, NULL,
      jsonb_build_object('old_user_code', OLD.user_code, 'new_user_code', NEW.user_code, 'actor_auth_user_id', auth.uid()),
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_org_users_user_code_audit() IS
  'AFTER UPDATE OF user_code trigger function: logs USER_CODE_CHANGED (old/new code, actor) to sys_auth_audit_log.';

REVOKE EXECUTE ON FUNCTION fn_org_users_user_code_audit() FROM PUBLIC, anon, authenticated;

-- Fires only when user_code is written, so ordinary profile/login-counter updates pay nothing.
CREATE TRIGGER trg_org_users_user_code_audit
  AFTER UPDATE OF user_code ON org_users_mst
  FOR EACH ROW
  EXECUTE FUNCTION fn_org_users_user_code_audit();
COMMENT ON TRIGGER trg_org_users_user_code_audit ON org_users_mst IS
  'Audits user_code changes into sys_auth_audit_log (USER_CODE_CHANGED).';

-- ROLLBACK PLAN:
--   DROP TRIGGER trg_org_users_user_code_audit ON org_users_mst;
--   DROP FUNCTION fn_org_users_user_code_audit(); DROP FUNCTION fn_auth_resolve_login_identifier(TEXT);
--   ALTER TABLE org_users_mst DROP CONSTRAINT uq_org_users_mst_user_id, DROP CONSTRAINT chk_org_users_user_code, DROP COLUMN user_code;
--   DROP FUNCTION fn_org_user_code_next(); DROP SEQUENCE org_user_code_seq;
--   DELETE FROM sys_auth_event_cd WHERE code = 'USER_CODE_CHANGED';
--   restore current_tenant_id() from 0561.
