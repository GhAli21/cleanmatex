-- ============================================================
-- Migration: 0502_ntf_runtime_hub_flags.sql
-- Purpose:   Move Notification Hub non-secret runtime flags
--            (previously env-only in web-admin/lib/notifications/config.ts
--            and related .env.local keys) into sys_ntf_runtime_cf so
--            operators can change sandbox/from/dispatch behaviour
--            without a redeploy. Secrets stay in env.
-- Affected:  sys_ntf_runtime_cf
-- Related:   0355 (table + base_url/outbox_secret_key),
--            0356 (audit columns)
-- ============================================================
-- Do not apply automatically. Review first.
-- Secrets NOT stored here: TWILIO_AUTH_TOKEN, TWILIO_ACCOUNT_SID,
-- NOTIFICATIONS_OUTBOX_SECRET (already outbox_secret_key),
-- META_WHATSAPP_ACCESS_TOKEN, NTF_HQ_SERVICE_ROLE_KEY,
-- RESEND_API_KEY.
-- ROLLBACK PLAN: DELETE the seeded keys listed below.
-- ON CONFLICT DO NOTHING so re-apply does not overwrite ops edits.

BEGIN;

INSERT INTO public.sys_ntf_runtime_cf (
  key,
  value,
  is_active,
  rec_status,
  rec_notes,
  created_by,
  created_info
)
VALUES
  (
    'whatsapp_fallback_email',
    'true',
    true,
    1,
    'Env: NTF_WHATSAPP_FALLBACK_EMAIL. Route WHATSAPP to EMAIL when WA cannot send.',
    'system',
    '0502_ntf_runtime_hub_flags'
  ),
  (
    'order_transition_notify',
    'false',
    true,
    1,
    'Env: NTF_ORDER_TRANSITION_NOTIFY. Legacy /orders/[id]/transition notify path.',
    'system',
    '0502_ntf_runtime_hub_flags'
  ),
  (
    'wa_use_sandbox_template',
    'true',
    true,
    1,
    'Env: TWILIO_WHATSAPP_USE_SANDBOX_TEMPLATE. Set false for production WABA free-form or approved templates via provider config.',
    'system',
    '0502_ntf_runtime_hub_flags'
  ),
  (
    'wa_sandbox_content_sid',
    'HXf671d04d86dbedf8df5231159beee93a',
    true,
    1,
    'Env: TWILIO_WHATSAPP_SANDBOX_CONTENT_SID. order_created_simple Content SID.',
    'system',
    '0502_ntf_runtime_hub_flags'
  ),
  (
    'outbox_inline_dispatch',
    'true',
    true,
    1,
    'Env: NTF_OUTBOX_INLINE_DISPATCH. Send WhatsApp in-process; set false in production so pg_cron owns dispatch.',
    'system',
    '0502_ntf_runtime_hub_flags'
  ),
  (
    'twilio_sms_from',
    '+17017796841',
    true,
    1,
    'Env: TWILIO_SMS_FROM. E.164 SMS sender.',
    'system',
    '0502_ntf_runtime_hub_flags'
  ),
  (
    'twilio_whatsapp_from',
    'whatsapp:+14155238886',
    true,
    1,
    'Env: TWILIO_WHATSAPP_FROM. Sandbox sender; replace with production WABA number when live.',
    'system',
    '0502_ntf_runtime_hub_flags'
  ),
  (
    'ntf_dispatch_via_hq',
    'false',
    true,
    1,
    'Env: NTF_DISPATCH_VIA_HQ. When true, EMAIL/SMS/WA/PUSH go through HQ proxy.',
    'system',
    '0502_ntf_runtime_hub_flags'
  ),
  (
    'ntf_hq_dispatch_url',
    'http://localhost:3002/api/hq/v1/notifications/dispatch',
    true,
    1,
    'Env: NTF_HQ_DISPATCH_URL. HQ dispatch endpoint (no secret).',
    'system',
    '0502_ntf_runtime_hub_flags'
  ),
  (
    'resend_from_email',
    'noreply@service.cleanmatex.com',
    true,
    1,
    'Env: RESEND_FROM_EMAIL. From address for Notification Hub email.',
    'system',
    '0502_ntf_runtime_hub_flags'
  )
ON CONFLICT (key) DO NOTHING;

COMMIT;
