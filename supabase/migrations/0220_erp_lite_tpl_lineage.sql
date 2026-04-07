-- ==================================================================
-- Migration: 0220_erp_lite_tpl_lineage.sql
-- Purpose: Add row-level template materialization lineage table.
--          Closes DELTA-TPL-001 (Wave 3).
--
-- Why: The current template apply log (org_fin_tpl_apply_log) records
-- that a template package was applied to a tenant but does NOT record
-- which specific rows (accounts, usage mappings, governance rules)
-- were created/updated/skipped as a result of each apply run.
--
-- Without row-level lineage:
--   - HQ cannot audit what exactly was provisioned per tenant.
--   - Re-apply and partial-apply logic has no idempotency reference.
--   - Disputes about "why does tenant X have account Y" are
--     unresolvable without reading code + raw logs.
--
-- This table records one row per object materialized per apply run,
-- enabling:
--   - Full apply diff view in HQ template studio
--   - Idempotent re-apply (check for existing lineage rows)
--   - Tenant "what came from template" badge in COA Explorer
--   - Audit trail for HQ governance support
--
-- Design: append-only (one row per object per apply attempt).
--         Never updated after insert.
--
-- New objects:
--   public.org_fin_tpl_mat_tr
--
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- Table: org_fin_tpl_mat_tr
-- Row-level template materialization lineage.
-- One row per (apply_log, object_type, object_id) combination.
-- Append-only; never updated after insert.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_fin_tpl_mat_tr (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id       UUID        NOT NULL,

  -- link to the apply run that created this row
  apply_log_id        UUID        NOT NULL,

  -- what type of object was materialized
  -- VALUES: 'ACCOUNT', 'USAGE_MAP', 'GOV_RULE', 'GOV_POLICY',
  --         'GOV_RULE_LINE', 'PERIOD', 'SEQUENCE'
  object_type         VARCHAR(30) NOT NULL,

  -- the id of the materialized object in its respective table
  object_id           UUID        NOT NULL,

  -- source template reference: the template line that drove this row
  source_tpl_line_id  UUID,
  source_tpl_pkg_id   UUID,

  -- action taken during this apply run for this object
  -- CREATED: new row inserted
  -- UPDATED: existing row updated (template re-apply with changes)
  -- SKIPPED: row already existed and matched; no change made
  -- FAILED:  attempted but errored; error_message records reason
  action_code         VARCHAR(10) NOT NULL DEFAULT 'CREATED',

  -- human-readable summary of what changed (for UPDATED rows)
  change_summary      TEXT,

  -- error detail for FAILED rows
  error_message       TEXT,

  -- snapshot of the object state after materialization (optional JSON)
  -- Stored only when action_code IN ('CREATED', 'UPDATED')
  object_snapshot_json JSONB,

  -- standard audit (append-only: no updated_at)
  created_at          TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by          VARCHAR(120),
  created_info        TEXT,
  rec_status          SMALLINT    NOT NULL DEFAULT 1,
  rec_order           INTEGER,
  rec_notes           VARCHAR(200),
  is_active           BOOLEAN     NOT NULL DEFAULT true,

  -- referential integrity
  CONSTRAINT fk_oftm_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,

  CONSTRAINT fk_oftm_apply_log FOREIGN KEY (apply_log_id)
    REFERENCES public.org_fin_tpl_apply_log(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_oftm_tpl_pkg FOREIGN KEY (source_tpl_pkg_id)
    REFERENCES public.sys_fin_tpl_pkg_mst(tpl_pkg_id)
    ON DELETE SET NULL,

  -- constraints
  CONSTRAINT chk_oftm_object_type CHECK (
    object_type IN (
      'ACCOUNT', 'USAGE_MAP', 'GOV_RULE', 'GOV_POLICY',
      'GOV_RULE_LINE', 'PERIOD', 'SEQUENCE'
    )
  ),
  CONSTRAINT chk_oftm_action CHECK (
    action_code IN ('CREATED', 'UPDATED', 'SKIPPED', 'FAILED')
  ),
  -- idempotency: one lineage row per object per apply run
  CONSTRAINT uq_oftm_apply_object UNIQUE (apply_log_id, object_type, object_id)
);

COMMENT ON TABLE public.org_fin_tpl_mat_tr IS
  'Row-level template materialization lineage. Append-only. One row per object '
  '(account, usage map, governance rule, etc.) per template apply run. '
  'Enables: apply diff view in HQ template studio, idempotent re-apply, '
  '"came from template" badge in COA Explorer, and HQ governance audit trail.';

COMMENT ON COLUMN public.org_fin_tpl_mat_tr.object_type IS
  'Type of object materialized: ACCOUNT, USAGE_MAP, GOV_RULE, GOV_POLICY, '
  'GOV_RULE_LINE, PERIOD, SEQUENCE.';
COMMENT ON COLUMN public.org_fin_tpl_mat_tr.object_id IS
  'UUID of the materialized object in its respective table.';
COMMENT ON COLUMN public.org_fin_tpl_mat_tr.action_code IS
  'CREATED: new row inserted. UPDATED: row updated (re-apply). '
  'SKIPPED: row matched template, no change. FAILED: attempted but errored.';
COMMENT ON COLUMN public.org_fin_tpl_mat_tr.change_summary IS
  'Human-readable summary of what changed for UPDATED rows (field diff).';
COMMENT ON COLUMN public.org_fin_tpl_mat_tr.object_snapshot_json IS
  'Optional JSON snapshot of the object state after materialization. '
  'Stored for CREATED and UPDATED rows. Omitted for SKIPPED and FAILED.';

-- ------------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------------

-- Primary lookup: all rows for a given apply run (HQ apply diff view)
CREATE INDEX IF NOT EXISTS idx_oftm_apply_log
  ON public.org_fin_tpl_mat_tr(tenant_org_id, apply_log_id, object_type);

-- COA Explorer badge: was this account ever materialized from a template?
CREATE INDEX IF NOT EXISTS idx_oftm_object
  ON public.org_fin_tpl_mat_tr(tenant_org_id, object_type, object_id);

-- Source template line lookup: which tenants got this template line?
CREATE INDEX IF NOT EXISTS idx_oftm_tpl_line
  ON public.org_fin_tpl_mat_tr(source_tpl_line_id, tenant_org_id)
  WHERE source_tpl_line_id IS NOT NULL;

-- Failed row monitoring: how many failures per apply run?
CREATE INDEX IF NOT EXISTS idx_oftm_failed
  ON public.org_fin_tpl_mat_tr(tenant_org_id, apply_log_id)
  WHERE action_code = 'FAILED';

-- ------------------------------------------------------------------
-- RLS: tenant-scoped append-only table
-- ------------------------------------------------------------------
ALTER TABLE public.org_fin_tpl_mat_tr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_oftm ON public.org_fin_tpl_mat_tr;
CREATE POLICY tenant_isolation_oftm ON public.org_fin_tpl_mat_tr
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
