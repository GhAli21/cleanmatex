-- =============================================================================
-- 0581_auth_password_management.sql
-- Purpose:  User Session Lifecycle — password management (change / admin reset / emailed link).
--           1. org_users_mst: forced-change flag (pwd_must_change) + last-change timestamp.
--           2. Password history (bcrypt hashes of previous passwords) captured by a trigger on auth.users, plus
--              fn_auth_pwd_reuse_check() so EVERY caller (tenant app, HQ platform-api, recovery) enforces no-reuse.
--           3. Auth-config catalog: new group PASSWORD and four policy items
--              (require-current-password, history depth, breached-password check, fresh-sign-in window).
--           4. Audit events: PASSWORD_RESET_BY_ADMIN, PASSWORD_RESET_LINK_SENT, ACCOUNT_UNLOCKED.
--           5. fn_auth_session_validate() also returns must_change_password so the proxy can force the change.
--           6. users:reset_password granted to the mandatory default role 'admin' (permission already exists).
--           7. Template v2 for 'security.password.changed' (EN/AR; never contains a password).
-- Depends:  0561 (event catalog), 0570 (config catalog), 0575 (validate), 0345/0346 (notification catalog).
-- Reversal (forward-only): see bottom of file.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. org_users_mst: forced password change + last change time
-- ---------------------------------------------------------------------------
ALTER TABLE public.org_users_mst
  ADD COLUMN IF NOT EXISTS pwd_must_change BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pwd_changed_at  TIMESTAMPTZ;

COMMENT ON COLUMN public.org_users_mst.pwd_must_change IS
  'true = the user must set a new password before using the app (set after an admin sets a temporary password). Cleared when the user changes their own password. Enforced by the proxy through fn_auth_session_validate().';
COMMENT ON COLUMN public.org_users_mst.pwd_changed_at IS
  'When the auth password last changed (stamped by trg_auth_pwd_capture on auth.users). NULL = never changed since this column existed.';

-- ---------------------------------------------------------------------------
-- 2. Password history
-- ---------------------------------------------------------------------------
-- Stores previous bcrypt hashes only (never plaintext). Global table keyed by auth user: one auth account maps to one
-- tenant membership, so there is no tenant_org_id here. Service-role / definer access only.
CREATE TABLE IF NOT EXISTS public.sys_auth_pwd_history_dtl (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),            -- Row identity.
  auth_user_id  UUID NOT NULL,-- REFERENCES auth.users(id) ON DELETE CASCADE, -- Owner; history disappears with the account.
  password_hash TEXT NOT NULL,                                         -- Previous bcrypt hash copied from auth.users.encrypted_password.
  rec_notes     TEXT,                                                  -- Optional free-form note (who/how is recorded in sys_auth_audit_log, not here).
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()                     -- When this password was replaced.
);

COMMENT ON TABLE public.sys_auth_pwd_history_dtl IS
  'Previous password hashes per auth user, used only by fn_auth_pwd_reuse_check() to block reuse. Hashes only; no API-role access.';
COMMENT ON COLUMN public.sys_auth_pwd_history_dtl.id IS 'Row identity.';
COMMENT ON COLUMN public.sys_auth_pwd_history_dtl.auth_user_id IS 'Owning auth.users row (cascade delete).';
COMMENT ON COLUMN public.sys_auth_pwd_history_dtl.password_hash IS 'Previous bcrypt hash; never plaintext.';
COMMENT ON COLUMN public.sys_auth_pwd_history_dtl.rec_notes IS 'Optional note. Who changed the password and how (self/admin/HQ/link, email sent) is audited in sys_auth_audit_log.details, not here.';
COMMENT ON COLUMN public.sys_auth_pwd_history_dtl.created_at IS 'Time the password was replaced.';

CREATE INDEX IF NOT EXISTS idx_auth_pwd_hist_user
  ON public.sys_auth_pwd_history_dtl (auth_user_id, created_at DESC);
COMMENT ON INDEX public.idx_auth_pwd_hist_user IS 'Newest-first history lookup for the reuse check and pruning.';

-- RLS on with NO policy + all API-role privileges revoked: only service_role / SECURITY DEFINER code can touch it.
ALTER TABLE public.sys_auth_pwd_history_dtl ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.sys_auth_pwd_history_dtl FROM PUBLIC, anon, authenticated;

-- Trigger function: whenever the password hash changes, keep the OLD hash and stamp pwd_changed_at.
-- Never blocks the password change itself: any failure here is downgraded to a warning.
CREATE OR REPLACE FUNCTION public.fn_auth_pwd_capture()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  BEGIN
    IF OLD.encrypted_password IS NOT NULL AND OLD.encrypted_password <> '' THEN
      INSERT INTO sys_auth_pwd_history_dtl (auth_user_id, password_hash)
      VALUES (NEW.id, OLD.encrypted_password);

      -- Cap storage: keep the 24 most recent entries (the maximum configurable depth).
      DELETE FROM sys_auth_pwd_history_dtl h
      WHERE h.auth_user_id = NEW.id
        AND h.id NOT IN (
          SELECT x.id FROM sys_auth_pwd_history_dtl x
          WHERE x.auth_user_id = NEW.id ORDER BY x.created_at DESC LIMIT 24
        );
    END IF;

    -- user_id is UNIQUE on org_users_mst (one auth account per membership), so this touches exactly one row.
    UPDATE org_users_mst SET pwd_changed_at = now() WHERE user_id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_auth_pwd_capture failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.fn_auth_pwd_capture() IS
  'AFTER UPDATE OF encrypted_password on auth.users: stores the replaced hash in sys_auth_pwd_history_dtl and stamps org_users_mst.pwd_changed_at. Failure-tolerant.';
REVOKE EXECUTE ON FUNCTION public.fn_auth_pwd_capture() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_auth_pwd_capture ON auth.users;
CREATE TRIGGER trg_auth_pwd_capture
  AFTER UPDATE OF encrypted_password ON auth.users
  FOR EACH ROW
  WHEN (OLD.encrypted_password IS DISTINCT FROM NEW.encrypted_password)
  EXECUTE FUNCTION public.fn_auth_pwd_capture();
-- No COMMENT ON TRIGGER here: the migration role does not own auth.users (it may create triggers, not comment on them).
-- Purpose: captures password history for every change path (tenant app, HQ, recovery).

-- Reuse check: true when p_new_password equals the CURRENT password or one of the most recent previous ones, so that
-- the last p_depth passwords (current included) cannot be reused. p_depth = 0 disables the rule.
CREATE OR REPLACE FUNCTION public.fn_auth_pwd_reuse_check(
  p_auth_user_id UUID,
  p_new_password TEXT,
  p_depth        INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_current TEXT;
BEGIN
  IF COALESCE(p_depth, 0) <= 0 OR p_new_password IS NULL THEN
    RETURN false;
  END IF;

  SELECT u.encrypted_password INTO v_current FROM auth.users u WHERE u.id = p_auth_user_id;
  IF v_current IS NOT NULL AND v_current <> '' AND crypt(p_new_password, v_current) = v_current THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM (
      SELECT h.password_hash
      FROM sys_auth_pwd_history_dtl h
      WHERE h.auth_user_id = p_auth_user_id
      ORDER BY h.created_at DESC
      LIMIT GREATEST(p_depth - 1, 0)
    ) recent
    WHERE crypt(p_new_password, recent.password_hash) = recent.password_hash
  );
END;
$$;
COMMENT ON FUNCTION public.fn_auth_pwd_reuse_check(UUID, TEXT, INTEGER) IS
  'true when the plaintext matches the current password or one of the last (p_depth-1) previous ones. service_role only.';
REVOKE EXECUTE ON FUNCTION public.fn_auth_pwd_reuse_check(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_auth_pwd_reuse_check(UUID, TEXT, INTEGER) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Config catalog: PASSWORD group + items
-- ---------------------------------------------------------------------------
ALTER TABLE public.sys_auth_admin_config_cf DROP CONSTRAINT sys_auth_admin_config_cf_config_group_check;
ALTER TABLE public.sys_auth_admin_config_cf
  ADD CONSTRAINT sys_auth_admin_config_cf_config_group_check
  CHECK (config_group IN ('SESSION', 'DEVICE', 'LOCKOUT', 'PASSWORD'));
COMMENT ON COLUMN public.sys_auth_admin_config_cf.config_group IS 'UI grouping: SESSION, DEVICE, LOCKOUT or PASSWORD.';

-- Seed without flooding the audit trail (the audit trigger is re-enabled right after).
ALTER TABLE public.sys_auth_admin_config_cf DISABLE TRIGGER trg_auth_cfg_sys_audit;

INSERT INTO public.sys_auth_admin_config_cf
  (config_code, name, name2, description, description2, config_group, value_type, unit,
   config_value, min_value, max_value, allowed_values, is_allow_tenant_change, display_order, created_by, created_info)
VALUES
  ('AUTH_PWD_REQUIRE_CURRENT', 'Require current password to change', 'طلب كلمة المرور الحالية عند التغيير',
   'On: users must type their current password to change it. Off: users enter only the new password twice, allowed only shortly after signing in (see the sign-in freshness window).',
   'مفعّل: يجب على المستخدم إدخال كلمة المرور الحالية لتغييرها. معطّل: يُدخل كلمة المرور الجديدة مرتين فقط، ويُسمح بذلك بعد تسجيل الدخول بوقت قصير (انظر نافذة حداثة تسجيل الدخول).',
   'PASSWORD', 'BOOLEAN', 'NONE', 'true', NULL, NULL, NULL, true, 110, 'migration', '0581'),
  ('AUTH_PWD_FRESH_SIGNIN_MIN', 'Sign-in freshness window', 'نافذة حداثة تسجيل الدخول',
   'When the current password is not required, minutes after sign-in during which the password may still be changed with only the new password. Afterwards the user must sign in again or use the emailed link.',
   'عندما لا تكون كلمة المرور الحالية مطلوبة: عدد الدقائق بعد تسجيل الدخول التي يمكن خلالها تغيير كلمة المرور بإدخال الجديدة فقط. بعدها يلزم تسجيل الدخول مجدداً أو استخدام الرابط المرسل بالبريد.',
   'PASSWORD', 'INTEGER', 'MINUTES', '15', 1, 120, NULL, true, 120, 'migration', '0581'),
  ('AUTH_PWD_HISTORY_COUNT', 'Password history', 'سجل كلمات المرور',
   'Number of recent passwords (including the current one) that cannot be reused. 0 turns the rule off.',
   'عدد كلمات المرور الأخيرة (بما فيها الحالية) التي لا يمكن إعادة استخدامها. القيمة 0 تعطّل القاعدة.',
   'PASSWORD', 'INTEGER', 'COUNT', '5', 0, 24, NULL, true, 130, 'migration', '0581'),
  ('AUTH_PWD_BREACH_CHECK', 'Block breached passwords', 'منع كلمات المرور المسرّبة',
   'Reject passwords that appear in public data-breach lists. Only a partial hash is sent to the checking service; the password never leaves the server.',
   'رفض كلمات المرور الموجودة في قوائم التسريبات العامة. يُرسل جزء من البصمة فقط إلى خدمة الفحص ولا تغادر كلمة المرور الخادم.',
   'PASSWORD', 'BOOLEAN', 'NONE', 'true', NULL, NULL, NULL, false, 140, 'migration', '0581')
ON CONFLICT (config_code) DO NOTHING;

ALTER TABLE public.sys_auth_admin_config_cf ENABLE TRIGGER trg_auth_cfg_sys_audit;

-- ---------------------------------------------------------------------------
-- 4. Audit event codes
-- ---------------------------------------------------------------------------
INSERT INTO public.sys_auth_event_cd
  (code, name, name2, description, description2, event_group, display_order, created_by, created_info)
VALUES
  ('PASSWORD_RESET_BY_ADMIN', 'Password reset by administrator', 'إعادة تعيين كلمة المرور بواسطة مسؤول',
   'An administrator set a new password for the user.', 'قام مسؤول بتعيين كلمة مرور جديدة للمستخدم.', 'SECURITY', 91, 'migration', '0581'),
  ('PASSWORD_RESET_LINK_SENT', 'Password reset link emailed', 'إرسال رابط إعادة تعيين كلمة المرور',
   'A link to choose a new password was emailed to the user.', 'تم إرسال رابط اختيار كلمة مرور جديدة إلى بريد المستخدم.', 'SECURITY', 92, 'migration', '0581'),
  ('ACCOUNT_UNLOCKED', 'Account unlocked', 'تم فتح قفل الحساب',
   'An administrator cleared a sign-in lockout.', 'قام مسؤول بإزالة قفل تسجيل الدخول.', 'LOGIN', 35, 'migration', '0581')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. fn_auth_session_validate: add must_change_password
-- ---------------------------------------------------------------------------
-- The RETURNS TABLE shape changes, so the function must be dropped and re-created (RESTRICT: nothing depends on it;
-- other functions reference it only by name at run time). Body identical to 0575 except the membership lookup and the
-- extra output column.
DROP FUNCTION public.fn_auth_session_validate(BOOLEAN, INET) RESTRICT;

CREATE FUNCTION public.fn_auth_session_validate(p_touch BOOLEAN DEFAULT false, p_ip_address INET DEFAULT NULL)
RETURNS TABLE(
  state                 TEXT,
  end_reason            TEXT,
  tenant_org_id         UUID,
  idle_remaining_sec    INTEGER,
  absolute_remaining_sec INTEGER,
  idle_warning_sec      INTEGER,
  must_change_password  BOOLEAN
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

  -- Membership still active? (also reads the forced-change flag in the same lookup)
  SELECT ou.pwd_must_change INTO v_must
  FROM org_users_mst ou
  WHERE ou.user_id = v_uid AND ou.tenant_org_id = v_row.tenant_org_id AND ou.is_active = true;
  IF NOT FOUND THEN
    PERFORM fn_auth_session_end_internal(v_sid, 'USER_DEACTIVATED', NULL);
    RETURN QUERY SELECT 'ENDED', 'USER_DEACTIVATED', v_row.tenant_org_id, 0, 0, v_row.idle_warning_sec, false;
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

  RETURN QUERY SELECT 'ACTIVE', NULL::TEXT, v_row.tenant_org_id, v_idle_remaining, v_abs_remaining, v_row.idle_warning_sec,
                      COALESCE(v_must, false);
END;
$$;

COMMENT ON FUNCTION public.fn_auth_session_validate(BOOLEAN, INET) IS
  'Validates the caller''s own session (state, timeouts, membership) and, when ACTIVE, reports must_change_password so the proxy can force a password change. Ends the session on timeout/deactivation.';
REVOKE EXECUTE ON FUNCTION public.fn_auth_session_validate(BOOLEAN, INET) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_auth_session_validate(BOOLEAN, INET) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. users:reset_password -> mandatory default role 'admin' (permission itself already exists)
-- ---------------------------------------------------------------------------
UPDATE public.sys_auth_role_default_permissions
SET is_enabled = true, is_active = true, rec_status = 1, updated_at = CURRENT_TIMESTAMP
WHERE role_code IN ('super_admin', 'tenant_admin', 'admin') AND permission_code = 'users:reset_password';

INSERT INTO public.sys_auth_role_default_permissions
  (role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin')
  AND p.code = 'users:reset_password'
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- ---------------------------------------------------------------------------
-- 7. Notification template v2: security.password.changed (no password ever included)
-- ---------------------------------------------------------------------------
-- Variables: {{changed_at}}, {{actor_label}} ("you" / "an administrator" resolved by the emitter in the user's language).
INSERT INTO public.sys_ntf_template_ver_dtl
  (template_code, version_number, subject, subject2, body, body2, status, approved_by, approved_at, created_by, created_info)
SELECT
  'security.password.changed.default', 2,
  'Your password was changed', 'تم تغيير كلمة المرور',
  'The password of your account was changed by {{actor_label}} at {{changed_at}}. If this was not you, contact your administrator immediately.',
  'تم تغيير كلمة مرور حسابك بواسطة {{actor_label}} في {{changed_at}}. إذا لم تكن أنت، تواصل مع المسؤول فوراً.',
  'APPROVED', 'system_admin', CURRENT_TIMESTAMP, 'system_admin',
  'User_Session_Lifecycle — password management notification.'
WHERE EXISTS (SELECT 1 FROM public.sys_ntf_templates_mst WHERE template_code = 'security.password.changed.default')
ON CONFLICT (template_code, version_number) DO NOTHING;

INSERT INTO public.sys_ntf_template_chan_dtl
  (template_version_id, channel_code, rendered_subject, rendered_subject2, rendered_body, rendered_body2, metadata, created_by, created_info)
SELECT v2.id, c1.channel_code, v2.subject, v2.subject2, v2.body, v2.body2, c1.metadata, 'system_admin',
       'User_Session_Lifecycle — password management notification.'
FROM public.sys_ntf_template_ver_dtl v2
JOIN public.sys_ntf_template_ver_dtl v1 ON v1.template_code = v2.template_code AND v1.version_number = 1
JOIN public.sys_ntf_template_chan_dtl c1 ON c1.template_version_id = v1.id
WHERE v2.template_code = 'security.password.changed.default' AND v2.version_number = 2
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_ntf_template_chan_dtl x
    WHERE x.template_version_id = v2.id AND x.channel_code = c1.channel_code
  );

-- ---------------------------------------------------------------------------
-- 8. Post-conditions
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT count(*) FROM public.sys_auth_admin_config_cf WHERE config_group = 'PASSWORD') < 4 THEN
    RAISE EXCEPTION '0581: PASSWORD config items were not seeded';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auth_pwd_capture') THEN
    RAISE EXCEPTION '0581: trg_auth_pwd_capture missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sys_auth_role_default_permissions
                 WHERE role_code = 'admin' AND permission_code = 'users:reset_password' AND is_enabled) THEN
    RAISE EXCEPTION '0581: users:reset_password not granted to admin';
  END IF;
END $$;

COMMIT;

-- Reversal (forward-only, manual):
--   DROP TRIGGER trg_auth_pwd_capture ON auth.users; DROP FUNCTION fn_auth_pwd_capture(), fn_auth_pwd_reuse_check(UUID,TEXT,INTEGER);
--   DROP TABLE sys_auth_pwd_history_dtl; ALTER TABLE org_users_mst DROP COLUMN pwd_must_change, DROP COLUMN pwd_changed_at;
--   DELETE the four AUTH_PWD_* catalog rows, restore the 0575 definition of fn_auth_session_validate().
