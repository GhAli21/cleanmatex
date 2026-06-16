-- =============================================================================
-- Migration: 0371_sys_ntf_pricing_cf.sql
-- Purpose:   Create sys_ntf_pricing_cf — effective-dated, multi-currency
--            notification pricing for the HQ Quota & Monetization layer
--            (CMX-PRD-019 B2).
--
-- Design:
--   • Two price dimensions per row:
--       cost_per_unit  — what HQ pays the external provider (COGS).
--       sell_per_unit  — what HQ charges the tenant (revenue).
--   • effective_from / effective_to allow scheduled pricing changes:
--       active row = effective_from <= NOW() AND (effective_to IS NULL OR NOW() < effective_to)
--   • Multi-currency from day one: one row per (channel, provider, currency).
--   • The tenant's billing currency is sourced from the existing
--     'default_currency_code' setting (fallback USD).
--     The pricing service fetches the setting then looks up a matching row.
--   • No RLS — sys_* table, HQ service role reads directly.
--   • Idempotent seed via ON CONFLICT DO UPDATE.
--
-- Seq: 0371 (after 0370_org_ntf_quota_override_cf.sql)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sys_ntf_pricing_cf (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What is being priced
  channel_code    TEXT          NOT NULL,   -- EMAIL | SMS | WHATSAPP | PUSH | IN_APP | CAMPAIGN
  provider_code   TEXT          NOT NULL,   -- RESEND | TWILIO | META | FCM | VAPID | INTERNAL

  -- Currency
  currency_code   TEXT          NOT NULL,   -- ISO 4217: USD, EUR, SAR, AED, OMR, GBP, …

  -- Cost/price per single send unit
  cost_per_unit   DECIMAL(19,4) NOT NULL DEFAULT 0,  -- HQ pays provider (COGS)
  sell_per_unit   DECIMAL(19,4) NOT NULL DEFAULT 0,  -- HQ charges tenant

  -- Effective dating (open-ended if effective_to IS NULL)
  effective_from  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  effective_to    TIMESTAMP,

  -- Bilingual labels
  name            VARCHAR(250),
  name2           VARCHAR(250),

  -- Audit
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by  VARCHAR(120),
  created_info TEXT,
  updated_at  TIMESTAMP,
  updated_by  VARCHAR(120),
  updated_info TEXT,
  rec_status  SMALLINT  NOT NULL DEFAULT 1,
  rec_order   INTEGER,
  rec_notes   TEXT,
  is_active   BOOLEAN   NOT NULL DEFAULT true,

  -- Unique price point per (channel, provider, currency, effective_from)
  UNIQUE (channel_code, provider_code, currency_code, effective_from)
);

COMMENT ON TABLE sys_ntf_pricing_cf IS
  'Effective-dated, multi-currency notification unit pricing for the HQ dispatch proxy. '
  'cost_per_unit = provider COGS; sell_per_unit = tenant charge. '
  'Active row: effective_from <= NOW() AND (effective_to IS NULL OR NOW() < effective_to).';

COMMENT ON COLUMN sys_ntf_pricing_cf.cost_per_unit IS
  'Cost HQ pays to the external provider per single send (e.g. 0.0001 USD for Resend email). Used for margin dashboards.';
COMMENT ON COLUMN sys_ntf_pricing_cf.sell_per_unit IS
  'Amount HQ charges the tenant per single send above the included_qty. Zero = channel is included at no per-unit cost.';
COMMENT ON COLUMN sys_ntf_pricing_cf.effective_from IS
  'UTC timestamp from which this pricing row is active. Multiple future rows may exist for scheduled price changes.';
COMMENT ON COLUMN sys_ntf_pricing_cf.effective_to IS
  'UTC timestamp at which this pricing row expires. NULL = open-ended (current). Closed when superseded by a new row.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Primary resolution lookup: active row for (channel, provider, currency)
CREATE INDEX IF NOT EXISTS idx_ntf_pricing_active
  ON sys_ntf_pricing_cf (channel_code, provider_code, currency_code, effective_from DESC)
  WHERE is_active = true;

-- Open-ended active rows (most common query path)
CREATE INDEX IF NOT EXISTS idx_ntf_pricing_open_ended
  ON sys_ntf_pricing_cf (channel_code, provider_code, currency_code)
  WHERE effective_to IS NULL AND is_active = true;

-- Historical lookups for reporting
CREATE INDEX IF NOT EXISTS idx_ntf_pricing_history
  ON sys_ntf_pricing_cf (channel_code, provider_code, effective_from DESC);

-- ---------------------------------------------------------------------------
-- Seed — idempotent baseline pricing
-- All amounts in the currency's main unit (0.0001 USD = $0.0001 per send).
-- cost_per_unit ≈ approximate provider COGS; sell_per_unit = platform markup.
-- Adjust before production launch.
-- ---------------------------------------------------------------------------

INSERT INTO sys_ntf_pricing_cf
  (channel_code, provider_code, currency_code, cost_per_unit, sell_per_unit,
   effective_from, effective_to, name, name2, created_by)
VALUES
  -- ─── EMAIL — Resend ───────────────────────────────────────────────────────
  ('EMAIL', 'RESEND', 'USD', 0.0001, 0.0002, '2026-01-01 00:00:00', NULL,
   'Email (Resend) — USD', 'البريد الإلكتروني (Resend) — دولار',      'migration_0371'),
  ('EMAIL', 'RESEND', 'EUR', 0.0001, 0.0002, '2026-01-01 00:00:00', NULL,
   'Email (Resend) — EUR', 'البريد الإلكتروني (Resend) — يورو',       'migration_0371'),
  ('EMAIL', 'RESEND', 'SAR', 0.0004, 0.0008, '2026-01-01 00:00:00', NULL,
   'Email (Resend) — SAR', 'البريد الإلكتروني (Resend) — ريال',       'migration_0371'),
  ('EMAIL', 'RESEND', 'AED', 0.0004, 0.0008, '2026-01-01 00:00:00', NULL,
   'Email (Resend) — AED', 'البريد الإلكتروني (Resend) — درهم',       'migration_0371'),
  ('EMAIL', 'RESEND', 'OMR', 0.0001, 0.0001, '2026-01-01 00:00:00', NULL,
   'Email (Resend) — OMR', 'البريد الإلكتروني (Resend) — ريال عُماني','migration_0371'),
  ('EMAIL', 'RESEND', 'GBP', 0.0001, 0.0002, '2026-01-01 00:00:00', NULL,
   'Email (Resend) — GBP', 'البريد الإلكتروني (Resend) — جنيه',       'migration_0371'),

  -- ─── SMS — Twilio ─────────────────────────────────────────────────────────
  ('SMS', 'TWILIO', 'USD', 0.0075, 0.0120, '2026-01-01 00:00:00', NULL,
   'SMS (Twilio) — USD', 'رسالة نصية (Twilio) — دولار', 'migration_0371'),
  ('SMS', 'TWILIO', 'EUR', 0.0075, 0.0120, '2026-01-01 00:00:00', NULL,
   'SMS (Twilio) — EUR', 'رسالة نصية (Twilio) — يورو',  'migration_0371'),
  ('SMS', 'TWILIO', 'SAR', 0.0280, 0.0450, '2026-01-01 00:00:00', NULL,
   'SMS (Twilio) — SAR', 'رسالة نصية (Twilio) — ريال',  'migration_0371'),
  ('SMS', 'TWILIO', 'AED', 0.0280, 0.0450, '2026-01-01 00:00:00', NULL,
   'SMS (Twilio) — AED', 'رسالة نصية (Twilio) — درهم',  'migration_0371'),
  ('SMS', 'TWILIO', 'OMR', 0.0030, 0.0050, '2026-01-01 00:00:00', NULL,
   'SMS (Twilio) — OMR', 'رسالة نصية (Twilio) — ريال عُماني', 'migration_0371'),
  ('SMS', 'TWILIO', 'GBP', 0.0060, 0.0100, '2026-01-01 00:00:00', NULL,
   'SMS (Twilio) — GBP', 'رسالة نصية (Twilio) — جنيه',  'migration_0371'),

  -- ─── WHATSAPP — Meta ──────────────────────────────────────────────────────
  ('WHATSAPP', 'META', 'USD', 0.0050, 0.0080, '2026-01-01 00:00:00', NULL,
   'WhatsApp (Meta) — USD', 'واتساب (Meta) — دولار', 'migration_0371'),
  ('WHATSAPP', 'META', 'SAR', 0.0190, 0.0300, '2026-01-01 00:00:00', NULL,
   'WhatsApp (Meta) — SAR', 'واتساب (Meta) — ريال',  'migration_0371'),
  ('WHATSAPP', 'META', 'AED', 0.0190, 0.0300, '2026-01-01 00:00:00', NULL,
   'WhatsApp (Meta) — AED', 'واتساب (Meta) — درهم',  'migration_0371'),

  -- ─── PUSH — FCM ───────────────────────────────────────────────────────────
  ('PUSH', 'FCM', 'USD', 0.0000, 0.0001, '2026-01-01 00:00:00', NULL,
   'Push Notification (FCM) — USD', 'إشعار دفع (FCM) — دولار', 'migration_0371'),
  ('PUSH', 'FCM', 'SAR', 0.0000, 0.0004, '2026-01-01 00:00:00', NULL,
   'Push Notification (FCM) — SAR', 'إشعار دفع (FCM) — ريال',  'migration_0371'),

  -- ─── IN_APP — Internal (always zero cost; bundled) ───────────────────────
  ('IN_APP', 'INTERNAL', 'USD', 0.0000, 0.0000, '2026-01-01 00:00:00', NULL,
   'In-App Notification — USD', 'إشعار داخل التطبيق — دولار', 'migration_0371')

ON CONFLICT (channel_code, provider_code, currency_code, effective_from) DO UPDATE
  SET cost_per_unit = EXCLUDED.cost_per_unit,
      sell_per_unit = EXCLUDED.sell_per_unit,
      name          = EXCLUDED.name,
      name2         = EXCLUDED.name2,
      updated_at    = CURRENT_TIMESTAMP,
      updated_by    = 'migration_0371';

COMMIT;
