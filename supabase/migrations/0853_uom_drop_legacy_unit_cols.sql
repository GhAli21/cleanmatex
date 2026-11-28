-- =============================================================================
-- Migration: 0853_uom_drop_legacy_unit_cols.sql
-- Program:   Measured Pricing + UoM - P9 step 2 of 2 (Migration B)
--            (docs/features/Measured_Pricing/PLAN.md)
-- Purpose:   Remove the pre-UoM columns and the bridge that kept them in step:
--            org_product_data_mst.product_unit,
--            sys_service_prod_templates_cd.product_unit / requires_weight /
--            requires_dimensions, triggers trg_prod_uom_1_bridge and
--            trg_sspt_uom_1_bridge, fn_uom_prod_legacy_bridge and
--            fn_uom_legacy_code. base_uom_code is the only unit; its dimension
--            says whether a product is measured.
-- DESTRUCTIVE: the dropped values cannot be restored from this database.
--            Checked 2026-11-27 (local and remote): every product_unit maps to
--            the row's base_uom_code, and both requires_* flags are false on
--            every template, so no information is lost.
-- Order:     apply AFTER 0852 AND after the P9 application code (HQ and tenant)
--            is running: older code writes product_unit and would fail.
--            Afterwards regenerate the database types in both repositories.
-- Related:   0813, 0814 (columns and bridge), 0852.
-- Rollback (forward-only, manual): re-add the columns and re-create the bridge
--            from 0814; product_unit can be refilled from base_uom_code.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- Stop if 0852 is missing: a seeder still reading product_unit would break at run time, not here.
DO $$
DECLARE
  v_fn TEXT;
BEGIN
  SELECT string_agg(p.proname, ', ') INTO v_fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname <> 'fn_uom_prod_legacy_bridge'
     AND (p.prosrc ~* '\m(product_unit|requires_weight|requires_dimensions|fn_uom_legacy_code)\M');
  IF v_fn IS NOT NULL THEN
    RAISE EXCEPTION '0853: function(s) still use the legacy unit columns: %. Apply 0852 first.', v_fn;
  END IF;
END $$;

-- 1. Bridge triggers, then the functions only they used.
DROP TRIGGER IF EXISTS trg_prod_uom_1_bridge ON public.org_product_data_mst;
DROP TRIGGER IF EXISTS trg_sspt_uom_1_bridge ON public.sys_service_prod_templates_cd;
DROP FUNCTION IF EXISTS public.fn_uom_prod_legacy_bridge() RESTRICT;
DROP FUNCTION IF EXISTS public.fn_uom_legacy_code(text) RESTRICT;

-- 2. Legacy columns. RESTRICT: any unexpected dependant stops the migration.
ALTER TABLE public.org_product_data_mst
  DROP COLUMN IF EXISTS product_unit RESTRICT;

ALTER TABLE public.sys_service_prod_templates_cd
  DROP COLUMN IF EXISTS product_unit RESTRICT,
  DROP COLUMN IF EXISTS requires_weight RESTRICT,
  DROP COLUMN IF EXISTS requires_dimensions RESTRICT;

COMMIT;
