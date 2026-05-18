-- ============================================================
-- Migration 0287: Loyalty Program Tables
-- Phase 3 of the Order Financial Platform
--
-- Tables created:
--   org_loyalty_programs_cf    — one loyalty program config per tenant
--   org_loyalty_tiers_cf       — tier levels within a program
--   org_loyalty_accounts_mst   — per-customer loyalty account (balance ledger)
--   org_loyalty_txn_dtl        — immutable loyalty point transactions
--
-- Seed data: demo programs + tiers for both tenant 1 and tenant 2
-- ============================================================

-- ── org_loyalty_programs_cf ───────────────────────────────────────────────────
-- One row per tenant. Unique constraint enforces single active program per org.
CREATE TABLE org_loyalty_programs_cf (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id             UUID        NOT NULL,
  program_name              TEXT        NOT NULL,
  program_name2             TEXT,
  -- earn_rate_per_unit: points earned per 1 unit of order currency (e.g. 1 pt per 1 SAR)
  earn_rate_per_unit        DECIMAL(10,4)  NOT NULL DEFAULT 1,
  -- redeem_rate_per_point: currency value of 1 loyalty point (e.g. 0.01 SAR per point)
  redeem_rate_per_point     DECIMAL(10,6)  NOT NULL DEFAULT 0.01,
  min_redeem_points         INTEGER     NOT NULL DEFAULT 100,
  max_redeem_pct_of_order   DECIMAL(5,2)   NOT NULL DEFAULT 20.00,
  points_expiry_days        INTEGER,
  is_active                 BOOLEAN     NOT NULL DEFAULT TRUE,
  rec_status                SMALLINT    NOT NULL DEFAULT 1,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                UUID,
  created_info              TEXT,
  updated_at                TIMESTAMPTZ,
  updated_by                UUID,
  updated_info              TEXT,
  CONSTRAINT uq_loyalty_per_tenant UNIQUE (tenant_org_id)
);

-- ── org_loyalty_tiers_cf ─────────────────────────────────────────────────────
-- Tier levels within a loyalty program (Bronze, Silver, Gold, etc.)
CREATE TABLE org_loyalty_tiers_cf (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID        NOT NULL,
  program_id        UUID        NOT NULL REFERENCES org_loyalty_programs_cf(id),
  name              TEXT        NOT NULL,
  name2             TEXT,
  min_points        INTEGER     NOT NULL,
  bonus_multiplier  DECIMAL(5,2)   NOT NULL DEFAULT 1.00,
  sort_order        SMALLINT    NOT NULL DEFAULT 0,
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  rec_status        SMALLINT    NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID,
  created_info      TEXT,
  updated_at        TIMESTAMPTZ,
  updated_by        UUID,
  updated_info      TEXT
);

-- ── org_loyalty_accounts_mst ─────────────────────────────────────────────────
-- One account per customer per tenant. Holds running point balance.
-- CHECK (points_balance >= 0) prevents negative balances at DB level.
CREATE TABLE org_loyalty_accounts_mst (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id    UUID        NOT NULL,
  customer_id      UUID        NOT NULL REFERENCES org_customers_mst(id) ON DELETE RESTRICT,
  program_id       UUID        NOT NULL REFERENCES org_loyalty_programs_cf(id),
  points_balance   INTEGER     NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  lifetime_earned  INTEGER     NOT NULL DEFAULT 0,
  current_tier_id  UUID        REFERENCES org_loyalty_tiers_cf(id),
  last_activity_at TIMESTAMPTZ,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  rec_status       SMALLINT    NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID,
  created_info     TEXT,
  updated_at       TIMESTAMPTZ,
  updated_by       UUID,
  updated_info     TEXT,
  CONSTRAINT uq_loyalty_acct UNIQUE (tenant_org_id, customer_id)
);

-- ── org_loyalty_txn_dtl ──────────────────────────────────────────────────────
-- Immutable append-only ledger of loyalty point movements.
-- points_before/after provide a full audit trail without replaying history.
-- idempotency_key prevents double-posting from retries.
CREATE TABLE org_loyalty_txn_dtl (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID        NOT NULL,
  account_id      UUID        NOT NULL REFERENCES org_loyalty_accounts_mst(id),
  customer_id     UUID        NOT NULL,
  txn_type        TEXT        NOT NULL CHECK (txn_type IN ('EARN','REDEEM','EXPIRE','ADJUST','BONUS')),
  points          INTEGER     NOT NULL,
  points_before   INTEGER     NOT NULL,
  points_after    INTEGER     NOT NULL,
  order_id        UUID,
  credit_app_id   UUID,
  idempotency_key TEXT,
  notes           TEXT,
  performed_by    UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  created_info    TEXT,
  CONSTRAINT uq_loyalty_txn_idempotency UNIQUE (tenant_org_id, idempotency_key)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_loyalty_programs_tenant
  ON org_loyalty_programs_cf (tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_program
  ON org_loyalty_tiers_cf (tenant_org_id, program_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_customer
  ON org_loyalty_accounts_mst (tenant_org_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_txn_account
  ON org_loyalty_txn_dtl (tenant_org_id, account_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_txn_order
  ON org_loyalty_txn_dtl (tenant_org_id, order_id)
  WHERE order_id IS NOT NULL;

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE org_loyalty_programs_cf ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_loyalty_programs_cf
  ON org_loyalty_programs_cf FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

ALTER TABLE org_loyalty_tiers_cf ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_loyalty_tiers_cf
  ON org_loyalty_tiers_cf FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

ALTER TABLE org_loyalty_accounts_mst ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_loyalty_accounts_mst
  ON org_loyalty_accounts_mst FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

ALTER TABLE org_loyalty_txn_dtl ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_loyalty_txn_dtl
  ON org_loyalty_txn_dtl FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- ── Seed: Tenant 1 — CleanMate Rewards ───────────────────────────────────────

WITH prog1 AS (
  INSERT INTO org_loyalty_programs_cf
    (id, tenant_org_id, program_name, program_name2,
     earn_rate_per_unit, redeem_rate_per_point,
     min_redeem_points, max_redeem_pct_of_order,
     points_expiry_days, is_active, rec_status)
  VALUES
    ('aaaaaaaa-0001-0001-0001-000000000001',
     '11111111-1111-1111-1111-111111111111',
     'CleanMate Rewards', 'مكافآت كلين ميت',
     1.00, 0.01, 100, 20.00, 365, true, 1)
  RETURNING id
)
INSERT INTO org_loyalty_tiers_cf
  (id, tenant_org_id, program_id, name, name2,
   min_points, bonus_multiplier, sort_order, is_active, rec_status)
SELECT
  gen_random_uuid(),
  '11111111-1111-1111-1111-111111111111',
  prog1.id,
  t.name, t.name2, t.min_pts, t.multiplier, t.ord,
  true, 1
FROM prog1
CROSS JOIN (VALUES
  ('Bronze',   'برونزي',    0,     1.00, 1),
  ('Silver',   'فضي',       1000,  1.25, 2),
  ('Gold',     'ذهبي',      5000,  1.50, 3),
  ('Platinum', 'بلاتيني',   15000, 2.00, 4),
  ('VIP',      'في آي بي',  50000, 3.00, 5)
) AS t(name, name2, min_pts, multiplier, ord);

-- ── Seed: Tenant 2 — Prestige Points ─────────────────────────────────────────

WITH prog2 AS (
  INSERT INTO org_loyalty_programs_cf
    (id, tenant_org_id, program_name, program_name2,
     earn_rate_per_unit, redeem_rate_per_point,
     min_redeem_points, max_redeem_pct_of_order,
     points_expiry_days, is_active, rec_status)
  VALUES
    ('aaaaaaaa-0002-0002-0002-000000000002',
     'c9ac29d1-219c-4a3a-8887-f860550c32be',
     'Prestige Points', 'نقاط البرستيج',
     1.50, 0.015, 50, 25.00, 730, true, 1)
  RETURNING id
)
INSERT INTO org_loyalty_tiers_cf
  (id, tenant_org_id, program_id, name, name2,
   min_points, bonus_multiplier, sort_order, is_active, rec_status)
SELECT
  gen_random_uuid(),
  'c9ac29d1-219c-4a3a-8887-f860550c32be',
  prog2.id,
  t.name, t.name2, t.min_pts, t.multiplier, t.ord,
  true, 1
FROM prog2
CROSS JOIN (VALUES
  ('Member',  'عضو',     0,     1.00, 1),
  ('Silver',  'فضي',     2000,  1.25, 2),
  ('Gold',    'ذهبي',    8000,  1.75, 3),
  ('Diamond', 'ألماسي',  25000, 2.50, 4)
) AS t(name, name2, min_pts, multiplier, ord);
