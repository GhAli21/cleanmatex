-- =============================================================================
-- Migration: 0817_uom_convert_whole_tolerance.sql
-- Purpose:   Fix fn_uom_convert (0813) for reverse conversions into a count unit.
--            A reverse conversion multiplies by the stored divide_rate, which is a
--            12-decimal reciprocal (0.083333333333 for 12 pieces per box), so
--            24 PC → BOX gave 1.999999999992 and was refused as "not a whole number".
--            The whole-number check now looks at the result rounded to the QUANTITY
--            scale (6 decimals); a result that is whole at that scale is returned as
--            the whole number. 30 PC → 2.5 BOX is still refused.
-- Affected:  function fn_uom_convert(uuid, uuid, numeric, text, text, boolean)
-- Related:   0813 (original definition), web-admin lib/uom/convert.ts (same rule).
-- Rollback (forward-only, manual): re-apply the 0813 definition.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

CREATE OR REPLACE FUNCTION public.fn_uom_convert(
  p_tenant_org_id uuid,
  p_product_id    uuid,
  p_qty           numeric,
  p_from          text,
  p_to            text,
  p_require_whole boolean DEFAULT true
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_rate   numeric;
  v_leg1   numeric;
  v_leg2   numeric;
  v_base   text;
  v_dim_to text;
  v_result numeric;
  v_whole  numeric;
BEGIN
  IF p_qty IS NULL OR p_from IS NULL OR p_to IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_from = p_to THEN
    RETURN p_qty;
  END IF;

  v_rate := public.fn_uom_conv_rate(p_tenant_org_id, p_product_id, p_from, p_to);

  IF v_rate IS NULL THEN
    -- Two legs through a base unit: the source dimension's base, then the target's.
    FOR v_base IN
      SELECT b.uom_code
        FROM public.org_uom_cf u
        JOIN public.org_uom_cf b
          ON b.tenant_org_id = u.tenant_org_id AND b.uom_dimension = u.uom_dimension AND b.is_base_unit
       WHERE u.tenant_org_id = p_tenant_org_id AND u.uom_code IN (p_from, p_to)
       ORDER BY (u.uom_code = p_from) DESC
    LOOP
      CONTINUE WHEN v_base IN (p_from, p_to);
      v_leg1 := public.fn_uom_conv_rate(p_tenant_org_id, p_product_id, p_from, v_base);
      v_leg2 := public.fn_uom_conv_rate(p_tenant_org_id, p_product_id, v_base, p_to);
      IF v_leg1 IS NOT NULL AND v_leg2 IS NOT NULL THEN
        v_rate := v_leg1 * v_leg2;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF v_rate IS NULL THEN
    RAISE EXCEPTION 'UOM_CONVERSION_MISSING: no conversion from % to %', p_from, p_to
      USING ERRCODE = 'no_data_found';
  END IF;

  v_result := p_qty * v_rate;

  SELECT u.uom_dimension INTO v_dim_to FROM public.org_uom_cf u
   WHERE u.tenant_org_id = p_tenant_org_id AND u.uom_code = p_to;
  IF p_require_whole AND v_dim_to = 'COUNT' THEN
    -- A stored 12-decimal reciprocal leaves noise (24 × 0.083333333333 = 1.999999999992):
    -- judge the result at the QUANTITY scale (6 decimals) and return the clean whole number.
    v_whole := round(v_result, 6);
    IF v_whole <> trunc(v_whole) THEN
      RAISE EXCEPTION 'UOM_QTY_NOT_WHOLE: % % is % %, not a whole number', p_qty, p_from, v_result, p_to
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN v_whole;
  END IF;
  RETURN v_result;
END $$;
COMMENT ON FUNCTION public.fn_uom_convert(uuid, uuid, numeric, text, text, boolean) IS 'Converts p_qty from one unit to another for one Organization (and optionally one product): same unit, direct pair (product → Organization), else two legs through a base unit. Raises UOM_CONVERSION_MISSING, or UOM_QTY_NOT_WHOLE for a fractional COUNT result when p_require_whole (judged at 6 decimals, so reciprocal-rate noise does not matter; a whole result is returned exactly). Otherwise returns an unrounded value; callers round to the target unit decimals. Mirrored by web-admin lib/uom/convert.ts.';

COMMIT;
