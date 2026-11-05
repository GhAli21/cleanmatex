--
-- Migration 0674_ord_order_no_engine.sql
-- Human-Friendly Codes, P2 (ORDER numbering cutover), migration 1 of 1.
--
-- Purpose: org_orders_mst.order_no moves from the 0012 MAX+1 generator to the shared engine (fn_doc_seq_next).
--   1. LOCK org_orders_mst (SHARE ROW EXCLUSIVE: reads go on, inserts/updates wait for this migration only).
--   2. Seed org_doc_seq_mst (doc type ORDER) from every existing tenant-day, so no past or current day can collide.
--   3. sys_doc_seq_type_cd row ORDER: DOMAIN -> GENERAL (same transaction as the seed).
--   4. generate_order_number(uuid): same signature, now a thin SECURITY DEFINER wrapper over fn_doc_seq_next.
--   5. Typed assign trigger trg_ord_no_assign (fills an empty order_no) + guard trg_ord_no_guard (order_no immutable).
--   6. Grandfathered helpers: get_order_number_prefix() IMMUTABLE -> STABLE (it reads CURRENT_DATE);
--      extract_order_sequence(text) parses with a regex instead of SUBSTRING FROM 14 (works for 5+ digit numbers).
--   7. fn_ord_next_sub_order_no(tenant, parent): sub-order numbers <root order_no>-S<n> (A-19, A-28).
--
-- Format (unchanged for users): ORD-<YYYYMMDD in the tenant time zone>-<seq, pad 4, grows past 9999>, daily reset.
--   Before: CURRENT_DATE of the DB session (UTC) and MAX(order_no)+1 with a retry loop (race-prone).
--   After:  tenant time zone day (hq_general_config fallback) and a row-locked counter (gap-free on rollback).
--   On the cutover day a tenant east of UTC can see ORD-<tomorrow-in-UTC terms> earlier than before; the seed covers
--   every existing day, so this never collides.
-- Sub-orders: <root order_no>-S<n>, n = 1 + the highest S<n> among all descendants of the root (soft-deleted rows
--   included, so a number is never reused). Splitting a sub-order numbers under the root (ORD-..-0007-S2 -> -S3).
--   Legacy timestamp suffixes (-S<6 digits>, never produced successfully: both legacy split paths failed on missing
--   columns) are ignored because n is read only from 1-5 digit suffixes without a leading zero.
--
-- Affected: org_orders_mst (2 triggers, no column change), org_doc_seq_mst (seed rows), sys_doc_seq_type_cd (ORDER row),
--           3 replaced functions (same signatures), 2 new functions. No Prisma model change; regenerate Supabase types
--           (new function fn_ord_next_sub_order_no).
-- Related:  0012 (generate_order_number, get_order_number_prefix, extract_order_sequence), 0667 doc_seq_type_config,
--           0669 doc_seq_counters, 0670 doc_seq_engine_fns, 0671 doc_seq_consistency.
-- Plan:     docs/features/Human_Friendly_Codes/IMPLEMENTATION_PLAN_Human_Friendly_Codes.md section 5.8; decisions A-19, A-28.
-- APPLY ORDER: 1 of 1 in P2. Requires 0667-0671 (P1). Deploy the web-admin P2 code with or after this migration (the
--              old code keeps working: it calls generate_order_number, which keeps its signature).
--              Pre-checks: DEV_GUIDE_DOC_SEQ_ENGINE.md section 15 (P2 pre-apply checks).
-- ROLLBACK PLAN (forward-only repo; write a new migration). Data is untouched, so it is safe at any time:
--   DROP TRIGGER trg_ord_no_assign ON public.org_orders_mst; DROP TRIGGER trg_ord_no_guard ON public.org_orders_mst;
--   DROP FUNCTION public.fn_ord_no_assign(); DROP FUNCTION public.fn_ord_next_sub_order_no(uuid, uuid);
--   Re-create the 0012 bodies of generate_order_number(uuid) (MAX+1 + retry loop, GRANT EXECUTE TO authenticated)
--   and extract_order_sequence(text) (sql IMMUTABLE, CAST(SUBSTRING(p_order_no FROM 14) AS INTEGER));
--   ALTER FUNCTION public.get_order_number_prefix() IMMUTABLE;
--   UPDATE public.sys_doc_seq_type_cd SET manage_by_level = 'DOMAIN', managed_by_object = 'public.generate_order_number(uuid)'
--     WHERE doc_type_code = 'ORDER';
--   DELETE FROM public.org_doc_seq_mst WHERE doc_type_code = 'ORDER';
--   (Rolling back while numbers with 5+ digit sequences exist breaks the 0012 SUBSTRING parse; check first.)
--
BEGIN;
SET LOCAL lock_timeout = '10s';

-- 1. Lock: no order insert or order_no change can slip between the seed and the trigger -------------------------
LOCK TABLE public.org_orders_mst IN SHARE ROW EXCLUSIVE MODE;

-- 2. Seed the ORDER counters from all existing data (every tenant-day) ----------------------------------------------
-- Only canonical main numbers (ORD-YYYYMMDD-<4+ digits>) count; sub-orders (-S<n>) and odd legacy values are skipped.
INSERT INTO public.org_doc_seq_mst (tenant_org_id, doc_type_code, period_key, last_value, created_by, created_info)
SELECT o.tenant_org_id, 'ORDER', split_part(o.order_no, '-', 2), MAX(split_part(o.order_no, '-', 3)::BIGINT),
       'migration', 'ord_order_no_engine seed'
  FROM public.org_orders_mst o
 WHERE o.order_no ~ '^ORD-[0-9]{8}-[0-9]{4,18}$'
 GROUP BY o.tenant_org_id, split_part(o.order_no, '-', 2)
ON CONFLICT (tenant_org_id, doc_type_code, period_key)
DO UPDATE SET last_value = GREATEST(public.org_doc_seq_mst.last_value, EXCLUDED.last_value),
              updated_by = 'migration', updated_info = 'ord_order_no_engine seed';

-- 3. ORDER config row: DOMAIN -> GENERAL ---------------------------------------------------------------------------
DO $chk$
DECLARE v_rows INT;
BEGIN
  UPDATE public.sys_doc_seq_type_cd
     SET manage_by_level = 'GENERAL',
         managed_by_object = 'public.fn_ord_no_assign() via trg_ord_no_assign; public.generate_order_number(uuid); public.fn_ord_next_sub_order_no(uuid,uuid)',
         implement_description =
           'Engine-managed since P2 (migration ord_order_no_engine): fn_doc_seq_next(tenant, ''ORDER'') returns '
           || 'ORD-<YYYYMMDD in the tenant time zone>-<seq pad 4, grows past 9999>, daily reset, row-locked counter in '
           || 'org_doc_seq_mst (seeded from all existing orders at cutover). Paths: (a) web-admin order create calls '
           || 'generate_order_number(tenant) (wrapper over fn_doc_seq_next) inside the create transaction just before '
           || 'the header INSERT (lib/services/order-numbering); (b) trigger trg_ord_no_assign fills order_no when an '
           || 'INSERT leaves it empty; (c) sub-orders: fn_ord_next_sub_order_no(tenant, parent) returns '
           || '<root order_no>-S<n> under a root-row lock (split service lib/services/order-split.service.ts). trg_ord_no_guard '
           || 'keeps order_no immutable. Check: SELECT order_no FROM org_orders_mst WHERE tenant_org_id = $1 ORDER BY '
           || 'created_at DESC LIMIT 5; counters: SELECT * FROM org_doc_seq_mst WHERE tenant_org_id = $1 AND '
           || 'doc_type_code = ''ORDER'' ORDER BY period_key DESC LIMIT 5; Reserved type prefix ORD (scan payload '
           || 'CMX1:ORD:<code>).',
         updated_by = 'migration',
         updated_info = 'ord_order_no_engine'
   WHERE doc_type_code = 'ORDER'
     AND target_table = 'org_orders_mst' AND target_column = 'order_no';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'ORD_ENGINE_CFG_MISSING: sys_doc_seq_type_cd row ORDER for org_orders_mst.order_no not found';
  END IF;
END $chk$;

-- 4. generate_order_number(uuid): engine wrapper (same signature and return type as 0012) --------------------------
CREATE OR REPLACE FUNCTION public.generate_order_number(p_tenant_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  -- Tenant and caller checks happen inside fn_doc_seq_next (DOC_SEQ_TENANT_REQUIRED / DOC_SEQ_TENANT_MISMATCH).
  RETURN public.fn_doc_seq_next(p_tenant_org_id, 'ORDER', now());
END
$fn$;
COMMENT ON FUNCTION public.generate_order_number(UUID) IS
  'Next order number for a tenant: ORD-<YYYYMMDD tenant time zone>-<seq pad 4, grows>. Thin wrapper over fn_doc_seq_next(tenant, ''ORDER'') since migration ord_order_no_engine (was MAX+1 in 0012). The counter row stays locked until COMMIT: call it inside the transaction that inserts the order, as late as possible. Caller: web-admin lib/services/order-numbering (Prisma, same transaction as the INSERT). A JWT caller may only number its own tenant.';
REVOKE ALL ON FUNCTION public.generate_order_number(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_order_number(UUID) TO authenticated, service_role;

-- 5. Typed assign trigger + guard (DEV_GUIDE section 12) ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ord_no_assign()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  IF NEW.order_no IS NULL OR btrim(NEW.order_no) = '' THEN
    NEW.order_no := public.fn_doc_seq_next(NEW.tenant_org_id, 'ORDER', now());
  END IF;
  RETURN NEW;
END
$fn$;
COMMENT ON FUNCTION public.fn_ord_no_assign() IS
  'BEFORE INSERT trigger function on org_orders_mst: fills an empty order_no from fn_doc_seq_next(tenant, ''ORDER''). A supplied order_no (app create path, sub-orders) is kept. Typed (no TG_ARGV / jsonb) because orders are a busy table. Migration ord_order_no_engine.';
REVOKE ALL ON FUNCTION public.fn_ord_no_assign() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ord_no_assign ON public.org_orders_mst;
CREATE TRIGGER trg_ord_no_assign
  BEFORE INSERT ON public.org_orders_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_ord_no_assign();
COMMENT ON TRIGGER trg_ord_no_assign ON public.org_orders_mst IS
  'Fills an empty order_no from the ORDER counter (fn_ord_no_assign). Migration ord_order_no_engine.';

DROP TRIGGER IF EXISTS trg_ord_no_guard ON public.org_orders_mst;
CREATE TRIGGER trg_ord_no_guard
  BEFORE UPDATE OF order_no ON public.org_orders_mst
  FOR EACH ROW WHEN (OLD.order_no IS DISTINCT FROM NEW.order_no)
  EXECUTE FUNCTION public.fn_doc_seq_guard_immutable('order_no');
COMMENT ON TRIGGER trg_ord_no_guard ON public.org_orders_mst IS
  'order_no is immutable once set (fn_doc_seq_guard_immutable). The WHEN clause skips updates that do not change it. Migration ord_order_no_engine.';

COMMENT ON COLUMN public.org_orders_mst.order_no IS
  'Human order number, unique per tenant. Main orders: ORD-<YYYYMMDD tenant day>-<seq pad 4, grows> from the ORDER counter (fn_doc_seq_next); sub-orders: <root order_no>-S<n> (fn_ord_next_sub_order_no). Immutable once set (trg_ord_no_guard). Treat as an opaque string: do not parse fixed positions.';

-- 6. Grandfathered helpers --------------------------------------------------------------------------------------
-- get_order_number_prefix() reads CURRENT_DATE, so it was never IMMUTABLE. No DB or app caller (P0); A-06 drops it later.
ALTER FUNCTION public.get_order_number_prefix() STABLE;
COMMENT ON FUNCTION public.get_order_number_prefix() IS
  'Deprecated (A-06): ORD-<CURRENT_DATE of the DB session>-. Not tenant time zone aware and unused; do not call. Use the ORDER row of sys_doc_seq_type_cd / fn_doc_seq_format instead.';

CREATE OR REPLACE FUNCTION public.extract_order_sequence(p_order_no TEXT)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $fn$
  SELECT substring(p_order_no FROM '^ORD-[0-9]{8}-([0-9]{1,9})(?:-S[0-9]+)?$')::INTEGER
$fn$;
COMMENT ON FUNCTION public.extract_order_sequence(TEXT) IS
  'Sequence part of an order number (ORD-YYYYMMDD-<seq>[-S<n>]) or NULL when the value is not in that shape. Regex since migration ord_order_no_engine (0012 used SUBSTRING FROM 14, wrong past 4 digits or on sub-orders).';

-- 7. Sub-order numbers -------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ord_next_sub_order_no(p_tenant UUID, p_parent_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  c_max_depth CONSTANT INT := 10;
  c_max_n     CONSTANT INT := 99999;
  v_id      UUID := p_parent_order_id;
  v_parent  UUID;
  v_root_no TEXT;
  v_depth   INT := 0;
  v_n       INT;
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

  -- Walk up to the root (bounded), then lock the root row. Re-check after the lock: if the row gained a parent
  -- meanwhile, keep walking. Concurrent splits of one family serialise on the root row until COMMIT.
  LOOP
    SELECT o.parent_order_id INTO v_parent
      FROM public.org_orders_mst o
     WHERE o.id = v_id AND o.tenant_org_id = p_tenant;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ORD_PARENT_NOT_FOUND: %', v_id USING ERRCODE = 'P0002';
    END IF;
    IF v_parent IS NULL THEN
      SELECT o.order_no, o.parent_order_id INTO v_root_no, v_parent
        FROM public.org_orders_mst o
       WHERE o.id = v_id AND o.tenant_org_id = p_tenant
         FOR UPDATE;
      EXIT WHEN v_parent IS NULL;
    END IF;
    v_depth := v_depth + 1;
    IF v_depth > c_max_depth THEN
      RAISE EXCEPTION 'ORD_SPLIT_DEPTH_EXCEEDED: more than % levels above %', c_max_depth, p_parent_order_id
        USING ERRCODE = '22023';
    END IF;
    v_id := v_parent;
  END LOOP;

  -- Highest S<n> among all descendants of the root (soft-deleted rows included: a number is never reused).
  WITH RECURSIVE d AS (
    SELECT c.id, c.order_no, 1 AS lvl
      FROM public.org_orders_mst c
     WHERE c.tenant_org_id = p_tenant AND c.parent_order_id = v_id
    UNION ALL
    SELECT c.id, c.order_no, d.lvl + 1
      FROM public.org_orders_mst c
      JOIN d ON c.parent_order_id = d.id
     WHERE c.tenant_org_id = p_tenant AND d.lvl < c_max_depth
  )
  SELECT COALESCE(MAX(substr(d.order_no, length(v_root_no) + 3)::INT), 0) + 1
    INTO v_n
    FROM d
   WHERE left(d.order_no, length(v_root_no) + 2) = v_root_no || '-S'
     AND substr(d.order_no, length(v_root_no) + 3) ~ '^[1-9][0-9]{0,4}$';

  IF v_n > c_max_n THEN
    RAISE EXCEPTION 'ORD_SUB_ORDER_LIMIT: % already has % sub-orders', v_root_no, c_max_n USING ERRCODE = '22023';
  END IF;
  RETURN v_root_no || '-S' || v_n;
END
$fn$;
COMMENT ON FUNCTION public.fn_ord_next_sub_order_no(UUID, UUID) IS
  'Next sub-order number <root order_no>-S<n> for a split of p_parent_order_id (A-19: numbered under the root, so splitting ORD-..-0007-S2 gives -S3). Walks parent_order_id to the root (max depth 10), locks the root row FOR UPDATE until COMMIT, n = 1 + highest S<n> (1-5 digits) among all descendants incl. soft-deleted. Errors: DOC_SEQ_TENANT_REQUIRED, DOC_SEQ_TENANT_MISMATCH, ORD_PARENT_NOT_FOUND, ORD_SPLIT_DEPTH_EXCEEDED, ORD_SUB_ORDER_LIMIT. Call inside the split transaction just before the sub-order INSERT. Caller: web-admin lib/services/order-split. Migration ord_order_no_engine.';
REVOKE ALL ON FUNCTION public.fn_ord_next_sub_order_no(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_ord_next_sub_order_no(UUID, UUID) TO authenticated, service_role;

COMMIT;
