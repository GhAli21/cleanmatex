-- ==================================================================
-- Migration: 0223_erp_lite_period_close_precheck_idx.sql
-- Purpose: Support period-close precheck queries (draft journals by posting_date).
-- Project: cleanmatex (source of truth). Do NOT apply automatically.
-- ==================================================================

BEGIN;

CREATE INDEX IF NOT EXISTS idx_ofj_tenant_posting_draft
  ON public.org_fin_journal_mst (tenant_org_id, posting_date)
  WHERE rec_status = 1 AND status_code = 'DRAFT';

COMMENT ON INDEX public.idx_ofj_tenant_posting_draft IS
  'Speeds tenant period-close precheck: draft journals in a posting_date range.';

COMMIT;
