--
-- Migration 0682_ord_item_srno_barcode.sql
-- Human-Friendly Codes, P3 (order item and piece codes), migration 1 of 2.
--
-- Purpose: every order line gets a unique, human-readable serial <order_no>-<n> and the line barcode holds that
--   plain value (no more SVG data URLs in the database).
--   1. LOCK org_order_items_dtl (SHARE ROW EXCLUSIVE: reads go on, line inserts/updates wait for this migration).
--   2. Report counts (NOTICE): empty, non-canonical and duplicate serials, data: URL barcodes.
--   3. fn_next_order_item_srno(uuid, uuid): same signature, new body. Before (0015) its regex was broken and every
--      call returned '001'. Now: <order_no>-<1 + highest n of the order>, serialised per order by a transaction
--      advisory lock (same key as web-admin lib/services/order-item-code.service.ts). Removed lines count, so a
--      number is never reused. trg_set_order_item_srno() also treats a blank value as empty.
--   4. Backfill, with every user trigger on the table switched off for the backfill only (decision A-34):
--      a line keeps its serial when it is canonical (<order_no>-<1-9 digits, no leading zero>) and the first
--      (created_at, id) holder of it; every other line (NULL, blank, '001'-style, duplicate) gets the next free n of
--      its order in (created_at, id) order. The old value is kept in metadata.hfc_p3_old_srno.
--      Line barcodes that are data: URLs become the serial (old value is NOT kept: it is a picture of the code).
--      Why triggers off: after_upd_items_recalc would recompute and rewrite order totals (a silent money change),
--      oc_item_removed_guard would refuse removed (history) lines, and an updated_at trigger would make every line
--      look edited. Only code columns and metadata change; the same trigger set is switched back on at the end.
--   5. uq_ord_item_srno UNIQUE (tenant_org_id, order_item_srno); ck_ord_item_srno_set (not blank);
--      ck_ord_item_barcode_val (no data: URL). A CHECK instead of NOT NULL keeps the Prisma create input optional
--      (the BEFORE INSERT trigger fills it); vw_doc_seq_consistency therefore shows NOT_NULL_MISSING as WARN (expected).
--   6. trg_ord_item_srno_guard: a set serial never changes (fn_doc_seq_guard_immutable).
--   7. sys_doc_seq_type_cd ORDER_ITEM: implement_description refreshed (still DOMAIN, same managed_by_object).
--   8. COMMENT refresh for 0678 objects (COMMENT ON only): tenants also start in creating when created by HQ (P2.2),
--      and the hard-delete guard is the only place that removes counters (A-33).
--
-- Affected: org_order_items_dtl (data in order_item_srno, barcode, metadata; 1 unique index, 2 checks, 1 trigger),
--           2 replaced functions (same signatures), sys_doc_seq_type_cd (1 row), comments on 0678 objects.
--           No column type change: regenerate Supabase types and Prisma only for the new constraint/index names.
-- Related:  0001 (org_order_items_dtl), 0015 (fn_next_order_item_srno, trg_set_order_item_srno, recalc triggers),
--           0548 (oc_item_removed_guard), 0667 (ORDER_ITEM row), 0670 (fn_doc_seq_guard_immutable), 0674, 0678.
-- Plan:     docs/features/Human_Friendly_Codes/IMPLEMENTATION_PLAN_Human_Friendly_Codes.md section 5.9; decisions A-33, A-34.
-- APPLY ORDER: 1 of 2 in P3. Deploy the web-admin P3 code FIRST (it writes <order_no>-<n> and plain barcodes and
--              works on the old schema), then this migration, then 0683_ord_piece_code_human.
--              Pre-checks: DEV_GUIDE_DOC_SEQ_ENGINE.md section 17 (P3 pre-apply checks).
-- ROLLBACK PLAN (forward-only repo; write a new migration). Renumbered serials stay (old values are in metadata):
--   DROP TRIGGER trg_ord_item_srno_guard ON public.org_order_items_dtl;
--   DROP INDEX public.uq_ord_item_srno;
--   ALTER TABLE public.org_order_items_dtl DROP CONSTRAINT ck_ord_item_srno_set, DROP CONSTRAINT ck_ord_item_barcode_val;
--   Re-create the 0015 bodies of fn_next_order_item_srno(uuid,uuid) and trg_set_order_item_srno().
--
BEGIN;
SET LOCAL lock_timeout = '10s';

-- 1. Lock ---------------------------------------------------------------------------------------------------------
LOCK TABLE public.org_order_items_dtl IN SHARE ROW EXCLUSIVE MODE;

-- 2. Report -------------------------------------------------------------------------------------------------------
DO $rep$
DECLARE v_total BIGINT; v_empty BIGINT; v_noncanon BIGINT; v_dup BIGINT; v_data BIGINT; v_removed BIGINT;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE i.order_item_srno IS NULL OR btrim(i.order_item_srno) = ''),
         count(*) FILTER (WHERE i.order_item_srno IS NOT NULL AND btrim(i.order_item_srno) <> ''
                            AND NOT (left(i.order_item_srno, length(o.order_no) + 1) = o.order_no || '-'
                                     AND substring(i.order_item_srno FROM length(o.order_no) + 2) ~ '^[1-9][0-9]{0,8}$')),
         count(*) FILTER (WHERE i.barcode LIKE 'data:%'),
         count(*) FILTER (WHERE i.deleted_order_change_id IS NOT NULL)
    INTO v_total, v_empty, v_noncanon, v_data, v_removed
    FROM public.org_order_items_dtl i
    JOIN public.org_orders_mst o ON o.id = i.order_id AND o.tenant_org_id = i.tenant_org_id;
  SELECT COALESCE(sum(c - 1), 0) INTO v_dup
    FROM (SELECT count(*) AS c FROM public.org_order_items_dtl
           WHERE order_item_srno IS NOT NULL AND btrim(order_item_srno) <> ''
           GROUP BY tenant_org_id, order_item_srno HAVING count(*) > 1) d;
  RAISE NOTICE 'ord_item_srno_barcode: lines %, empty serial %, non-canonical %, extra duplicates %, data: barcodes %, removed (history) lines %',
    v_total, v_empty, v_noncanon, v_dup, v_data, v_removed;
  IF EXISTS (SELECT 1 FROM public.org_order_items_dtl i
              WHERE NOT EXISTS (SELECT 1 FROM public.org_orders_mst o WHERE o.id = i.order_id AND o.tenant_org_id = i.tenant_org_id)) THEN
    RAISE EXCEPTION 'ORD_ITEM_SRNO_PRECHECK: lines whose order is missing or in another tenant exist; fix them first (DEV_GUIDE section 17, repair R1)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.org_orders_mst WHERE order_no IS NULL OR btrim(order_no) = '') THEN
    RAISE EXCEPTION 'ORD_ITEM_SRNO_PRECHECK: orders with an empty order_no exist; fix them first (DEV_GUIDE section 17, repair R2)';
  END IF;
END $rep$;

-- 3. Serial generator ------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_next_order_item_srno(p_tenant uuid, p_order uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_order_no TEXT;
  v_max      BIGINT;
BEGIN
  SELECT o.order_no INTO v_order_no
    FROM public.org_orders_mst o
   WHERE o.tenant_org_id = p_tenant AND o.id = p_order;
  IF v_order_no IS NULL OR btrim(v_order_no) = '' THEN
    RAISE EXCEPTION 'ORD_ITEM_ORDER_NOT_FOUND: order % not found for tenant % (or it has no order_no)', p_order, p_tenant
      USING ERRCODE = 'P0002';
  END IF;
  -- One writer per order at a time (same key as web-admin order-item-code.service.ts); released at commit/rollback.
  PERFORM pg_advisory_xact_lock(hashtextextended('ord_item_srno:' || p_order::text, 0));
  SELECT COALESCE(MAX(substring(i.order_item_srno FROM length(v_order_no) + 2)::bigint), 0) INTO v_max
    FROM public.org_order_items_dtl i
   WHERE i.tenant_org_id = p_tenant AND i.order_id = p_order
     AND left(i.order_item_srno, length(v_order_no) + 1) = v_order_no || '-'
     AND substring(i.order_item_srno FROM length(v_order_no) + 2) ~ '^[1-9][0-9]{0,8}$';
  RETURN v_order_no || '-' || (v_max + 1)::text;
END $$;
COMMENT ON FUNCTION public.fn_next_order_item_srno(uuid, uuid) IS
  'Next order line serial <order_no>-<n>, n = 1 + highest canonical n of the order (removed lines included, never reused). Serialised per order by pg_advisory_xact_lock(hashtextextended(''ord_item_srno:''||order_id,0)), the same key web-admin uses. Raises ORD_ITEM_ORDER_NOT_FOUND (P0002). SECURITY INVOKER (RLS applies). Migration ord_item_srno_barcode (P3), replaces the 0015 body that always returned 001.';

CREATE OR REPLACE FUNCTION public.trg_set_order_item_srno()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.order_item_srno IS NULL OR btrim(NEW.order_item_srno) = '' THEN
    NEW.order_item_srno := public.fn_next_order_item_srno(NEW.tenant_org_id, NEW.order_id);
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.trg_set_order_item_srno() IS
  'BEFORE INSERT on org_order_items_dtl (before_ins_set_order_item_srno): fills an empty or blank order_item_srno with fn_next_order_item_srno. A supplied value is kept (web-admin supplies <order_no>-<n>); uq_ord_item_srno rejects a duplicate. Migration ord_item_srno_barcode (P3).';

-- 4. Backfill (A-34) -------------------------------------------------------------------------------------------------
DO $bf$
DECLARE
  r RECORD;
  v_name TEXT;
  v_trg TEXT[] := '{}';
  v_srno BIGINT; v_bar BIGINT;
BEGIN
  FOR r IN SELECT t.tgname FROM pg_trigger t
            WHERE t.tgrelid = 'public.org_order_items_dtl'::regclass AND NOT t.tgisinternal AND t.tgenabled <> 'D'
            ORDER BY t.tgname LOOP
    EXECUTE format('ALTER TABLE public.org_order_items_dtl DISABLE TRIGGER %I', r.tgname);
    v_trg := v_trg || r.tgname::text;
  END LOOP;
  RAISE NOTICE 'ord_item_srno_barcode: triggers switched off for the backfill: %', v_trg;

  WITH base AS (
    SELECT i.id, i.order_id, i.tenant_org_id, i.created_at, i.order_item_srno AS old_srno, o.order_no,
           CASE WHEN left(i.order_item_srno, length(o.order_no) + 1) = o.order_no || '-'
                 AND substring(i.order_item_srno FROM length(o.order_no) + 2) ~ '^[1-9][0-9]{0,8}$'
                THEN substring(i.order_item_srno FROM length(o.order_no) + 2)::bigint END AS n
      FROM public.org_order_items_dtl i
      JOIN public.org_orders_mst o ON o.id = i.order_id AND o.tenant_org_id = i.tenant_org_id
  ), ranked AS (
    SELECT b.*, CASE WHEN b.n IS NULL THEN 2
                     ELSE row_number() OVER (PARTITION BY b.tenant_org_id, b.order_id, b.n ORDER BY b.created_at NULLS LAST, b.id) END AS rk
      FROM base b
  ), kept_max AS (
    SELECT order_id, COALESCE(MAX(n) FILTER (WHERE rk = 1), 0) AS mx FROM ranked GROUP BY order_id
  ), todo AS (
    SELECT q.id, q.old_srno, q.order_no,
           k.mx + row_number() OVER (PARTITION BY q.order_id ORDER BY q.created_at NULLS LAST, q.id) AS new_n
      FROM ranked q JOIN kept_max k ON k.order_id = q.order_id
     WHERE q.rk > 1
  )
  UPDATE public.org_order_items_dtl i
     SET order_item_srno = t.order_no || '-' || t.new_n::text,
         metadata = COALESCE(i.metadata, '{}'::jsonb) || jsonb_build_object('hfc_p3_old_srno', t.old_srno)
    FROM todo t
   WHERE i.id = t.id;
  GET DIAGNOSTICS v_srno = ROW_COUNT;

  UPDATE public.org_order_items_dtl
     SET barcode = order_item_srno
   WHERE barcode LIKE 'data:%';
  GET DIAGNOSTICS v_bar = ROW_COUNT;

  FOREACH v_name IN ARRAY v_trg LOOP
    EXECUTE format('ALTER TABLE public.org_order_items_dtl ENABLE TRIGGER %I', v_name);
  END LOOP;
  RAISE NOTICE 'ord_item_srno_barcode: serials renumbered %, data: barcodes replaced %; triggers switched back on', v_srno, v_bar;
END $bf$;

-- 5. Constraints -----------------------------------------------------------------------------------------------------
ALTER TABLE public.org_order_items_dtl
  ADD CONSTRAINT ck_ord_item_srno_set CHECK (order_item_srno IS NOT NULL AND btrim(order_item_srno) <> ''),
  ADD CONSTRAINT ck_ord_item_barcode_val CHECK (barcode IS NULL OR barcode NOT LIKE 'data:%');
COMMENT ON CONSTRAINT ck_ord_item_srno_set ON public.org_order_items_dtl IS
  'Every line has a serial (filled by before_ins_set_order_item_srno when the insert leaves it empty). CHECK instead of NOT NULL so the Prisma create input stays optional. Migration ord_item_srno_barcode (P3).';
COMMENT ON CONSTRAINT ck_ord_item_barcode_val ON public.org_order_items_dtl IS
  'barcode stores the plain value to encode (the serial), never an image data: URL; labels render the image at print time. Migration ord_item_srno_barcode (P3).';

CREATE UNIQUE INDEX uq_ord_item_srno ON public.org_order_items_dtl (tenant_org_id, order_item_srno);
COMMENT ON INDEX public.uq_ord_item_srno IS
  'One line per serial per tenant (serial = <order_no>-<n>, unique by construction when order_no is unique). Migration ord_item_srno_barcode (P3).';

COMMENT ON COLUMN public.org_order_items_dtl.order_item_srno IS
  'Human-readable line serial <order_no>-<n> (n from 1, never reused within the order, removed lines included). Set at insert, immutable afterwards (trg_ord_item_srno_guard). Unique per tenant (uq_ord_item_srno). Doc type ORDER_ITEM.';
COMMENT ON COLUMN public.org_order_items_dtl.barcode IS
  'Plain value printed as the line barcode (today the serial). Never an image data: URL (ck_ord_item_barcode_val).';

-- 6. Guard -----------------------------------------------------------------------------------------------------------
CREATE TRIGGER trg_ord_item_srno_guard
  BEFORE UPDATE OF order_item_srno ON public.org_order_items_dtl
  FOR EACH ROW
  WHEN (OLD.order_item_srno IS DISTINCT FROM NEW.order_item_srno)
  EXECUTE FUNCTION public.fn_doc_seq_guard_immutable('order_item_srno');
COMMENT ON TRIGGER trg_ord_item_srno_guard ON public.org_order_items_dtl IS
  'A set order_item_srno never changes (DOC_SEQ_CODE_IMMUTABLE). See fn_doc_seq_guard_immutable. Migration ord_item_srno_barcode (P3).';

-- 7. Registry --------------------------------------------------------------------------------------------------------
DO $reg$
DECLARE v_rows INT;
BEGIN
  UPDATE public.sys_doc_seq_type_cd
     SET managed_by_object = 'public.fn_next_order_item_srno(uuid,uuid)',
         implement_description =
           'Child code since P3 (migration ord_item_srno_barcode): <order_no>-<n>, no printed prefix (ITM reserved for '
           || 'scan payloads). n = 1 + highest n of the order, removed lines included (never reused). Paths: (a) '
           || 'web-admin supplies it inside the write transaction (lib/services/order-item-code.service.ts: advisory '
           || 'lock per order + MAX read; callers order-service.ts, lib/db/orders.ts, order-change-structural-write.ts, '
           || 'order-split.service.ts); (b) trigger before_ins_set_order_item_srno -> fn_next_order_item_srno(tenant, '
           || 'order) fills an empty value under the same lock. uq_ord_item_srno, ck_ord_item_srno_set, '
           || 'trg_ord_item_srno_guard (immutable). barcode holds the same plain value. Check: SELECT order_item_srno, '
           || 'barcode FROM org_order_items_dtl WHERE tenant_org_id = $1 AND order_id = $2 ORDER BY created_at;',
         updated_by = 'migration', updated_info = 'ord_item_srno_barcode'
   WHERE doc_type_code = 'ORDER_ITEM';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'ord_item_srno_barcode: sys_doc_seq_type_cd row ORDER_ITEM not found (apply 0667 first)';
  END IF;
END $reg$;

-- 8. 0678 comment refresh (COMMENT ON only; 0678 itself is never edited) --------------------------------------------
COMMENT ON COLUMN public.org_tenants_mst.status IS
  'Tenant status: creating (being provisioned by self-signup or by the HQ create wizard; set only on INSERT, the only state in which the row may be hard-deleted), trial, active, suspended, cancelled, expired, archived. Hard delete is guarded by trg_tenant_hard_delete_guard; use suspend/archive for live tenants.';
COMMENT ON FUNCTION public.fn_tenant_hard_delete_guard() IS
  'BEFORE DELETE on org_tenants_mst (trg_tenant_hard_delete_guard). Fails closed: a row is deleted only when status = creating (NULL or any other status raises TENANT_HARD_DELETE_BLOCKED, SQLSTATE 55000). When allowed, deletes the tenant org_doc_seq_mst counters first (FK RESTRICT), in the same statement: this is the only place counters are removed (A-33; callers such as the HQ create rollback and the self-signup cleanup never delete counters themselves). Migration tenant_hard_delete_guard (A-31), comment refreshed by ord_item_srno_barcode (P3).';
COMMENT ON TRIGGER trg_tenant_hard_delete_guard ON public.org_tenants_mst IS
  'Tenant hard delete only in status creating (self-signup or HQ create rollback); removes counters first. See fn_tenant_hard_delete_guard.';

COMMIT;
