-- ============================================================================
-- 0317_ar_invoice_header_defaults_fix.sql
-- Purpose:
--   Align org_invoice_mst defaults with the canonical AR Invoice v1 status model.
-- Why:
--   0314 added uppercase status constraints but inherited the legacy lowercase
--   default of 'pending', which makes inserts fail unless every caller supplies
--   a compliant status explicitly.
-- ============================================================================

BEGIN;

ALTER TABLE public.org_invoice_mst
  ALTER COLUMN status SET DEFAULT 'OPEN';

COMMIT;
