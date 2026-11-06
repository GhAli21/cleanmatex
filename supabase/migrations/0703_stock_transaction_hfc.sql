-- ============================================================
-- Migration: 0703_stock_transaction_hfc.sql
-- Purpose:   Move stock transaction numbering to the atomic HFC engine,
--            repair known duplicate codes without losing their provenance,
--            and enforce tenant-scoped uniqueness and immutability.
-- Affected:  org_inv_stock_tr, org_doc_seq_mst, sys_doc_seq_type_cd,
--            deduct_retail_stock_for_order(uuid,uuid,uuid,text,uuid,text,uuid,text,text,text,text,text,text,text,text)
-- Related:   0101, 0111, 0667, 0669, 0670, 0671
-- ============================================================
--
-- Deployment compatibility:
--   Apply this migration before or with the web-admin change. The assign trigger
--   deliberately replaces a supplied transaction_no, so an older web build that
--   still calculates STK numbers cannot bypass the database counter during rollout.
--
-- Historical repair:
--   Canonical unique codes are retained. For each tenant/code duplicate, the oldest
--   row by transaction_date, created_at, id retains the original code; later rows
--   receive new engine codes. NULL/blank codes also receive engine codes. The former
--   value and prior updated_info are preserved in updated_info for audit review.
--   Nonblank noncanonical values make the migration fail closed for manual review.
--
-- ROLLBACK PLAN (forward-only; use a new migration):
--   Keep the repaired codes, NOT NULL and tenant-scoped unique constraint. A code
--   rollback may replace deduct_retail_stock_for_order and the app writer only if
--   both continue to leave transaction_no to trg_inv_stock_no_assign. Do not restore
--   either MAX/read-latest generator. Dropping the assignment or immutability trigger
--   would violate the HFC contract and requires a separately reviewed replacement.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Prevent a writer from entering between counter seeding, duplicate repair and constraint creation.
LOCK TABLE public.org_inv_stock_tr IN SHARE ROW EXCLUSIVE MODE;

-- Unexpected legacy shapes need an explicit mapping decision rather than silent renumbering.
DO $preflight$
DECLARE
  v_bad_count BIGINT;
  v_bad_sample TEXT;
BEGIN
  SELECT count(*), min(s.transaction_no)
    INTO v_bad_count, v_bad_sample
    FROM public.org_inv_stock_tr s
   WHERE s.transaction_no IS NOT NULL
     AND btrim(s.transaction_no) <> ''
     AND s.transaction_no !~ '^STK-[0-9]{8}-[0-9]{4,18}$';

  IF v_bad_count > 0 THEN
    RAISE EXCEPTION 'STOCK_TRANSACTION_LEGACY_FORMAT_REVIEW_REQUIRED: % row(s), sample %',
      v_bad_count, v_bad_sample;
  END IF;
END
$preflight$;

-- Seed every printed tenant/day before repairing duplicates so replacement codes start above all retained codes.
INSERT INTO public.org_doc_seq_mst (
  tenant_org_id,
  doc_type_code,
  period_key,
  last_value,
  created_by,
  created_info
)
SELECT
  s.tenant_org_id,
  'STOCK_TRANSACTION',
  split_part(s.transaction_no, '-', 2),
  max(split_part(s.transaction_no, '-', 3)::BIGINT),
  'migration',
  '0703 stock transaction HFC seed'
FROM public.org_inv_stock_tr s
WHERE s.transaction_no ~ '^STK-[0-9]{8}-[0-9]{4,18}$'
GROUP BY s.tenant_org_id, split_part(s.transaction_no, '-', 2)
ON CONFLICT (tenant_org_id, doc_type_code, period_key)
DO UPDATE SET
  last_value = greatest(public.org_doc_seq_mst.last_value, EXCLUDED.last_value),
  updated_at = now(),
  updated_by = 'migration',
  updated_info = '0703 stock transaction HFC seed';

-- Promote the registry row only when it still identifies the intended tenant-scoped target.
DO $config$
DECLARE
  v_rows INTEGER;
BEGIN
  UPDATE public.sys_doc_seq_type_cd
     SET manage_by_level = 'GENERAL',
         managed_by_object = NULL,
         implement_description =
           'Engine-managed since migration 0703_stock_transaction_hfc. '
           || 'trg_inv_stock_no_assign always assigns STK-<YYYYMMDD in the tenant time zone>-<sequence pad 4, grows> '
           || 'from fn_doc_seq_next(tenant, ''STOCK_TRANSACTION'') and org_doc_seq_mst. The trigger replaces supplied '
           || 'values so every writer shares the same atomic counter. trg_inv_stock_no_guard keeps transaction_no '
           || 'immutable. deduct_retail_stock_for_order and web-admin inventory-service omit transaction_no. '
           || 'Tenant-scoped uniqueness is uq_inv_stock_tr_no. Check: SELECT transaction_no FROM org_inv_stock_tr '
           || 'WHERE tenant_org_id = $1 ORDER BY transaction_date DESC, id DESC LIMIT 20; counters: SELECT * FROM '
           || 'org_doc_seq_mst WHERE tenant_org_id = $1 AND doc_type_code = ''STOCK_TRANSACTION'' ORDER BY period_key DESC.',
         updated_at = now(),
         updated_by = 'migration',
         updated_info = '0703_stock_transaction_hfc'
   WHERE doc_type_code = 'STOCK_TRANSACTION'
     AND scope_code = 'TENANT_ORG'
     AND target_table = 'org_inv_stock_tr'
     AND target_column = 'transaction_no';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'STOCK_TRANSACTION_CONFIG_MISSING: expected one registry row, updated %', v_rows;
  END IF;
END
$config$;

-- Renumber only duplicate followers and missing codes; preserve the prior value and audit text on each repaired row.
DO $repair$
DECLARE
  r RECORD;
  v_new_code TEXT;
BEGIN
  FOR r IN
    SELECT ranked.id,
           ranked.tenant_org_id,
           ranked.transaction_no,
           ranked.transaction_date,
           ranked.updated_info
      FROM (
        SELECT s.id,
               s.tenant_org_id,
               s.transaction_no,
               s.transaction_date,
               s.created_at,
               s.updated_info,
               row_number() OVER (
                 PARTITION BY s.tenant_org_id, s.transaction_no
                 ORDER BY s.transaction_date, s.created_at NULLS LAST, s.id
               ) AS duplicate_rank
          FROM public.org_inv_stock_tr s
      ) ranked
     WHERE ranked.transaction_no IS NULL
        OR btrim(ranked.transaction_no) = ''
        OR ranked.duplicate_rank > 1
     ORDER BY ranked.tenant_org_id, ranked.transaction_date, ranked.id
  LOOP
    v_new_code := public.fn_doc_seq_next(
      r.tenant_org_id,
      'STOCK_TRANSACTION',
      r.transaction_date
    );

    UPDATE public.org_inv_stock_tr s
       SET transaction_no = v_new_code,
           updated_at = now(),
           updated_by = 'migration',
           updated_info = jsonb_build_object(
             'migration', '0703_stock_transaction_hfc',
             'reason', CASE
               WHEN r.transaction_no IS NULL OR btrim(r.transaction_no) = '' THEN 'MISSING_CODE'
               ELSE 'DUPLICATE_CODE'
             END,
             'previous_transaction_no', r.transaction_no,
             'previous_updated_info', r.updated_info
           )::TEXT
     WHERE s.tenant_org_id = r.tenant_org_id
       AND s.id = r.id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'STOCK_TRANSACTION_REPAIR_LOST_ROW: tenant %, id %', r.tenant_org_id, r.id;
    END IF;
  END LOOP;
END
$repair$;

-- TEXT avoids a future length ceiling when the daily sequence grows beyond its four-digit minimum.
ALTER TABLE public.org_inv_stock_tr
  ALTER COLUMN transaction_no TYPE TEXT,
  ALTER COLUMN transaction_no SET NOT NULL;
COMMENT ON COLUMN public.org_inv_stock_tr.transaction_no IS
  'Immutable human-facing stock movement code assigned only by trg_inv_stock_no_assign: STK-<YYYYMMDD tenant day>-<sequence pad 4, grows>. Unique within tenant_org_id; never calculate in application code.';

-- Enforces the registry unique_with={tenant_org_id} contract after deterministic historical repair.
CREATE UNIQUE INDEX uq_inv_stock_tr_no
  ON public.org_inv_stock_tr (tenant_org_id, transaction_no);
COMMENT ON INDEX public.uq_inv_stock_tr_no IS
  'Prevents duplicate stock transaction codes within an Organization while allowing the same formatted code in different Organizations.';
ALTER TABLE public.org_inv_stock_tr
  ADD CONSTRAINT uq_inv_stock_tr_no
  UNIQUE USING INDEX uq_inv_stock_tr_no;
COMMENT ON CONSTRAINT uq_inv_stock_tr_no ON public.org_inv_stock_tr IS
  'Tenant-scoped uniqueness for the STOCK_TRANSACTION human-friendly code.';

-- Always replacing a supplied value makes the DB the sole numbering authority, including during an old-app deploy window.
CREATE OR REPLACE FUNCTION public.fn_inv_stock_no_assign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  NEW.transaction_no := public.fn_doc_seq_next(
    NEW.tenant_org_id,
    'STOCK_TRANSACTION',
    COALESCE(NEW.transaction_date, now())
  );
  RETURN NEW;
END
$function$;
COMMENT ON FUNCTION public.fn_inv_stock_no_assign() IS
  'BEFORE INSERT authority for org_inv_stock_tr.transaction_no. Always replaces caller input with the atomic STOCK_TRANSACTION counter so legacy or concurrent writers cannot create duplicates.';
-- Only the table trigger may invoke the assignment function directly.
REVOKE ALL ON FUNCTION public.fn_inv_stock_no_assign() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_inv_stock_no_assign
  BEFORE INSERT ON public.org_inv_stock_tr
  FOR EACH ROW EXECUTE FUNCTION public.fn_inv_stock_no_assign();
COMMENT ON TRIGGER trg_inv_stock_no_assign ON public.org_inv_stock_tr IS
  'Assigns every stock transaction code from the shared HFC engine and overrides caller-supplied values during staggered deployments.';

CREATE TRIGGER trg_inv_stock_no_guard
  BEFORE UPDATE OF transaction_no ON public.org_inv_stock_tr
  FOR EACH ROW WHEN (OLD.transaction_no IS DISTINCT FROM NEW.transaction_no)
  EXECUTE FUNCTION public.fn_doc_seq_guard_immutable('transaction_no');
COMMENT ON TRIGGER trg_inv_stock_no_guard ON public.org_inv_stock_tr IS
  'Prevents changing a stock transaction code after insert while allowing unrelated transaction fields to be updated.';

-- Order-driven stock deductions now leave numbering to trg_inv_stock_no_assign; all tenant tables remain explicitly scoped.
CREATE OR REPLACE FUNCTION public.deduct_retail_stock_for_order(
  p_order_id       UUID,
  p_tenant_org_id  UUID,
  p_branch_id      UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT 'ORDER',
  p_reference_id   UUID DEFAULT NULL,
  p_reference_no   TEXT DEFAULT NULL,
  p_user_id        UUID DEFAULT NULL,
  p_user_name      TEXT DEFAULT NULL,
  p_user_info      TEXT DEFAULT NULL,
  p_user_agent     TEXT DEFAULT NULL,
  p_user_device    TEXT DEFAULT NULL,
  p_user_browser   TEXT DEFAULT NULL,
  p_user_os        TEXT DEFAULT NULL,
  p_user_ip        TEXT DEFAULT NULL,
  p_reason         TEXT DEFAULT 'Order sale deduction'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  r RECORD;
  v_qty_to_deduct DECIMAL(19,4);
  v_qty_before    DECIMAL(19,4);
  v_qty_after     DECIMAL(19,4);
  v_created_info  TEXT;
BEGIN
  FOR r IN (
    SELECT oi.product_id, oi.quantity, p.is_retail_item
      FROM public.org_order_items_dtl oi
      JOIN public.org_product_data_mst p
        ON p.id = oi.product_id
       AND p.tenant_org_id = oi.tenant_org_id
     WHERE oi.order_id = p_order_id
       AND oi.tenant_org_id = p_tenant_org_id
       AND oi.product_id IS NOT NULL
       AND p.is_retail_item = true
       AND p.service_category_code = 'RETAIL_ITEMS'
       AND oi.service_category_code = 'RETAIL_ITEMS'
  ) LOOP
    v_qty_to_deduct := r.quantity;

    IF p_branch_id IS NOT NULL THEN
      INSERT INTO public.org_inv_stock_by_branch (
        tenant_org_id, product_id, branch_id,
        qty_on_hand, reorder_point, min_stock_level, max_stock_level,
        last_purchase_cost, storage_location, id_sku
      )
      SELECT
        p_tenant_org_id, r.product_id, p_branch_id,
        0,
        COALESCE(p.reorder_point, 0),
        COALESCE(p.min_stock_level, 0),
        p.max_stock_level,
        p.last_purchase_cost,
        p.storage_location,
        p.id_sku
      FROM public.org_product_data_mst p
      WHERE p.id = r.product_id
        AND p.tenant_org_id = p_tenant_org_id
      ON CONFLICT (tenant_org_id, product_id, branch_id) DO NOTHING;

      SELECT b.qty_on_hand
        INTO v_qty_before
        FROM public.org_inv_stock_by_branch b
       WHERE b.tenant_org_id = p_tenant_org_id
         AND b.product_id = r.product_id
         AND b.branch_id = p_branch_id
       FOR UPDATE;

      v_qty_after := COALESCE(v_qty_before, 0) - v_qty_to_deduct;

      UPDATE public.org_inv_stock_by_branch b
         SET qty_on_hand = v_qty_after,
             updated_at = now()
       WHERE b.tenant_org_id = p_tenant_org_id
         AND b.product_id = r.product_id
         AND b.branch_id = p_branch_id;
    ELSE
      SELECT p.qty_on_hand
        INTO v_qty_before
        FROM public.org_product_data_mst p
       WHERE p.id = r.product_id
         AND p.tenant_org_id = p_tenant_org_id
       FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: Product % not found', r.product_id;
      END IF;

      v_qty_after := COALESCE(v_qty_before, 0) - v_qty_to_deduct;

      UPDATE public.org_product_data_mst p
         SET qty_on_hand = v_qty_after,
             updated_at = now()
       WHERE p.id = r.product_id
         AND p.tenant_org_id = p_tenant_org_id;
    END IF;

    SELECT CASE
      WHEN p_user_info IS NULL AND p_user_agent IS NULL AND p_user_device IS NULL
       AND p_user_browser IS NULL AND p_user_os IS NULL AND p_user_ip IS NULL
      THEN NULL
      ELSE json_build_object(
        'user_info', p_user_info,
        'user_agent', p_user_agent,
        'user_device', p_user_device,
        'user_browser', p_user_browser,
        'user_os', p_user_os,
        'user_ip', p_user_ip
      )::TEXT
    END INTO v_created_info;

    INSERT INTO public.org_inv_stock_tr (
      tenant_org_id, product_id, branch_id,
      transaction_type, quantity,
      qty_before, qty_after,
      reference_type, reference_id, reference_no,
      reason, processed_by, created_by, created_info,
      is_active, rec_status
    ) VALUES (
      p_tenant_org_id, r.product_id, p_branch_id,
      'STOCK_OUT', -v_qty_to_deduct,
      v_qty_before, v_qty_after,
      COALESCE(NULLIF(trim(p_reference_type), ''), 'ORDER'),
      COALESCE(p_reference_id, p_order_id),
      COALESCE(
        p_reference_no,
        (
          SELECT o.order_no
            FROM public.org_orders_mst o
           WHERE o.id = p_order_id
             AND o.tenant_org_id = p_tenant_org_id
           LIMIT 1
        )
      ),
      COALESCE(NULLIF(trim(p_reason), ''), 'Order sale deduction'),
      p_user_id,
      p_user_name,
      v_created_info,
      true,
      1
    );
  END LOOP;
END
$function$;
COMMENT ON FUNCTION public.deduct_retail_stock_for_order(UUID, UUID, UUID, TEXT, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'Deducts retail stock for one tenant/order and writes one org_inv_stock_tr row per retail item. Branch stock is locked and updated when p_branch_id is present; otherwise the tenant product row is locked and updated. transaction_no is intentionally omitted so trg_inv_stock_no_assign uses the shared atomic HFC counter.';
-- CREATE OR REPLACE retains the existing owner and EXECUTE privileges; no grant boundary changes in this migration.

COMMIT;
