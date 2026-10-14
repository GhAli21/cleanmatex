-- Platform Operations Console — Config Registry conversion, step R6 (data only).
--
-- 1. The HQ platform-api call sites now read these keys through ConfigResolverService
--    (app code shipped with this migration), so they become "wired": a value stored in the
--    registry is now actually consumed, and a change takes effect within the resolver cache
--    TTL (45 s) instead of needing a restart.
-- 2. The twelve tenant-app runtime flags (ntf.app.<flag>) duplicated sys_ntf_runtime_cf, which the
--    tenant app already reads (env wins, then the stored value) and which the HQ Runtime Config
--    screen manages. Two stores for one flag would be two sources of truth, so the registry rows
--    are retired (soft-deleted, history kept) and sys_ntf_runtime_cf stays the single authority.
--
-- No schema change: UPDATEs of existing rows only. Idempotent (re-running changes nothing further).
BEGIN;

-- 1. Mark every converted HQ key as wired; resolver-read values do not need a restart.
UPDATE public.sys_ops_config_cf
   SET is_wired = true,
       requires_restart = false,
       updated_at = now(),
       updated_info = '0615_ops_config_wire_hq_keys'
 WHERE config_key IN (
         'ntf.hq.resend.api_key',
         'ntf.hq.resend.from_email',
         'ntf.hq.twilio.account_sid',
         'ntf.hq.twilio.auth_token',
         'ntf.hq.twilio.sms_from',
         'ntf.hq.twilio.whatsapp_from',
         'ntf.hq.twilio.webhook_url',
         'ntf.hq.twilio.content_cred_ref',
         'ntf.hq.twilio.content_cred_ver',
         'ntf.hq.meta.app_secret',
         'ntf.hq.meta.wa_access_token',
         'ntf.hq.meta.wa_phone_number_id',
         'ntf.hq.fcm.server_key',
         'ntf.hq.queue_enabled'
       )
   AND applies_to_app IN ('PLATFORM_API', 'ALL')
   AND (is_wired IS DISTINCT FROM true OR requires_restart IS DISTINCT FROM false);

-- 2. Retire the duplicate tenant runtime-flag rows (soft delete; the change log is untouched).
UPDATE public.sys_ops_config_cf
   SET is_active = false,
       rec_status = 0,
       rec_notes = 'Retired by 0615: this flag is authoritative in sys_ntf_runtime_cf (HQ Runtime Config screen); a second store would be a second source of truth.',
       updated_at = now(),
       updated_info = '0615_ops_config_wire_hq_keys'
 WHERE config_key IN (
         'ntf.app.whatsapp_fallback_email',
         'ntf.app.order_transition_notify',
         'ntf.app.outbox_inline_dispatch',
         'ntf.app.dispatch_via_hq',
         'ntf.app.hq_dispatch_url',
         'ntf.app.hq_route_dispatch_url',
         'ntf.app.resend_from_email',
         'ntf.app.twilio_sms_from',
         'ntf.app.twilio_whatsapp_from',
         'ntf.app.wa_use_sandbox_template',
         'ntf.app.wa_sandbox_content_sid',
         'ntf.app.wa_sandbox_to_phone'
       )
   AND applies_to_app = 'TENANT_WEB'
   AND is_active = true;

COMMIT;
