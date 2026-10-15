-- Config Registry — master-key rotation support and drift alerting (Notification Hub R7).
--
-- 1. REENCRYPT is a new change-log action. Re-sealing an encrypted value under a new master key does not
--    change the value (so its fingerprint is unchanged) but must be auditable.
-- 2. fn_ops_config_reencrypt swaps one encrypted envelope for another under the row lock, guarded by
--    compare-and-swap on the envelope the caller read, so a value changed or re-sealed concurrently is
--    never overwritten. The database never sees the master key or any plaintext.
-- 3. Registers the three keys the new HQ features read: the previous master key (rotation window,
--    bootstrap, environment only), the drift-alert webhook URL, and the drift-check interval.
--    Names and metadata only: no value appears here (values are set in the UI or the environment).
-- Idempotent: re-running changes nothing an operator edited.
BEGIN;

-- 1. Allow the REENCRYPT action in the change log.
ALTER TABLE public.sys_ops_config_chg_log DROP CONSTRAINT IF EXISTS ck_ops_config_chg_act;
ALTER TABLE public.sys_ops_config_chg_log
  ADD CONSTRAINT ck_ops_config_chg_act
  CHECK (action IN ('SET', 'CLEAR', 'POLICY_CHANGE', 'ENCRYPTION_CHANGE', 'REENCRYPT'));
COMMENT ON CONSTRAINT ck_ops_config_chg_act ON public.sys_ops_config_chg_log IS
  'Allowed change actions (REENCRYPT = the stored envelope was re-sealed under another master key; the value is unchanged).';
COMMENT ON COLUMN public.sys_ops_config_chg_log.action IS 'SET, CLEAR, POLICY_CHANGE, ENCRYPTION_CHANGE or REENCRYPT.';

-- 2. Re-seal one encrypted value (compare-and-swap).
CREATE OR REPLACE FUNCTION public.fn_ops_config_reencrypt(
  p_key     TEXT,
  p_old_enc TEXT,
  p_new_enc TEXT,
  p_actor   TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cfg   public.sys_ops_config_cf%ROWTYPE;
  v_actor TEXT := left(COALESCE(NULLIF(btrim(p_actor), ''), 'unknown'), 120);
BEGIN
  SELECT * INTO v_cfg
  FROM public.sys_ops_config_cf
  WHERE config_key = p_key AND rec_status = 1 AND is_active
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Config key is not registered', 'config_key', p_key);
  END IF;
  -- Only a stored envelope can be re-sealed.
  IF NOT v_cfg.is_encrypted OR v_cfg.db_value_enc IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOTHING_TO_CHANGE',
      'message', 'The key holds no encrypted value', 'config_key', p_key);
  END IF;
  IF p_new_enc IS NULL OR btrim(p_new_enc) = '' OR p_old_enc IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'VALUE_SHAPE',
      'message', 'Supply the envelope read and its replacement', 'config_key', p_key);
  END IF;
  IF length(p_new_enc) > 16000 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'VALUE_TOO_LONG', 'message', 'Value is too long', 'config_key', p_key);
  END IF;
  -- Compare-and-swap: the envelope must still be the one the API decrypted.
  IF v_cfg.db_value_enc <> p_old_enc THEN
    RETURN jsonb_build_object('ok', false, 'code', 'STALE_VALUE',
      'message', 'The stored value changed while it was being re-encrypted; retry', 'config_key', p_key);
  END IF;

  -- The value is unchanged, so the fingerprint and every constraint hold before and after.
  UPDATE public.sys_ops_config_cf
  SET db_value_enc = p_new_enc,
      updated_at   = now(),
      updated_info = 'fn_ops_config_reencrypt by ' || v_actor
  WHERE config_key = p_key;

  INSERT INTO public.sys_ops_config_chg_log (config_key, action, actor, old_fingerprint, new_fingerprint, created_info)
  VALUES (p_key, 'REENCRYPT', v_actor, v_cfg.db_value_fingerprint, v_cfg.db_value_fingerprint, 'fn_ops_config_reencrypt');

  RETURN jsonb_build_object('ok', true, 'code', 'UPDATED', 'message', 'Value re-encrypted', 'config_key', p_key);
END;
$$;

COMMENT ON FUNCTION public.fn_ops_config_reencrypt(TEXT, TEXT, TEXT, TEXT) IS
  'Replaces a key''s stored envelope with one sealed under a different master key, atomically under the row lock and only if the stored envelope still equals p_old_enc (otherwise STALE_VALUE). The value and its fingerprint are unchanged; the action is logged as REENCRYPT. Called by HQ platform-api, which holds the master keys.';

REVOKE ALL ON FUNCTION public.fn_ops_config_reencrypt(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ops_config_reencrypt(TEXT, TEXT, TEXT, TEXT) TO service_role;

-- 3. New registry keys (metadata only).
INSERT INTO public.sys_ops_config_cf (
  config_key, module, name, name2, description, description2, value_type, is_secret, is_encrypted, source_policy,
  env_var_name, is_bootstrap, is_wired, requires_restart, manage_via, guidance, guidance2, applies_to_app, env_var_scope_val,
  created_info, is_active, rec_status
) VALUES
  ('platform.encryption.master_key_previous', 'platform', 'HQ previous encryption master key', 'مفتاح التشفير الرئيسي السابق لـ HQ',
   'Base64 32-byte AES key that was the master key before a rotation. Only set during a rotation window so old values stay readable until they are re-encrypted.',
   'مفتاح AES بطول 32 بايت (Base64) كان المفتاح الرئيسي قبل التدوير. يُعيَّن فقط أثناء نافذة التدوير لتبقى القيم القديمة مقروءة حتى إعادة تشفيرها.',
   'SECRET_STRING', true, false, 'ENV_ONLY', 'HQ_ENCRYPTION_MASTER_KEY_PREVIOUS', true, true, true, 'HOSTING_ENV',
   'Set only while rotating: put the old master key here, put the new key in HQ_ENCRYPTION_MASTER_KEY, restart HQ API, run Re-encrypt on the Config page, then remove this variable.',
   'عيّنه أثناء التدوير فقط: ضع المفتاح القديم هنا والجديد في HQ_ENCRYPTION_MASTER_KEY ثم أعد تشغيل واجهة HQ ونفّذ إعادة التشفير من صفحة الإعدادات ثم احذف هذا المتغير.',
   '[{"app":"HQ_API","is_still_used":true}]'::jsonb, '[]'::jsonb, '0621_ops_config_rotation_alerting', true, 1),
  ('platform.ops.alert_webhook_url', 'platform', 'Operations alert webhook URL', 'عنوان webhook لتنبيهات العمليات',
   'HTTPS endpoint (Slack-compatible incoming webhook) that receives a short message when configuration drift or a failed check is detected. Treated as a secret because the URL carries the token.',
   'نقطة HTTPS (webhook وارد متوافق مع Slack) تستقبل رسالة قصيرة عند اكتشاف انحراف في الإعدادات أو فشل فحص. تُعامل كسر لأن العنوان يحمل الرمز.',
   'SECRET_STRING', true, false, 'ENV_OVERRIDES_DB', 'HQ_OPS_ALERT_WEBHOOK_URL', false, true, false, 'UI',
   'Paste the incoming-webhook URL of your chat tool. Leave empty to disable outbound alerts; drift is still recorded in the audit log and on Setup Health.',
   'الصق عنوان webhook الوارد لأداة المحادثة. اتركه فارغًا لتعطيل التنبيهات الخارجية؛ يبقى الانحراف مسجلًا في سجل التدقيق وصفحة صحة الإعداد.',
   '[{"app":"HQ_API","is_still_used":true}]'::jsonb, '[]'::jsonb, '0621_ops_config_rotation_alerting', true, 1),
  ('platform.ops.drift_check_minutes', 'platform', 'Drift check interval (minutes)', 'فترة فحص الانحراف (بالدقائق)',
   'How often HQ API compares the registry with its own environment and raises an alert when a key drifts. 0 disables the automatic check (default 15 when unset).',
   'عدد الدقائق بين فحوصات واجهة HQ لمقارنة السجل ببيئتها وإطلاق تنبيه عند انحراف مفتاح. القيمة 0 تعطّل الفحص التلقائي (الافتراضي 15 عند عدم التعيين).',
   'NUMBER', false, false, 'ENV_OVERRIDES_DB', 'HQ_CONFIG_DRIFT_CHECK_MINUTES', false, true, false, 'UI',
   'Whole minutes between 0 and 1440. Takes effect within a minute; no restart needed.',
   'عدد صحيح من الدقائق بين 0 و1440. يسري خلال دقيقة دون إعادة تشغيل.',
   '[{"app":"HQ_API","is_still_used":true}]'::jsonb, '[]'::jsonb, '0621_ops_config_rotation_alerting', true, 1)
ON CONFLICT (config_key) DO NOTHING;

COMMIT;
