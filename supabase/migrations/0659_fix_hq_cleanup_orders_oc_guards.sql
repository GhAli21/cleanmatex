-- =============================================================================
-- 0659_fix_hq_cleanup_orders_oc_guards.sql
--
-- HQ tenant maintenance "Delete Orders" (execute, not preview) failed with
--   Failed to delete tenant orders: Applied Change history is immutable
--
-- 0551 taught public.hq_mntnc_cleanup_tenant_orders to delete order-change rows, but 0548's
-- row guards reject every runtime DELETE on the rows this purge must remove:
--   - oc_change_immutable   (org_order_changes_mst)      'Applied Change history is immutable'
--   - oc_op_immutable       (org_order_change_ops_dtl)   'Applied Change history is immutable'
--   - oc_order_foundation_guard (org_orders_mst)         'Committed order cannot be deleted'
--   - oc_item_removed_guard / oc_piece_removed_guard / oc_pref_removed_guard
--                           (items / pieces / preferences) 'Governed removed fact cannot be deleted'
--
-- Second defect from 0551, masked by the first: it deletes org_order_changes_mst BEFORE items /
-- pieces / preferences, but removed (governed) rows there point back at their change through
-- oc_item/piece/pref_removal_change_fk, ON DELETE RESTRICT. RESTRICT is checked immediately even
-- though those FKs are DEFERRABLE, so any order with a removed line would fail. The change-header
-- DELETE is moved to right after the items DELETE. Final order:
--   change ops -> preferences -> pieces -> items -> change headers -> ... -> orders
--
-- Fix: the execute branch of the function disables exactly these six row triggers, deletes,
-- then re-enables them. 0548 names trigger maintenance by the table owner as the sanctioned
-- administrative boundary (an application session cannot do it); the function is SECURITY
-- DEFINER owned by postgres, the tables' owner. The guard functions themselves are unchanged,
-- and the TRUNCATE guards stay enabled throughout.
--
-- Safety properties:
--   - ALTER TABLE ... DISABLE TRIGGER is transactional: any error inside the function rolls the
--     disable back with the deletes, so the guards can never be left off.
--   - The ALTERs take ACCESS EXCLUSIVE on the six tables until the HQ call commits, so other
--     sessions wait rather than slip past a disabled guard. lock_timeout (5s, transaction-local)
--     makes a busy table fail the call cleanly instead of queueing the whole app behind it.
--   - Deferred FK checks queued by the deletes are fired (SET CONSTRAINTS ALL IMMEDIATE) before
--     re-enabling, because ALTER TABLE refuses a table with pending trigger events. They would
--     run at commit anyway; this only moves them earlier.
--   - Dry runs and blocked calls never reach the ALTERs.
--
-- Same live-definition transform as 0551 (position()/slicing, every edit asserted, idempotent),
-- so signature, SECURITY DEFINER, search_path and grants are preserved.
-- =============================================================================
BEGIN;

DO $$
DECLARE
  v_oid  oid;
  v_def  text;
  v_new  text;
  v_pos  INT;
  v_exec CONSTANT text := E'IF NOT p_dry_run AND NOT v_blocked THEN\n';
  v_res  CONSTANT text := E'  v_result := jsonb_build_object(';
  -- Owner-only guard bypass for the purge; rolled back with the transaction on any error.
  v_disable CONSTANT text :=
    E'    PERFORM set_config(''lock_timeout'', ''5s'', true);\n' ||
    E'    ALTER TABLE public.org_order_changes_mst     DISABLE TRIGGER oc_change_immutable;\n' ||
    E'    ALTER TABLE public.org_order_change_ops_dtl  DISABLE TRIGGER oc_op_immutable;\n' ||
    E'    ALTER TABLE public.org_orders_mst            DISABLE TRIGGER oc_order_foundation_guard;\n' ||
    E'    ALTER TABLE public.org_order_items_dtl       DISABLE TRIGGER oc_item_removed_guard;\n' ||
    E'    ALTER TABLE public.org_order_item_pieces_dtl DISABLE TRIGGER oc_piece_removed_guard;\n' ||
    E'    ALTER TABLE public.org_order_preferences_dtl DISABLE TRIGGER oc_pref_removed_guard;\n\n';
  -- Fire queued deferred FK checks first: ALTER TABLE rejects tables with pending trigger events.
  v_enable CONSTANT text :=
    E'  IF NOT p_dry_run AND NOT v_blocked THEN\n' ||
    E'    SET CONSTRAINTS ALL IMMEDIATE;\n' ||
    E'    ALTER TABLE public.org_order_changes_mst     ENABLE TRIGGER oc_change_immutable;\n' ||
    E'    ALTER TABLE public.org_order_change_ops_dtl  ENABLE TRIGGER oc_op_immutable;\n' ||
    E'    ALTER TABLE public.org_orders_mst            ENABLE TRIGGER oc_order_foundation_guard;\n' ||
    E'    ALTER TABLE public.org_order_items_dtl       ENABLE TRIGGER oc_item_removed_guard;\n' ||
    E'    ALTER TABLE public.org_order_item_pieces_dtl ENABLE TRIGGER oc_piece_removed_guard;\n' ||
    E'    ALTER TABLE public.org_order_preferences_dtl ENABLE TRIGGER oc_pref_removed_guard;\n' ||
    E'  END IF;\n\n';
  -- Exact text 0551 inserted, and the items DELETE it must follow (removed lines RESTRICT it).
  v_chg CONSTANT text :=
    E'DELETE FROM public.org_order_changes_mst AS x\n' ||
    E'    WHERE x.tenant_org_id = p_tenant_org_id\n' ||
    E'      AND x.order_id IN (SELECT order_id FROM tmp_cto_target_orders);\n\n    ';
  v_items CONSTANT text :=
    E'DELETE FROM public.org_order_items_dtl AS x\n' ||
    E'    WHERE x.tenant_org_id = p_tenant_org_id\n' ||
    E'      AND x.order_id IN (SELECT order_id FROM tmp_cto_target_orders);\n\n    ';
BEGIN
  SELECT p.oid INTO v_oid
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'hq_mntnc_cleanup_tenant_orders';
  IF v_oid IS NULL THEN
    RAISE NOTICE 'hq_mntnc_cleanup_tenant_orders not found — nothing to redefine';
    RETURN;
  END IF;

  v_def := pg_get_functiondef(v_oid);
  IF position('DISABLE TRIGGER oc_change_immutable' IN v_def) > 0 THEN
    RAISE NOTICE 'hq_mntnc_cleanup_tenant_orders already fixed';
    RETURN;
  END IF;

  -- (1) disable the guards at the top of the execute branch, before any delete
  v_pos := position(v_exec IN v_def);
  IF v_pos = 0 OR position(v_exec IN substring(v_def FROM v_pos + 1)) > 0 THEN
    RAISE EXCEPTION '0659: execute-branch anchor not found exactly once';
  END IF;
  v_new := left(v_def, v_pos - 1 + length(v_exec)) || v_disable
        || substring(v_def FROM v_pos + length(v_exec));

  -- (2) re-enable after the execute branch (and its verification) closes
  v_pos := position(v_res IN v_new);
  IF v_pos = 0 OR position(v_res IN substring(v_new FROM v_pos + 1)) > 0 THEN
    RAISE EXCEPTION '0659: result anchor not found exactly once';
  END IF;
  v_new := left(v_new, v_pos - 1) || v_enable || substring(v_new FROM v_pos);

  -- (3) move the change-header DELETE after the items DELETE
  v_pos := position(v_chg IN v_new);
  IF v_pos = 0 OR position(v_chg IN substring(v_new FROM v_pos + 1)) > 0 THEN
    RAISE EXCEPTION '0659: change-header DELETE not found exactly once';
  END IF;
  v_new := left(v_new, v_pos - 1) || substring(v_new FROM v_pos + length(v_chg));
  v_pos := position(v_items IN v_new);
  IF v_pos = 0 OR position(v_items IN substring(v_new FROM v_pos + 1)) > 0 THEN
    RAISE EXCEPTION '0659: items DELETE anchor not found exactly once';
  END IF;
  v_new := left(v_new, v_pos - 1 + length(v_items)) || v_chg
        || substring(v_new FROM v_pos + length(v_items));

  EXECUTE v_new;
END $$;

-- Verification: the live function disables and re-enables every guard.
DO $$
DECLARE
  v_def text;
  v_trg text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'hq_mntnc_cleanup_tenant_orders';
  IF v_def IS NULL THEN
    RETURN;
  END IF;
  FOREACH v_trg IN ARRAY ARRAY['oc_change_immutable', 'oc_op_immutable', 'oc_order_foundation_guard',
                               'oc_item_removed_guard', 'oc_piece_removed_guard', 'oc_pref_removed_guard'] LOOP
    IF position('DISABLE TRIGGER ' || v_trg || ';' IN v_def) = 0
       OR position('ENABLE TRIGGER ' || v_trg || ';' IN v_def) = 0 THEN
      RAISE EXCEPTION '0659 verification failed: % not toggled', v_trg;
    END IF;
  END LOOP;
  IF position('DELETE FROM public.org_order_changes_mst' IN v_def)
     < position('DELETE FROM public.org_order_items_dtl' IN v_def) THEN
    RAISE EXCEPTION '0659 verification failed: change headers still deleted before items';
  END IF;
END $$;

-- Keeps the existing description (0465/0466) and appends the 0659 guard behaviour.
COMMENT ON FUNCTION public.hq_mntnc_cleanup_tenant_orders IS
  'HQ Console destructive order-data cleanup for a single tenant. Ported from '
  'supabase/snippets/cleanup_all_order_data_all_tenants_or_one_tenant_fixed.sql (no all-tenants mode; '
  'see migration header for the full deviation list). p_dry_run defaults true. Returns blocked/block_reasons '
  'instead of raising for data-dependent guard-rail conditions (uncovered related rows; target count over '
  'p_max_target_orders); raises only for malformed input. service_role EXECUTE only. '
  'Since 0659 the execute branch disables the 0548 Order Change row guards (history immutability, removed '
  'facts, committed orders) as table owner for its own transaction and re-enables them before returning; '
  'dry runs and blocked calls never touch them.';

COMMIT;

-- =============================================================================
-- Post-apply (by hand): HQ > Tenants > <tenant> > Maintenance > Delete Orders > Delete
-- must succeed; then confirm the guards are back on:
--   SELECT tgname, tgenabled FROM pg_trigger WHERE tgname LIKE 'oc\_%';   -- all 'O'
-- =============================================================================
