-- =============================================================================
-- Migration: 0370_org_ntf_quota_override_cf.sql
-- Purpose:   Create org_ntf_quota_override_cf — per-tenant notification quota
--            overrides that take precedence over plan defaults (CMX-PRD-019 B2).
--
-- Design:
--   • Platform admins can give individual tenants higher (or lower) quotas
--     than their plan tier specifies — e.g. custom enterprise agreements.
--   • Quota resolution precedence:
--       THIS TABLE (override) → sys_ntf_quota_plan_cf (plan default)
--       → sys_ntf_channel_cd.daily_limit (legacy fallback)
--   • NULL on included_qty / hard_cap / overage_allowed means "fall through
--     to the next layer" — only fields that are SET override the plan default.
--   • RLS is enabled so cleanmatex tenant-side reads (if any) stay scoped.
--     HQ writes via service role, which bypasses RLS.
--
-- Seq: 0370 (after 0369_sys_ntf_quota_plan_cf.sql)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS org_ntf_quota_override_cf (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant context
  tenant_org_id   UUID    NOT NULL,

  -- What metric this override applies to
  metric          TEXT    NOT NULL
    CHECK (metric IN ('EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP', 'CAMPAIGN')),

  -- Period the quota resets over
  period_type     TEXT    NOT NULL
    CHECK (period_type IN ('DAILY', 'MONTHLY')),

  -- Override values (NULL = fall through to plan default for that field)
  included_qty    INTEGER,
  hard_cap        INTEGER,   -- NULL = inherit; -1 = explicitly remove cap for this tenant
  overage_allowed BOOLEAN,

  -- Optional admin note on why override was applied
  reason          TEXT,

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

  -- One active override per (tenant, metric, period)
  UNIQUE (tenant_org_id, metric, period_type)
);

COMMENT ON TABLE org_ntf_quota_override_cf IS
  'Per-tenant notification quota overrides. Takes precedence over sys_ntf_quota_plan_cf plan defaults. '
  'NULL field = inherit from plan. HQ admins manage this; cleanmatex reads via HQ API only.';

COMMENT ON COLUMN org_ntf_quota_override_cf.included_qty IS
  'Overrides plan included_qty. NULL = use plan default.';
COMMENT ON COLUMN org_ntf_quota_override_cf.hard_cap IS
  'Overrides plan hard_cap. NULL = use plan default. Use -1 to explicitly remove the cap for this tenant.';
COMMENT ON COLUMN org_ntf_quota_override_cf.overage_allowed IS
  'Overrides plan overage_allowed. NULL = use plan default.';
COMMENT ON COLUMN org_ntf_quota_override_cf.reason IS
  'Admin note explaining why this override exists, e.g. "Custom enterprise SLA — approved 2026-06-15".';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Primary tenant-scoped lookups (quota resolution hot path)
CREATE INDEX IF NOT EXISTS idx_ntf_qoverride_tenant
  ON org_ntf_quota_override_cf (tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ntf_qoverride_tenant_metric
  ON org_ntf_quota_override_cf (tenant_org_id, metric, period_type);

CREATE INDEX IF NOT EXISTS idx_ntf_qoverride_tenant_active
  ON org_ntf_quota_override_cf (tenant_org_id, is_active)
  WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- Cleanmatex tenant-side reads are scoped to the tenant's own overrides.
-- HQ service role bypasses all RLS policies (intended).
-- ---------------------------------------------------------------------------

ALTER TABLE org_ntf_quota_override_cf ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_ntf_quota_override_cf
  ON org_ntf_quota_override_cf
  FOR ALL
  USING  (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
