-- ============================================================================
-- 0456_sys_wf_graph_def_ver_force_rebuild.sql
-- Allow multiple graph def rows with the same catalog_fingerprint so every
-- profile publish can force-insert a new immutable snapshot (no reuse).
--
-- DO NOT APPLY via agent tools — review and apply manually.
-- ============================================================================

BEGIN;

ALTER TABLE public.sys_wf_graph_def_ver_mst
  DROP CONSTRAINT IF EXISTS uq_sys_wf_graph_def_ver_fp;

CREATE INDEX IF NOT EXISTS idx_sys_wf_graph_def_ver_fp
  ON public.sys_wf_graph_def_ver_mst (catalog_fingerprint);

COMMENT ON TABLE public.sys_wf_graph_def_ver_mst IS
  'Immutable snapshot of sys_wf_* catalogs at publish time. Each publish inserts a new row (full rebuild); fingerprint is informational, not a dedupe key.';
COMMENT ON COLUMN public.sys_wf_graph_def_ver_mst.catalog_fingerprint IS
  'Hash of active catalog rows at publish — audit/compare only; duplicates allowed across publishes.';

COMMIT;
