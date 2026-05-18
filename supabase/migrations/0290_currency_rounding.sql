-- ============================================================
-- Migration 0290: Currency Rounding Rules
-- Phase 6.1 of the Order Financial Platform
--
-- sys table: no tenant_org_id, no RLS
-- Covers all GCC + common international currencies used in the platform.
-- rounding_unit = smallest coin/subdivision (e.g. 0.001 for OMR baisa)
-- ============================================================

CREATE TABLE sys_currency_rounding_rules_cd (
  currency_code   TEXT        PRIMARY KEY,
  rounding_method TEXT        NOT NULL DEFAULT 'HALF_UP'
                                CHECK (rounding_method IN ('HALF_UP','HALF_DOWN','FLOOR','CEIL')),
  rounding_unit   DECIMAL(10,6) NOT NULL DEFAULT 0.01,
  notes           TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  rec_status      SMALLINT    NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO sys_currency_rounding_rules_cd
  (currency_code, rounding_method, rounding_unit, notes)
VALUES
  -- GCC
  ('SAR', 'HALF_UP', 0.01,   'Saudi Riyal — 2 decimals; halalas'),
  ('AED', 'HALF_UP', 0.01,   'UAE Dirham — 2 decimals; fils'),
  ('QAR', 'HALF_UP', 0.01,   'Qatari Riyal — 2 decimals; dirhams'),
  ('KWD', 'HALF_UP', 0.001,  'Kuwaiti Dinar — 3 decimals; fils'),
  ('BHD', 'HALF_UP', 0.001,  'Bahraini Dinar — 3 decimals; fils'),
  ('OMR', 'HALF_UP', 0.001,  'Omani Rial — 3 decimals; baisa'),
  -- Arab region
  ('EGP', 'HALF_UP', 0.01,   'Egyptian Pound — 2 decimals; piastres'),
  ('JOD', 'HALF_UP', 0.001,  'Jordanian Dinar — 3 decimals; fils'),
  ('LBP', 'HALF_UP', 1.00,   'Lebanese Pound — 0 decimals'),
  -- International
  ('USD', 'HALF_UP', 0.01,   'US Dollar — 2 decimals; cents'),
  ('GBP', 'HALF_UP', 0.01,   'British Pound — 2 decimals; pence'),
  ('EUR', 'HALF_UP', 0.01,   'Euro — 2 decimals; cents'),
  ('INR', 'HALF_UP', 0.01,   'Indian Rupee — 2 decimals; paise');
