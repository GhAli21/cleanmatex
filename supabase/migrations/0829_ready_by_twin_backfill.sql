-- Backfill Ready By twins that were never written.
-- Provenance: docs/features/Time_and_Timezone/technical_docs/provenance-class-a.md
-- Sampled 2026-11-25. Null twins were 0 on local and remote, so this updates no current row.
-- Rows that already have ready_by_at_new stay as stored, including the three paired
-- rows whose clocks differ. ready_by is not dropped and is not rewritten.
-- The naive value is read as a UTC wall, the shape proven for the paired rows.
-- This is a one-time backfill across organizations. Application writes now set
-- ready_by_at_new only.

BEGIN;

UPDATE public.org_orders_mst
   SET ready_by_at_new = ready_by AT TIME ZONE 'UTC',
       updated_at = clock_timestamp(),
       updated_info = 'ready_by twin backfill'
 WHERE tenant_org_id IS NOT NULL
   AND ready_by_at_new IS NULL
   AND ready_by IS NOT NULL;

COMMENT ON COLUMN public.org_orders_mst.ready_by_at_new IS
  'UTC instant promised for Ready By. Writers set this column. ready_by remains until every reader has moved.';

COMMENT ON COLUMN public.org_orders_mst.ready_by IS
  'Legacy naive Ready By wall. No longer written. A null ready_by_at_new was filled from this column as a UTC wall. Rows that already had a twin were not rewritten.';

COMMIT;
