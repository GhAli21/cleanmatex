-- =============================================================================
-- Migration: 0366_ntf_dispatch_mode_currency.sql
-- Purpose:   Two additive columns required for the HQ Dispatch Proxy (CMX-PRD-019 B1):
--
--   1. org_ntf_channel_provider_cf.dispatch_mode
--        Determines whether HQ uses platform provider credentials (env vars)
--        or tenant-supplied BYO credentials (AES-256-GCM in encrypted_config).
--        Default 'PLATFORM' so all existing rows keep current behaviour.
--
--   2. org_ntf_channel_provider_cf.encrypted_config
--        AES-256-GCM ciphertext envelope for BYO provider credentials.
--        Only present when dispatch_mode = 'BYO'. NULL for PLATFORM rows.
--        Format: base64-encoded JSON {v:1, iv:<hex>, tag:<hex>, ct:<base64>}
--        NEVER store plaintext API keys here.
--
--   3. org_ntf_usage_daily.currency_code
--        ISO 4217 currency code for cost_amount. Defaults to 'USD' so all
--        existing rows remain valid. Required for multi-currency quota billing.
--
-- Seq: 0366 (after 0365_hq_audit_logs_improve.sql)
-- All columns are nullable/defaulted — zero backfill required.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. org_ntf_channel_provider_cf — dispatch mode & BYO credentials envelope
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'org_ntf_channel_provider_cf'
      AND column_name = 'dispatch_mode') THEN
    ALTER TABLE org_ntf_channel_provider_cf
      ADD COLUMN dispatch_mode TEXT NOT NULL DEFAULT 'PLATFORM'
        CHECK (dispatch_mode IN ('PLATFORM', 'BYO'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'org_ntf_channel_provider_cf'
      AND column_name = 'encrypted_config') THEN
    ALTER TABLE org_ntf_channel_provider_cf
      ADD COLUMN encrypted_config TEXT;  -- NULL when dispatch_mode = 'PLATFORM'
  END IF;
END $$;

COMMENT ON COLUMN org_ntf_channel_provider_cf.dispatch_mode IS
  'PLATFORM = HQ uses shared platform credentials from env vars; BYO = tenant supplies own encrypted credentials stored in encrypted_config';
COMMENT ON COLUMN org_ntf_channel_provider_cf.encrypted_config IS
  'AES-256-GCM ciphertext envelope for BYO provider credentials. Format: base64 JSON {v:1,iv,tag,ct}. NULL when dispatch_mode=PLATFORM. NEVER store plaintext keys here.';

-- Index: BYO-mode rows for provider-resolver cache invalidation scans
CREATE INDEX IF NOT EXISTS idx_ntf_cf_dispatch_mode
  ON org_ntf_channel_provider_cf (dispatch_mode)
  WHERE dispatch_mode = 'BYO';

-- ---------------------------------------------------------------------------
-- 2. org_ntf_usage_daily — multi-currency cost tracking
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'org_ntf_usage_daily'
      AND column_name = 'currency_code') THEN
    ALTER TABLE org_ntf_usage_daily
      ADD COLUMN currency_code TEXT NOT NULL DEFAULT 'USD';
  END IF;
END $$;

COMMENT ON COLUMN org_ntf_usage_daily.currency_code IS
  'ISO 4217 currency code for cost_amount, e.g. USD, EUR, SAR. Defaults to USD for backward compatibility.';

-- Update natural-key unique index to include currency_code so usage can be
-- tracked per-currency for multi-currency tenants.
-- Old index: (tenant_org_id, channel_code, usage_date, provider_code)
-- New index: (tenant_org_id, channel_code, usage_date, provider_code, currency_code)

DROP INDEX IF EXISTS idx_ntf_usage_natural;

CREATE UNIQUE INDEX idx_ntf_usage_natural
  ON org_ntf_usage_daily (tenant_org_id, channel_code, usage_date, provider_code, currency_code);

COMMIT;
