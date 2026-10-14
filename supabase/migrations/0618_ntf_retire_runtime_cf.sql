-- Notification Hub — retire sys_ntf_runtime_cf (R6b). The Config Registry (sys_ops_config_cf) is the
-- single authority for configuration (owner decision 2026-10-15).
--
-- Preconditions met before this file:
--   * 0617 copied every runtime flag into the registry (with fingerprints and change-log rows).
--   * The tenant app reads the registry through lib/ops-config/tenant-config-resolver.ts; HQ
--     platform-api reads it through ConfigResolverService; the HQ Runtime Config screen and its API
--     are removed; the outbox secret lives in Vault (0616).
--   * The only database object that still mentions the table is fn_ntf_cron_post's legacy fallback,
--     replaced below. No view, trigger, foreign key or other function depends on it (checked).
--
-- Safety: the migration ABORTS (no change at all) if any non-empty runtime value is missing from the
-- registry or differs from the registry's stored value, so nothing operator-set can be lost.
BEGIN;

-- 1. Guard: every non-empty runtime flag must already be stored, identically, in the registry.
DO $$
DECLARE
  v_missing TEXT;
BEGIN
  IF to_regclass('public.sys_ntf_runtime_cf') IS NULL THEN
    RETURN; -- already retired (re-run)
  END IF;

  SELECT string_agg(m.runtime_key, ', ' ORDER BY m.runtime_key)
    INTO v_missing
    FROM (VALUES
      ('whatsapp_fallback_email', 'ntf.app.whatsapp_fallback_email'),
      ('order_transition_notify', 'ntf.app.order_transition_notify'),
      ('outbox_inline_dispatch', 'ntf.app.outbox_inline_dispatch'),
      ('ntf_dispatch_via_hq', 'ntf.app.dispatch_via_hq'),
      ('ntf_hq_dispatch_url', 'ntf.app.hq_dispatch_url'),
      ('ntf_hq_route_dispatch_url', 'ntf.app.hq_route_dispatch_url'),
      ('resend_from_email', 'ntf.app.resend_from_email'),
      ('twilio_sms_from', 'ntf.app.twilio_sms_from'),
      ('twilio_whatsapp_from', 'ntf.app.twilio_whatsapp_from'),
      ('wa_sandbox_content_sid', 'ntf.app.wa_sandbox_content_sid'),
      ('wa_sandbox_to_phone', 'ntf.app.wa_sandbox_to_phone'),
      ('wa_use_sandbox_template', 'ntf.app.wa_use_sandbox_template'),
      ('base_url', 'ntf.app.base_url')
    ) AS m(runtime_key, config_key)
    JOIN public.sys_ntf_runtime_cf r ON r.key = m.runtime_key
    LEFT JOIN public.sys_ops_config_cf c ON c.config_key = m.config_key
   WHERE btrim(COALESCE(r.value, '')) <> ''
     AND (c.db_value_fingerprint IS NULL
          OR c.db_value_fingerprint <> encode(sha256(convert_to(btrim(r.value), 'UTF8')), 'hex'));

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0618 aborted: runtime flags not (identically) stored in sys_ops_config_cf: %. Store them on HQ /ops/config, then re-run.', v_missing;
  END IF;

  -- Rows with keys outside the known mapping would be silently lost: refuse them too.
  SELECT string_agg(r.key, ', ' ORDER BY r.key)
    INTO v_missing
    FROM public.sys_ntf_runtime_cf r
   WHERE btrim(COALESCE(r.value, '')) <> ''
     AND r.key NOT IN ('whatsapp_fallback_email', 'order_transition_notify', 'outbox_inline_dispatch',
                       'ntf_dispatch_via_hq', 'ntf_hq_dispatch_url', 'ntf_hq_route_dispatch_url',
                       'resend_from_email', 'twilio_sms_from', 'twilio_whatsapp_from',
                       'wa_sandbox_content_sid', 'wa_sandbox_to_phone', 'wa_use_sandbox_template', 'base_url');
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0618 aborted: sys_ntf_runtime_cf holds keys with no registry home: %. Register them first.', v_missing;
  END IF;
END;
$$;

-- 2. pg_cron dispatcher: base_url from the registry only (the legacy fallback is removed with the table).
CREATE OR REPLACE FUNCTION public.fn_ntf_cron_post(p_path TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url    TEXT;
  v_secret TEXT;
BEGIN
  SELECT c.db_value INTO v_url
    FROM public.sys_ops_config_cf c
   WHERE c.config_key = 'ntf.app.base_url' AND c.rec_status = 1 AND c.is_active AND NOT c.is_encrypted;
  v_secret := public.fn_ntf_cron_secret();

  IF v_url IS NULL OR btrim(v_url) = '' OR v_secret IS NULL THEN
    RAISE WARNING '[fn_ntf_cron_post] % skipped: registry key ntf.app.base_url or the vault secret ntf_outbox_secret is missing', p_path;
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := btrim(v_url) || p_path,
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_secret
               ),
    body    := '{}'::jsonb
  );
END;
$$;
COMMENT ON FUNCTION public.fn_ntf_cron_post(TEXT) IS
  'pg_cron dispatcher: reads base_url from the Config Registry (ntf.app.base_url, plain) and the bearer secret from Vault, then POSTs {} to base_url || p_path through pg_net. Warns and skips when either is missing. Internal; revoked from API roles.';
REVOKE ALL ON FUNCTION public.fn_ntf_cron_post(TEXT) FROM PUBLIC, anon, authenticated, service_role;

-- 3. Retire the legacy table. RESTRICT: fails instead of cascading if anything still depends on it.
DROP TABLE IF EXISTS public.sys_ntf_runtime_cf RESTRICT;

-- 4. The tenant notification keys are now read through the tenant resolver: mark them wired.
--    Values change within the 45 s resolver cache, so no restart is needed.
UPDATE public.sys_ops_config_cf
   SET is_wired = true,
       requires_restart = false,
       updated_at = now(),
       updated_info = '0618_ntf_retire_runtime_cf'
 WHERE config_key IN (
         'ntf.app.whatsapp_fallback_email', 'ntf.app.order_transition_notify', 'ntf.app.outbox_inline_dispatch',
         'ntf.app.dispatch_via_hq', 'ntf.app.hq_dispatch_url', 'ntf.app.hq_route_dispatch_url',
         'ntf.app.resend_from_email', 'ntf.app.twilio_sms_from', 'ntf.app.twilio_whatsapp_from',
         'ntf.app.wa_sandbox_content_sid', 'ntf.app.wa_sandbox_to_phone', 'ntf.app.wa_use_sandbox_template',
         'ntf.app.twilio.account_sid', 'ntf.app.twilio.auth_token', 'ntf.app.twilio.phone_number',
         'ntf.app.resend.api_key', 'ntf.app.resend.webhook_secret',
         'ntf.app.meta.wa_access_token', 'ntf.app.meta.wa_phone_number_id',
         'ntf.app.vapid.public_key', 'ntf.app.vapid.private_key', 'ntf.app.vapid.subject',
         'ntf.app.onesignal.app_id', 'ntf.app.onesignal.rest_api_key',
         'ntf.app.fcm.service_account', 'ntf.app.fcm.project_id',
         'ntf.app.outbox_secret', 'ntf.app.outbox_worker_id'
       )
   AND (is_wired IS DISTINCT FROM true OR requires_restart IS DISTINCT FROM false);

-- 5. Operations catalog guidance: the Resend signing secret can now also live in the registry.
UPDATE public.sys_ops_operation_cf
   SET guidance_md = guidance_md || E'\n6. Alternative to step 4: store the secret on HQ **Operations > Configuration Registry**, key `ntf.app.resend.webhook_secret` (the tenant app reads it within 45 s; a set env var still wins).',
       guidance_md2 = COALESCE(guidance_md2, '') || E'\n6. بديل للخطوة 4: خزّن السر في HQ **العمليات > سجل الإعدادات** بالمفتاح `ntf.app.resend.webhook_secret` (يقرؤه تطبيق المنشأة خلال 45 ثانية؛ ويبقى متغير البيئة المعيّن هو الأعلى).',
       updated_info = '0618_ntf_retire_runtime_cf'
 WHERE operation_code = 'ntf.resend_webhook_setup'
   AND guidance_md NOT LIKE '%ntf.app.resend.webhook_secret%';

COMMIT;
