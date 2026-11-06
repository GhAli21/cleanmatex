-- =============================================================================
-- 0699_line_money_not_null_checks.sql
-- Line-Level Money Snapshot, P10-03 / M10 (PLAN.md §6.1, §6.4, §5.2 I5, §12).
--
-- Why: every order line and piece is now written by the commercial calculator
-- (Create, Edit) or by the split, which writes zero figures. The legacy writers
-- that left these columns empty are removed. This migration makes the database
-- refuse a line without its figures, so a future writer cannot store one.
--
-- Changes:
--   1. org_order_items_dtl and org_order_item_pieces_dtl:
--      - NOT NULL on the line money columns the calculator always writes.
--      - The code CHECKs on money_basis, price_source and tax_pricing_mode no
--        longer accept NULL. A piece is never ROLLUP. SPEED_RULE is dropped from
--        price_source (never written; the rule is on speed_rule_id).
--      - A list price source names its list; a speed premium names its rule.
--      - Money columns are never negative (speed_premium_amount excepted).
--      - New CHECK for invariant I5 on every row:
--        net_amount = total_price - line_disc_amount - order_disc_alloc_amount
--        line_total_amount = net_amount + tax_amount (TAX_EXCLUSIVE)
--                          = net_amount              (TAX_INCLUSIVE)
--   2. org_order_discounts_dtl: discount_level is NOT NULL; its CHECKs no longer
--      accept NULL; a PIECE row also names its line (the writer always sets both).
--   3. fix_order_data: never adds or removes pieces on a calculator order or a
--      split sub-order (their pieces are exact by construction, and a piece it
--      added would have no line figures). Security fix: anonymous callers lose
--      EXECUTE, and a signed-in user is limited to their own organization.
--
-- Left nullable by design: ready_by_at, price_list_id, speed_rule_id,
-- tax_profile_id, tax_exempt_reason (items and pieces); disc_alloc_mode and
-- tax_category_code (discounts); the charge tax columns (an untaxed charge has
-- none); the order header (a sub-order has no commercial_calc_version).
--
-- Fails, and changes nothing, if any existing row breaks a rule (remote and
-- local had 0 order lines when this was written).
-- =============================================================================

BEGIN;

-- ─── 1. Items ───────────────────────────────────────────────────────────────
ALTER TABLE public.org_order_items_dtl
  ALTER COLUMN money_basis SET NOT NULL,
  ALTER COLUMN service_speed SET NOT NULL,
  ALTER COLUMN price_source SET NOT NULL,
  ALTER COLUMN list_unit_price SET NOT NULL,
  ALTER COLUMN speed_premium_amount SET NOT NULL,
  ALTER COLUMN line_disc_amount SET NOT NULL,
  ALTER COLUMN order_disc_alloc_amount SET NOT NULL,
  ALTER COLUMN net_amount SET NOT NULL,
  ALTER COLUMN tax_pricing_mode SET NOT NULL,
  ALTER COLUMN tax_category_code SET NOT NULL,
  ALTER COLUMN tax_rate SET NOT NULL,
  ALTER COLUMN taxable_amount SET NOT NULL,
  ALTER COLUMN tax_amount SET NOT NULL,
  ALTER COLUMN line_total_amount SET NOT NULL;

-- Replaced: the same code lists, without the NULL branch.
ALTER TABLE public.org_order_items_dtl DROP CONSTRAINT chk_oid_money_basis RESTRICT;
ALTER TABLE public.org_order_items_dtl DROP CONSTRAINT chk_oid_price_source RESTRICT;
ALTER TABLE public.org_order_items_dtl DROP CONSTRAINT chk_oid_tax_pricing_mode RESTRICT;

ALTER TABLE public.org_order_items_dtl
  ADD CONSTRAINT chk_oid_money_basis
    CHECK (money_basis IN ('PRICED', 'ALLOCATED', 'ROLLUP')),
  -- SPEED_RULE is no longer accepted: it was never written; the rule is recorded on speed_rule_id.
  ADD CONSTRAINT chk_oid_price_source
    CHECK (price_source IN ('PRICE_LIST', 'PRODUCT_DEFAULT', 'CUSTOMER_PRICE', 'MANUAL')),
  ADD CONSTRAINT chk_oid_tax_pricing_mode
    CHECK (tax_pricing_mode IN ('TAX_INCLUSIVE', 'TAX_EXCLUSIVE')),
  ADD CONSTRAINT chk_oid_price_src_list
    CHECK ((price_source IN ('PRICE_LIST', 'CUSTOMER_PRICE')) = (price_list_id IS NOT NULL)),
  ADD CONSTRAINT chk_oid_speed_rule_link
    CHECK (
      -- A ROLLUP item only sums its pieces, which name their own rules.
      money_basis = 'ROLLUP'
      OR ((speed_premium_amount = 0 OR speed_rule_id IS NOT NULL)
          AND (service_speed <> 'STANDARD' OR speed_rule_id IS NULL))
    ),
  ADD CONSTRAINT chk_oid_money_nonneg
    CHECK (
      list_unit_price >= 0 AND line_disc_amount >= 0 AND order_disc_alloc_amount >= 0
      AND net_amount >= 0 AND tax_rate >= 0 AND taxable_amount >= 0
      AND tax_amount >= 0 AND line_total_amount >= 0
    ),
  ADD CONSTRAINT chk_oid_line_money_i5
    CHECK (
      net_amount = total_price - line_disc_amount - order_disc_alloc_amount
      AND line_total_amount = net_amount
        + CASE WHEN tax_pricing_mode = 'TAX_EXCLUSIVE' THEN tax_amount ELSE 0 END
    );

COMMENT ON CONSTRAINT chk_oid_money_basis ON public.org_order_items_dtl IS
  'ITEM level: the item is PRICED (or ALLOCATED on a split sub-order line). PIECE level: the item is the ROLLUP of its pieces.';
COMMENT ON CONSTRAINT chk_oid_price_source ON public.org_order_items_dtl IS
  'Where the unit price came from: a price list, the product default, the customer''s list, or MANUAL (cashier override or custom item).';
COMMENT ON CONSTRAINT chk_oid_tax_pricing_mode ON public.org_order_items_dtl IS
  'The order''s tax pricing mode, copied to every line (I6).';
COMMENT ON CONSTRAINT chk_oid_price_src_list ON public.org_order_items_dtl IS
  'A price taken from a list names that list; any other source names none.';
COMMENT ON CONSTRAINT chk_oid_speed_rule_link ON public.org_order_items_dtl IS
  'A priced or allocated row with a speed premium names the rule that set it; Standard speed has no rule. A ROLLUP item is exempt: its pieces carry the rules.';
COMMENT ON CONSTRAINT chk_oid_money_nonneg ON public.org_order_items_dtl IS
  'Prices, discounts, tax and totals are never negative. speed_premium_amount is left out: a speed sell price may be below the normal price.';
COMMENT ON CONSTRAINT chk_oid_line_money_i5 ON public.org_order_items_dtl IS
  'Invariant I5: net = gross - line discount - order discount share; line total = net + tax when tax-exclusive, else net.';

-- ─── 1b. Pieces (identical columns, §6.1) ───────────────────────────────────
ALTER TABLE public.org_order_item_pieces_dtl
  ALTER COLUMN money_basis SET NOT NULL,
  ALTER COLUMN service_speed SET NOT NULL,
  ALTER COLUMN price_source SET NOT NULL,
  ALTER COLUMN list_unit_price SET NOT NULL,
  ALTER COLUMN speed_premium_amount SET NOT NULL,
  ALTER COLUMN line_disc_amount SET NOT NULL,
  ALTER COLUMN order_disc_alloc_amount SET NOT NULL,
  ALTER COLUMN net_amount SET NOT NULL,
  ALTER COLUMN tax_pricing_mode SET NOT NULL,
  ALTER COLUMN tax_category_code SET NOT NULL,
  ALTER COLUMN tax_rate SET NOT NULL,
  ALTER COLUMN taxable_amount SET NOT NULL,
  ALTER COLUMN tax_amount SET NOT NULL,
  ALTER COLUMN line_total_amount SET NOT NULL;

ALTER TABLE public.org_order_item_pieces_dtl DROP CONSTRAINT chk_opd_money_basis RESTRICT;
ALTER TABLE public.org_order_item_pieces_dtl DROP CONSTRAINT chk_opd_price_source RESTRICT;
ALTER TABLE public.org_order_item_pieces_dtl DROP CONSTRAINT chk_opd_tax_pricing_mode RESTRICT;

ALTER TABLE public.org_order_item_pieces_dtl
  ADD CONSTRAINT chk_opd_money_basis
    CHECK (money_basis IN ('PRICED', 'ALLOCATED')),
  -- SPEED_RULE is no longer accepted: it was never written; the rule is recorded on speed_rule_id.
  ADD CONSTRAINT chk_opd_price_source
    CHECK (price_source IN ('PRICE_LIST', 'PRODUCT_DEFAULT', 'CUSTOMER_PRICE', 'MANUAL')),
  ADD CONSTRAINT chk_opd_tax_pricing_mode
    CHECK (tax_pricing_mode IN ('TAX_INCLUSIVE', 'TAX_EXCLUSIVE')),
  ADD CONSTRAINT chk_opd_price_src_list
    CHECK ((price_source IN ('PRICE_LIST', 'CUSTOMER_PRICE')) = (price_list_id IS NOT NULL)),
  ADD CONSTRAINT chk_opd_speed_rule_link
    CHECK (
      -- A ROLLUP item only sums its pieces, which name their own rules.
      money_basis = 'ROLLUP'
      OR ((speed_premium_amount = 0 OR speed_rule_id IS NOT NULL)
          AND (service_speed <> 'STANDARD' OR speed_rule_id IS NULL))
    ),
  ADD CONSTRAINT chk_opd_money_nonneg
    CHECK (
      list_unit_price >= 0 AND line_disc_amount >= 0 AND order_disc_alloc_amount >= 0
      AND net_amount >= 0 AND tax_rate >= 0 AND taxable_amount >= 0
      AND tax_amount >= 0 AND line_total_amount >= 0
    ),
  ADD CONSTRAINT chk_opd_line_money_i5
    CHECK (
      net_amount = total_price - line_disc_amount - order_disc_alloc_amount
      AND line_total_amount = net_amount
        + CASE WHEN tax_pricing_mode = 'TAX_EXCLUSIVE' THEN tax_amount ELSE 0 END
    );

COMMENT ON CONSTRAINT chk_opd_money_basis ON public.org_order_item_pieces_dtl IS
  'ITEM level: the piece is an exact ALLOCATED share of its item. PIECE level: the piece is PRICED. A piece is never a rollup.';
COMMENT ON CONSTRAINT chk_opd_price_source ON public.org_order_item_pieces_dtl IS
  'Where the unit price came from: a price list, the product default, the customer''s list, or MANUAL (cashier override or custom item).';
COMMENT ON CONSTRAINT chk_opd_tax_pricing_mode ON public.org_order_item_pieces_dtl IS
  'The order''s tax pricing mode, copied to every piece (I6).';
COMMENT ON CONSTRAINT chk_opd_price_src_list ON public.org_order_item_pieces_dtl IS
  'A price taken from a list names that list; any other source names none.';
COMMENT ON CONSTRAINT chk_opd_speed_rule_link ON public.org_order_item_pieces_dtl IS
  'A priced or allocated row with a speed premium names the rule that set it; Standard speed has no rule. A ROLLUP item is exempt: its pieces carry the rules.';
COMMENT ON CONSTRAINT chk_opd_money_nonneg ON public.org_order_item_pieces_dtl IS
  'Prices, discounts, tax and totals are never negative. speed_premium_amount is left out: a speed sell price may be below the normal price.';
COMMENT ON CONSTRAINT chk_opd_line_money_i5 ON public.org_order_item_pieces_dtl IS
  'Invariant I5: net = gross - line discount - order discount share; line total = net + tax when tax-exclusive, else net.';

-- ─── 2. Discounts ───────────────────────────────────────────────────────────
ALTER TABLE public.org_order_discounts_dtl
  ALTER COLUMN discount_level SET NOT NULL;

ALTER TABLE public.org_order_discounts_dtl DROP CONSTRAINT chk_ood_discount_level RESTRICT;
ALTER TABLE public.org_order_discounts_dtl DROP CONSTRAINT chk_ood_level_matches_refs RESTRICT;

ALTER TABLE public.org_order_discounts_dtl
  ADD CONSTRAINT chk_ood_discount_level
    CHECK (discount_level IN ('ORDER', 'ITEM', 'PIECE')),
  ADD CONSTRAINT chk_ood_level_matches_refs
    CHECK (
      (discount_level = 'ORDER' AND order_item_id IS NULL AND order_item_piece_id IS NULL)
      OR (discount_level = 'ITEM' AND order_item_id IS NOT NULL AND order_item_piece_id IS NULL)
      OR (discount_level = 'PIECE' AND order_item_id IS NOT NULL AND order_item_piece_id IS NOT NULL)
    );

COMMENT ON CONSTRAINT chk_ood_discount_level ON public.org_order_discounts_dtl IS
  'What the discount reduces: the whole order, one line, or one piece.';
COMMENT ON CONSTRAINT chk_ood_level_matches_refs ON public.org_order_discounts_dtl IS
  'An ORDER row names no line or piece; an ITEM row names its line only; a PIECE row names its line and its piece.';

-- ─── 3. fix_order_data: skip calculator orders and sub-orders ───────────────
-- Same signature and result shape as before; only the order filters change.
CREATE OR REPLACE FUNCTION public.fix_order_data(
  p_tenant_org_id uuid DEFAULT NULL::uuid,
  p_steps text[] DEFAULT NULL::text[],
  p_order_id uuid DEFAULT NULL::uuid,
  p_dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSONB := '{"overall": "success", "steps": []}'::JSONB;
  v_steps_out JSONB := '[]'::JSONB;
  v_overall TEXT := 'success';
  v_run_complete_pieces BOOLEAN := false;
  r_oi RECORD;
  v_piece_count INTEGER;
  v_max_seq INTEGER;
  v_to_add INTEGER;
  v_pieces_added INTEGER := 0;
  v_pieces_removed INTEGER := 0;
  v_items_adjusted INTEGER := 0;
  v_item_results JSONB := '[]'::JSONB;
  v_step_summary TEXT;
  v_step_details JSONB;
  v_price_per_piece NUMERIC(19,4);
  v_seq INTEGER;
  v_step_result JSONB;
  v_err_msg TEXT;
  v_committed BOOLEAN := false;
BEGIN
  -- Tenant boundary: only the service role (HQ maintenance) may run across all
  -- organizations. A signed-in user must name an organization they belong to.
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    IF p_tenant_org_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.org_users_mst ou
      WHERE ou.tenant_org_id = p_tenant_org_id
        AND ou.user_id = auth.uid()
        AND ou.is_active = true
    ) THEN
      RAISE EXCEPTION 'fix_order_data: organization access denied' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- A named committed, calculator or split sub-order cannot be repaired here.
  -- Edit Order review owns that structure. Dry run stays read-only.
  IF p_order_id IS NOT NULL AND NOT p_dry_run THEN
    SELECT (o.committed_at IS NOT NULL
            OR o.commercial_calc_version IS NOT NULL
            OR o.parent_order_id IS NOT NULL)
      INTO v_committed
    FROM public.org_orders_mst o
    WHERE o.id = p_order_id
      AND (p_tenant_org_id IS NULL OR o.tenant_org_id = p_tenant_org_id);
    IF v_committed THEN
      RETURN jsonb_build_object(
        'overall', 'error',
        'steps', jsonb_build_array(jsonb_build_object(
          'step_id', 'complete_order_item_pieces',
          'status', 'error',
          'summary', NULL,
          'details', NULL,
          'error_message', 'LEGACY_COMMITTED_UPDATE_RETIRED'
        )),
        'dry_run', p_dry_run
      );
    END IF;
  END IF;

  v_run_complete_pieces := (p_steps IS NULL OR 'complete_order_item_pieces' = ANY(p_steps));

  IF v_run_complete_pieces THEN
    v_pieces_added := 0;
    v_pieces_removed := 0;
    v_items_adjusted := 0;
    v_item_results := '[]'::JSONB;
    v_err_msg := NULL;

    BEGIN
      FOR r_oi IN
        SELECT oi.id AS order_item_id,
               oi.order_id,
               oi.tenant_org_id,
               COALESCE(oi.order_item_srno, '') AS order_item_srno,
               oi.quantity,
               oi.total_price,
               oi.service_category_code,
               oi.product_id,
               (SELECT COUNT(*) FROM org_order_item_pieces_dtl p
                WHERE p.order_item_id = oi.id
                  AND p.tenant_org_id = oi.tenant_org_id) AS piece_count,
               (SELECT COALESCE(MAX(p.piece_seq), 0) FROM org_order_item_pieces_dtl p
                WHERE p.order_item_id = oi.id
                  AND p.tenant_org_id = oi.tenant_org_id) AS max_seq
        FROM org_order_items_dtl oi
        WHERE oi.tenant_org_id = COALESCE(p_tenant_org_id, oi.tenant_org_id)
          AND (p_order_id IS NULL OR oi.order_id = p_order_id)
          AND oi.quantity IS NOT NULL
          AND oi.quantity > 0
          -- Calculator orders and sub-orders are never touched, not even in a dry run:
          -- their pieces are exact by construction (a sub-order's stay on its parent).
          AND NOT EXISTS (
            SELECT 1
            FROM public.org_orders_mst o
            WHERE o.id = oi.order_id
              AND o.tenant_org_id = oi.tenant_org_id
              AND (o.commercial_calc_version IS NOT NULL OR o.parent_order_id IS NOT NULL)
          )
          AND (
            p_dry_run
            OR NOT EXISTS (
              SELECT 1
              FROM public.org_orders_mst o
              WHERE o.id = oi.order_id
                AND o.tenant_org_id = oi.tenant_org_id
                AND o.committed_at IS NOT NULL
            )
          )
      LOOP
        v_piece_count := r_oi.piece_count;
        v_max_seq := r_oi.max_seq;

        IF v_piece_count < r_oi.quantity THEN
          v_to_add := r_oi.quantity - v_piece_count;
          IF NOT p_dry_run THEN
            v_price_per_piece := r_oi.total_price / NULLIF(r_oi.quantity, 0);
            FOR v_seq IN (v_max_seq + 1)..r_oi.quantity LOOP
              INSERT INTO org_order_item_pieces_dtl (
                tenant_org_id, order_id, order_item_id, piece_seq,
                service_category_code, product_id, scan_state, quantity,
                price_per_unit, total_price, piece_status, is_ready, is_rejected
              ) VALUES (
                r_oi.tenant_org_id, r_oi.order_id, r_oi.order_item_id, v_seq,
                r_oi.service_category_code, r_oi.product_id, 'expected', 1,
                v_price_per_piece, v_price_per_piece, 'processing', false, false
              );
            END LOOP;
          END IF;
          v_pieces_added := v_pieces_added + v_to_add;
          v_items_adjusted := v_items_adjusted + 1;
          v_item_results := v_item_results || jsonb_build_array(jsonb_build_object(
            'order_item_id', r_oi.order_item_id,
            'order_item_srno', r_oi.order_item_srno,
            'action', 'added_pieces',
            'count', v_to_add
          ));
        ELSIF v_piece_count > r_oi.quantity THEN
          v_to_add := v_piece_count - r_oi.quantity;
          IF NOT p_dry_run THEN
            DELETE FROM org_order_item_pieces_dtl
            WHERE order_item_id = r_oi.order_item_id
              AND tenant_org_id = r_oi.tenant_org_id
              AND piece_seq > r_oi.quantity;
          END IF;
          v_pieces_removed := v_pieces_removed + v_to_add;
          v_items_adjusted := v_items_adjusted + 1;
          v_item_results := v_item_results || jsonb_build_array(jsonb_build_object(
            'order_item_id', r_oi.order_item_id,
            'order_item_srno', r_oi.order_item_srno,
            'action', 'removed_pieces',
            'count', v_to_add
          ));
        END IF;
      END LOOP;

      IF v_items_adjusted = 0 AND v_pieces_added = 0 AND v_pieces_removed = 0 THEN
        v_step_summary := 'No changes needed.';
      ELSIF p_dry_run THEN
        v_step_summary := v_items_adjusted || ' items would be adjusted. ' ||
          v_pieces_added || ' pieces would be added, ' || v_pieces_removed || ' would be removed.';
      ELSE
        v_step_summary := v_items_adjusted || ' items adjusted. ' ||
          v_pieces_added || ' pieces added, ' || v_pieces_removed || ' removed.';
      END IF;

      v_step_details := jsonb_build_object(
        'items_adjusted', v_items_adjusted,
        'pieces_added', v_pieces_added,
        'pieces_removed', v_pieces_removed,
        'item_results', v_item_results,
        'dry_run', p_dry_run
      );
      v_step_result := jsonb_build_object(
        'step_id', 'complete_order_item_pieces',
        'status', 'success',
        'summary', v_step_summary,
        'details', v_step_details,
        'error_message', NULL
      );
    EXCEPTION WHEN OTHERS THEN
      v_err_msg := SQLERRM;
      v_overall := 'error';
      v_step_result := jsonb_build_object(
        'step_id', 'complete_order_item_pieces',
        'status', 'error',
        'summary', NULL,
        'details', NULL,
        'error_message', v_err_msg
      );
    END;

    v_steps_out := v_steps_out || v_step_result;
  END IF;

  v_result := jsonb_build_object(
    'overall', v_overall,
    'steps', v_steps_out,
    'dry_run', p_dry_run
  );
  RETURN v_result;
END;
$function$;

COMMENT ON FUNCTION public.fix_order_data(uuid, text[], uuid, boolean) IS
  'Repairs piece counts on legacy, uncommitted orders only. Calculator orders and split sub-orders are skipped: their pieces are exact by construction. A signed-in user may only name an organization they belong to; all organizations need the service role.';

-- Anonymous callers could run this SECURITY DEFINER function before (EXECUTE was
-- granted to PUBLIC and anon). Only signed-in staff and the service role keep it.
REVOKE ALL ON FUNCTION public.fix_order_data(uuid, text[], uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fix_order_data(uuid, text[], uuid, boolean) TO authenticated, service_role;

COMMIT;
