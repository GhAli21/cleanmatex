-- =============================================================================
-- Migration: 0859_uom_area_side_units.sql
-- Program:   Measured Pricing + UoM - area units fix
--            (docs/features/Measured_Pricing/STATUS.md)
-- Purpose:   Only an area unit whose sides can be measured may price a product:
--            SQM (length and width in metres, M) and SQFT (in feet, FT). An
--            area line stores length x width in that side unit. Any other area
--            unit, a custom one included, was charged as if its sides were
--            metres, so it is now refused.
-- Mirrors:   web-admin/lib/constants/uom.ts UOM_AREA_SIDE_UNITS. A new
--            measurable area unit needs both changed together.
-- Affected:  org_order_items_dtl (one CHECK, two column comments);
--            org_product_data_mst and sys_service_prod_templates_cd (one guard
--            trigger each). No data is changed. No new table, column or grant.
-- Order:     apply any time. The application already refuses these units.
-- Safety:    stops with a message if a product, template or line already breaks
--            the rule (verified none on the remote database, 2026-11-28).
-- Rollback (forward-only, manual): drop the constraint, both triggers and both
--            functions.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- -----------------------------------------------------------------------------
-- 1. Preflight: never add the guards over data that breaks them
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_products  integer;
  v_templates integer;
  v_lines     integer;
BEGIN
  -- Cross-organization count on purpose (migration preflight); each join matches the row's own organization.
  SELECT count(*) INTO v_products
    FROM public.org_product_data_mst p
    JOIN public.org_uom_cf u ON u.tenant_org_id = p.tenant_org_id AND u.uom_code = p.base_uom_code
   WHERE u.uom_dimension = 'AREA' AND p.base_uom_code NOT IN ('SQM', 'SQFT');

  SELECT count(*) INTO v_templates
    FROM public.sys_service_prod_templates_cd t
    JOIN public.sys_uom_cd s ON s.uom_code = t.base_uom_code
   WHERE s.uom_dimension = 'AREA' AND t.base_uom_code NOT IN ('SQM', 'SQFT');

  SELECT count(*) INTO v_lines
    FROM public.org_order_items_dtl i
   WHERE i.measure_length IS NOT NULL AND i.uom_code NOT IN ('SQM', 'SQFT');

  IF v_products + v_templates + v_lines > 0 THEN
    RAISE EXCEPTION '0859 stopped: % product(s), % template(s) and % order line(s) use an area unit other than SQM or SQFT; move them to one of those first',
      v_products, v_templates, v_lines;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Order lines: length and width exist only where their unit is known
-- -----------------------------------------------------------------------------
-- Length and width are stored only for SQM (metres) and SQFT (feet) lines.
ALTER TABLE public.org_order_items_dtl
  ADD CONSTRAINT ck_oid_area_side_unit CHECK (measure_length IS NULL OR uom_code IN ('SQM', 'SQFT'));
COMMENT ON CONSTRAINT ck_oid_area_side_unit ON public.org_order_items_dtl IS
  'Length and width are accepted only on SQM lines (metres) and SQFT lines (feet); any other area unit would be mis-measured.';

-- Corrects the 0814 wording, which said metres for every area line.
COMMENT ON COLUMN public.org_order_items_dtl.measure_length IS
  'Length of an area line in the side unit of its area unit: metres on SQM, feet on SQFT (area = length x width). NULL otherwise.';
COMMENT ON COLUMN public.org_order_items_dtl.measure_width IS
  'Width of an area line in the side unit of its area unit: metres on SQM, feet on SQFT. NULL otherwise.';

-- -----------------------------------------------------------------------------
-- 3. Products: an area product is priced in SQM or SQFT
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER: products are written with the signed-in user's key, which
-- cannot read org_uom_cf directly; the lookup filters NEW.tenant_org_id.
CREATE OR REPLACE FUNCTION public.fn_uom_prod_area_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  -- An unchanged unit is left alone so other product edits are never blocked.
  IF TG_OP = 'UPDATE' AND NEW.base_uom_code IS NOT DISTINCT FROM OLD.base_uom_code THEN
    RETURN NEW;
  END IF;
  IF NEW.base_uom_code NOT IN ('SQM', 'SQFT') AND EXISTS (
    SELECT 1 FROM public.org_uom_cf u
     WHERE u.tenant_org_id = NEW.tenant_org_id AND u.uom_code = NEW.base_uom_code AND u.uom_dimension = 'AREA'
  ) THEN
    RAISE EXCEPTION 'UOM_AREA_UNSUPPORTED: a product can be priced per square metre or square foot only, not %', NEW.base_uom_code
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.fn_uom_prod_area_guard() IS
  'BEFORE INSERT/UPDATE on org_product_data_mst: an area unit other than SQM or SQFT cannot price a product (its sides cannot be measured). Reads only NEW.tenant_org_id rows.';
REVOKE ALL ON FUNCTION public.fn_uom_prod_area_guard() FROM PUBLIC, anon, authenticated;

-- Runs after trg_prod_uom_2_rules (name order), which first adds a missing system unit to the organization.
DROP TRIGGER IF EXISTS trg_prod_uom_3_area ON public.org_product_data_mst;
CREATE TRIGGER trg_prod_uom_3_area BEFORE INSERT OR UPDATE ON public.org_product_data_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_uom_prod_area_guard();
COMMENT ON TRIGGER trg_prod_uom_3_area ON public.org_product_data_mst IS
  'Area products are priced in SQM or SQFT only (fn_uom_prod_area_guard).';

-- -----------------------------------------------------------------------------
-- 4. HQ product templates: the same rule, so seeding cannot create such a product
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_uom_tpl_area_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.base_uom_code IS NOT DISTINCT FROM OLD.base_uom_code THEN
    RETURN NEW;
  END IF;
  IF NEW.base_uom_code NOT IN ('SQM', 'SQFT') AND EXISTS (
    SELECT 1 FROM public.sys_uom_cd s WHERE s.uom_code = NEW.base_uom_code AND s.uom_dimension = 'AREA'
  ) THEN
    RAISE EXCEPTION 'UOM_AREA_UNSUPPORTED: a product template can be priced per square metre or square foot only, not %', NEW.base_uom_code
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.fn_uom_tpl_area_guard() IS
  'BEFORE INSERT/UPDATE on sys_service_prod_templates_cd: an area unit other than SQM or SQFT cannot price a template.';
REVOKE ALL ON FUNCTION public.fn_uom_tpl_area_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sspt_uom_3_area ON public.sys_service_prod_templates_cd;
CREATE TRIGGER trg_sspt_uom_3_area BEFORE INSERT OR UPDATE ON public.sys_service_prod_templates_cd
  FOR EACH ROW EXECUTE FUNCTION public.fn_uom_tpl_area_guard();
COMMENT ON TRIGGER trg_sspt_uom_3_area ON public.sys_service_prod_templates_cd IS
  'Area templates are priced in SQM or SQFT only (fn_uom_tpl_area_guard).';

COMMIT;
