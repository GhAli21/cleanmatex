-- ==================================================================
-- hfc_p21_split_safety.test.sql
-- Purpose: user-run safety test for Human-Friendly Codes P2 + P2.1 on a real database (risk 1).
--   Part A lists every trigger on the order, split and tenant tables (so unexpected triggers are visible).
--   Part B runs a full create -> item -> split -> split-of-split flow exactly like web-admin order-split.service
--   and checks: order_no format, sub-order numbering under the root, root_order_id, money stays on the parent,
--   sub-order lines priced 0 and pointing to the parent lines, root_order_id immutability.
--   Part C checks the tenant hard-delete guard (0678).
-- Dependencies: migrations 0674, 0677, 0678 applied.
-- Run with psql as the postgres role (LOCAL first; on remote it is also safe, see below):
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/hfc_p21_split_safety.test.sql
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -v tenant_id=<uuid> -f supabase/tests/hfc_p21_split_safety.test.sql
-- Without tenant_id it picks the first active tenant (not creating) that has an order with at least one line;
-- that order and line are used only as a column template (customer, branch, workflow ids), never changed.
-- SAFE: everything runs in ONE transaction that is ROLLED BACK at the end: no order, line, counter, tenant or
-- number is kept (counters are row-locked and roll back too, so no order number is skipped).
-- Output: "PASS ..." notices, or the run stops at the first "FAIL ...". A SKIP notice explains a missing fixture.
-- Note: Part B locks the counter row of the chosen tenant-day until the end of the run (a few ms): run it at a
-- quiet moment on a busy remote database.
-- ==================================================================

\if :{?tenant_id}
\else
\set tenant_id ''
\endif

BEGIN;
SET LOCAL lock_timeout = '5s';
SELECT set_config('zz.tenant', :'tenant_id', true) AS tenant_param;

-- ------------------------------------------------------------------
-- Part A: triggers on the tables the flow touches
-- ------------------------------------------------------------------
SELECT c.relname AS table_name, t.tgname AS trigger_name,
       CASE WHEN t.tgenabled = 'D' THEN 'DISABLED' ELSE 'enabled' END AS state,
       p.proname AS function_name,
       pg_get_triggerdef(t.oid) AS definition
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = t.tgfoid
 WHERE n.nspname = 'public' AND NOT t.tgisinternal
   AND c.relname IN ('org_orders_mst', 'org_order_items_dtl', 'org_order_item_pieces_dtl', 'org_order_history',
                     'org_doc_seq_mst', 'org_tenants_mst')
 ORDER BY c.relname, t.tgname;

DO $$
DECLARE v_missing TEXT;
BEGIN
  SELECT string_agg(x, ', ') INTO v_missing
    FROM unnest(ARRAY['org_orders_mst.trg_ord_no_assign', 'org_orders_mst.trg_ord_no_guard',
                      'org_orders_mst.trg_ord_root_guard', 'org_tenants_mst.trg_tenant_hard_delete_guard',
                      'org_tenants_mst.trg_tenant_truncate_guard', 'org_tenants_mst.trg_tenant_status_creating_guard']) x
   WHERE NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
                      WHERE c.relnamespace = 'public'::regnamespace AND c.relname || '.' || t.tgname = x
                        AND t.tgenabled <> 'D');
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'FAIL A1: missing or disabled triggers: %', v_missing; END IF;
  RAISE NOTICE 'PASS A1: P2/P2.1 triggers present and enabled (see the listing above for all triggers)';
END $$;

-- ------------------------------------------------------------------
-- Fixture + helper
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

-- Copy p_cols (only those that exist) from the template row, with p_over values on top. Returns the new id.
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

-- Same header columns web-admin copies for a sub-order (order-split.service.ts), used for the root order too.
INSERT INTO zz_ctx VALUES ('order_cols', 'branch_id,customer_id,order_type_id,status,current_status,current_stage,priority,'
  'priority_multiplier,service_category_code,workflow_template_id,wf_profile_id,wf_version_no,wf_profile_version_id,'
  'wf_profile_artifact_id,wf_profile_revision,wf_profile_checksum,wf_profile_schema_version,received_at,ready_by,'
  'ready_by_at_new,physical_intake_status,order_source_code,currency_code,currency_ex_rate,is_retail,'
  'is_default_customer,customer_name,customer_mobile_number,customer_email,customer_details,service_speed');
INSERT INTO zz_ctx VALUES ('item_cols', 'branch_id,service_category_code,product_id,product_name,'
  'product_name2,status,item_status,item_stage,notes,color,brand,has_stain,has_damage,stain_notes,'
  'damage_notes,service_speed,ready_by_at');

-- ------------------------------------------------------------------
-- Part B: create -> line -> split -> split of the split
-- ------------------------------------------------------------------
DO $$
DECLARE
  v_t UUID := (SELECT v::uuid FROM zz_ctx WHERE k = 't');
  v_oc TEXT[] := string_to_array((SELECT v FROM zz_ctx WHERE k = 'order_cols'), ',');
  v_ic TEXT[] := string_to_array((SELECT v FROM zz_ctx WHERE k = 'item_cols'), ',');
  v_root UUID; v_root_no TEXT; v_root_rt UUID; v_line UUID;
  v_s1 UUID; v_s1_no TEXT; v_s2 UUID; v_s2_no TEXT; v_no TEXT; v_rt UUID;
  v_parent_total NUMERIC; v_after_total NUMERIC; v_sub_money NUMERIC; v_bad INT; v_ok BOOLEAN;
BEGIN
  -- B1 root order: order_no left empty -> trg_ord_no_assign
  v_root := pg_temp.zz_clone('org_orders_mst', (SELECT v::uuid FROM zz_ctx WHERE k = 'tpl_order'), v_oc,
              jsonb_build_object('tenant_org_id', v_t, 'order_no', NULL, 'parent_order_id', NULL,
                                 'customer_notes', 'HFC P2.1 safety test (rolled back)', 'rec_status', 1,
                                 'created_at', now(), 'created_info', 'hfc_p21_split_safety.test'));
  SELECT order_no, root_order_id INTO v_root_no, v_root_rt FROM public.org_orders_mst WHERE id = v_root AND tenant_org_id = v_t;
  IF v_root_no !~ '^ORD-[0-9]{8}-[0-9]{4,}$' THEN RAISE EXCEPTION 'FAIL B1: root order_no %', v_root_no; END IF;
  IF v_root_rt IS NOT NULL THEN RAISE EXCEPTION 'FAIL B1: root has root_order_id %', v_root_rt; END IF;
  RAISE NOTICE 'PASS B1: root order % (root_order_id NULL)', v_root_no;

  -- B2 a priced line on the root (4 units x 2.500)
  v_line := pg_temp.zz_clone('org_order_items_dtl', (SELECT v::uuid FROM zz_ctx WHERE k = 'tpl_item'), v_ic,
              jsonb_build_object('tenant_org_id', v_t, 'order_id', v_root, 'quantity', 4, 'quantity_ready', 0,
                                 'price_per_unit', 2.5, 'total_price', 10, 'metadata', '{}'::jsonb, 'rec_status', 1,
                                 'created_at', now(), 'created_info', 'hfc_p21_split_safety.test'));
  SELECT SUM(total_price) INTO v_parent_total FROM public.org_order_items_dtl WHERE tenant_org_id = v_t AND order_id = v_root;
  RAISE NOTICE 'PASS B2: line % on the root, line money %', v_line, v_parent_total;

  -- B3 first split (same order of steps as the service: number LAST, then header, then zero-priced line)
  v_s1_no := public.fn_ord_next_sub_order_no(v_t, v_root);
  IF v_s1_no <> v_root_no || '-S1' THEN RAISE EXCEPTION 'FAIL B3: first sub-order number %', v_s1_no; END IF;
  v_s1 := pg_temp.zz_clone('org_orders_mst', v_root, v_oc,
            jsonb_build_object('tenant_org_id', v_t, 'order_no', v_s1_no, 'parent_order_id', v_root,
                               'order_subtype', 'split_child', 'total_items', 1, 'rec_status', 1,
                               'created_at', now(), 'created_info', 'hfc_p21_split_safety.test'));
  PERFORM pg_temp.zz_clone('org_order_items_dtl', v_line, v_ic,
            jsonb_build_object('tenant_org_id', v_t, 'order_id', v_s1, 'order_item_srno', v_s1_no || '-1', 'barcode', v_s1_no || '-1', 'quantity', 1, 'quantity_ready', 0,
                               'price_per_unit', 0, 'total_price', 0, 'rec_status', 1, 'created_at', now(),
                               'metadata', jsonb_build_object('split_from_order_id', v_root, 'split_from_order_no', v_root_no,
                                 'split_from_item_id', v_line, 'split_root_order_id', v_root, 'money_on_parent', true)));
  SELECT root_order_id INTO v_rt FROM public.org_orders_mst WHERE id = v_s1 AND tenant_org_id = v_t;
  IF v_rt IS DISTINCT FROM v_root THEN RAISE EXCEPTION 'FAIL B3: S1 root_order_id % (expected %)', v_rt, v_root; END IF;
  RAISE NOTICE 'PASS B3: % with root_order_id = root', v_s1_no;

  -- B4 split of the sub-order: numbered under the root, root_order_id = root (not S1)
  v_s2_no := public.fn_ord_next_sub_order_no(v_t, v_s1);
  IF v_s2_no <> v_root_no || '-S2' THEN RAISE EXCEPTION 'FAIL B4: split of S1 gave %', v_s2_no; END IF;
  v_s2 := pg_temp.zz_clone('org_orders_mst', v_s1, v_oc,
            jsonb_build_object('tenant_org_id', v_t, 'order_no', v_s2_no, 'parent_order_id', v_s1,
                               'order_subtype', 'split_child', 'total_items', 1, 'rec_status', 1,
                               'created_at', now(), 'created_info', 'hfc_p21_split_safety.test'));
  PERFORM pg_temp.zz_clone('org_order_items_dtl', v_line, v_ic,
            jsonb_build_object('tenant_org_id', v_t, 'order_id', v_s2, 'order_item_srno', v_s2_no || '-1', 'barcode', v_s2_no || '-1', 'quantity', 1, 'quantity_ready', 0,
                               'price_per_unit', 0, 'total_price', 0, 'rec_status', 1, 'created_at', now(),
                               'metadata', jsonb_build_object('split_from_order_id', v_root, 'split_from_order_no', v_root_no,
                                 'split_from_item_id', v_line, 'split_root_order_id', v_root, 'money_on_parent', true)));
  SELECT root_order_id INTO v_rt FROM public.org_orders_mst WHERE id = v_s2 AND tenant_org_id = v_t;
  IF v_rt IS DISTINCT FROM v_root THEN RAISE EXCEPTION 'FAIL B4: S2 root_order_id % (expected root %)', v_rt, v_root; END IF;
  v_no := public.fn_ord_next_sub_order_no(v_t, v_s2);
  IF v_no <> v_root_no || '-S3' THEN RAISE EXCEPTION 'FAIL B4: next after S2 is %', v_no; END IF;
  RAISE NOTICE 'PASS B4: % from S1, root_order_id = root, next would be %', v_s2_no, v_no;

  -- B5 money stays on the parent; sub lines are 0 and point to a parent line of the root
  SELECT SUM(total_price) INTO v_after_total FROM public.org_order_items_dtl WHERE tenant_org_id = v_t AND order_id = v_root;
  IF v_after_total IS DISTINCT FROM v_parent_total THEN
    RAISE EXCEPTION 'FAIL B5: parent line money changed % -> %', v_parent_total, v_after_total;
  END IF;
  SELECT COALESCE(SUM(ABS(i.total_price) + ABS(i.price_per_unit)), 0),
         COUNT(*) FILTER (WHERE NOT EXISTS (
           SELECT 1 FROM public.org_order_items_dtl p
            WHERE p.tenant_org_id = v_t AND p.order_id = v_root AND p.id::text = i.metadata->>'split_from_item_id'))
    INTO v_sub_money, v_bad
    FROM public.org_order_items_dtl i
    JOIN public.org_orders_mst o ON o.id = i.order_id AND o.tenant_org_id = i.tenant_org_id
   WHERE o.tenant_org_id = v_t AND o.root_order_id = v_root;
  IF v_sub_money <> 0 THEN RAISE EXCEPTION 'FAIL B5: sub-order lines carry money %', v_sub_money; END IF;
  IF v_bad <> 0 THEN RAISE EXCEPTION 'FAIL B5: % sub-order line(s) do not point to a root line', v_bad; END IF;
  RAISE NOTICE 'PASS B5: parent line money % unchanged, sub-order lines 0 and linked to the parent line', v_after_total;

  -- B6 root_order_id is immutable; re-parenting outside the family and a wrong explicit root are refused
  v_ok := false;
  BEGIN UPDATE public.org_orders_mst SET root_order_id = v_s1 WHERE id = v_s2 AND tenant_org_id = v_t;
  EXCEPTION WHEN check_violation THEN v_ok := SQLERRM LIKE 'ORD_ROOT_IMMUTABLE%'; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL B6a: root_order_id change not blocked'; END IF;
  v_ok := false;
  BEGIN UPDATE public.org_orders_mst SET parent_order_id = (SELECT v::uuid FROM zz_ctx WHERE k = 'tpl_order')
         WHERE id = v_s2 AND tenant_org_id = v_t;
  EXCEPTION WHEN check_violation THEN v_ok := SQLERRM LIKE 'ORD_ROOT_MISMATCH%'; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL B6b: re-parenting into another family not blocked'; END IF;
  v_ok := false;
  BEGIN PERFORM pg_temp.zz_clone('org_orders_mst', v_root, v_oc,
          jsonb_build_object('tenant_org_id', v_t, 'order_no', v_root_no || '-S90', 'parent_order_id', v_s1,
                             'root_order_id', v_s1, 'rec_status', 1));
  EXCEPTION WHEN check_violation THEN v_ok := SQLERRM LIKE 'ORD_ROOT_MISMATCH%'; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL B6c: wrong explicit root_order_id accepted'; END IF;
  RAISE NOTICE 'PASS B6: root_order_id immutable, cross-family re-parent and wrong root refused';
END $$;

-- ------------------------------------------------------------------
-- Part C: tenant hard delete guard (0678)
-- ------------------------------------------------------------------
DO $$
DECLARE v_t UUID := (SELECT v::uuid FROM zz_ctx WHERE k = 't'); v_ok BOOLEAN; v_new UUID; v_n INT;
BEGIN
  v_ok := false;
  BEGIN DELETE FROM public.org_tenants_mst WHERE id = v_t;
  EXCEPTION WHEN object_not_in_prerequisite_state THEN v_ok := SQLERRM LIKE 'TENANT_HARD_DELETE_BLOCKED%'; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL C1: hard delete of a live tenant was not blocked'; END IF;
  v_ok := false;
  BEGIN UPDATE public.org_tenants_mst SET status = 'creating' WHERE id = v_t;
  EXCEPTION WHEN object_not_in_prerequisite_state THEN v_ok := SQLERRM LIKE 'TENANT_STATUS_CREATING_INSERT_ONLY%'; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL C2: a live tenant could be moved to status creating'; END IF;
  RAISE NOTICE 'PASS C1-C2: live tenant hard delete -> TENANT_HARD_DELETE_BLOCKED, status creating is insert-only';

  -- C3 a tenant in status creating (as self-signup makes it) can be removed, its counters go first.
  BEGIN
    INSERT INTO public.org_tenants_mst (name, status, is_active)
    VALUES ('HFC P2.1 safety test tenant (rolled back)', 'creating', true)
    RETURNING id INTO v_new;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SKIP C3: cannot insert a minimal test tenant here (%); covered by the box tests', SQLERRM;
    RETURN;
  END;
  BEGIN
    PERFORM public.fn_doc_seq_next(v_new, 'ORDER', now());
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'NOTE C3: no ORDER counter created for the test tenant (%)', SQLERRM;
  END;
  BEGIN
    DELETE FROM public.org_tenants_mst WHERE id = v_new;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL C3: a tenant in status creating could not be deleted: % (%)', SQLERRM, SQLSTATE;
  END;
  SELECT COUNT(*) INTO v_n FROM public.org_doc_seq_mst WHERE tenant_org_id = v_new;
  IF v_n <> 0 OR EXISTS (SELECT 1 FROM public.org_tenants_mst WHERE id = v_new) THEN
    RAISE EXCEPTION 'FAIL C3: creating tenant not removed cleanly (% counters left)', v_n;
  END IF;
  RAISE NOTICE 'PASS C3: tenant in status creating hard-deleted, counters removed first';
END $$;

ROLLBACK;
\echo 'hfc_p21_split_safety: all checks done, everything rolled back.'
