-- =============================================================================
-- Migration: 0369_sys_ntf_quota_plan_cf.sql
-- Purpose:   Create sys_ntf_quota_plan_cf — plan-level notification quota
--            defaults for the HQ Quota & Monetization layer (CMX-PRD-019 B2).
--
-- Design:
--   • Each row defines how many messages a given plan tier may send per metric
--     (channel or aggregate) within a given billing period.
--   • Quota resolution precedence (B2):
--       org_ntf_quota_override_cf (per-tenant) → this table (plan default)
--       → sys_ntf_channel_cd.daily_limit (legacy fallback)
--   • included_qty = free allowance before overage kicks in.
--   • hard_cap = absolute ceiling; if overage_allowed = false the HQ proxy
--     returns QUOTA_EXCEEDED for any send past this point.
--   • NULL hard_cap means unlimited sends (soft metering only).
--   • Idempotent seed via ON CONFLICT DO UPDATE so re-running is safe.
--
-- Seq: 0369 (after 0368_fin_overpay_save_to_wallet.sql)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sys_ntf_quota_plan_cf (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Plan reference (matches plan_code in sys_pln_subscription_plans_mst)
  plan_code         TEXT    NOT NULL,

  -- Notification metric being quota'd
  metric            TEXT    NOT NULL
    CHECK (metric IN ('EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP', 'CAMPAIGN')),

  -- Period the quota resets over
  period_type       TEXT    NOT NULL
    CHECK (period_type IN ('DAILY', 'MONTHLY')),

  -- Quota values
  included_qty      INTEGER NOT NULL DEFAULT 0,   -- free allowance (0 = none)
  hard_cap          INTEGER,                      -- NULL = no cap
  overage_allowed   BOOLEAN NOT NULL DEFAULT false,

  -- Bilingual labels (optional UI override)
  name              VARCHAR(250),
  name2             VARCHAR(250),

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

  -- Natural key: one row per (plan, metric, period)
  UNIQUE (plan_code, metric, period_type)
);

COMMENT ON TABLE sys_ntf_quota_plan_cf IS
  'Platform-level notification quota defaults per subscription plan and metric. '
  'Quota resolution precedence: org_ntf_quota_override_cf → sys_ntf_quota_plan_cf → sys_ntf_channel_cd.daily_limit.';

COMMENT ON COLUMN sys_ntf_quota_plan_cf.plan_code IS
  'References plan_code in sys_pln_subscription_plans_mst. Loose text reference so new plan codes can be seeded without a schema change.';
COMMENT ON COLUMN sys_ntf_quota_plan_cf.metric IS
  'Notification channel or aggregate type being quota-limited: EMAIL | SMS | WHATSAPP | PUSH | IN_APP | CAMPAIGN.';
COMMENT ON COLUMN sys_ntf_quota_plan_cf.period_type IS
  'Reset cadence: DAILY (resets at midnight UTC) | MONTHLY (resets on billing anniversary).';
COMMENT ON COLUMN sys_ntf_quota_plan_cf.included_qty IS
  'Number of sends included in the base plan price. Sends above this count are eligible for overage billing.';
COMMENT ON COLUMN sys_ntf_quota_plan_cf.hard_cap IS
  'Absolute maximum allowed sends per period. NULL = unlimited. If overage_allowed = false, dispatch is blocked at this count.';
COMMENT ON COLUMN sys_ntf_quota_plan_cf.overage_allowed IS
  'If false and hard_cap is reached, HQ proxy returns QUOTA_EXCEEDED. If true, overage sends are metered and billed.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_ntf_qplan_plan_code
  ON sys_ntf_quota_plan_cf (plan_code);

CREATE INDEX IF NOT EXISTS idx_ntf_qplan_metric_period
  ON sys_ntf_quota_plan_cf (metric, period_type);

CREATE INDEX IF NOT EXISTS idx_ntf_qplan_active
  ON sys_ntf_quota_plan_cf (plan_code, is_active)
  WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- Seed — idempotent defaults for standard plan tiers
-- Adjust included_qty / hard_cap to match commercial decisions.
-- ---------------------------------------------------------------------------

INSERT INTO sys_ntf_quota_plan_cf
  (plan_code, metric, period_type, included_qty, hard_cap, overage_allowed, name, name2, created_by)
VALUES
  -- FREE_TRIAL — tight caps, no overage
  ('FREE_TRIAL', 'EMAIL',    'MONTHLY', 100,    200,   false, 'Free Trial Email Quota',    'حصة البريد التجريبي',          'system'),
  ('FREE_TRIAL', 'SMS',      'MONTHLY', 0,      50,    false, 'Free Trial SMS Quota',      'حصة الرسائل التجريبية',        'system'),
  ('FREE_TRIAL', 'WHATSAPP', 'MONTHLY', 0,      50,    false, 'Free Trial WhatsApp Quota', 'حصة واتساب التجريبية',         'system'),
  ('FREE_TRIAL', 'PUSH',     'MONTHLY', 500,    1000,  false, 'Free Trial Push Quota',     'حصة الإشعارات التجريبية',      'system'),
  ('FREE_TRIAL', 'IN_APP',   'MONTHLY', 2000,   NULL,  false, 'Free Trial In-App Quota',   'حصة التطبيق التجريبية',        'system'),
  ('FREE_TRIAL', 'CAMPAIGN', 'MONTHLY', 0,      2,     false, 'Free Trial Campaign Quota', 'حصة الحملات التجريبية',        'system'),

  -- STARTER
  ('STARTER',    'EMAIL',    'MONTHLY', 1000,   2000,  false, 'Starter Email Quota',    'حصة البريد للمبتدئين',    'system'),
  ('STARTER',    'SMS',      'MONTHLY', 200,    500,   false, 'Starter SMS Quota',      'حصة الرسائل للمبتدئين',  'system'),
  ('STARTER',    'WHATSAPP', 'MONTHLY', 200,    500,   false, 'Starter WhatsApp Quota', 'حصة واتساب للمبتدئين',   'system'),
  ('STARTER',    'PUSH',     'MONTHLY', 5000,   10000, false, 'Starter Push Quota',     'حصة الإشعارات للمبتدئين','system'),
  ('STARTER',    'IN_APP',   'MONTHLY', 10000,  NULL,  false, 'Starter In-App Quota',   'حصة التطبيق للمبتدئين',  'system'),
  ('STARTER',    'CAMPAIGN', 'MONTHLY', 2,      5,     false, 'Starter Campaign Quota', 'حصة الحملات للمبتدئين',  'system'),

  -- GROWTH — overage allowed on main channels
  ('GROWTH',     'EMAIL',    'MONTHLY', 5000,   10000, true,  'Growth Email Quota',    'حصة البريد للنمو',    'system'),
  ('GROWTH',     'SMS',      'MONTHLY', 1000,   2000,  true,  'Growth SMS Quota',      'حصة الرسائل للنمو',  'system'),
  ('GROWTH',     'WHATSAPP', 'MONTHLY', 1000,   2000,  true,  'Growth WhatsApp Quota', 'حصة واتساب للنمو',   'system'),
  ('GROWTH',     'PUSH',     'MONTHLY', 20000,  50000, true,  'Growth Push Quota',     'حصة الإشعارات للنمو','system'),
  ('GROWTH',     'IN_APP',   'MONTHLY', 25000,  NULL,  false, 'Growth In-App Quota',   'حصة التطبيق للنمو',  'system'),
  ('GROWTH',     'CAMPAIGN', 'MONTHLY', 5,      10,    true,  'Growth Campaign Quota', 'حصة الحملات للنمو',  'system'),

  -- PRO — high allowances, overage allowed
  ('PRO',        'EMAIL',    'MONTHLY', 10000,  NULL,  true,  'Pro Email Quota',    'حصة البريد الاحترافية',    'system'),
  ('PRO',        'SMS',      'MONTHLY', 2000,   NULL,  true,  'Pro SMS Quota',      'حصة الرسائل الاحترافية',  'system'),
  ('PRO',        'WHATSAPP', 'MONTHLY', 2000,   NULL,  true,  'Pro WhatsApp Quota', 'حصة واتساب الاحترافية',   'system'),
  ('PRO',        'PUSH',     'MONTHLY', 50000,  NULL,  true,  'Pro Push Quota',     'حصة الإشعارات الاحترافية','system'),
  ('PRO',        'IN_APP',   'MONTHLY', 50000,  NULL,  false, 'Pro In-App Quota',   'حصة التطبيق الاحترافية',  'system'),
  ('PRO',        'CAMPAIGN', 'MONTHLY', 10,     NULL,  true,  'Pro Campaign Quota', 'حصة الحملات الاحترافية',  'system'),

  -- ENTERPRISE — effectively unlimited; NULL hard_cap = no block
  ('ENTERPRISE', 'EMAIL',    'MONTHLY', 100000, NULL,  true,  'Enterprise Email Quota',    'حصة البريد للمؤسسات',    'system'),
  ('ENTERPRISE', 'SMS',      'MONTHLY', 20000,  NULL,  true,  'Enterprise SMS Quota',      'حصة الرسائل للمؤسسات',  'system'),
  ('ENTERPRISE', 'WHATSAPP', 'MONTHLY', 20000,  NULL,  true,  'Enterprise WhatsApp Quota', 'حصة واتساب للمؤسسات',   'system'),
  ('ENTERPRISE', 'PUSH',     'MONTHLY', 500000, NULL,  true,  'Enterprise Push Quota',     'حصة الإشعارات للمؤسسات','system'),
  ('ENTERPRISE', 'IN_APP',   'MONTHLY', 500000, NULL,  false, 'Enterprise In-App Quota',   'حصة التطبيق للمؤسسات',  'system'),
  ('ENTERPRISE', 'CAMPAIGN', 'MONTHLY', 50,     NULL,  true,  'Enterprise Campaign Quota', 'حصة الحملات للمؤسسات',  'system')

ON CONFLICT (plan_code, metric, period_type) DO UPDATE
  SET included_qty    = EXCLUDED.included_qty,
      hard_cap        = EXCLUDED.hard_cap,
      overage_allowed = EXCLUDED.overage_allowed,
      updated_at      = CURRENT_TIMESTAMP,
      updated_by      = 'migration_0369';

COMMIT;
