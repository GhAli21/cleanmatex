-- ============================================================
-- Migration: 0777_ops_config_i11_worker_env.sql
-- Purpose:   Register the I11 Render worker environment variables as
--            metadata-only HQ Config Registry keys, and refuse stored-value
--            policies for keys the HQ resolver does not consume.
-- Affected:  sys_ops_config_cf (eight inventory rows),
--            fn_ops_config_set, fn_ops_config_set_policy
-- Related:   0612, 0615, 0617, 0774; I11 task 4.7
-- ============================================================
--
-- Why: the worker reads these names from its own process.env. HQ Config
-- Registry resolution and Check now run only in HQ API, which cannot see
-- the Render worker host. Registering them as ENV_ONLY / HOSTING_ENV /
-- is_wired=false keeps the inventory honest: editing a database value must
-- not look like it drives the worker. PLATFORM_WORKER_API_KEY is a secret
-- identity shared by HQ API and the worker; this file stores no value,
-- ciphertext, or fingerprint.
--
-- Remote inventory (2026-11-19, metadata-only): no active or inactive row
-- used these eight env_var_name values, including env_var_scope_val.
-- Nearby names HQ_API_URL and WORKER_CONCURRENCY already belong to other keys.
BEGIN;

-- Abort if a later environment reused one of these names on another key.
DO $$
DECLARE
  v_collision TEXT;
BEGIN
  SELECT c.config_key || '=' || c.env_var_name
    INTO v_collision
    FROM public.sys_ops_config_cf AS c
   WHERE c.env_var_name = ANY (ARRAY[
           'NTF_OUTBOX_WORKER_ENABLED',
           'NTF_OUTBOX_SHADOW_ENABLED',
           'NTF_OUTBOX_CLAIM_LIMIT',
           'NTF_OUTBOX_MAX_CLAIMS_PER_BOOT',
           'NTF_OUTBOX_CANARY_RUN_ID',
           'LEGACY_BULLMQ_ENABLED',
           'HQ_JOBS_API_URL',
           'PLATFORM_WORKER_API_KEY'
         ])
     AND c.config_key NOT IN (
           'ntf.worker.outbox_enabled',
           'ntf.worker.outbox_shadow_enabled',
           'ntf.worker.outbox_claim_limit',
           'ntf.worker.outbox_max_claims_per_boot',
           'ntf.worker.outbox_canary_run_id',
           'workers.legacy_bullmq_enabled',
           'ntf.worker.hq_jobs_api_url',
           'platform.worker_api_key'
         )
   LIMIT 1;
  IF v_collision IS NOT NULL THEN
    RAISE EXCEPTION '0777 aborted: env var already registered as %', v_collision;
  END IF;
END
$$;

-- Inventory rows only. No db_value, envelope, or fingerprint is seeded.
INSERT INTO public.sys_ops_config_cf (
  config_key, module, name, name2, description, description2, value_type, is_secret, is_encrypted, source_policy,
  env_var_name, is_bootstrap, is_wired, requires_restart, validation_rule, manage_via, guidance, guidance2,
  applies_to_app, env_var_scope_val, created_info, is_active, rec_status
) VALUES
  (
    'ntf.worker.outbox_enabled', 'ntf',
    'Notification outbox worker enabled', 'تفعيل عامل صندوق الإشعارات',
    'Render platform-workers process.env switch. Only the exact value true starts the canonical claim loop. The HQ Config Registry does not feed this process; Check now cannot see Render.',
    'مفتاح بيئة عملية عمّال المنصة. القيمة true فقط تشغّل حلقة المطالبة المعتمدة. سجل الإعدادات لا يغذي هذه العملية ولا يستطيع التحقق من Render.',
    'BOOLEAN', false, false, 'ENV_ONLY', 'NTF_OUTBOX_WORKER_ENABLED',
    false, false, true, '^(true|false)$', 'HOSTING_ENV',
    'Set NTF_OUTBOX_WORKER_ENABLED on the Render worker service and redeploy. Keep it false until the I11 canary gates pass. A registry stored value would not be read.',
    'عيّن NTF_OUTBOX_WORKER_ENABLED على خدمة العامل في Render ثم أعد النشر. أبقه false حتى تجتاز بوابات I11. قيمة مخزّنة في السجل لن تُقرأ.',
    '[{"app":"HQ_WORKERS","is_still_used":true}]'::jsonb,
    '[{"scope":"HQ_WORKERS","env_var_name":"NTF_OUTBOX_WORKER_ENABLED","is_it_there":"unknown","value":null,"fingerprint":null,"description":"Read only from Render platform-workers process.env. HQ API cannot verify this host.","is_still_used":true}]'::jsonb,
    '0777_ops_config_i11_worker_env', true, 1
  ),
  (
    'ntf.worker.outbox_shadow_enabled', 'ntf',
    'Notification outbox shadow probe', 'مسبار ظل صندوق الإشعارات',
    'Render platform-workers process.env switch for the no-write due-work probe. Unset defaults to enabled. Explicit false is capacity containment only and does not start delivery.',
    'مفتاح بيئة مسبار العدّ دون كتابة. القيمة غير المعيّنة تبقى مفعّلة. false الصريحة للاحتواء فقط ولا تبدأ التسليم.',
    'BOOLEAN', false, false, 'ENV_ONLY', 'NTF_OUTBOX_SHADOW_ENABLED',
    false, false, true, '^(true|false)$', 'HOSTING_ENV',
    'Set NTF_OUTBOX_SHADOW_ENABLED on the Render worker service and redeploy. HQ Check now cannot confirm Render presence.',
    'عيّن NTF_OUTBOX_SHADOW_ENABLED على خدمة العامل في Render ثم أعد النشر. تحقق HQ لا يؤكد وجود المتغير في Render.',
    '[{"app":"HQ_WORKERS","is_still_used":true}]'::jsonb,
    '[{"scope":"HQ_WORKERS","env_var_name":"NTF_OUTBOX_SHADOW_ENABLED","is_it_there":"unknown","value":null,"fingerprint":null,"description":"Read only from Render platform-workers process.env. HQ API cannot verify this host.","is_still_used":true}]'::jsonb,
    '0777_ops_config_i11_worker_env', true, 1
  ),
  (
    'ntf.worker.outbox_claim_limit', 'ntf',
    'Notification outbox claim limit', 'حد مطالبة صندوق الإشعارات',
    'Render platform-workers per-tenant claim bound, integer 1-50, default 25 when unset. Read from process.env only.',
    'حد المطالبة لكل منشأة في عمّال Render، عدد صحيح 1-50 والافتراضي 25 إن لم يُعيَّن. يُقرأ من بيئة العملية فقط.',
    'NUMBER', false, false, 'ENV_ONLY', 'NTF_OUTBOX_CLAIM_LIMIT',
    false, false, true, '^([1-9]|[1-4][0-9]|50)$', 'HOSTING_ENV',
    'Set NTF_OUTBOX_CLAIM_LIMIT on the Render worker service and redeploy. Use 1 only for an authorized canary. A registry stored value would not be read.',
    'عيّن NTF_OUTBOX_CLAIM_LIMIT على خدمة العامل في Render ثم أعد النشر. استخدم 1 فقط لتجربة مصرّح بها. قيمة مخزّنة في السجل لن تُقرأ.',
    '[{"app":"HQ_WORKERS","is_still_used":true}]'::jsonb,
    '[{"scope":"HQ_WORKERS","env_var_name":"NTF_OUTBOX_CLAIM_LIMIT","is_it_there":"unknown","value":null,"fingerprint":null,"description":"Read only from Render platform-workers process.env. HQ API cannot verify this host.","is_still_used":true}]'::jsonb,
    '0777_ops_config_i11_worker_env', true, 1
  ),
  (
    'ntf.worker.outbox_max_claims_per_boot', 'ntf',
    'Notification outbox max claims per boot', 'أقصى مطالبات لصندوق الإشعارات لكل تشغيل',
    'Optional Render process-local claim budget, integer 1-50. Unset means no process budget. Defense in depth beside the database-global canary run ID.',
    'ميزانية مطالبة اختيارية لكل عملية Render، عدد صحيح 1-50. عدم التعيين يعني بلا ميزانية للعملية. حماية إضافية بجانب معرّف التجربة العام في القاعدة.',
    'NUMBER', false, false, 'ENV_ONLY', 'NTF_OUTBOX_MAX_CLAIMS_PER_BOOT',
    false, false, true, '^([1-9]|[1-4][0-9]|50)$', 'HOSTING_ENV',
    'Set NTF_OUTBOX_MAX_CLAIMS_PER_BOOT on the Render worker service and redeploy. Use 1 during a canary. A registry stored value would not be read.',
    'عيّن NTF_OUTBOX_MAX_CLAIMS_PER_BOOT على خدمة العامل في Render ثم أعد النشر. استخدم 1 أثناء التجربة. قيمة مخزّنة في السجل لن تُقرأ.',
    '[{"app":"HQ_WORKERS","is_still_used":true}]'::jsonb,
    '[{"scope":"HQ_WORKERS","env_var_name":"NTF_OUTBOX_MAX_CLAIMS_PER_BOOT","is_it_there":"unknown","value":null,"fingerprint":null,"description":"Read only from Render platform-workers process.env. HQ API cannot verify this host.","is_still_used":true}]'::jsonb,
    '0777_ops_config_i11_worker_env', true, 1
  ),
  (
    'ntf.worker.outbox_canary_run_id', 'ntf',
    'Notification outbox canary run id', 'معرّف تشغيل تجربة صندوق الإشعارات',
    'Optional UUID shared by overlapping Render worker processes. When set, claims use the database-global one-claim guard. Opaque correlation only; never a customer or provider identifier.',
    'معرّف UUID اختياري تشترك فيه عمليات العامل المتداخلة. عند تعيينه تستخدم المطالبات حارس المطالبة الواحدة العام. للارتباط فقط وليس معرّف عميل أو مزوّد.',
    'STRING', false, false, 'ENV_ONLY', 'NTF_OUTBOX_CANARY_RUN_ID',
    false, false, true,
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    'HOSTING_ENV',
    'Set a newly generated UUID as NTF_OUTBOX_CANARY_RUN_ID on every overlapping Render worker process, then redeploy. Do not reuse a closed canary UUID. HQ Check now cannot verify Render.',
    'عيّن UUID جديداً كـ NTF_OUTBOX_CANARY_RUN_ID على كل عملية عامل متداخلة ثم أعد النشر. لا تعد استخدام معرّف تجربة مغلقة. تحقق HQ لا يؤكد Render.',
    '[{"app":"HQ_WORKERS","is_still_used":true}]'::jsonb,
    '[{"scope":"HQ_WORKERS","env_var_name":"NTF_OUTBOX_CANARY_RUN_ID","is_it_there":"unknown","value":null,"fingerprint":null,"description":"Read only from Render platform-workers process.env. HQ API cannot verify this host.","is_still_used":true}]'::jsonb,
    '0777_ops_config_i11_worker_env', true, 1
  ),
  (
    'workers.legacy_bullmq_enabled', 'platform',
    'Legacy BullMQ dispatch enabled', 'تفعيل إرسال BullMQ القديم',
    'Render platform-workers process.env rollback switch. Only the exact value true starts Redis/BullMQ. Unsupported beside the canonical worker path.',
    'مفتاح تراجع بيئة عمّال Render. القيمة true فقط تشغّل Redis/BullMQ. غير مدعوم بجانب المسار المعتمد.',
    'BOOLEAN', false, false, 'ENV_ONLY', 'LEGACY_BULLMQ_ENABLED',
    false, false, true, '^(true|false)$', 'HOSTING_ENV',
    'Keep LEGACY_BULLMQ_ENABLED false or unset on the Render worker unless an Owner-approved rollback is in force. A registry stored value would not be read.',
    'أبقِ LEGACY_BULLMQ_ENABLED false أو غير معيّن على العامل ما لم يُعتمد تراجع من المالك. قيمة مخزّنة في السجل لن تُقرأ.',
    '[{"app":"HQ_WORKERS","is_still_used":true}]'::jsonb,
    '[{"scope":"HQ_WORKERS","env_var_name":"LEGACY_BULLMQ_ENABLED","is_it_there":"unknown","value":null,"fingerprint":null,"description":"Read only from Render platform-workers process.env. HQ API cannot verify this host.","is_still_used":true}]'::jsonb,
    '0777_ops_config_i11_worker_env', true, 1
  ),
  (
    'ntf.worker.hq_jobs_api_url', 'ntf',
    'Worker private HQ jobs URL', 'عنوان مهام HQ الخاص للعامل',
    'Render platform-workers private HQ jobs base URL. Not a browser URL and not the tenant web-admin URL. Read from process.env only.',
    'العنوان الأساسي الخاص لمهام HQ الذي يستخدمه العامل. ليس عنوان متصفح وليس عنوان تطبيق المنشأة. يُقرأ من بيئة العملية فقط.',
    'URL', false, false, 'ENV_ONLY', 'HQ_JOBS_API_URL',
    false, false, true, NULL, 'HOSTING_ENV',
    'Set HQ_JOBS_API_URL on the Render worker to the deployed private HQ jobs base path, then redeploy. Do not paste the value into chat, tickets, or this registry.',
    'عيّن HQ_JOBS_API_URL على العامل إلى مسار مهام HQ الخاص المنشور ثم أعد النشر. لا تلصق القيمة في المحادثة أو التذاكر أو هذا السجل.',
    '[{"app":"HQ_WORKERS","is_still_used":true}]'::jsonb,
    '[{"scope":"HQ_WORKERS","env_var_name":"HQ_JOBS_API_URL","is_it_there":"unknown","value":null,"fingerprint":null,"description":"Read only from Render platform-workers process.env. Presence and value are never copied into the registry.","is_still_used":true}]'::jsonb,
    '0777_ops_config_i11_worker_env', true, 1
  ),
  (
    'platform.worker_api_key', 'platform',
    'Platform worker machine key', 'مفتاح آلة عامل المنصة',
    'Dedicated machine key shared by HQ API PlatformWorkerGuard and Render platform-workers. Write-only metadata; HQ Check now can report HQ API presence only, never the value and never Render presence.',
    'مفتاح آلة مخصص يشترك فيه حارس HQ API وعمّال Render. بيانات وصفية للكتابة فقط؛ تحقق HQ يبلّغ وجود المتغير في واجهة HQ فقط دون القيمة ودون بيئة Render.',
    'SECRET_STRING', true, false, 'ENV_ONLY', 'PLATFORM_WORKER_API_KEY',
    false, false, true, NULL, 'HOSTING_ENV',
    'Set the same dedicated PLATFORM_WORKER_API_KEY on HQ API and the Render worker, then redeploy both. Never paste, log, or store the value in this registry.',
    'عيّن نفس PLATFORM_WORKER_API_KEY المخصص على واجهة HQ وعامل Render ثم أعد نشر الاثنين. لا تلصق القيمة أو تسجّلها أو تخزّنها في هذا السجل.',
    '[{"app":"HQ_API","is_still_used":true},{"app":"HQ_WORKERS","is_still_used":true}]'::jsonb,
    '[{"scope":"HQ_API","env_var_name":"PLATFORM_WORKER_API_KEY","is_it_there":"unknown","value":null,"fingerprint":null,"description":"Read by HQ platform-api PlatformWorkerGuard from its host environment. Check now may report presence on this host only; the value is never returned.","is_still_used":true},{"scope":"HQ_WORKERS","env_var_name":"PLATFORM_WORKER_API_KEY","is_it_there":"unknown","value":null,"fingerprint":null,"description":"Read by Render platform-workers from its host environment. HQ API cannot verify this host or expose the secret.","is_still_used":true}]'::jsonb,
    '0777_ops_config_i11_worker_env', true, 1
  )
ON CONFLICT (config_key) DO NOTHING;

COMMENT ON COLUMN public.sys_ops_config_cf.is_wired IS
  'True only when application code reads the live value through ConfigResolverService. False means a stored registry value is not consumed; host-managed worker keys stay false until a resolver exists in that process.';

-- Refuse a stored value when nothing reads the registry for this key.
CREATE OR REPLACE FUNCTION public.fn_ops_config_set(
  p_key         TEXT,
  p_value_plain TEXT,
  p_value_enc   TEXT,
  p_fingerprint TEXT,
  p_actor       TEXT
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

  IF v_cfg.is_bootstrap THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BOOTSTRAP_KEY',
      'message', 'Bootstrap keys can only be set in the hosting environment', 'config_key', p_key);
  END IF;
  -- Unwired keys have no registry consumer; a stored value would be a false operator control.
  IF NOT v_cfg.is_wired THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNWIRED_KEY',
      'message', 'Unwired keys do not consume a stored value; set the host environment instead', 'config_key', p_key);
  END IF;
  IF v_cfg.source_policy = 'ENV_ONLY' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ENV_ONLY_POLICY',
      'message', 'Policy ENV_ONLY does not allow a stored value; change the policy first', 'config_key', p_key);
  END IF;
  IF p_fingerprint IS NULL OR p_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FINGERPRINT',
      'message', 'Fingerprint must be a SHA-256 hex digest', 'config_key', p_key);
  END IF;

  IF v_cfg.is_encrypted THEN
    IF p_value_enc IS NULL OR btrim(p_value_enc) = '' OR p_value_plain IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'VALUE_SHAPE',
        'message', 'This key is encrypted: supply the envelope only', 'config_key', p_key);
    END IF;
    IF length(p_value_enc) > 16000 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'VALUE_TOO_LONG', 'message', 'Value is too long', 'config_key', p_key);
    END IF;
  ELSE
    IF p_value_plain IS NULL OR btrim(p_value_plain) = '' OR p_value_enc IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'VALUE_SHAPE',
        'message', 'This key is plain: supply the plain value only', 'config_key', p_key);
    END IF;
    IF length(p_value_plain) > 4000 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'VALUE_TOO_LONG', 'message', 'Value is too long', 'config_key', p_key);
    END IF;
  END IF;

  UPDATE public.sys_ops_config_cf
  SET db_value             = CASE WHEN v_cfg.is_encrypted THEN NULL ELSE p_value_plain END,
      db_value_enc         = CASE WHEN v_cfg.is_encrypted THEN p_value_enc ELSE NULL END,
      db_value_fingerprint = p_fingerprint,
      last_check_status    = NULL,
      last_check_at        = NULL,
      value_updated_at     = now(),
      value_updated_by     = v_actor,
      updated_info         = 'fn_ops_config_set by ' || v_actor
  WHERE config_key = p_key;

  INSERT INTO public.sys_ops_config_chg_log (config_key, action, actor, old_fingerprint, new_fingerprint, created_info)
  VALUES (p_key, 'SET', v_actor, v_cfg.db_value_fingerprint, p_fingerprint, 'fn_ops_config_set');

  RETURN jsonb_build_object('ok', true, 'code', 'UPDATED', 'message', 'Value stored', 'config_key', p_key);
END;
$$;

COMMENT ON FUNCTION public.fn_ops_config_set(TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'Stores a config value as plain text or an API envelope plus SHA-256 fingerprint. Rejects bootstrap, unwired, and ENV_ONLY keys. Logs the fingerprint change only; never logs the value.';

-- Unwired keys may only become ENV_ONLY so operators cannot invent a stored-value control.
CREATE OR REPLACE FUNCTION public.fn_ops_config_set_policy(
  p_key    TEXT,
  p_policy TEXT,
  p_actor  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cfg     public.sys_ops_config_cf%ROWTYPE;
  v_actor   TEXT := left(COALESCE(NULLIF(btrim(p_actor), ''), 'unknown'), 120);
  v_cleared BOOLEAN := false;
BEGIN
  IF p_policy IS NULL OR p_policy NOT IN (
    'DB_ONLY', 'ENV_ONLY', 'BOTH_MUST_MATCH', 'ENV_OVERRIDES_DB', 'DB_OVERRIDES_ENV', 'TAKE_EXISTING_DB_OR_ENV'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_POLICY', 'message', 'Unknown source policy', 'config_key', p_key);
  END IF;

  SELECT * INTO v_cfg
  FROM public.sys_ops_config_cf
  WHERE config_key = p_key AND rec_status = 1 AND is_active
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Config key is not registered', 'config_key', p_key);
  END IF;
  IF v_cfg.is_bootstrap THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BOOTSTRAP_KEY',
      'message', 'Bootstrap keys are always ENV_ONLY', 'config_key', p_key);
  END IF;
  IF v_cfg.source_policy = p_policy THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOTHING_TO_CHANGE', 'message', 'Policy is already set', 'config_key', p_key);
  END IF;
  IF NOT v_cfg.is_wired AND p_policy <> 'ENV_ONLY' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNWIRED_KEY',
      'message', 'Unwired keys cannot use a stored-value policy; the consumer does not read the registry', 'config_key', p_key);
  END IF;
  IF p_policy <> 'DB_ONLY' AND (v_cfg.env_var_name IS NULL OR btrim(v_cfg.env_var_name) = '') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ENV_VAR_REQUIRED',
      'message', 'This key has no environment variable name', 'config_key', p_key);
  END IF;
  IF p_policy IN ('DB_ONLY', 'BOTH_MUST_MATCH')
     AND v_cfg.db_value IS NULL AND v_cfg.db_value_enc IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'DB_VALUE_REQUIRED',
      'message', 'Store a value before switching to this policy', 'config_key', p_key);
  END IF;

  v_cleared := p_policy = 'ENV_ONLY' AND v_cfg.db_value_fingerprint IS NOT NULL;

  UPDATE public.sys_ops_config_cf
  SET source_policy        = p_policy,
      db_value             = CASE WHEN p_policy = 'ENV_ONLY' THEN NULL ELSE db_value END,
      db_value_enc         = CASE WHEN p_policy = 'ENV_ONLY' THEN NULL ELSE db_value_enc END,
      db_value_fingerprint = CASE WHEN p_policy = 'ENV_ONLY' THEN NULL ELSE db_value_fingerprint END,
      last_check_status    = NULL,
      last_check_at        = NULL,
      value_updated_at     = now(),
      value_updated_by     = v_actor,
      updated_info         = 'fn_ops_config_set_policy by ' || v_actor
  WHERE config_key = p_key;

  INSERT INTO public.sys_ops_config_chg_log (
    config_key, action, actor, old_fingerprint, new_fingerprint, old_policy, new_policy, created_info
  ) VALUES (
    p_key, 'POLICY_CHANGE', v_actor, v_cfg.db_value_fingerprint,
    CASE WHEN p_policy = 'ENV_ONLY' THEN NULL ELSE v_cfg.db_value_fingerprint END,
    v_cfg.source_policy, p_policy, 'fn_ops_config_set_policy'
  );

  RETURN jsonb_build_object('ok', true, 'code', 'UPDATED', 'message', 'Policy updated',
    'config_key', p_key, 'cleared_value', v_cleared);
END;
$$;

COMMENT ON FUNCTION public.fn_ops_config_set_policy(TEXT, TEXT, TEXT) IS
  'Changes the source policy of a non-bootstrap key. Unwired keys may only become ENV_ONLY. DB_ONLY/BOTH_MUST_MATCH require a stored value; ENV_ONLY clears any stored value. Logs the change without values.';

REVOKE ALL ON FUNCTION public.fn_ops_config_set(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_config_set_policy(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ops_config_set(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_config_set_policy(TEXT, TEXT, TEXT) TO service_role;

COMMIT;
