-- ==================================================================
-- Migration: 0213_erp_lite_post_snapshot_tr.sql
-- Purpose: Add immutable posting execution snapshot table.
--          Closes DELTA-AUD-001.
--
-- Problem: Current schema stores partial evidence — journal keeps
-- mapping_rule_id/version, posting log carries request/resolved
-- payload JSONs. This is useful but insufficient: a future HQ rule
-- edit must not make old journals unreconstructible.
--
-- This table captures the full effective governance context and
-- resolved runtime state at the moment of each successful posting.
-- It is append-only and must never be updated after insert.
--
-- New objects:
--   public.org_fin_post_snapshot_tr
--
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_fin_post_snapshot_tr (
  id                        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id             UUID    NOT NULL,

  -- links to runtime posting records
  posting_log_id            UUID    NOT NULL,
  journal_id                UUID,

  -- governance evidence: what package/rule/policy was in effect
  gov_pkg_id                UUID,
  gov_pkg_code              VARCHAR(80),
  gov_pkg_version           INTEGER,
  gov_rule_id               UUID,
  gov_rule_code             VARCHAR(80),
  gov_rule_version          INTEGER,
  gov_policy_id             UUID,
  gov_policy_version        INTEGER,

  -- source document references
  source_module_code        VARCHAR(40),
  source_doc_type_code      VARCHAR(40),
  source_doc_id             UUID,
  txn_event_code            VARCHAR(60),

  -- full immutable execution evidence (JSONB, write-once)
  normalized_request_json   JSONB   NOT NULL DEFAULT '{}'::jsonb,
  resolved_rule_json        JSONB   NOT NULL DEFAULT '{}'::jsonb,
  resolved_lines_json       JSONB   NOT NULL DEFAULT '[]'::jsonb,
  resolved_mappings_json    JSONB   NOT NULL DEFAULT '[]'::jsonb,
  resolved_accounts_json    JSONB   NOT NULL DEFAULT '[]'::jsonb,
  journal_header_json       JSONB   NOT NULL DEFAULT '{}'::jsonb,
  journal_lines_json        JSONB   NOT NULL DEFAULT '[]'::jsonb,
  -- actor metadata: AUTO, USER, RETRY, REPOST
  actor_type                VARCHAR(20),
  actor_user_id             VARCHAR(120),

  -- standard audit fields — created_at is the only mutable-ish column
  -- (set at insert time; no updated_at because this is append-only)
  created_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by                VARCHAR(120),
  created_info              TEXT,
  is_active                 BOOLEAN   NOT NULL DEFAULT true,
  rec_status                SMALLINT  NOT NULL DEFAULT 1,

  -- referential integrity
  CONSTRAINT fk_ofps_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofps_log FOREIGN KEY (posting_log_id, tenant_org_id)
    REFERENCES public.org_fin_post_log_tr(id, tenant_org_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ofps_jrnl FOREIGN KEY (journal_id, tenant_org_id)
    REFERENCES public.org_fin_journal_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ofps_pkg FOREIGN KEY (gov_pkg_id)
    REFERENCES public.sys_fin_gov_pkg_mst(pkg_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ofps_rule FOREIGN KEY (gov_rule_id)
    REFERENCES public.sys_fin_map_rule_mst(rule_id)
    ON DELETE SET NULL,

  -- one snapshot per posting attempt
  CONSTRAINT uq_ofps_log UNIQUE (tenant_org_id, posting_log_id),

  CONSTRAINT chk_ofps_actor CHECK (
    actor_type IS NULL OR
    actor_type IN ('AUTO', 'USER', 'RETRY', 'REPOST', 'SYSTEM')
  )
);

COMMENT ON TABLE public.org_fin_post_snapshot_tr IS
  'Append-only immutable execution snapshot. Captures the full effective '
  'governance context and resolved runtime state at posting time so that '
  'any journal can be reconstructed even after HQ rule/policy changes.';
COMMENT ON COLUMN public.org_fin_post_snapshot_tr.normalized_request_json IS
  'Full normalized posting request as submitted to the engine.';
COMMENT ON COLUMN public.org_fin_post_snapshot_tr.resolved_rule_json IS
  'Snapshot of the governance rule as it existed at posting time.';
COMMENT ON COLUMN public.org_fin_post_snapshot_tr.resolved_lines_json IS
  'Resolved rule lines including conditions, sides, and amount sources.';
COMMENT ON COLUMN public.org_fin_post_snapshot_tr.resolved_mappings_json IS
  'Resolved usage-code → account mappings at posting time.';
COMMENT ON COLUMN public.org_fin_post_snapshot_tr.resolved_accounts_json IS
  'Resolved account ids, codes, and types used in the journal draft.';
COMMENT ON COLUMN public.org_fin_post_snapshot_tr.journal_header_json IS
  'Journal header as built before persistence.';
COMMENT ON COLUMN public.org_fin_post_snapshot_tr.journal_lines_json IS
  'Journal lines as built before persistence.';

CREATE INDEX IF NOT EXISTS idx_ofps_tenant
  ON public.org_fin_post_snapshot_tr(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofps_jrnl
  ON public.org_fin_post_snapshot_tr(tenant_org_id, journal_id);

CREATE INDEX IF NOT EXISTS idx_ofps_source
  ON public.org_fin_post_snapshot_tr(tenant_org_id, source_doc_type_code, source_doc_id);

CREATE INDEX IF NOT EXISTS idx_ofps_evt
  ON public.org_fin_post_snapshot_tr(tenant_org_id, txn_event_code);

-- RLS: tenant-scoped — must filter by tenant
ALTER TABLE public.org_fin_post_snapshot_tr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ofps ON public.org_fin_post_snapshot_tr;
CREATE POLICY tenant_isolation_ofps ON public.org_fin_post_snapshot_tr
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
