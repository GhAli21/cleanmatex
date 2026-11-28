-- =============================================================================
-- Migration: 0850_uom_template_active_unit.sql
-- Program:   Measured Pricing + UoM - P7e (docs/features/Measured_Pricing/PLAN.md)
-- Purpose:   An active product template may not be put on a switched-off unit.
--            HQ refuses to switch off a unit that active templates use, but
--            nothing refused the other direction: choosing an inactive unit on a
--            template, importing such a row, or reactivating a template whose
--            unit was switched off meanwhile. Seeding an organization catalog
--            from that template then fails (UOM_NOT_FOUND / UOM_INACTIVE).
-- Affected:  fn_uom_tpl_rules (replaced; trigger trg_sspt_uom_2_rules on
--            sys_service_prod_templates_cd is unchanged).
-- Related:   0813 (sys_uom_cd), 0814 (template rules). Apply those first.
-- Existing data: rows are not rewritten. The new rule fires only on insert, on a
--            unit change and on reactivation, so unrelated edits of any older
--            row still save (remote 2026-11-27: no active template is on an
--            inactive unit).
-- Rollback (forward-only, manual): re-create fn_uom_tpl_rules without the
--            UOM_INACTIVE block (the body in 0814).
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- Template unit rules. UOM_<CODE>: message is read by HQ, which shows it on the field.
CREATE OR REPLACE FUNCTION public.fn_uom_tpl_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.price_type = 'FIXED'
     AND EXISTS (SELECT 1 FROM public.sys_uom_cd s WHERE s.uom_code = NEW.base_uom_code AND s.uom_dimension <> 'COUNT') THEN
    RAISE EXCEPTION 'UOM_FIXED_PRICE_MEASURED: a fixed price needs a count unit, not %', NEW.base_uom_code
      USING ERRCODE = 'check_violation';
  END IF;

  -- Nested IF: OLD does not exist on INSERT.
  IF NEW.is_active THEN
    IF TG_OP = 'UPDATE' THEN
      IF NEW.base_uom_code IS NOT DISTINCT FROM OLD.base_uom_code AND OLD.is_active THEN
        RETURN NEW;
      END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM public.sys_uom_cd s
                WHERE s.uom_code = NEW.base_uom_code AND (NOT s.is_active OR s.rec_status <> 1)) THEN
      RAISE EXCEPTION 'UOM_INACTIVE: unit % is switched off; choose an active unit or switch the unit on', NEW.base_uom_code
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.fn_uom_tpl_rules() IS
  'Product template unit rules (trigger trg_sspt_uom_2_rules): a FIXED price needs a COUNT unit (UOM_FIXED_PRICE_MEASURED); an active template cannot be inserted, moved to or reactivated on a switched-off unit (UOM_INACTIVE).';

COMMIT;
