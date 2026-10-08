-- =============================================================================
-- 0584_ntf_password_changed_bilingual_actor.sql
-- Purpose:  User Session Lifecycle — password management follow-up to 0581.
--           Template v2 of 'security.password.changed.default' (0581) used ONE variable {{actor_label}} in both
--           the English and the Arabic text, so an Arabic notification would have said "by an administrator"
--           in English. Template v3 uses {{actor_label}} (English wording) in the English text and
--           {{actor_label2}} (Arabic wording) in the Arabic text; the web-admin emitter sends both variables
--           (lib/services/auth/password/password-notify.ts).
-- Variables: {{actor_label}}, {{actor_label2}}, {{changed_at}}   (all strings)
-- Depends:  0581 (v2), 0345/0346 (notification catalog + template tables).
-- Idempotent: re-running changes nothing (ON CONFLICT DO NOTHING / NOT EXISTS).
-- Reversal (forward-only):
--   UPDATE sys_ntf_template_ver_dtl SET status = 'RETIRED', retired_at = CURRENT_TIMESTAMP, is_active = false
--    WHERE template_code = 'security.password.changed.default' AND version_number = 3;
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Template version 3 (APPROVED). The renderer picks the highest approved version; v1/v2 stay as history.
-- ---------------------------------------------------------------------------
INSERT INTO public.sys_ntf_template_ver_dtl
  (template_code, version_number, subject, subject2, body, body2, status, approved_by, approved_at, created_by, created_info)
SELECT
  'security.password.changed.default', 3,
  'Your password was changed', 'تم تغيير كلمة المرور',
  'The password of your account was changed by {{actor_label}} at {{changed_at}}. If this was not you, contact your administrator immediately.',
  'تم تغيير كلمة مرور حسابك بواسطة {{actor_label2}} في {{changed_at}}. إذا لم تكن أنت، تواصل مع المسؤول فوراً.',
  'APPROVED', 'system_admin', CURRENT_TIMESTAMP, 'system_admin',
  'User_Session_Lifecycle — bilingual actor wording for the password-changed notification.'
WHERE EXISTS (SELECT 1 FROM public.sys_ntf_templates_mst WHERE template_code = 'security.password.changed.default')
ON CONFLICT (template_code, version_number) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Per-channel rendering for v3: same content on every channel v1 had (copies the channel metadata).
-- ---------------------------------------------------------------------------
INSERT INTO public.sys_ntf_template_chan_dtl
  (template_version_id, channel_code, rendered_subject, rendered_subject2, rendered_body, rendered_body2, metadata, created_by, created_info)
SELECT v3.id, c1.channel_code, v3.subject, v3.subject2, v3.body, v3.body2, c1.metadata, 'system_admin',
       'User_Session_Lifecycle — bilingual actor wording for the password-changed notification.'
FROM public.sys_ntf_template_ver_dtl v3
JOIN public.sys_ntf_template_ver_dtl v1 ON v1.template_code = v3.template_code AND v1.version_number = 1
JOIN public.sys_ntf_template_chan_dtl c1 ON c1.template_version_id = v1.id
WHERE v3.template_code = 'security.password.changed.default' AND v3.version_number = 3
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_ntf_template_chan_dtl x
    WHERE x.template_version_id = v3.id AND x.channel_code = c1.channel_code
  );

-- ---------------------------------------------------------------------------
-- 3. Post-conditions
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sys_ntf_templates_mst WHERE template_code = 'security.password.changed.default')
     AND (SELECT count(*)
            FROM public.sys_ntf_template_chan_dtl c
            JOIN public.sys_ntf_template_ver_dtl v ON v.id = c.template_version_id
           WHERE v.template_code = 'security.password.changed.default' AND v.version_number = 3) < 1 THEN
    RAISE EXCEPTION '0584: no channel rows were created for security.password.changed.default v3';
  END IF;
END $$;

COMMIT;
