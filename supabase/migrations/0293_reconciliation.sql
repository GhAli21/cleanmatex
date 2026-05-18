-- ============================================================
-- Migration 0293: Financial Reconciliation Tables
-- Phase 6.4 of the Order Financial Platform
--
-- Tables created:
--   org_fin_recon_runs_mst   — one row per reconciliation run
--   org_fin_recon_issues_dtl — individual check failures within a run
-- ============================================================

-- ── org_fin_recon_runs_mst ────────────────────────────────────────────────────
-- Each row represents a full reconciliation pass over a date range.
-- run_no is tenant-scoped and unique (e.g. RECON-2026-05-001).
CREATE TABLE org_fin_recon_runs_mst (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID        NOT NULL,
  run_no          TEXT        NOT NULL,
  run_type        TEXT        NOT NULL DEFAULT 'MANUAL'
                                CHECK (run_type IN ('DAILY','MANUAL')),
  period_from     DATE        NOT NULL,
  period_to       DATE        NOT NULL,
  branch_id       UUID,
  currency_code   TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'PENDING'
                                CHECK (status IN ('PENDING','RUNNING','PASSED','FAILED','PARTIAL')),
  total_checked   INTEGER     NOT NULL DEFAULT 0,
  passed_checks   INTEGER     NOT NULL DEFAULT 0,
  failed_checks   INTEGER     NOT NULL DEFAULT 0,
  warning_checks  INTEGER     NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  triggered_by    UUID,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  rec_status      SMALLINT    NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  created_info    TEXT,
  updated_at      TIMESTAMPTZ,
  updated_by      UUID,
  updated_info    TEXT,
  metadata        JSONB,
  CONSTRAINT uq_recon_run_no UNIQUE (tenant_org_id, run_no)
);

-- ── org_fin_recon_issues_dtl ──────────────────────────────────────────────────
-- Individual check results within a run. BLOCKER = prevents close; WARNING = advisory.
CREATE TABLE org_fin_recon_issues_dtl (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id        UUID        NOT NULL,
  run_id               UUID        NOT NULL REFERENCES org_fin_recon_runs_mst(id) ON DELETE CASCADE,
  check_name           TEXT        NOT NULL,
  severity             TEXT        NOT NULL CHECK (severity IN ('BLOCKER','WARNING','INFO')),
  affected_entity_type TEXT,
  affected_entity_id   UUID,
  expected_value       DECIMAL(19,4),
  actual_value         DECIMAL(19,4),
  delta                DECIMAL(19,4),
  message              TEXT        NOT NULL,
  status               TEXT        NOT NULL DEFAULT 'OPEN'
                         CHECK (status IN ('OPEN','ACKNOWLEDGED','RESOLVED')),
  acknowledged_by      UUID,
  acknowledged_at      TIMESTAMPTZ,
  resolved_by          UUID,
  resolved_at          TIMESTAMPTZ,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_fin_recon_runs_status
  ON org_fin_recon_runs_mst (tenant_org_id, status, period_from);

CREATE INDEX IF NOT EXISTS idx_fin_recon_issues_run
  ON org_fin_recon_issues_dtl (run_id, severity, status);

CREATE INDEX IF NOT EXISTS idx_fin_recon_issues_tenant
  ON org_fin_recon_issues_dtl (tenant_org_id, status, severity);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE org_fin_recon_runs_mst ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_fin_recon_runs_mst
  ON org_fin_recon_runs_mst FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

ALTER TABLE org_fin_recon_issues_dtl ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_fin_recon_issues
  ON org_fin_recon_issues_dtl FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());
