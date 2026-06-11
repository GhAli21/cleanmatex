-- =============================================================================
-- CMX-PRD-019 Notification Hub — Step 2: Activate Providers & Enable Channels
-- =============================================================================
-- This script inserts directly into org_ntf_channel_provider_cf and
-- org_ntf_settings_cf for ONE tenant. Re-run replacing <TENANT_ID> for
-- each additional tenant.
--
-- PREREQUISITE: GUCs set (01_set_gucs.sql), app deployed with ENV vars.
--
-- HOW TO USE:
--   1. Run this query to get your tenant ID:
--      SELECT id, name FROM org_tenants_mst WHERE is_active = true;
--   2. Replace every occurrence of '<TENANT_ID>' below with the UUID.
--   3. Paste into Supabase SQL Editor and run.
--
-- NOTE: You may also use the REST API instead (see 04_provider_activation.md).
--       This SQL approach is equivalent and avoids needing the app running.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. FIND YOUR TENANT ID (run this first, then fill in <TENANT_ID> below)
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT id, name FROM org_tenants_mst WHERE is_active = true ORDER BY created_at;


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. REGISTER + ACTIVATE PROVIDERS
-- ─────────────────────────────────────────────────────────────────────────────

-- IN_APP — built-in Supabase Realtime, no external config needed
INSERT INTO org_ntf_channel_provider_cf (
  id, tenant_org_id, channel_code, provider_code,
  display_name, config, is_active,
  is_enabled, rec_status, created_at, created_by
) VALUES (
  gen_random_uuid(), '<TENANT_ID>', 'IN_APP', 'SUPABASE_REALTIME',
  'Supabase Realtime (built-in)', '{}'::jsonb, true,
  true, 1, NOW(), 'system_setup'
)
ON CONFLICT (tenant_org_id, channel_code, provider_code)
DO UPDATE SET is_active = true, updated_at = NOW();

-- EMAIL — Resend (fill your from_email after your domain is verified in Resend)
INSERT INTO org_ntf_channel_provider_cf (
  id, tenant_org_id, channel_code, provider_code,
  display_name, config, is_active,
  is_enabled, rec_status, created_at, created_by
) VALUES (
  gen_random_uuid(), '<TENANT_ID>', 'EMAIL', 'RESEND',
  'Resend', jsonb_build_object('from_email', 'noreply@cmx.cleanmatex.com', 'from_name', 'CleanMateX'), true,
  true, 1, NOW(), 'system_setup'
)
ON CONFLICT (tenant_org_id, channel_code, provider_code)
DO UPDATE SET is_active = true, config = EXCLUDED.config, updated_at = NOW();

-- SMS — Twilio (uncomment after setting TWILIO_* env vars)
-- UPDATE org_ntf_channel_provider_cf SET is_active = false
--   WHERE tenant_org_id = '<TENANT_ID>' AND channel_code = 'SMS';
-- INSERT INTO org_ntf_channel_provider_cf (
--   id, tenant_org_id, channel_code, provider_code,
--   display_name, config, is_active, is_enabled, rec_status, created_at, created_by
-- ) VALUES (
--   gen_random_uuid(), '<TENANT_ID>', 'SMS', 'TWILIO_SMS',
--   'Twilio SMS', jsonb_build_object('from_number', '+1XXXXXXXXXX'), true,
--   true, 1, NOW(), 'system_setup'
-- )
-- ON CONFLICT (tenant_org_id, channel_code, provider_code)
-- DO UPDATE SET is_active = true, config = EXCLUDED.config, updated_at = NOW();

-- WHATSAPP — Twilio BSP (uncomment after Twilio WhatsApp approval)
-- INSERT INTO org_ntf_channel_provider_cf (
--   id, tenant_org_id, channel_code, provider_code,
--   display_name, config, is_active, is_enabled, rec_status, created_at, created_by
-- ) VALUES (
--   gen_random_uuid(), '<TENANT_ID>', 'WHATSAPP', 'TWILIO_WHATSAPP',
--   'WhatsApp via Twilio', jsonb_build_object('from_number', 'whatsapp:+1XXXXXXXXXX'), true,
--   true, 1, NOW(), 'system_setup'
-- )
-- ON CONFLICT (tenant_org_id, channel_code, provider_code)
-- DO UPDATE SET is_active = true, config = EXCLUDED.config, updated_at = NOW();

-- PUSH — VAPID (uncomment after NEXT_PUBLIC_VAPID_PUBLIC_KEY is live in frontend)
-- INSERT INTO org_ntf_channel_provider_cf (
--   id, tenant_org_id, channel_code, provider_code,
--   display_name, config, is_active, is_enabled, rec_status, created_at, created_by
-- ) VALUES (
--   gen_random_uuid(), '<TENANT_ID>', 'PUSH', 'VAPID',
--   'Browser Web Push (VAPID)', jsonb_build_object('vapid_public_key', 'BKug-WOexd_dskGfX9LRYcN2BEhFvT6c1ZpuvudND4wXxHrEoUBOJsiJqVq8QT0H6ncM9On5tnwyMsT2BqQfgrQ'), true,
--   true, 1, NOW(), 'system_setup'
-- )
-- ON CONFLICT (tenant_org_id, channel_code, provider_code)
-- DO UPDATE SET is_active = true, config = EXCLUDED.config, updated_at = NOW();


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ENABLE CHANNELS
-- ─────────────────────────────────────────────────────────────────────────────

-- IN_APP — always enable; no quiet hours needed
INSERT INTO org_ntf_settings_cf (
  id, tenant_org_id, channel_code,
  is_enabled, quiet_hours_enabled, daily_limit,
  rec_status, created_at, created_by
) VALUES (
  gen_random_uuid(), '<TENANT_ID>', 'IN_APP',
  true, false, 500,
  1, NOW(), 'system_setup'
)
ON CONFLICT (tenant_org_id, channel_code)
DO UPDATE SET is_enabled = true, updated_at = NOW();

-- EMAIL — enable with GCC quiet hours (22:00–08:00 Gulf Standard Time)
INSERT INTO org_ntf_settings_cf (
  id, tenant_org_id, channel_code,
  is_enabled, quiet_hours_enabled,
  quiet_hours_start, quiet_hours_end, quiet_hours_tz,
  daily_limit, rec_status, created_at, created_by
) VALUES (
  gen_random_uuid(), '<TENANT_ID>', 'EMAIL',
  true, false,
  '22:00', '08:00', 'Asia/Dubai',
  100, 1, NOW(), 'system_setup'
)
ON CONFLICT (tenant_org_id, channel_code)
DO UPDATE SET is_enabled = true, updated_at = NOW();

-- SMS — disabled until Twilio creds set (change is_enabled = true when ready)
INSERT INTO org_ntf_settings_cf (
  id, tenant_org_id, channel_code,
  is_enabled, quiet_hours_enabled,
  quiet_hours_start, quiet_hours_end, quiet_hours_tz,
  daily_limit, rec_status, created_at, created_by
) VALUES (
  gen_random_uuid(), '<TENANT_ID>', 'SMS',
  false, true,
  '22:00', '08:00', 'Asia/Dubai',
  50, 1, NOW(), 'system_setup'
)
ON CONFLICT (tenant_org_id, channel_code)
DO UPDATE SET updated_at = NOW();

-- WHATSAPP — disabled until templates approved
INSERT INTO org_ntf_settings_cf (
  id, tenant_org_id, channel_code,
  is_enabled, quiet_hours_enabled,
  quiet_hours_start, quiet_hours_end, quiet_hours_tz,
  daily_limit, rec_status, created_at, created_by
) VALUES (
  gen_random_uuid(), '<TENANT_ID>', 'WHATSAPP',
  false, true,
  '22:00', '08:00', 'Asia/Dubai',
  50, 1, NOW(), 'system_setup'
)
ON CONFLICT (tenant_org_id, channel_code)
DO UPDATE SET updated_at = NOW();

-- PUSH — disabled until VAPID push subscription client is live
INSERT INTO org_ntf_settings_cf (
  id, tenant_org_id, channel_code,
  is_enabled, quiet_hours_enabled, daily_limit,
  rec_status, created_at, created_by
) VALUES (
  gen_random_uuid(), '<TENANT_ID>', 'PUSH',
  false, false, 200,
  1, NOW(), 'system_setup'
)
ON CONFLICT (tenant_org_id, channel_code)
DO UPDATE SET updated_at = NOW();


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. VERIFY
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  s.channel_code,
  s.is_enabled    AS channel_enabled,
  p.provider_code AS active_provider,
  p.is_active     AS provider_active
FROM org_ntf_settings_cf s
LEFT JOIN org_ntf_channel_provider_cf p
  ON p.tenant_org_id = s.tenant_org_id
 AND p.channel_code  = s.channel_code
 AND p.is_active     = true
WHERE s.tenant_org_id = '<TENANT_ID>'
ORDER BY s.channel_code;

-- Expected after this script:
--   IN_APP   | true   | SUPABASE_REALTIME | true
--   EMAIL    | true   | RESEND            | true
--   SMS      | false  | (null)            | (null)
--   WHATSAPP | false  | (null)            | (null)
--   PUSH     | false  | (null)            | (null)
