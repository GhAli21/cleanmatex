-- =============================================================================
-- 0551_fix_hq_cleanup_orders_coverage.sql
--
-- HQ tenant maintenance "Delete Orders" preview failed with
--   malformed array literal: "Uncovered related rows exist in org_* tables ..."
--
-- Two defects in public.hq_mntnc_cleanup_tenant_orders, both pre-existing and only exposed now
-- that the uncovered-reference guard fires:
--   1. The guard appended a bare string literal to the TEXT[] block_reasons variable. An untyped
--      literal concatenated to an array is parsed as an ARRAY literal, so the message itself was
--      rejected ("malformed array literal") instead of being reported as a block reason. The
--      sibling guard uses format(), which is typed text, and works. Fixed with an explicit ::text.
--   2. Three org_* tables that reference orders / loyalty transactions were never added to the
--      function (they were created by later programs), so a tenant with such rows was always
--      blocked — and, once the cast is fixed, would be blocked for good:
--        - org_order_changes_mst / org_order_change_ops_dtl   (order-change history, 0547/0548;
--          both RESTRICT the order / its items, so they must be deleted first)
--        - org_loyalty_txn_allocs_dtl                         (loyalty FIFO allocations; RESTRICT
--          both loyalty transactions they link)
--
-- The function (~60 KB) is rewritten by transforming its own live definition with position()/
-- substring slicing (no regex: a greedy atom would swallow the rest of the body), so signature,
-- SECURITY DEFINER, search_path and grants are preserved. Every edit is asserted; the block aborts
-- (rolling the migration back) if the live text is not the shape this expects. Idempotent.
--
-- Note for operators: deleting an order's voucher lines also removes any cash-ledger stamp they
-- carried, so a CLOSED drawer session that covered them will no longer recompute to its frozen
-- closing figures. That is inherent to wiping demo/test orders and is intentionally not hidden:
-- the reconciliation report will flag the drift. This function is for non-production cleanup.
-- =============================================================================
BEGIN;

DO $$
DECLARE
  v_oid  oid;
  v_def  text;
  v_new  text;
  v_pos  INT;
  v_bad  CONSTANT text := '''Uncovered related rows exist in org_* tables not covered by this function — review uncovered_related_refs before proceeding.'';';
  v_good CONSTANT text := '''Uncovered related rows exist in org_* tables not covered by this function — review uncovered_related_refs before proceeding.''::text;';
  v_ops  CONSTANT text :=
    E'DELETE FROM public.org_order_change_ops_dtl AS x\n' ||
    E'    WHERE x.tenant_org_id = p_tenant_org_id\n' ||
    E'      AND x.order_id IN (SELECT order_id FROM tmp_cto_target_orders);\n\n' ||
    E'    DELETE FROM public.org_order_changes_mst AS x\n' ||
    E'    WHERE x.tenant_org_id = p_tenant_org_id\n' ||
    E'      AND x.order_id IN (SELECT order_id FROM tmp_cto_target_orders);\n\n    ';
  v_alloc CONSTANT text :=
    E'DELETE FROM public.org_loyalty_txn_allocs_dtl AS x\n' ||
    E'    WHERE x.tenant_org_id = p_tenant_org_id\n' ||
    E'      AND (\n' ||
    E'        x.consuming_txn_id IN (SELECT id FROM tmp_cto_target_loyalty_txns)\n' ||
    E'        OR x.source_txn_id IN (SELECT id FROM tmp_cto_target_loyalty_txns)\n' ||
    E'      );\n\n    ';
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
  IF position('org_order_changes_mst' IN v_def) > 0 AND position(v_bad IN v_def) = 0 THEN
    RAISE NOTICE 'hq_mntnc_cleanup_tenant_orders already fixed';
    RETURN;
  END IF;
  v_new := v_def;

  -- (1) typed block reason
  IF position(v_bad IN v_new) = 0 THEN
    RAISE EXCEPTION '0551: block-reason literal not found in hq_mntnc_cleanup_tenant_orders';
  END IF;
  v_new := replace(v_new, v_bad, v_good);

  -- (2) the uncovered-reference scan must treat the three tables as covered
  v_pos := position('''org_wf_release_mst'', ''org_wf_release_ln''' IN v_new);
  IF v_pos = 0 THEN
    RAISE EXCEPTION '0551: scan exclusion list anchor not found';
  END IF;
  v_new := left(v_new, v_pos - 1)
        || '''org_wf_release_mst'', ''org_wf_release_ln'',' || E'\n        '
        || '''org_order_changes_mst'', ''org_order_change_ops_dtl'', ''org_loyalty_txn_allocs_dtl'''
        || substring(v_new FROM v_pos + length('''org_wf_release_mst'', ''org_wf_release_ln'''));

  -- (3) loyalty allocations go before the loyalty transactions they RESTRICT
  v_pos := position('DELETE FROM public.org_loyalty_txn_dtl AS x' IN v_new);
  IF v_pos = 0 THEN
    RAISE EXCEPTION '0551: loyalty transaction DELETE anchor not found';
  END IF;
  v_new := left(v_new, v_pos - 1) || v_alloc || substring(v_new FROM v_pos);

  -- (4) order-change rows go before preferences / pieces / items (ops RESTRICT all three)
  v_pos := position('DELETE FROM public.org_order_preferences_dtl AS x' IN v_new);
  IF v_pos = 0 THEN
    RAISE EXCEPTION '0551: order preferences DELETE anchor not found';
  END IF;
  v_new := left(v_new, v_pos - 1) || v_ops || substring(v_new FROM v_pos);

  IF v_new = v_def THEN
    RAISE EXCEPTION '0551: nothing changed';
  END IF;
  EXECUTE v_new;
END $$;

-- Verification: the live function carries every edit.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'hq_mntnc_cleanup_tenant_orders';
  IF v_def IS NULL THEN
    RETURN;
  END IF;
  IF position('proceeding.''::text;' IN v_def) = 0
     OR position('DELETE FROM public.org_order_changes_mst' IN v_def) = 0
     OR position('DELETE FROM public.org_order_change_ops_dtl' IN v_def) = 0
     OR position('DELETE FROM public.org_loyalty_txn_allocs_dtl' IN v_def) = 0 THEN
    RAISE EXCEPTION '0551 verification failed: hq_mntnc_cleanup_tenant_orders is missing an edit';
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- Post-apply (by hand): HQ > Tenants > <tenant> > Maintenance > Delete Orders > Preview
-- must now return a payload (blocked only by the real safety cap), not a 500.
-- =============================================================================
