-- =============================================================================
-- 0352_notif_channel_provider_cf.sql
-- Purpose: Notification Hub – per-tenant channel-to-provider mapping.
--          Allows each tenant to configure which provider handles each
--          notification channel (e.g., PUSH → VAPID, EMAIL → RESEND,
--          SMS → TWILIO, WHATSAPP → META_WHATSAPP).
--
--          Table: org_ntf_channel_provider_cf  (28 chars)
--
--          Key rules:
--          • Only ONE row per (tenant, channel) may have is_active = true at
--            any time. The partial unique index enforces this at DB level.
--          • config JSONB stores non-secret provider settings only
--            (from_email, sender_name, vapid_public_key, webhook_url, etc.).
--            API keys and secrets ALWAYS stay in environment variables.
--          • The NotificationSettingsService reads this table (with 30s cache)
--            and is the canonical source of truth for which provider to use.
--
-- PRD: CMX-PRD-019 Notification & Communication Hub
-- Author: CleanMateX Development Team
-- Created: 2026-06-11
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Channel provider configuration table
-- =============================================================================

CREATE TABLE IF NOT EXISTS org_ntf_channel_provider_cf (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID    NOT NULL,

  -- The channel this provider row belongs to (EMAIL, SMS, WHATSAPP, PUSH, IN_APP, WEB_SOCKET).
  channel_code    TEXT    NOT NULL
    REFERENCES sys_notification_channel_cd(code),

  -- Provider identifier. Must match a code in sys_ntf_providers_cd.
  -- Examples: RESEND, SENDGRID, TWILIO, META_WHATSAPP, FCM, VAPID, ONESIGNAL, INTERNAL.
  provider_code   TEXT    NOT NULL,

  -- Human-readable label for admin UI (e.g. "Production Resend Account").
  display_name    TEXT,

  -- Non-secret provider configuration stored in DB:
  --   EMAIL  : { from_email, from_name, reply_to }
  --   SMS    : { from_number, alphanumeric_sender }
  --   WA     : { phone_number_id, business_account_id }
  --   PUSH   : { vapid_public_key, app_id (OneSignal) }
  -- API keys/secrets MUST remain in environment variables — never here.
  config          JSONB,

  -- Only one provider may be active per (tenant, channel).
  -- The partial unique index below enforces this at DB level.
  is_active       BOOLEAN NOT NULL DEFAULT false,

  -- Audit
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by      TEXT,
  created_info    TEXT,
  updated_at      TIMESTAMP,
  updated_by      TEXT,
  updated_info    TEXT,
  rec_status      SMALLINT DEFAULT 1,
  rec_order       INTEGER,
  rec_notes       TEXT,
  is_rec_active   BOOLEAN NOT NULL DEFAULT true
);

-- =============================================================================
-- 2. Constraints
-- =============================================================================

-- A tenant cannot configure the same provider twice for the same channel.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ntf_ch_provider_row
  ON org_ntf_channel_provider_cf (tenant_org_id, channel_code, provider_code);

-- At most one active provider per (tenant, channel) — enforced at DB level.
-- The activate API route sets all others to false before setting the target to true.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ntf_ch_provider_active
  ON org_ntf_channel_provider_cf (tenant_org_id, channel_code)
  WHERE is_active = true;

-- =============================================================================
-- 3. Performance indexes
-- =============================================================================

-- Primary lookup by NotificationSettingsService
CREATE INDEX IF NOT EXISTS idx_ntf_ch_prov_tenant_active
  ON org_ntf_channel_provider_cf (tenant_org_id, channel_code, is_active);

-- General tenant filter
CREATE INDEX IF NOT EXISTS idx_ntf_ch_prov_tenant
  ON org_ntf_channel_provider_cf (tenant_org_id);

-- =============================================================================
-- 4. Row-Level Security
-- =============================================================================

ALTER TABLE org_ntf_channel_provider_cf ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_ntf_ch_prov
  ON org_ntf_channel_provider_cf
  FOR ALL
  USING  (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- =============================================================================
-- 5. Comments
-- =============================================================================

COMMENT ON TABLE org_ntf_channel_provider_cf IS
  'Per-tenant channel-to-provider mapping. Exactly one row per (tenant, channel) may be active (is_active=true) at a time. Source of truth for which provider the push/email/SMS/WA adapters use.';

COMMENT ON COLUMN org_ntf_channel_provider_cf.provider_code IS
  'Provider identifier: RESEND | SENDGRID | TWILIO | META_WHATSAPP | FCM | VAPID | ONESIGNAL | INTERNAL. Must match sys_ntf_providers_cd.code.';

COMMENT ON COLUMN org_ntf_channel_provider_cf.config IS
  'Non-secret provider config only (from_email, vapid_public_key, etc.). API keys stay in env vars.';

COMMENT ON COLUMN org_ntf_channel_provider_cf.is_active IS
  'Exactly one row per (tenant_org_id, channel_code) may be true. Partial unique index enforces this. Use the /providers/activate API to switch providers safely.';

COMMIT;
