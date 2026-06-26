-- ==================================================================
-- Migration: 0388_tax_doc_seq_counters_audit_cols.sql
-- Purpose: Align org_tax_doc_seq_counters with the standard audit-column
--          convention (F-09 from the Order-Fin validation report).
--
-- Problem (F-09, Low): the counter table has created_at/by + updated_at/by
--   but lacks created_info / updated_info / rec_status / rec_order /
--   rec_notes / is_active. Minor convention deviation flagged for cleanup
--   "if/when touched for F-01" — F-01 (RLS) shipped in 0379, so this closes
--   the remaining convention gap on the same table.
--
-- All columns are additive with safe defaults; no rewrite of existing rows
-- beyond the column backfill of the defaults. No behavior change — the
-- sequence allocator (SELECT ... FOR UPDATE; UPDATE last_sequence) does not
-- read these columns.
--
-- Tables touched: public.org_tax_doc_seq_counters (DDL — ADD COLUMN only).
-- Additive + idempotent (IF NOT EXISTS). Tenant-scoped table (RLS from 0379).
--
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

ALTER TABLE public.org_tax_doc_seq_counters
  ADD COLUMN IF NOT EXISTS created_info TEXT,
  ADD COLUMN IF NOT EXISTS updated_info TEXT,
  ADD COLUMN IF NOT EXISTS rec_status   SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order    INTEGER,
  ADD COLUMN IF NOT EXISTS rec_notes    TEXT,
  ADD COLUMN IF NOT EXISTS is_active    BOOLEAN  NOT NULL DEFAULT true;

COMMENT ON COLUMN public.org_tax_doc_seq_counters.rec_status IS
  'Standard audit lifecycle flag (1 = active). Convention alignment (F-09).';
COMMENT ON COLUMN public.org_tax_doc_seq_counters.is_active IS
  'Standard soft-active flag. Convention alignment (F-09). The sequence '
  'allocator does not gate on this column; counters are never soft-deleted.';

COMMIT;