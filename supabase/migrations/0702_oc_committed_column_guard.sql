-- Committed-order column guard (Order Edit V2, WP17 postponed item).
--
-- Problem: anon and authenticated hold INSERT / UPDATE / DELETE on the five order tables.
-- Row security keeps a session inside its own organization, but inside it a signed-in user
-- could change a committed order's quantity, price, preferences or totals straight through
-- the data API, skipping Edit Order policy, review, proof and audit.
--
-- Fix: one trigger function on the five tables. For a session running as anon or
-- authenticated, on a committed order (committed_at set):
--   * order lines, pieces, preferences and charges cannot be added or removed;
--   * the money / structure columns listed per table cannot change.
-- Workflow columns (status, stage, scan, rack, readiness, issues, processing confirmation,
-- follow-up notes, customer merge) are not listed and stay writable.
--
-- Not limited: postgres (Prisma, where Edit Apply, the financial snapshot, payments and
-- charge void run), service_role (server-only key) and SECURITY DEFINER functions (their
-- current_user is the owner). Grants are not revoked: Create and workflow need them.
-- Migrations 0113 and 0627 stay unchanged.
--
-- Not repeated here: the existing oc_order_foundation_guard trigger on org_orders_mst already
-- refuses deleting a committed order and changing committed_at / committed_by once set (for
-- every role), so a committed order cannot be "un-committed" to get past this guard.

BEGIN;

-- Trigger function. TG_ARGV carries the protected column names of the table it is attached to.
CREATE OR REPLACE FUNCTION public.oc_guard_committed_cols()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_col text;
  v_committed boolean := false;
BEGIN
  -- Only the data-API roles are limited; server writers own committed-order money.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP <> 'INSERT' THEN v_old := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN v_new := to_jsonb(NEW); END IF;

  IF TG_TABLE_NAME = 'org_orders_mst' THEN
    v_committed := (v_old ->> 'committed_at') IS NOT NULL;
  ELSE
    -- Old and new parent: a row cannot leave or enter a committed order either.
    IF v_old IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.org_orders_mst o
        WHERE o.tenant_org_id = (v_old ->> 'tenant_org_id')::uuid
          AND o.id = (v_old ->> 'order_id')::uuid
          AND o.committed_at IS NOT NULL
      ) INTO v_committed;
    END IF;
    IF NOT v_committed AND v_new IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.org_orders_mst o
        WHERE o.tenant_org_id = (v_new ->> 'tenant_org_id')::uuid
          AND o.id = (v_new ->> 'order_id')::uuid
          AND o.committed_at IS NOT NULL
      ) INTO v_committed;
    END IF;
  END IF;

  IF NOT v_committed THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP IN ('INSERT', 'DELETE') THEN
    RAISE EXCEPTION 'Rows of a committed order cannot be added or removed directly (%); use Edit Order', TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;

  FOREACH v_col IN ARRAY TG_ARGV LOOP
    IF (v_old -> v_col) IS DISTINCT FROM (v_new -> v_col) THEN
      RAISE EXCEPTION 'Committed order field %.% cannot be changed directly; use Edit Order', TG_TABLE_NAME, v_col
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.oc_guard_committed_cols() IS
  'Order Edit V2 guard: for anon/authenticated sessions, a committed order''s rows cannot be added or removed and the protected columns passed as trigger arguments cannot change. Server roles and SECURITY DEFINER functions are not limited.';

-- Protected columns per table, checked against the catalog, then attached as trigger arguments.
-- One list per table keeps the check and the trigger in step; a missing column fails the migration.
DO $guard$
DECLARE
  v_spec record;
  v_col text;
  v_args text;
BEGIN
  FOR v_spec IN
    SELECT * FROM (VALUES
      ('org_orders_mst', 'oc_order_committed_cols_guard', 'BEFORE UPDATE',
       ARRAY[
         'tenant_org_id', 'branch_id', 'parent_order_id', 'root_order_id', 'total_items',
         'currency_code', 'currency_ex_rate', 'tax_rate', 'vat_rate', 'discount_rate', 'discount_type',
         'promo_code_id', 'gift_card_id', 'payment_type_code', 'payment_terms', 'payment_status',
         'paid_at', 'paid_by', 'is_retail', 'b2b_contract_id', 'service_speed',
         'commercial_level', 'tax_pricing_mode', 'extra_price_pricing_mode', 'disc_alloc_mode',
         'disc_alloc_basis', 'commercial_calc_version', 'financial_engine_version',
         'subtotal_amount', 'items_base_amount', 'total_amount', 'speed_premium_amount',
         'piece_extra_price_amount', 'preference_extra_price_amount', 'service_charge_amount',
         'delivery_charge_amount', 'express_charge_amount', 'other_charges_amount',
         'total_charges_amount', 'total_discount_amount', 'total_tax_amount', 'taxable_amount',
         'non_taxable_amount', 'exempt_amount', 'zero_rated_amount', 'out_of_scope_amount',
         'rounding_adjustment_amount', 'total_credit_applied_amount', 'total_paid_amount',
         'pay_on_collection_amount', 'change_returned_amount', 'outstanding_amount', 'overpaid_amount',
         'refunded_amount', 'real_payment_refunded_amount', 'stored_value_restored_amount',
         'customer_credit_issued_amount', 'net_collected_amount', 'pending_payment_amount',
         'authorized_payment_amount', 'failed_payment_amount', 'refund_reopens_due_amount',
         'credit_reversal_reopens_due_amount', 'credit_reversed_amount',
         'pending_credit_application_amount', 'failed_credit_application_amount',
         'ar_receivable_amount', 'ar_invoice_id', 'ar_invoice_no', 'ar_invoice_status',
         'tax_document_id', 'tax_document_no', 'tax_document_status', 'tax_document_type',
         'financial_last_calculated_at', 'financial_last_calculated_by', 'financial_snapshot_status',
         'financial_mismatch_warning_count', 'financial_calculation_snapshot',
         'financial_calculation_hash', 'financial_calculation_trace_id',
         'base_cur_currency_code', 'base_cur_total_amount', 'base_cur_tax_amount',
         'base_cur_paid_amount', 'base_cur_credit_applied_amount', 'base_cur_outstanding_amount',
         'base_cur_ar_receivable_amount', 'edit_state_version', 'edit_access_status',
         'edit_block_reason_code', 'edit_block_reason_text', 'edit_blocked_at', 'edit_blocked_by',
         'edit_block_until'
       ]),
      ('org_order_items_dtl', 'oc_item_committed_cols_guard', 'BEFORE INSERT OR UPDATE OR DELETE',
       ARRAY[
         'tenant_org_id', 'order_id', 'service_category_code', 'product_id', 'product_name',
         'product_name2', 'quantity', 'price_per_unit', 'total_price', 'notes', 'color', 'brand',
         'has_stain', 'has_damage', 'stain_notes', 'damage_notes', 'price_override', 'override_reason',
         'override_by', 'packing_pref_code', 'packing_pref_is_override', 'packing_pref_source',
         'service_pref_charge', 'rec_status', 'deleted_at', 'deleted_by', 'deleted_order_change_id',
         'money_basis', 'service_speed', 'ready_by_at', 'price_source', 'price_list_id', 'speed_rule_id',
         'list_unit_price', 'speed_premium_amount', 'line_disc_amount', 'order_disc_alloc_amount',
         'net_amount', 'tax_pricing_mode', 'tax_profile_id', 'tax_category_code', 'tax_exempt_reason',
         'tax_rate', 'taxable_amount', 'tax_amount', 'line_total_amount'
       ]),
      ('org_order_item_pieces_dtl', 'oc_piece_committed_cols_guard', 'BEFORE INSERT OR UPDATE OR DELETE',
       ARRAY[
         'tenant_org_id', 'order_id', 'order_item_id', 'service_category_code', 'product_id',
         'quantity', 'price_per_unit', 'total_price', 'notes', 'color', 'brand', 'has_stain',
         'has_damage', 'packing_pref_code', 'service_pref_charge', 'rec_status', 'deleted_at',
         'deleted_by', 'deleted_order_change_id', 'money_basis', 'service_speed', 'ready_by_at',
         'price_source', 'price_list_id', 'speed_rule_id', 'list_unit_price', 'speed_premium_amount',
         'line_disc_amount', 'order_disc_alloc_amount', 'net_amount', 'tax_pricing_mode',
         'tax_profile_id', 'tax_category_code', 'tax_exempt_reason', 'tax_rate', 'taxable_amount',
         'tax_amount', 'line_total_amount'
       ]),
      ('org_order_preferences_dtl', 'oc_pref_committed_cols_guard', 'BEFORE INSERT OR UPDATE OR DELETE',
       ARRAY[
         'tenant_org_id', 'order_id', 'order_item_id', 'order_item_piece_id', 'prefs_level',
         'preference_id', 'preference_code', 'preference_sys_kind', 'preference_category',
         'preference_content', 'extra_price', 'extra_price_pricing_mode', 'price_basis',
         'list_extra_price', 'is_price_override', 'bundle_code', 'bundle_discount_amt',
         'extra_turnaround_min', 'rec_status', 'deleted_at', 'deleted_by', 'deleted_order_change_id'
       ]),
      ('org_order_charges_dtl', 'oc_charge_committed_cols_guard', 'BEFORE INSERT OR UPDATE OR DELETE',
       ARRAY[
         'tenant_org_id', 'order_id', 'charge_type', 'charge_source_id', 'amount', 'currency_code',
         'exchange_rate', 'is_voided', 'voided_at', 'voided_by', 'void_reason', 'rec_status',
         'tax_category_code', 'tax_profile_id', 'tax_rate', 'taxable_amount', 'tax_amount'
       ])
    ) AS s(tbl, trg, timing, cols)
  LOOP
    FOREACH v_col IN ARRAY v_spec.cols LOOP
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = v_spec.tbl AND column_name = v_col
      ) THEN
        RAISE EXCEPTION 'Guard column %.% does not exist', v_spec.tbl, v_col;
      END IF;
    END LOOP;

    SELECT string_agg(quote_literal(c), ', ') INTO v_args FROM unnest(v_spec.cols) AS c;

    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I RESTRICT', v_spec.trg, v_spec.tbl);
    EXECUTE format(
      'CREATE TRIGGER %I %s ON public.%I FOR EACH ROW EXECUTE FUNCTION public.oc_guard_committed_cols(%s)',
      v_spec.trg, v_spec.timing, v_spec.tbl, v_args
    );
    EXECUTE format(
      'COMMENT ON TRIGGER %I ON public.%I IS %L',
      v_spec.trg, v_spec.tbl,
      'Order Edit V2: blocks anon/authenticated money and structure changes on a committed order; workflow columns stay writable. Arguments are the protected columns.'
    );
  END LOOP;
END;
$guard$;

COMMIT;
