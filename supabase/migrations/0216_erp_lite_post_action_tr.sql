-- ==================================================================
-- Migration: 0216_erp_lite_post_action_tr.sql
-- Purpose: Add operator action history table for sensitive finance
--          operations. Closes DELTA-AUD-002.
--
-- Problem: There is no durable audit record linking a human operator
-- action (retry, repost, resolve, close-period, etc.) to the
-- resulting state change. Without it, disputes and support cases
-- cannot be investigated without reading raw PostgreSQL logs.
--
-- This table records every deliberate operator action on:
--   - posting exceptions (retry, repost, resolve, ignore, close)
--   - accounting periods (close, reopen)
--   - usage mappings (activate, inactivate, replace)
--   - post-log manual interventions (force-resolve, re-queue)
--
-- Design: append-only, never updated after insert.
-- Queried in: Exception Workbench action history panel,
--             Period Management audit trail, Posting Audit Viewer.
--
-- New objects:
--   public.org_fin_post_action_tr
--
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- Table: org_fin_post_action_tr
-- Operator action audit trail for ERP-Lite finance operations.
-- One row per deliberate human (or system-scheduled) action.
-- Append-only — no UPDATE after INSERT.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_fin_post_action_tr (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id       UUID        NOT NULL,

  -- action classification -----------------------------------------
  -- action_domain: which sub-system the action targeted
  -- VALUES: 'EXCEPTION', 'PERIOD', 'USAGE_MAP', 'POST_LOG', 'OTHER'
  action_domain       VARCHAR(20) NOT NULL,

  -- action_code: the specific operation performed.
  -- EXCEPTION domain: RETRY, REPOST, RESOLVE, IGNORE, CLOSE
  -- PERIOD domain   : CLOSE, REOPEN
  -- USAGE_MAP domain: ACTIVATE, INACTIVATE, REPLACE
  -- POST_LOG domain : FORCE_RESOLVE, RE_QUEUE
  action_code         VARCHAR(30) NOT NULL,

  -- target reference ----------------------------------------------
  -- exactly one of these should be set, matching action_domain
  exception_id        UUID,       -- org_fin_post_exc_tr
  period_id           UUID,       -- org_fin_period_mst
  usage_map_id        UUID,       -- org_fin_usage_map_mst
  posting_log_id      UUID,       -- org_fin_post_log_tr

  -- action result -------------------------------------------------
  -- result_code: SUCCESS, FAILED, SKIPPED
  result_code         VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',

  -- state transition: what value changed (optional but recommended)
  prev_status_code    VARCHAR(30),
  new_status_code     VARCHAR(30),

  -- human context: why the operator took this action
  action_notes        TEXT,

  -- idempotency reference: links action to the triggered process
  -- e.g. posting_log_id of the new attempt spawned by a retry
  triggered_log_id    UUID,

  -- actor metadata ------------------------------------------------
  actor_user_id       VARCHAR(120) NOT NULL,
  actor_ip            VARCHAR(45),    -- IPv4 or IPv6
  actor_user_agent    TEXT,

  -- standard audit fields (append-only: no updated_at) -----------
  created_at          TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by          VARCHAR(120),
  created_info        TEXT,
  rec_status          SMALLINT    NOT NULL DEFAULT 1,
  rec_order           INTEGER,
  rec_notes           VARCHAR(200),
  is_active           BOOLEAN     NOT NULL DEFAULT true,

  -- referential integrity ----------------------------------------
  CONSTRAINT fk_ofpa_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,

  CONSTRAINT fk_ofpa_exc FOREIGN KEY (exception_id, tenant_org_id)
    REFERENCES public.org_fin_post_exc_tr(id, tenant_org_id)
    ON DELETE SET NULL,

  CONSTRAINT fk_ofpa_log FOREIGN KEY (posting_log_id, tenant_org_id)
    REFERENCES public.org_fin_post_log_tr(id, tenant_org_id)
    ON DELETE SET NULL,

  -- constraints ---------------------------------------------------
  CONSTRAINT chk_ofpa_domain CHECK (
    action_domain IN ('EXCEPTION', 'PERIOD', 'USAGE_MAP', 'POST_LOG', 'OTHER')
  ),
  CONSTRAINT chk_ofpa_result CHECK (
    result_code IN ('SUCCESS', 'FAILED', 'SKIPPED')
  ),
  CONSTRAINT chk_ofpa_actor CHECK (
    actor_user_id IS NOT NULL AND length(trim(actor_user_id)) > 0
  )
);

COMMENT ON TABLE public.org_fin_post_action_tr IS
  'Append-only operator action audit trail for sensitive ERP-Lite finance '
  'operations: exception retry/repost/resolve, period close/reopen, usage '
  'mapping activate/inactivate, and post-log interventions. Never updated '
  'after insert. Used by Exception Workbench, Period Management, and '
  'Posting Audit Viewer for action history panels.';

COMMENT ON COLUMN public.org_fin_post_action_tr.action_domain IS
  'Sub-system targeted: EXCEPTION, PERIOD, USAGE_MAP, POST_LOG, OTHER.';
COMMENT ON COLUMN public.org_fin_post_action_tr.action_code IS
  'Specific operation: e.g. RETRY, REPOST, RESOLVE, CLOSE, REOPEN, ACTIVATE, INACTIVATE.';
COMMENT ON COLUMN public.org_fin_post_action_tr.result_code IS
  'Outcome: SUCCESS (action completed), FAILED (action attempted but errored), '
  'SKIPPED (pre-condition check blocked execution).';
COMMENT ON COLUMN public.org_fin_post_action_tr.triggered_log_id IS
  'When a RETRY/REPOST spawns a new posting log attempt, that log id is recorded '
  'here for lineage tracing (action → new attempt).';
COMMENT ON COLUMN public.org_fin_post_action_tr.prev_status_code IS
  'Status before the action. Allows diff view in audit panel.';
COMMENT ON COLUMN public.org_fin_post_action_tr.new_status_code IS
  'Status after the action. Allows diff view in audit panel.';

-- ------------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------------

-- Primary query pattern: by tenant + domain + created_at (workbench list)
CREATE INDEX IF NOT EXISTS idx_ofpa_tenant_domain
  ON public.org_fin_post_action_tr(tenant_org_id, action_domain, created_at DESC);

-- Exception history panel: all actions for a given exception
CREATE INDEX IF NOT EXISTS idx_ofpa_exc
  ON public.org_fin_post_action_tr(tenant_org_id, exception_id)
  WHERE exception_id IS NOT NULL;

-- Period history panel: all actions for a given period
CREATE INDEX IF NOT EXISTS idx_ofpa_period
  ON public.org_fin_post_action_tr(tenant_org_id, period_id)
  WHERE period_id IS NOT NULL;

-- Usage map audit: all actions for a given mapping
CREATE INDEX IF NOT EXISTS idx_ofpa_usage_map
  ON public.org_fin_post_action_tr(tenant_org_id, usage_map_id)
  WHERE usage_map_id IS NOT NULL;

-- Posting log lineage: triggered_log → originating action
CREATE INDEX IF NOT EXISTS idx_ofpa_triggered_log
  ON public.org_fin_post_action_tr(tenant_org_id, triggered_log_id)
  WHERE triggered_log_id IS NOT NULL;

-- Actor queries: what did this user do?
CREATE INDEX IF NOT EXISTS idx_ofpa_actor
  ON public.org_fin_post_action_tr(tenant_org_id, actor_user_id, created_at DESC);

-- ------------------------------------------------------------------
-- RLS: tenant-scoped append-only table
-- ------------------------------------------------------------------
ALTER TABLE public.org_fin_post_action_tr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ofpa ON public.org_fin_post_action_tr;
CREATE POLICY tenant_isolation_ofpa ON public.org_fin_post_action_tr
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
