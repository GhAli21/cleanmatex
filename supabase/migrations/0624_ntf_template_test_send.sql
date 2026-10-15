-- Notification Hub R12 — generic template preview and test send (HQ).
--
-- 1. Permission hq_notifications:test_send (catalog row; SUPER_ADMIN already holds the global grant).
--    Previewing needs only hq_notifications:read; actually sending a test message is a separate grant.
-- 2. hq_ntf_dispatch_log.is_test marks test commands so they never count as customer traffic in usage,
--    quota or billing views. The HQ dispatcher skips quota reservation and metering for them.
-- 3. Two registry keys: the allow-list of recipients a test message may go to, and the per-operator
--    rate limit. Metadata only; the allow-list value is set in the Config Registry screen.
-- Idempotent.
BEGIN;

-- 1. Permission ----------------------------------------------------------------------------------------------
INSERT INTO public.hq_permissions (
  permission_code, permission_name, permission_name_ar,
  resource_code, action_code, is_system, is_active, created_info
)
SELECT seed.code, seed.name_en, seed.name_ar,
       split_part(seed.code, ':', 1), split_part(seed.code, ':', 2),
       true, true, '0624 template test send'
FROM (
  VALUES ('hq_notifications:test_send', 'Send notification test messages', 'إرسال رسائل اختبار الإشعارات')
) AS seed(code, name_en, name_ar)
ON CONFLICT (permission_code) DO NOTHING;

-- 2. Test flag on the HQ dispatch ledger ---------------------------------------------------------------------
ALTER TABLE public.hq_ntf_dispatch_log
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN public.hq_ntf_dispatch_log.is_test IS
  'True for an operator test message (template test send). Test commands skip quota reservation and usage metering and must be excluded from customer-traffic reports.';

-- 3. Registry keys -------------------------------------------------------------------------------------------
INSERT INTO public.sys_ops_config_cf (
  config_key, module, name, name2, description, description2, value_type, is_secret, is_encrypted, source_policy,
  env_var_name, is_bootstrap, is_wired, requires_restart, manage_via, guidance, guidance2, applies_to_app, env_var_scope_val,
  created_info, is_active, rec_status
) VALUES
  ('ntf.hq.test_recipients', 'ntf', 'Test-send recipient allow-list', 'قائمة المستلمين المسموح لهم برسائل الاختبار',
   'Comma-separated email addresses and phone numbers (E.164) that template test messages may be sent to. Empty = test sending is refused.',
   'عناوين بريد وأرقام هواتف (E.164) مفصولة بفواصل يُسمح بإرسال رسائل الاختبار إليها. الفارغ = يُرفض الإرسال التجريبي.',
   'STRING', false, false, 'ENV_OVERRIDES_DB', 'HQ_NTF_TEST_RECIPIENTS', false, true, false, 'UI',
   'List only addresses that belong to your own team. A test message never goes to anyone outside this list, and recipients on a tenant''s suppression list are still refused.',
   'أدرج فقط العناوين التي تخص فريقك. لا تُرسل رسالة اختبار إلى أي جهة خارج هذه القائمة، ويبقى المستلمون في قائمة الحظر لدى المنشأة ممنوعين.',
   '[{"app":"HQ_API","is_still_used":true}]'::jsonb, '[]'::jsonb, '0624_ntf_template_test_send', true, 1),
  ('ntf.hq.test_send_per_min', 'ntf', 'Test sends per minute (per operator)', 'عدد رسائل الاختبار في الدقيقة (لكل مشغّل)',
   'Maximum template test messages one operator may send per minute (1-30, default 5).',
   'أقصى عدد رسائل اختبار يرسله مشغّل واحد في الدقيقة (1-30، الافتراضي 5).',
   'NUMBER', false, false, 'ENV_OVERRIDES_DB', 'HQ_NTF_TEST_SEND_PER_MIN', false, true, false, 'UI',
   'Whole number between 1 and 30. Takes effect within a minute.',
   'عدد صحيح بين 1 و30. يسري خلال دقيقة.',
   '[{"app":"HQ_API","is_still_used":true}]'::jsonb, '[]'::jsonb, '0624_ntf_template_test_send', true, 1)
ON CONFLICT (config_key) DO NOTHING;

COMMIT;
