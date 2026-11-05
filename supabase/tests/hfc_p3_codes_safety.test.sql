-- ==================================================================
-- hfc_p3_codes_safety.test.sql
-- Purpose: user-run safety test for Human-Friendly Codes P3 (order line serials and piece codes) on a real database.
--   Part A lists every trigger on the line and piece tables and checks the P3 triggers, indexes and checks exist.
--   Part B checks the data: every line has a serial, no data: URL barcodes, every piece code = line serial-piece_seq,
--          no ERROR rows for ORDER_ITEM / ORDER_PIECE in vw_doc_seq_consistency.
--   Part C runs the write paths web-admin uses: new order, lines with and without a serial (trigger), duplicate and
--          immutable serial, plain barcode rule, pieces (code built by the trigger), external tag uniqueness and format,
--          a split-style sub-order line.
-- Dependencies: migrations 0674, 0677, 0682_ord_item_srno_barcode and 0683_ord_piece_code_human applied.
-- Run with psql as the postgres role (LOCAL first; on remote it is also safe, see below):
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/hfc_p3_codes_safety.test.sql
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -v tenant_id=<uuid> -f supabase/tests/hfc_p3_codes_safety.test.sql
-- Without tenant_id it picks the newest root order of an active tenant (not creating) that has at least one line;
-- that order and line are used only as a column template (customer, branch, workflow ids), never changed.
-- SAFE: everything runs in ONE transaction that is ROLLED BACK at the end: no order, line, piece, tag or number is
-- kept (the order counter is row-locked and rolls back too, so no order number is skipped).
-- Output: "PASS ..." notices, or the run stops at the first "FAIL ...".
-- Note: Part C holds the order counter row of the chosen tenant-day for a few ms: run it at a quiet moment on a busy
-- remote database.
-- ==================================================================

\if :{?tenant_id}
\else
\set tenant_id ''
\endif

BEGIN;
SET LOCAL lock_timeout = '5s';
SELECT set_config('zz.tenant', :'tenant_id', true) AS tenant_param;

-- ------------------------------------------------------------------
-- Part A: triggers, indexes, checks
-- ------------------------------------------------------------------
SELECT c.relname AS table_name, t.tgname AS trigger_name,
       CASE WHEN t.tgenabled = 'D' THEN 'DISABLED' ELSE 'enabled' END AS state,
       p.proname AS function_name
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_proc p ON p.oid = t.tgfoid
 WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal
   AND c.relname IN ('org_order_items_dtl', 'org_order_item_pieces_dtl', 'org_orders_mst')
 ORDER BY c.relname, t.tgname;

DO $$
DECLARE v_missing TEXT;
BEGIN
  SELECT string_agg(x, ', ') INTO v_missing
    FROM unnest(ARRAY['org_order_items_dtl.before_ins_set_order_item_srno', 'org_order_items_dtl.trg_ord_item_srno_guard',
                      'org_order_item_pieces_dtl.trg_ord_piece_code_set', 'org_order_item_pieces_dtl.trg_ord_piece_code_guard',
                      'org_order_item_pieces_dtl.trg_ord_piece_tag_rules', 'org_orders_mst.trg_ord_piece_tag_release']) x
   WHERE NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
                      WHERE c.relnamespace = 'public'::regnamespace AND c.relname || '.' || t.tgname = x AND t.tgenabled <> 'D');
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'FAIL A1: missing or disabled triggers: %', v_missing; END IF;
  RAISE NOTICE 'PASS A1: P3 triggers present and enabled (see the listing above for all triggers)';

  SELECT string_agg(x, ', ') INTO v_missing
    FROM unnest(ARRAY['uq_ord_item_srno', 'uq_ord_piece_code', 'uq_ord_piece_barcode', 'idx_ord_piece_tenant_barcode']) x
   WHERE to_regclass('public.' || x) IS NULL;
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'FAIL A2: missing indexes: %', v_missing; END IF;
  SELECT string_agg(x, ', ') INTO v_missing
    FROM unnest(ARRAY['ck_ord_item_srno_set', 'ck_ord_item_barcode_val', 'ck_ord_piece_code_set', 'ck_ord_piece_barcode_fmt', 'ck_ord_piece_barcode_not_code']) x
   WHERE NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = x AND convalidated);
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'FAIL A2: missing checks: %', v_missing; END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.org_order_item_pieces_dtl'::regclass
                AND attname = 'piece_code' AND attgenerated <> '') THEN
    RAISE EXCEPTION 'FAIL A2: piece_code is still a generated column';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.org_order_item_pieces_dtl'::regclass
                    AND attname = 'tag_released_at' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'FAIL A2: column tag_released_at missing';
  END IF;
  IF pg_get_indexdef('public.uq_ord_piece_barcode'::regclass) NOT LIKE '%tag_released_at IS NULL%' THEN
    RAISE EXCEPTION 'FAIL A2: uq_ord_piece_barcode does not exclude released tags';
  END IF;
  RAISE NOTICE 'PASS A2: unique indexes, checks, tag_released_at present; piece_code is a normal column';
END $$;

-- ------------------------------------------------------------------
-- Part B: data health (all tenants; counts only)
-- ------------------------------------------------------------------
DO $$
DECLARE v_n BIGINT; v_nc BIGINT;
BEGIN
  SELECT count(*) INTO v_n FROM public.org_order_items_dtl WHERE order_item_srno IS NULL OR btrim(order_item_srno) = '' OR barcode LIKE 'data:%';
  IF v_n > 0 THEN RAISE EXCEPTION 'FAIL B1: % line(s) without serial or with a data: barcode', v_n; END IF;
  SELECT count(*) INTO v_nc
    FROM public.org_order_items_dtl i JOIN public.org_orders_mst o ON o.id = i.order_id AND o.tenant_org_id = i.tenant_org_id
   WHERE NOT (left(i.order_item_srno, length(o.order_no) + 1) = o.order_no || '-'
              AND substring(i.order_item_srno FROM length(o.order_no) + 2) ~ '^[1-9][0-9]{0,8}$');
  RAISE NOTICE 'PASS B1: every line has a serial and a plain barcode (% line(s) not in <order_no>-<n> form; expected 0 after 0682)', v_nc;

  SELECT count(*) INTO v_n
    FROM public.org_order_item_pieces_dtl p
    JOIN public.org_order_items_dtl i ON i.id = p.order_item_id AND i.tenant_org_id = p.tenant_org_id
   WHERE p.piece_code IS DISTINCT FROM i.order_item_srno || '-' || p.piece_seq::text;
  IF v_n > 0 THEN RAISE EXCEPTION 'FAIL B2: % piece(s) whose code is not <line serial>-<piece_seq>', v_n; END IF;
  RAISE NOTICE 'PASS B2: every piece code = line serial-piece_seq';

  SELECT count(*) INTO v_n FROM public.vw_doc_seq_consistency
   WHERE doc_type_code IN ('ORDER_ITEM', 'ORDER_PIECE') AND severity = 'ERROR';
  IF v_n > 0 THEN RAISE EXCEPTION 'FAIL B3: % ERROR row(s) in vw_doc_seq_consistency for ORDER_ITEM/ORDER_PIECE', v_n; END IF;
  RAISE NOTICE 'PASS B3: vw_doc_seq_consistency has no ERROR for ORDER_ITEM/ORDER_PIECE (NOT_NULL_MISSING WARN on order_item_srno is expected: it is a CHECK)';
END $$;

-- ------------------------------------------------------------------
-- Fixture + helper (same as hfc_p21_split_safety.test.sql)
-- ------------------------------------------------------------------
CREATE TEMP TABLE zz_ctx (k TEXT PRIMARY KEY, v TEXT) ON COMMIT DROP;

DO $$
DECLARE v_t UUID := NULLIF(current_setting('zz.tenant', true), '')::uuid; v_o UUID; v_i UUID;
BEGIN
  SELECT o.tenant_org_id, o.id, i.id INTO v_t, v_o, v_i
    FROM public.org_orders_mst o
    JOIN public.org_tenants_mst t ON t.id = o.tenant_org_id
    JOIN public.org_order_items_dtl i ON i.order_id = o.id AND i.tenant_org_id = o.tenant_org_id
   WHERE (v_t IS NULL OR o.tenant_org_id = v_t)
     AND COALESCE(t.is_active, true) AND t.status IS DISTINCT FROM 'creating'
     AND o.parent_order_id IS NULL
   ORDER BY o.created_at DESC NULLS LAST
   LIMIT 1;
  IF v_o IS NULL THEN
    RAISE EXCEPTION 'SETUP: no active tenant% with an order that has a line', COALESCE(' ' || v_t::text, '');
  END IF;
  INSERT INTO zz_ctx VALUES ('t', v_t::text), ('tpl_order', v_o::text), ('tpl_item', v_i::text);
  RAISE NOTICE 'SETUP: tenant %, template order %, template line %', v_t, v_o, v_i;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.zz_clone(p_table TEXT, p_tpl UUID, p_cols TEXT[], p_over JSONB)
RETURNS UUID LANGUAGE plpgsql AS $f$
DECLARE v_cols TEXT[]; v_sel TEXT; v_id UUID; v_t UUID := (SELECT v::uuid FROM zz_ctx WHERE k = 't');
BEGIN
  SELECT array_agg(c.column_name::TEXT ORDER BY c.ordinal_position) INTO v_cols
    FROM information_schema.columns c
   WHERE c.table_schema = 'public' AND c.table_name = p_table
     AND (c.column_name = ANY (p_cols) OR p_over ? c.column_name)
     AND c.column_name <> 'id' AND c.is_generated = 'NEVER';
  SELECT string_agg(CASE WHEN p_over ? x THEN format('(jsonb_populate_record(NULL::public.%I, $2)).%I', p_table, x)
                         ELSE format('t.%I', x) END, ', ')
    INTO v_sel FROM unnest(v_cols) x;
  EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM public.%I t WHERE t.id = $1 AND t.tenant_org_id = $3 RETURNING id',
                 p_table, (SELECT string_agg(format('%I', x), ', ') FROM unnest(v_cols) x), v_sel, p_table)
    INTO v_id USING p_tpl, p_over, v_t;
  IF v_id IS NULL THEN RAISE EXCEPTION 'SETUP: template % row % not found', p_table, p_tpl; END IF;
  RETURN v_id;
END $f$;

INSERT INTO zz_ctx VALUES ('order_cols', 'branch_id,customer_id,order_type_id,status,current_status,current_stage,priority,'
  'priority_multiplier,service_category_code,workflow_template_id,wf_profile_id,wf_version_no,wf_profile_version_id,'
  'wf_profile_artifact_id,wf_profile_revision,wf_profile_checksum,wf_profile_schema_version,received_at,ready_by,'
  'ready_by_at_new,physical_intake_status,order_source_code,currency_code,currency_ex_rate,is_retail,'
  'is_default_customer,customer_name,customer_mobile_number,customer_email,customer_details,service_speed');
INSERT INTO zz_ctx VALUES ('item_cols', 'branch_id,service_category_code,product_id,product_name,'
  'product_name2,status,item_status,item_stage,notes,color,brand,has_stain,has_damage,stain_notes,'
  'damage_notes,service_speed,ready_by_at');

-- ------------------------------------------------------------------
-- Part C: write paths
-- ------------------------------------------------------------------
DO $$
DECLARE
  v_t UUID := (SELECT v::uuid FROM zz_ctx WHERE k = 't');
  v_oc TEXT[] := string_to_array((SELECT v FROM zz_ctx WHERE k = 'order_cols'), ',');
  v_ic TEXT[] := string_to_array((SELECT v FROM zz_ctx WHERE k = 'item_cols'), ',');
  v_tpl_item UUID := (SELECT v::uuid FROM zz_ctx WHERE k = 'tpl_item');
  v_o UUID; v_no TEXT; v_l1 UUID; v_l2 UUID; v_l3 UUID; v_s UUID; v_s_no TEXT; v_sl UUID;
  v_p1 UUID; v_p2 UUID; v_code TEXT; v_srno TEXT; v_tag TEXT := 'hfc-p3-test-' || substr(md5(random()::text), 1, 10);
  v_rel TIMESTAMPTZ;
  v_ok BOOLEAN; v_line JSONB;
BEGIN
  v_o := pg_temp.zz_clone('org_orders_mst', (SELECT v::uuid FROM zz_ctx WHERE k = 'tpl_order'), v_oc,
           jsonb_build_object('tenant_org_id', v_t, 'order_no', NULL, 'parent_order_id', NULL,
                              'customer_notes', 'HFC P3 safety test (rolled back)', 'rec_status', 1,
                              'status', 'processing', 'current_status', 'processing',
                              'created_at', now(), 'created_info', 'hfc_p3_codes_safety.test'));
  SELECT order_no INTO v_no FROM public.org_orders_mst WHERE id = v_o AND tenant_org_id = v_t;
  v_line := jsonb_build_object('tenant_org_id', v_t, 'order_id', v_o, 'quantity', 2, 'quantity_ready', 0,
              'price_per_unit', 1.5, 'total_price', 3, 'metadata', '{}'::jsonb, 'rec_status', 1, 'created_at', now(),
              'created_info', 'hfc_p3_codes_safety.test');

  -- C1 trigger path: serial left empty -> <order_no>-1
  v_l1 := pg_temp.zz_clone('org_order_items_dtl', v_tpl_item, v_ic, v_line || jsonb_build_object('order_item_srno', NULL, 'barcode', NULL));
  SELECT order_item_srno INTO v_srno FROM public.org_order_items_dtl WHERE id = v_l1 AND tenant_org_id = v_t;
  IF v_srno IS DISTINCT FROM v_no || '-1' THEN RAISE EXCEPTION 'FAIL C1: first line serial % (expected %-1)', v_srno, v_no; END IF;
  RAISE NOTICE 'PASS C1: empty serial filled by the trigger: %', v_srno;

  -- C2 app path: advisory lock + explicit <order_no>-2, barcode = serial
  PERFORM pg_advisory_xact_lock(hashtextextended('ord_item_srno:' || v_o::text, 0));
  v_l2 := pg_temp.zz_clone('org_order_items_dtl', v_tpl_item, v_ic,
            v_line || jsonb_build_object('order_item_srno', v_no || '-2', 'barcode', v_no || '-2'));
  v_l3 := pg_temp.zz_clone('org_order_items_dtl', v_tpl_item, v_ic, v_line || jsonb_build_object('order_item_srno', ' ', 'barcode', NULL));
  SELECT order_item_srno INTO v_srno FROM public.org_order_items_dtl WHERE id = v_l3 AND tenant_org_id = v_t;
  IF v_srno IS DISTINCT FROM v_no || '-3' THEN RAISE EXCEPTION 'FAIL C2: blank serial after an explicit -2 gave %', v_srno; END IF;
  RAISE NOTICE 'PASS C2: explicit serial kept, next empty one continues: %', v_srno;

  -- C3 duplicate serial refused
  v_ok := false;
  BEGIN PERFORM pg_temp.zz_clone('org_order_items_dtl', v_tpl_item, v_ic, v_line || jsonb_build_object('order_item_srno', v_no || '-2', 'barcode', NULL));
  EXCEPTION WHEN unique_violation THEN v_ok := SQLERRM LIKE '%uq_ord_item_srno%'; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL C3: duplicate serial not refused by uq_ord_item_srno'; END IF;
  RAISE NOTICE 'PASS C3: duplicate serial refused (uq_ord_item_srno)';

  -- C4 serial immutable, barcode never a data: URL
  v_ok := false;
  BEGIN UPDATE public.org_order_items_dtl SET order_item_srno = v_no || '-99' WHERE id = v_l1 AND tenant_org_id = v_t;
  EXCEPTION WHEN raise_exception THEN v_ok := SQLERRM LIKE 'DOC_SEQ_CODE_IMMUTABLE%'; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL C4: serial change not blocked'; END IF;
  v_ok := false;
  BEGIN UPDATE public.org_order_items_dtl SET barcode = 'data:image/svg+xml;base64,AAAA' WHERE id = v_l1 AND tenant_org_id = v_t;
  EXCEPTION WHEN check_violation THEN v_ok := SQLERRM LIKE '%ck_ord_item_barcode_val%'; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL C4: data: barcode not refused'; END IF;
  UPDATE public.org_order_items_dtl SET notes = 'hfc p3 test' WHERE id = v_l1 AND tenant_org_id = v_t;
  RAISE NOTICE 'PASS C4: serial immutable, data: barcode refused, other columns still editable';

  -- C5 pieces: code built by the trigger (supplied value ignored)
  INSERT INTO public.org_order_item_pieces_dtl (tenant_org_id, order_id, order_item_id, piece_seq, piece_code, price_per_unit, total_price, created_info)
  VALUES (v_t, v_o, v_l1, 1, 'HACK', 1.5, 1.5, 'hfc_p3_codes_safety.test') RETURNING id, piece_code INTO v_p1, v_code;
  IF v_code IS DISTINCT FROM v_no || '-1-1' THEN RAISE EXCEPTION 'FAIL C5: piece code % (expected %-1-1)', v_code, v_no; END IF;
  INSERT INTO public.org_order_item_pieces_dtl (tenant_org_id, order_id, order_item_id, piece_seq, price_per_unit, total_price, created_info)
  VALUES (v_t, v_o, v_l1, 2, 1.5, 1.5, 'hfc_p3_codes_safety.test') RETURNING id INTO v_p2;
  v_ok := false;
  BEGIN UPDATE public.org_order_item_pieces_dtl SET piece_code = 'X' WHERE id = v_p1 AND tenant_org_id = v_t;
  EXCEPTION WHEN raise_exception THEN v_ok := SQLERRM LIKE 'DOC_SEQ_CODE_IMMUTABLE%'; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL C5: piece code change not blocked'; END IF;
  RAISE NOTICE 'PASS C5: piece code % built by trg_ord_piece_code_set and immutable', v_code;

  -- C6 external tag (A-35..A-37): normalised, unique per tenant among live pieces of open orders, format checked,
  --    code look-alikes refused, freed when the order is delivered / closed / cancelled
  UPDATE public.org_order_item_pieces_dtl SET barcode = '  ' || v_tag || ' ' WHERE id = v_p1 AND tenant_org_id = v_t;
  IF (SELECT barcode FROM public.org_order_item_pieces_dtl WHERE id = v_p1 AND tenant_org_id = v_t) IS DISTINCT FROM upper(v_tag) THEN
    RAISE EXCEPTION 'FAIL C6: tag not trimmed + upper-cased';
  END IF;
  v_tag := upper(v_tag);
  v_ok := false;
  BEGIN UPDATE public.org_order_item_pieces_dtl SET barcode = lower(v_tag) WHERE id = v_p2 AND tenant_org_id = v_t;
  EXCEPTION WHEN unique_violation THEN v_ok := SQLERRM LIKE '%uq_ord_piece_barcode%'; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL C6: duplicate tag (other letter case) not refused'; END IF;
  v_ok := false;
  BEGIN UPDATE public.org_order_item_pieces_dtl SET barcode = 'A B' WHERE id = v_p2 AND tenant_org_id = v_t;
  EXCEPTION WHEN check_violation THEN v_ok := SQLERRM LIKE '%ck_ord_piece_barcode_fmt%'; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL C6: tag with a space not refused'; END IF;
  v_ok := false;
  BEGIN UPDATE public.org_order_item_pieces_dtl SET barcode = 'CMX1:PCS:X' WHERE id = v_p2 AND tenant_org_id = v_t;
  EXCEPTION WHEN check_violation THEN v_ok := SQLERRM LIKE 'PIECE_TAG_LOOKS_LIKE_CODE%' OR SQLERRM LIKE '%ck_ord_piece_barcode_fmt%'; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL C6: staff QR payload as tag not refused'; END IF;
  v_ok := false;
  BEGIN UPDATE public.org_order_item_pieces_dtl SET barcode = 'ord-20261101-0001' WHERE id = v_p2 AND tenant_org_id = v_t;
  EXCEPTION WHEN check_violation THEN v_ok := SQLERRM LIKE 'PIECE_TAG_LOOKS_LIKE_CODE%'; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL C6: tag shaped like an order number not refused'; END IF;
  v_ok := false;
  BEGIN UPDATE public.org_order_item_pieces_dtl SET barcode = 'cust-12' WHERE id = v_p2 AND tenant_org_id = v_t;
  EXCEPTION WHEN check_violation THEN v_ok := SQLERRM LIKE 'PIECE_TAG_LOOKS_LIKE_CODE%'; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL C6: tag shaped like a customer code not refused'; END IF;
  UPDATE public.org_order_item_pieces_dtl SET barcode = NULL WHERE id = v_p1 AND tenant_org_id = v_t;
  UPDATE public.org_order_item_pieces_dtl SET barcode = v_tag WHERE id = v_p2 AND tenant_org_id = v_t;
  -- release: order delivered -> tag free for another order's piece; reopening does not take it back
  UPDATE public.org_orders_mst SET status = 'delivered' WHERE id = v_o AND tenant_org_id = v_t;
  SELECT tag_released_at INTO v_rel FROM public.org_order_item_pieces_dtl WHERE id = v_p2 AND tenant_org_id = v_t;
  IF v_rel IS NULL THEN RAISE EXCEPTION 'FAIL C6: tag not released when the order was delivered'; END IF;
  UPDATE public.org_order_item_pieces_dtl SET barcode = v_tag WHERE id = v_p1 AND tenant_org_id = v_t;  -- same delivered order: allowed, released too
  UPDATE public.org_orders_mst SET status = 'processing' WHERE id = v_o AND tenant_org_id = v_t;
  IF (SELECT count(*) FROM public.org_order_item_pieces_dtl WHERE order_id = v_o AND tenant_org_id = v_t AND barcode = v_tag AND tag_released_at IS NOT NULL) <> 2 THEN
    RAISE EXCEPTION 'FAIL C6: reopening the order changed released tags';
  END IF;
  v_ok := false;
  BEGIN UPDATE public.org_order_item_pieces_dtl SET barcode = v_tag || '-X' WHERE id = v_p1 AND tenant_org_id = v_t;
        UPDATE public.org_order_item_pieces_dtl SET barcode = v_tag WHERE id = v_p1 AND tenant_org_id = v_t;
        v_ok := (SELECT tag_released_at IS NULL FROM public.org_order_item_pieces_dtl WHERE id = v_p1 AND tenant_org_id = v_t);
  EXCEPTION WHEN unique_violation THEN v_ok := false; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL C6: re-saving a tag on a reopened order did not make it live'; END IF;
  v_ok := false;  -- p2 still holds the same tag as released history; saving it again re-checks and clashes with p1
  BEGIN UPDATE public.org_order_item_pieces_dtl SET barcode = v_tag WHERE id = v_p2 AND tenant_org_id = v_t;
  EXCEPTION WHEN unique_violation THEN v_ok := SQLERRM LIKE '%uq_ord_piece_barcode%'; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL C6: re-saving a released tag that is live elsewhere not refused'; END IF;
  UPDATE public.org_order_item_pieces_dtl SET barcode = NULL WHERE id IN (v_p1, v_p2) AND tenant_org_id = v_t;
  RAISE NOTICE 'PASS C6: tag % normalised, unique per tenant, format checked, code look-alikes refused, released on delivery, not re-taken on reopen', v_tag;

  -- C7 split-style sub-order line: serial <sub order_no>-1 (order-split.service.ts)
  v_s_no := public.fn_ord_next_sub_order_no(v_t, v_o);
  v_s := pg_temp.zz_clone('org_orders_mst', v_o, v_oc,
           jsonb_build_object('tenant_org_id', v_t, 'order_no', v_s_no, 'parent_order_id', v_o, 'order_subtype', 'split_child',
                              'total_items', 1, 'rec_status', 1, 'created_at', now(), 'created_info', 'hfc_p3_codes_safety.test'));
  v_sl := pg_temp.zz_clone('org_order_items_dtl', v_l1, v_ic,
            v_line || jsonb_build_object('order_id', v_s, 'price_per_unit', 0, 'total_price', 0,
                                         'order_item_srno', v_s_no || '-1', 'barcode', v_s_no || '-1',
                                         'metadata', jsonb_build_object('split_from_item_id', v_l1, 'split_from_item_srno', v_no || '-1')));
  SELECT order_item_srno INTO v_srno FROM public.org_order_items_dtl WHERE id = v_sl AND tenant_org_id = v_t;
  IF v_srno IS DISTINCT FROM v_s_no || '-1' THEN RAISE EXCEPTION 'FAIL C7: sub-order line serial %', v_srno; END IF;
  RAISE NOTICE 'PASS C7: sub-order % line serial %', v_s_no, v_srno;
END $$;

ROLLBACK;
