-- =============================================================================
-- CMX-PRD-019 Notification Hub — Step 2: Activate Providers & Enable Channels
-- =============================================================================
-- Loops over ALL active tenants in org_tenants_mst and seeds:
--   • org_ntf_channel_provider_cf  — provider rows (IN_APP + EMAIL active;
--                                    SMS/WhatsApp/PUSH registered but inactive)
--   • org_ntf_settings_cf          — channel settings (IN_APP + EMAIL enabled;
--                                    SMS/WhatsApp/PUSH disabled pending credentials)
--
-- Idempotent: safe to re-run. ON CONFLICT clauses only update if values changed.
--
-- PREREQUISITE: Migrations 0355 + 0356 applied.
-- NOTE: You may also use the REST API instead (see 04_provider_activation.md).
-- =============================================================================

DO $$
DECLARE
  v_tenant_id   UUID;
  v_tenant_name TEXT;
  v_count       INT := 0;
BEGIN

  FOR v_tenant_id, v_tenant_name IN
    SELECT id, name FROM org_tenants_mst WHERE is_active = true ORDER BY created_at
  LOOP
    RAISE NOTICE 'Processing tenant: % (%)', v_tenant_name, v_tenant_id;

    -- ─────────────────────────────────────────────────────────────────────────
    -- PROVIDERS  (org_ntf_channel_provider_cf)
    -- ─────────────────────────────────────────────────────────────────────────

    -- IN_APP — Supabase Realtime (built-in, always active)
    INSERT INTO org_ntf_channel_provider_cf (
      id, tenant_org_id, channel_code, provider_code,
      display_name, config, is_active, is_enabled,
      rec_status, created_at, created_by
    ) VALUES (
      gen_random_uuid(), v_tenant_id, 'IN_APP', 'SUPABASE_REALTIME',
      'Supabase Realtime (built-in)', '{}'::jsonb, true, true,
      1, NOW(), 'system_setup'
    )
    ON CONFLICT (tenant_org_id, channel_code, provider_code)
    DO UPDATE SET is_active = true, is_enabled = true, updated_at = NOW();

    -- EMAIL — Resend (active; domain must be verified in Resend dashboard)
    INSERT INTO org_ntf_channel_provider_cf (
      id, tenant_org_id, channel_code, provider_code,
      display_name, config, is_active, is_enabled,
      rec_status, created_at, created_by
    ) VALUES (
      gen_random_uuid(), v_tenant_id, 'EMAIL', 'RESEND',
      'Resend', jsonb_build_object('from_email', 'noreply@cmx.cleanmatex.com', 'from_name', 'CleanMateX'), true, true,
      1, NOW(), 'system_setup'
    )
    ON CONFLICT (tenant_org_id, channel_code, provider_code)
    DO UPDATE SET is_active = true, is_enabled = true, config = EXCLUDED.config, updated_at = NOW();

    -- SMS — Twilio (registered but inactive until TWILIO_* env vars are set)
    INSERT INTO org_ntf_channel_provider_cf (
      id, tenant_org_id, channel_code, provider_code,
      display_name, config, is_active, is_enabled,
      rec_status, created_at, created_by
    ) VALUES (
      gen_random_uuid(), v_tenant_id, 'SMS', 'TWILIO_SMS',
      'Twilio SMS', jsonb_build_object('from_number', '+1XXXXXXXXXX'), false, true,
      1, NOW(), 'system_setup'
    )
    ON CONFLICT (tenant_org_id, channel_code, provider_code)
    DO UPDATE SET updated_at = NOW();

    -- WHATSAPP — Twilio BSP (registered but inactive until template approval)
    INSERT INTO org_ntf_channel_provider_cf (
      id, tenant_org_id, channel_code, provider_code,
      display_name, config, is_active, is_enabled,
      rec_status, created_at, created_by
    ) VALUES (
      gen_random_uuid(), v_tenant_id, 'WHATSAPP', 'TWILIO_WHATSAPP',
      'WhatsApp via Twilio', jsonb_build_object('from_number', 'whatsapp:+1XXXXXXXXXX'), false, true,
      1, NOW(), 'system_setup'
    )
    ON CONFLICT (tenant_org_id, channel_code, provider_code)
    DO UPDATE SET updated_at = NOW();

    -- PUSH — VAPID (registered but inactive until sw.js deployed + subscriptions exist)
    INSERT INTO org_ntf_channel_provider_cf (
      id, tenant_org_id, channel_code, provider_code,
      display_name, config, is_active, is_enabled,
      rec_status, created_at, created_by
    ) VALUES (
      gen_random_uuid(), v_tenant_id, 'PUSH', 'VAPID',
      'Browser Web Push (VAPID)',
      jsonb_build_object('vapid_public_key', 'BKug-WOexd_dskGfX9LRYcN2BEhFvT6c1ZpuvudND4wXxHrEoUBOJsiJqVq8QT0H6ncM9On5tnwyMsT2BqQfgrQ'),
      false, true,
      1, NOW(), 'system_setup'
    )
    ON CONFLICT (tenant_org_id, channel_code, provider_code)
    DO UPDATE SET updated_at = NOW();

    -- ─────────────────────────────────────────────────────────────────────────
    -- CHANNEL SETTINGS  (org_ntf_settings_cf)
    -- ─────────────────────────────────────────────────────────────────────────

    -- IN_APP — enabled; no quiet hours
    -- (no id column — PK is composite: tenant_org_id + channel_code)
    INSERT INTO org_ntf_settings_cf (
      tenant_org_id, channel_code,
      is_enabled, quiet_hours_enabled, daily_limit,
      rec_status, created_at, created_by
    ) VALUES (
      v_tenant_id, 'IN_APP',
      true, false, 500,
      1, NOW(), 'system_setup'
    )
    ON CONFLICT (tenant_org_id, channel_code)
    DO UPDATE SET is_enabled = true, updated_at = NOW();

    -- EMAIL — enabled; quiet hours off by default (enable per-tenant as needed)
    INSERT INTO org_ntf_settings_cf (
      tenant_org_id, channel_code,
      is_enabled, quiet_hours_enabled,
      quiet_hours_start, quiet_hours_end, quiet_hours_tz,
      daily_limit, rec_status, created_at, created_by
    ) VALUES (
      v_tenant_id, 'EMAIL',
      true, false,
      '22:00', '08:00', 'Asia/Dubai',
      100, 1, NOW(), 'system_setup'
    )
    ON CONFLICT (tenant_org_id, channel_code)
    DO UPDATE SET is_enabled = true, updated_at = NOW();

    -- SMS — disabled; GCC quiet hours pre-configured for when you enable it
    INSERT INTO org_ntf_settings_cf (
      tenant_org_id, channel_code,
      is_enabled, quiet_hours_enabled,
      quiet_hours_start, quiet_hours_end, quiet_hours_tz,
      daily_limit, rec_status, created_at, created_by
    ) VALUES (
      v_tenant_id, 'SMS',
      false, true,
      '22:00', '08:00', 'Asia/Dubai',
      50, 1, NOW(), 'system_setup'
    )
    ON CONFLICT (tenant_org_id, channel_code)
    DO UPDATE SET updated_at = NOW();

    -- WHATSAPP — disabled until META templates approved
    INSERT INTO org_ntf_settings_cf (
      tenant_org_id, channel_code,
      is_enabled, quiet_hours_enabled,
      quiet_hours_start, quiet_hours_end, quiet_hours_tz,
      daily_limit, rec_status, created_at, created_by
    ) VALUES (
      v_tenant_id, 'WHATSAPP',
      false, true,
      '22:00', '08:00', 'Asia/Dubai',
      50, 1, NOW(), 'system_setup'
    )
    ON CONFLICT (tenant_org_id, channel_code)
    DO UPDATE SET updated_at = NOW();

    -- PUSH — disabled until VAPID subscriptions exist
    INSERT INTO org_ntf_settings_cf (
      tenant_org_id, channel_code,
      is_enabled, quiet_hours_enabled, daily_limit,
      rec_status, created_at, created_by
    ) VALUES (
      v_tenant_id, 'PUSH',
      false, false, 200,
      1, NOW(), 'system_setup'
    )
    ON CONFLICT (tenant_org_id, channel_code)
    DO UPDATE SET updated_at = NOW();

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Done. Processed % tenant(s).', v_count;
END;
$$;

-- =============================================================================
-- VERIFY — summary across all tenants
-- =============================================================================
SELECT
  t.name                AS tenant_name,
  s.channel_code,
  s.is_enabled          AS channel_enabled,
  p.provider_code       AS active_provider,
  p.is_active           AS provider_active,
  p.is_enabled          AS provider_enabled
FROM org_tenants_mst t
JOIN org_ntf_settings_cf s
  ON s.tenant_org_id = t.id
LEFT JOIN org_ntf_channel_provider_cf p
  ON p.tenant_org_id = s.tenant_org_id
 AND p.channel_code  = s.channel_code
 AND p.is_active     = true
WHERE t.is_active = true
ORDER BY t.name, s.channel_code;

-- Expected per tenant:
--   EMAIL    | true   | RESEND            | true  | true
--   IN_APP   | true   | SUPABASE_REALTIME | true  | true
--   PUSH     | false  | (null)            | (null)| (null)
--   SMS      | false  | (null)            | (null)| (null)
--   WHATSAPP | false  | (null)            | (null)| (null)