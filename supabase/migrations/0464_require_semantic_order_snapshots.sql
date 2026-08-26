-- ============================================================================
-- 0464_require_semantic_order_snapshots.sql
-- Purpose: Make the compiled semantic workflow snapshot mandatory for every
--          active order written after the semantic-only runtime cutover.
-- Author: CleanMateX Development Team
-- Created: 2026-08-26
-- Dependencies: 0457_semantic_workflow_profile_runtime.sql
-- Safety: NOT VALID preserves existing historic rows. PostgreSQL still checks
--         every new or updated row, preventing new operational legacy orders.
-- DO NOT APPLY automatically - review then run via the normal DB process.
-- ============================================================================

BEGIN;

-- An active order must retain enough identity to load exactly one immutable
-- compiler artifact. Soft-deleted historic rows remain auditable without being
-- made operational again. This deliberately avoids rewriting development data.
ALTER TABLE public.org_orders_mst
  ADD CONSTRAINT chk_ord_wf_snap_required
  CHECK (
    COALESCE(rec_status, 1) = 0
    OR (
      wf_profile_id IS NOT NULL
      AND wf_version_no IS NOT NULL
      AND wf_profile_version_id IS NOT NULL
      AND wf_profile_artifact_id IS NOT NULL
      AND wf_profile_revision IS NOT NULL
      AND wf_profile_checksum IS NOT NULL
      AND wf_profile_schema_version IS NOT NULL
    )
  ) NOT VALID;

-- Documents the forward-only operational boundary enforced by this migration.
COMMENT ON CONSTRAINT chk_ord_wf_snap_required ON public.org_orders_mst IS
  'Requires a complete immutable semantic workflow snapshot for active orders; soft-deleted historic rows remain audit-only.';

COMMIT;
