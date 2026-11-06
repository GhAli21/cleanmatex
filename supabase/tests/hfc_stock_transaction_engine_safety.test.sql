-- =============================================================================
-- hfc_stock_transaction_engine_safety.test.sql
-- Purpose: Post-apply safety checks for 0703_stock_transaction_hfc.
--
-- Run only after the user applies migration 0703 to an approved local database:
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/hfc_stock_transaction_engine_safety.test.sql
--
-- The script verifies the permanent schema/data invariants, then inserts temporary
-- stock movements to prove database-only numbering and immutability. The transaction
-- is rolled back, so no fixture row or counter increment remains.
-- =============================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TEMP TABLE zz_stock_ctx (
  tenant_org_id UUID,
  product_id UUID,
  branch_id UUID
) ON COMMIT DROP;

INSERT INTO zz_stock_ctx (tenant_org_id, product_id, branch_id)
SELECT s.tenant_org_id, s.product_id, s.branch_id
  FROM public.org_inv_stock_tr s
 WHERE s.branch_id IS NOT NULL
 ORDER BY s.created_at NULLS LAST, s.id
 LIMIT 1;

-- Registry, column and uniqueness contracts ---------------------------------------------------------------
DO $schema$
DECLARE
  r public.sys_doc_seq_type_cd%ROWTYPE;
  v_duplicate_count BIGINT;
  v_error_count BIGINT;
  v_function_definition TEXT;
BEGIN
  SELECT * INTO r
    FROM public.sys_doc_seq_type_cd
   WHERE doc_type_code = 'STOCK_TRANSACTION';

  IF NOT FOUND
     OR r.manage_by_level IS DISTINCT FROM 'GENERAL'
     OR r.target_table IS DISTINCT FROM 'org_inv_stock_tr'
     OR r.target_column IS DISTINCT FROM 'transaction_no'
     OR r.prefix IS DISTINCT FROM 'STK'
     OR r.parts_format IS DISTINCT FROM 'YYYYMMDD-SEQ'
     OR r.seq_pad_length IS DISTINCT FROM 4
     OR r.reset_policy IS DISTINCT FROM 'DAILY' THEN
    RAISE EXCEPTION 'FAIL schema: STOCK_TRANSACTION registry row is not the expected GENERAL STK daily type';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_attribute a
     WHERE a.attrelid = 'public.org_inv_stock_tr'::regclass
       AND a.attname = 'transaction_no'
       AND a.attnotnull
       AND a.atttypid = 'text'::regtype
  ) THEN
    RAISE EXCEPTION 'FAIL schema: org_inv_stock_tr.transaction_no is not TEXT NOT NULL';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
     WHERE c.conrelid = 'public.org_inv_stock_tr'::regclass
       AND c.conname = 'uq_inv_stock_tr_no'
       AND c.contype = 'u'
  ) THEN
    RAISE EXCEPTION 'FAIL schema: tenant-scoped unique constraint uq_inv_stock_tr_no is missing';
  END IF;

  IF (
    SELECT count(*)
      FROM pg_trigger t
     WHERE t.tgrelid = 'public.org_inv_stock_tr'::regclass
       AND t.tgname IN ('trg_inv_stock_no_assign', 'trg_inv_stock_no_guard')
       AND NOT t.tgisinternal
  ) <> 2 THEN
    RAISE EXCEPTION 'FAIL schema: assignment/immutability trigger pair is missing';
  END IF;

  SELECT count(*) INTO v_duplicate_count
    FROM (
      SELECT s.tenant_org_id, s.transaction_no
        FROM public.org_inv_stock_tr s
       GROUP BY s.tenant_org_id, s.transaction_no
      HAVING count(*) > 1
    ) duplicates;
  IF v_duplicate_count <> 0 THEN
    RAISE EXCEPTION 'FAIL data: % duplicate tenant/code group(s) remain', v_duplicate_count;
  END IF;

  SELECT count(*) INTO v_error_count
    FROM public.vw_doc_seq_consistency c
   WHERE c.doc_type_code = 'STOCK_TRANSACTION'
     AND c.severity = 'ERROR';
  IF v_error_count <> 0 THEN
    RAISE EXCEPTION 'FAIL consistency: STOCK_TRANSACTION still has % ERROR check(s)', v_error_count;
  END IF;

  SELECT pg_get_functiondef(
    'public.deduct_retail_stock_for_order(uuid,uuid,uuid,text,uuid,text,uuid,text,text,text,text,text,text,text,text)'::regprocedure
  ) INTO v_function_definition;
  IF v_function_definition ~ 'v_trans_no|lpad\s*\(\s*v_seq' THEN
    RAISE EXCEPTION 'FAIL writer: deduct_retail_stock_for_order still generates STK numbers';
  END IF;

  RAISE NOTICE 'PASS schema/data: GENERAL registry, TEXT NOT NULL, unique constraint, triggers, no duplicates/errors';
END
$schema$;

-- Trigger authority and immutability -----------------------------------------------------------------------
DO $behavior$
DECLARE
  v_tenant UUID := (SELECT tenant_org_id FROM zz_stock_ctx LIMIT 1);
  v_product UUID := (SELECT product_id FROM zz_stock_ctx LIMIT 1);
  v_branch UUID := (SELECT branch_id FROM zz_stock_ctx LIMIT 1);
  v_id UUID;
  v_first TEXT;
  v_second TEXT;
  v_guarded BOOLEAN := false;
BEGIN
  IF v_tenant IS NULL OR v_product IS NULL OR v_branch IS NULL THEN
    RAISE NOTICE 'SKIP behavior: no existing branch-scoped stock transaction fixture';
    RETURN;
  END IF;

  INSERT INTO public.org_inv_stock_tr (
    tenant_org_id, product_id, branch_id, transaction_no,
    transaction_type, quantity, qty_before, qty_after,
    reference_type, reason, created_by, created_info
  ) VALUES (
    v_tenant, v_product, v_branch, 'STK-19990101-0001',
    'ADJUSTMENT', 0, 0, 0,
    'MANUAL', '0703 safety test', 'test', 'hfc_stock_transaction_engine_safety'
  )
  RETURNING id, transaction_no INTO v_id, v_first;

  INSERT INTO public.org_inv_stock_tr (
    tenant_org_id, product_id, branch_id, transaction_no,
    transaction_type, quantity, qty_before, qty_after,
    reference_type, reason, created_by, created_info
  ) VALUES (
    v_tenant, v_product, v_branch, 'STK-19990101-0001',
    'ADJUSTMENT', 0, 0, 0,
    'MANUAL', '0703 safety test', 'test', 'hfc_stock_transaction_engine_safety'
  )
  RETURNING transaction_no INTO v_second;

  IF v_first = 'STK-19990101-0001' OR v_second = 'STK-19990101-0001' THEN
    RAISE EXCEPTION 'FAIL behavior: caller-supplied transaction_no was not replaced (% / %)', v_first, v_second;
  END IF;
  IF v_first !~ '^STK-[0-9]{8}-[0-9]{4,}$'
     OR v_second !~ '^STK-[0-9]{8}-[0-9]{4,}$'
     OR v_first = v_second THEN
    RAISE EXCEPTION 'FAIL behavior: expected two distinct engine codes, got % / %', v_first, v_second;
  END IF;

  BEGIN
    UPDATE public.org_inv_stock_tr s
       SET transaction_no = 'STK-19990101-9999'
     WHERE s.tenant_org_id = v_tenant
       AND s.id = v_id;
  EXCEPTION WHEN raise_exception THEN
    v_guarded := SQLERRM LIKE 'DOC_SEQ_CODE_IMMUTABLE%';
  END;
  IF NOT v_guarded THEN
    RAISE EXCEPTION 'FAIL behavior: transaction_no mutation was not blocked';
  END IF;

  UPDATE public.org_inv_stock_tr s
     SET notes = 'unrelated fields remain editable'
   WHERE s.tenant_org_id = v_tenant
     AND s.id = v_id;

  RAISE NOTICE 'PASS behavior: supplied values overridden, sequential codes distinct, code immutable (% / %)',
    v_first, v_second;
END
$behavior$;

ROLLBACK;
