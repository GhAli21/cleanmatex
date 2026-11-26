-- ============================================================================
-- Migration: 0833_orders_ready_columns_canonical.sql
-- Purpose:
--   Standardize public.org_orders_mst onto the canonical two-column TIMESTAMPTZ
--   Ready pair matching org_order_items_dtl and org_order_item_pieces_dtl:
--     1. ready_by_at (TIMESTAMPTZ) -- customer-promised Ready By UTC instant
--     2. ready_at    (TIMESTAMPTZ) -- actual UTC instant when marked READY
--
-- Changes:
--   - Safety backfill: populate any null ready_by_at_new from legacy ready_by
--     interpreted as a UTC wall clock (proven in provenance-class-a.md).
--   - Remove legacy naive index idx_orders_ready_by (RESTRICT).
--   - Remove legacy naive columns ready_by and ready_by_override (RESTRICT).
--     ready_by is superseded by ready_by_at; ready_by_override was a redundant
--     naive timestamp written only during Quick Drop preparation completion with
--     no business-logic readers.
--   - Rename ready_by_at_new -> ready_by_at and idx_orders_ready_by_new ->
--     idx_orders_ready_by_at.
--   - Upgrade ready_at from naive TIMESTAMP to TIMESTAMPTZ (UTC wall).
-- ============================================================================

BEGIN;

-- 1. Idempotent backfill guard before dropping legacy ready_by.
--    Ensures no row loses a promised Ready By instant if 0829 was not yet run.
UPDATE public.org_orders_mst
   SET ready_by_at_new = ready_by AT TIME ZONE 'UTC',
       updated_at = clock_timestamp(),
       updated_info = 'ready_by canonical backfill (0833)'
 WHERE tenant_org_id IS NOT NULL
   AND ready_by_at_new IS NULL
   AND ready_by IS NOT NULL;

-- 2. Drop legacy naive Ready By index (superseded by idx_orders_ready_by_at).
DROP INDEX IF EXISTS public.idx_orders_ready_by RESTRICT;

-- 3. Drop legacy naive Ready By columns (RESTRICT ensures no hidden view,
--    trigger, or constraint depends on them).
ALTER TABLE public.org_orders_mst
  DROP COLUMN IF EXISTS ready_by RESTRICT,
  DROP COLUMN IF EXISTS ready_by_override RESTRICT;

-- 4. Rename canonical promised Ready By column and its partial tenant index
--    to match org_order_items_dtl.ready_by_at and org_order_item_pieces_dtl.ready_by_at.
ALTER TABLE public.org_orders_mst
  RENAME COLUMN ready_by_at_new TO ready_by_at;

ALTER INDEX IF EXISTS public.idx_orders_ready_by_new
  RENAME TO idx_orders_ready_by_at;

-- 5. Upgrade actual completion timestamp ready_at from naive TIMESTAMP to
--    TIMESTAMPTZ so SLA comparisons (ready_at <= ready_by_at) operate on
--    consistent UTC instants without session-timezone drift.
ALTER TABLE public.org_orders_mst
  ALTER COLUMN ready_at TYPE TIMESTAMPTZ
  USING ready_at AT TIME ZONE 'UTC';

-- 6. Catalog comments for altered/renamed objects.
COMMENT ON COLUMN public.org_orders_mst.ready_by_at IS
  'UTC instant promised to the customer for when the order will be ready. Set at creation and updated only on explicit rescheduling (order edit or preparation completion).';

COMMENT ON COLUMN public.org_orders_mst.ready_at IS
  'Actual UTC instant when the order finished processing and was marked READY by the workflow engine. Used with ready_by_at for on-time SLA evaluation.';

COMMENT ON INDEX public.idx_orders_ready_by_at IS
  'Tenant-scoped partial index on promised Ready By instant (ready_by_at) for overdue, workboard, and stage worklist queries.';

COMMIT;
