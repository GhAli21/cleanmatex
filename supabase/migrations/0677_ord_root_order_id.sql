-- ==================================================================
-- Migration 0677_ord_root_order_id.sql
-- Human-Friendly Codes, P2.1 (split family root), migration 1 of 2.
--
-- Purpose (decision A-28, approved by the user 2026-10-31): every sub-order stores the id of its family root.
--   1. org_orders_mst.root_order_id UUID NULL: NULL for a root (normal) order, the root order id for every sub-order
--      (also for a sub-order of a sub-order). Tenant-safe composite FK, partial index, self-reference CHECK.
--   2. Backfill from the parent_order_id chain (bounded, same tenant). Bad chains stop the migration with a list.
--   3. Guard trigger trg_ord_root_guard: fills root_order_id on INSERT from the parent, rejects a wrong value, a root
--      that is itself a sub-order, and any later change (immutable; only the FK ON DELETE SET NULL path may clear it).
--   4. fn_ord_next_sub_order_no(tenant, parent): same signature, now reads the root from root_order_id (no walk),
--      locks the root FOR UPDATE, checks the family is consistent, numbers from rows WHERE root_order_id = root.
--
-- Invariants after this migration:
--   - root order:  root_order_id IS NULL.
--   - sub-order:   parent_order_id IS NOT NULL at insert, root_order_id = COALESCE(parent.root_order_id, parent.id),
--                  and that root row has root_order_id IS NULL (a root is never itself a sub-order).
--   - root_order_id never changes once set (re-parenting is refused). parent_order_id may only become NULL
--     (fk_order_parent_order ON DELETE SET NULL); root_order_id then still names the family root.
--
-- Affected: org_orders_mst (1 column, 1 FK, 1 CHECK, 1 index, 1 trigger), 1 new + 1 replaced function.
--           Prisma: add root_order_id to model org_orders_mst (db pull) and regenerate Supabase types.
-- Related:  0674_ord_order_no_engine (fn_ord_next_sub_order_no first version), fk_order_parent_order,
--           idx_orders_parent_order, web-admin lib/services/order-split.service.ts.
-- Plan:     docs/features/Human_Friendly_Codes/IMPLEMENTATION_PLAN_Human_Friendly_Codes.md section 5.8.1; A-28..A-30.
-- APPLY ORDER: 1 of 2 in P2.1 (0678_tenant_hard_delete_guard is independent). Requires 0674.
--              Pre-checks: DEV_GUIDE_DOC_SEQ_ENGINE.md section 16 (P2.1 pre-apply checks). Deploy the P2.1 web-admin
--              split service after this migration (its parent lock query reads root_order_id). The P2 split code
--              keeps working on top of this migration (the trigger fills root_order_id for it).
-- ROLLBACK PLAN (forward-only repo; write a new migration). Order numbers are not touched, so it is safe at any time:
--   Re-create the 0674 body of fn_ord_next_sub_order_no (walk parent_order_id, recursive descendant scan);
--   DROP TRIGGER trg_ord_root_guard ON public.org_orders_mst; DROP FUNCTION public.fn_ord_root_guard();
--   ALTER TABLE public.org_orders_mst DROP COLUMN root_order_id;   (drops the FK, CHECK and index with it)
-- ==================================================================

BEGIN;
SET LOCAL lock_timeout = '10s';

-- ------------------------------------------------------------------
-- 1. Column, keys, index
-- ------------------------------------------------------------------
ALTER TABLE public.org_orders_mst ADD COLUMN IF NOT EXISTS root_order_id UUID NULL;

COMMENT ON COLUMN public.org_orders_mst.root_order_id IS
  'Split family root (A-28). NULL = this is a root (normal) order; otherwise the id of the root order of the family, the same for every sub-order of the family, also for a sub-order of a sub-order. Filled by trg_ord_root_guard from the parent on INSERT, immutable afterwards. Used by fn_ord_next_sub_order_no (<root order_no>-S<n>). Set to NULL only by fk_ord_root_order when the root row is deleted.';

ALTER TABLE public.org_orders_mst
  ADD CONSTRAINT fk_ord_root_order FOREIGN KEY (root_order_id, tenant_org_id)
    REFERENCES public.org_orders_mst (id, tenant_org_id)
    ON UPDATE RESTRICT ON DELETE SET NULL (root_order_id),
  ADD CONSTRAINT chk_ord_root_not_self CHECK (root_order_id IS DISTINCT FROM id);

COMMENT ON CONSTRAINT fk_ord_root_order ON public.org_orders_mst IS
  'Tenant-safe family root: (root_order_id, tenant_org_id) -> org_orders_mst (id, tenant_org_id), so a root is always in the same tenant. ON DELETE SET NULL (root_order_id) (PG15+) clears only root_order_id, never tenant_org_id; mirrors fk_order_parent_order.';
COMMENT ON CONSTRAINT chk_ord_root_not_self ON public.org_orders_mst IS
  'An order is never its own root: a root keeps root_order_id NULL.';

CREATE INDEX IF NOT EXISTS idx_ord_root_order
  ON public.org_orders_mst (tenant_org_id, root_order_id)
  WHERE root_order_id IS NOT NULL;

COMMENT ON INDEX public.idx_ord_root_order IS
  'Sub-orders of a family (tenant_org_id, root_order_id); partial, root orders (NULL) are not indexed. Used by fn_ord_next_sub_order_no and family lists.';

-- ------------------------------------------------------------------
-- 2. Backfill from parent_order_id (same tenant, bounded, cycle-safe). Expected 0 or very few rows: the legacy split
--    paths never produced sub-orders successfully. Any bad chain stops the migration (fail closed) with a list.
-- ------------------------------------------------------------------
DO $bf$
DECLARE
  c_max_depth CONSTANT INT := 10;
  v_bad   TEXT;
  v_rows  INT;
BEGIN
  CREATE TEMP TABLE zz_ord_root_map ON COMMIT DROP AS
  WITH RECURSIVE w AS (
    SELECT o.id, o.tenant_org_id, o.parent_order_id AS cur, 1 AS lvl, ARRAY[o.id] AS path
      FROM public.org_orders_mst o
     WHERE o.parent_order_id IS NOT NULL
    UNION ALL
    SELECT w.id, w.tenant_org_id, p.parent_order_id, w.lvl + 1, w.path || p.id
      FROM w
      JOIN public.org_orders_mst p ON p.id = w.cur AND p.tenant_org_id = w.tenant_org_id
     WHERE p.parent_order_id IS NOT NULL
       AND w.lvl <= c_max_depth
       AND NOT p.id = ANY (w.path)
  )
  SELECT DISTINCT ON (w.id) w.id, w.tenant_org_id, w.cur AS last_parent, w.lvl, w.path
    FROM w
   ORDER BY w.id, w.lvl DESC;

  -- the last step must be an existing same-tenant row without a parent (a real root)
  SELECT string_agg(m.id::TEXT, ', ' ORDER BY m.id) INTO v_bad
    FROM zz_ord_root_map m
    LEFT JOIN public.org_orders_mst r ON r.id = m.last_parent AND r.tenant_org_id = m.tenant_org_id
   WHERE r.id IS NULL OR r.parent_order_id IS NOT NULL;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'ORD_ROOT_BACKFILL_BAD_CHAIN: these orders have a parent chain that is cross-tenant, missing, cyclic or deeper than % levels: %',
      c_max_depth, left(v_bad, 4000)
      USING ERRCODE = '23514',
            HINT = 'Run the P2.1 pre-apply check in DEV_GUIDE_DOC_SEQ_ENGINE.md section 16 and repair parent_order_id first.';
  END IF;

  UPDATE public.org_orders_mst o
     SET root_order_id = m.last_parent
    FROM zz_ord_root_map m
   WHERE o.id = m.id AND o.tenant_org_id = m.tenant_org_id
     AND o.root_order_id IS DISTINCT FROM m.last_parent;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RAISE NOTICE 'ORD_ROOT_BACKFILL: % sub-order row(s) got root_order_id', v_rows;
END
$bf$;

-- ------------------------------------------------------------------
-- 3. Guard trigger: fill / validate on INSERT, immutable on UPDATE
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ord_root_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_p_root     UUID;
  v_expected   UUID;
  v_root_root  UUID;
  v_root_par   UUID;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.root_order_id IS DISTINCT FROM OLD.root_order_id THEN
      -- Only allowed change: to NULL because the root row is gone (fk_ord_root_order ON DELETE SET NULL).
      IF NOT (NEW.root_order_id IS NULL AND NOT EXISTS (
                SELECT 1 FROM public.org_orders_mst r
                 WHERE r.id = OLD.root_order_id AND r.tenant_org_id = OLD.tenant_org_id)) THEN
        RAISE EXCEPTION 'ORD_ROOT_IMMUTABLE: root_order_id of order % cannot change (% -> %)',
          OLD.id, OLD.root_order_id, NEW.root_order_id USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END IF;
    IF NEW.parent_order_id IS NOT DISTINCT FROM OLD.parent_order_id OR NEW.parent_order_id IS NULL THEN
      RETURN NEW;                                   -- unchanged, or detached (parent deleted)
    END IF;
    -- parent_order_id changed to a new non-null value: allowed only if it stays inside the same family.
  ELSIF NEW.parent_order_id IS NULL THEN            -- INSERT of a root order
    IF NEW.root_order_id IS NOT NULL THEN
      RAISE EXCEPTION 'ORD_ROOT_MISMATCH: an order without parent_order_id must have root_order_id NULL'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  SELECT p.root_order_id INTO v_p_root
    FROM public.org_orders_mst p
   WHERE p.id = NEW.parent_order_id AND p.tenant_org_id = NEW.tenant_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORD_PARENT_NOT_FOUND: %', NEW.parent_order_id USING ERRCODE = '23503';
  END IF;
  v_expected := COALESCE(v_p_root, NEW.parent_order_id);

  IF TG_OP = 'INSERT' AND NEW.root_order_id IS NULL THEN
    NEW.root_order_id := v_expected;
  ELSIF NEW.root_order_id IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'ORD_ROOT_MISMATCH: order % has root % but its parent % belongs to root %',
      NEW.id, NEW.root_order_id, NEW.parent_order_id, v_expected USING ERRCODE = '23514';
  END IF;

  IF v_p_root IS NOT NULL THEN                     -- parent is a sub-order: its root must be a real root
    SELECT r.root_order_id, r.parent_order_id INTO v_root_root, v_root_par
      FROM public.org_orders_mst r
     WHERE r.id = v_expected AND r.tenant_org_id = NEW.tenant_org_id;
    IF v_root_root IS NOT NULL OR v_root_par IS NOT NULL THEN
      RAISE EXCEPTION 'ORD_ROOT_NOT_ROOT: % is not a root order', v_expected USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;

COMMENT ON FUNCTION public.fn_ord_root_guard() IS
  'BEFORE INSERT OR UPDATE OF root_order_id, parent_order_id on org_orders_mst (trg_ord_root_guard). INSERT: root order -> root_order_id must be NULL; sub-order -> fills root_order_id = COALESCE(parent.root_order_id, parent.id) or rejects a different value, and the root must itself be a root. UPDATE: root_order_id is immutable (only the FK SET NULL path when the root row is gone may clear it); parent_order_id may become NULL or move inside the same family only. Errors: ORD_ROOT_MISMATCH, ORD_ROOT_NOT_ROOT, ORD_ROOT_IMMUTABLE, ORD_PARENT_NOT_FOUND. Tenant-filtered. Migration ord_root_order_id.';
REVOKE ALL ON FUNCTION public.fn_ord_root_guard() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_ord_root_guard ON public.org_orders_mst;
CREATE TRIGGER trg_ord_root_guard
  BEFORE INSERT OR UPDATE OF root_order_id, parent_order_id ON public.org_orders_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_ord_root_guard();
COMMENT ON TRIGGER trg_ord_root_guard ON public.org_orders_mst IS
  'Keeps root_order_id correct and immutable (A-28). See fn_ord_root_guard.';

-- ------------------------------------------------------------------
-- 4. fn_ord_next_sub_order_no: root from root_order_id, consistency check, numbering by root_order_id
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ord_next_sub_order_no(p_tenant UUID, p_parent_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  c_max_n     CONSTANT INT := 99999;
  v_p_parent  UUID;
  v_p_root    UUID;
  v_root      UUID;
  v_root_no   TEXT;
  v_r_parent  UUID;
  v_r_root    UUID;
  v_n         INT;
BEGIN
  IF p_tenant IS NULL THEN
    RAISE EXCEPTION 'DOC_SEQ_TENANT_REQUIRED: ORDER sub-order' USING ERRCODE = '22023';
  END IF;
  IF p_parent_order_id IS NULL THEN
    RAISE EXCEPTION 'ORD_PARENT_NOT_FOUND: parent order id is required' USING ERRCODE = '22023';
  END IF;
  IF public.fn_doc_seq_caller_role() = 'authenticated' AND p_tenant IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'DOC_SEQ_TENANT_MISMATCH' USING ERRCODE = '42501';
  END IF;

  SELECT o.parent_order_id, o.root_order_id INTO v_p_parent, v_p_root
    FROM public.org_orders_mst o
   WHERE o.id = p_parent_order_id AND o.tenant_org_id = p_tenant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORD_PARENT_NOT_FOUND: %', p_parent_order_id USING ERRCODE = 'P0002';
  END IF;
  -- A row with a parent always has a root (trg_ord_root_guard); a parent without a root here is broken data.
  IF v_p_parent IS NOT NULL AND v_p_root IS NULL THEN
    RAISE EXCEPTION 'ORD_ROOT_INCONSISTENT: order % has a parent but no root_order_id', p_parent_order_id
      USING ERRCODE = '22023';
  END IF;
  v_root := COALESCE(v_p_root, p_parent_order_id);

  -- Lock the root until COMMIT: concurrent splits of one family serialise here.
  SELECT o.order_no, o.parent_order_id, o.root_order_id INTO v_root_no, v_r_parent, v_r_root
    FROM public.org_orders_mst o
   WHERE o.id = v_root AND o.tenant_org_id = p_tenant
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORD_PARENT_NOT_FOUND: root % of %', v_root, p_parent_order_id USING ERRCODE = 'P0002';
  END IF;
  IF v_r_parent IS NOT NULL OR v_r_root IS NOT NULL THEN
    RAISE EXCEPTION 'ORD_ROOT_INCONSISTENT: root % of % is itself a sub-order', v_root, p_parent_order_id
      USING ERRCODE = '22023';
  END IF;

  -- Highest S<n> in the family (soft-deleted rows included: a number is never reused). Uses idx_ord_root_order.
  SELECT COALESCE(MAX(substr(c.order_no, length(v_root_no) + 3)::INT), 0) + 1
    INTO v_n
    FROM public.org_orders_mst c
   WHERE c.tenant_org_id = p_tenant
     AND c.root_order_id = v_root
     AND left(c.order_no, length(v_root_no) + 2) = v_root_no || '-S'
     AND substr(c.order_no, length(v_root_no) + 3) ~ '^[1-9][0-9]{0,4}$';

  IF v_n > c_max_n THEN
    RAISE EXCEPTION 'ORD_SUB_ORDER_LIMIT: % already has % sub-orders', v_root_no, c_max_n USING ERRCODE = '22023';
  END IF;
  RETURN v_root_no || '-S' || v_n;
END
$fn$;
COMMENT ON FUNCTION public.fn_ord_next_sub_order_no(UUID, UUID) IS
  'Next sub-order number <root order_no>-S<n> for a split of p_parent_order_id (A-19: numbered under the root, so splitting ORD-..-0007-S2 gives -S3). Root = COALESCE(parent.root_order_id, parent.id) (A-28, no chain walk); locks the root row FOR UPDATE until COMMIT and checks it is a real root; n = 1 + highest S<n> (1-5 digits) among rows WHERE root_order_id = root, soft-deleted included. Errors: DOC_SEQ_TENANT_REQUIRED, DOC_SEQ_TENANT_MISMATCH, ORD_PARENT_NOT_FOUND, ORD_ROOT_INCONSISTENT, ORD_SUB_ORDER_LIMIT. Call inside the split transaction just before the sub-order INSERT. Caller: web-admin lib/services/order-split. Migrations ord_order_no_engine, ord_root_order_id.';
REVOKE ALL ON FUNCTION public.fn_ord_next_sub_order_no(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_ord_next_sub_order_no(UUID, UUID) TO authenticated, service_role;

COMMIT;
