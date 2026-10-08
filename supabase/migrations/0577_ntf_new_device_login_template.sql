-- =============================================================================
-- 0577_ntf_new_device_login_template.sql
-- Purpose:  User Session Lifecycle, Phase 5 — real content for the "new device sign-in" alert.
--           Event 'security.login.detected' (seeded in 0345) only had the generic placeholder text
--           "New or unusual login detected". This adds template version 2 that tells the user WHICH
--           device, from WHICH IP address and WHEN, in English and Arabic, on every channel the event
--           already maps to (IN_APP, EMAIL, PUSH).
-- Emitted by: web-admin login route -> notifyNewDeviceSignIn() when fn_auth_session_register reports a
--           new device and the tenant policy AUTH_NEW_DEVICE_ALERT is on.
-- Variables: {{device_label}}, {{ip_address}}, {{signed_in_at}}  (all strings; "—" when unknown)
-- Depends:  0345 (event), 0346/0382 (template tables + v1 default template).
-- Idempotent: re-running changes nothing (ON CONFLICT DO NOTHING / WHERE NOT EXISTS).
-- Reversal (forward-only):
--   UPDATE sys_ntf_template_ver_dtl SET status = 'RETIRED', retired_at = CURRENT_TIMESTAMP, is_active = false
--    WHERE template_code = 'security.login.detected.default' AND version_number = 2;
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Template version 2 (APPROVED). The renderer always picks the highest approved version, so v1 stays
--    as history and is not edited.
-- ---------------------------------------------------------------------------
INSERT INTO public.sys_ntf_template_ver_dtl
  (template_code, version_number, subject, subject2, body, body2, status, approved_by, approved_at, created_by, created_info)
SELECT
  'security.login.detected.default',
  2,
  'New sign-in to your account',
  'تسجيل دخول جديد إلى حسابك',
  'Your account was signed in from a new device: {{device_label}} (IP {{ip_address}}) at {{signed_in_at}}. If this was not you, sign out that device and change your password now.',
  'تم تسجيل الدخول إلى حسابك من جهاز جديد: {{device_label}} (عنوان IP {{ip_address}}) في {{signed_in_at}}. إذا لم تكن أنت، سجّل خروج هذا الجهاز وغيّر كلمة المرور الآن.',
  'APPROVED',
  'system_admin',
  CURRENT_TIMESTAMP,
  'system_admin',
  'User_Session_Lifecycle Phase 5 — new-device sign-in alert content.'
WHERE EXISTS (SELECT 1 FROM public.sys_ntf_templates_mst WHERE template_code = 'security.login.detected.default')
ON CONFLICT (template_code, version_number) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Per-channel rendering for v2: same content on every channel v1 had (copies the channel metadata).
-- ---------------------------------------------------------------------------
INSERT INTO public.sys_ntf_template_chan_dtl
  (template_version_id, channel_code, rendered_subject, rendered_subject2, rendered_body, rendered_body2, metadata, created_by, created_info)
SELECT
  v2.id,
  c1.channel_code,
  v2.subject,
  v2.subject2,
  v2.body,
  v2.body2,
  c1.metadata,
  'system_admin',
  'User_Session_Lifecycle Phase 5 — new-device sign-in alert content.'
FROM public.sys_ntf_template_ver_dtl v2
JOIN public.sys_ntf_template_ver_dtl v1
  ON v1.template_code = v2.template_code AND v1.version_number = 1
JOIN public.sys_ntf_template_chan_dtl c1
  ON c1.template_version_id = v1.id AND c1.channel_code IN ('IN_APP', 'EMAIL', 'PUSH')
WHERE v2.template_code = 'security.login.detected.default'
  AND v2.version_number = 2
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_ntf_template_chan_dtl x
     WHERE x.template_version_id = v2.id AND x.channel_code = c1.channel_code
  );

-- ---------------------------------------------------------------------------
-- 3. Post-conditions
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sys_ntf_templates_mst WHERE template_code = 'security.login.detected.default')
     AND (SELECT count(*)
            FROM public.sys_ntf_template_chan_dtl c
            JOIN public.sys_ntf_template_ver_dtl v ON v.id = c.template_version_id
           WHERE v.template_code = 'security.login.detected.default' AND v.version_number = 2) < 1 THEN
    RAISE EXCEPTION '0577: no channel rows were created for security.login.detected.default v2';
  END IF;
END $$;

COMMIT;
