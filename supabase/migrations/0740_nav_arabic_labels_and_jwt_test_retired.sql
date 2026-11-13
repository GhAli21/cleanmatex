-- =============================================================================
-- Migration: 0740_nav_arabic_labels_and_jwt_test_retired.sql
-- Purpose:   Setup Health plan 2, step 5 (docs/features/Setup_Health/PLAN_2_RUN_SCOPE_AND_QA_FIXES.md),
--            fixing two QA findings in the tenant sidebar:
--            (1) Arabic labels: eight active menu rows had no label2, so the
--                sidebar stayed in English in Arabic mode (home, orders, catalog,
--                help, drivers, billing_invoices, assembly, catalog_addons).
--                The wording is the one the app already uses in
--                web-admin/messages/ar/navigation.json (no new terms).
--            (2) The 'assembly' row was labelled "AssemblyJh" (a test leftover);
--                it is now "Assembly", as in messages/en/navigation.json.
--            (3) 'jhtestui' (the developer "JWT Test" page) is retired from the
--                menu for every tenant. The page itself is not removed; it stays
--                reachable by URL for administrators.
--            Mirrors web-admin/config/navigation.ts (dual-write: the jhtestui
--            entry is removed there in the same change).
-- Affected:  sys_components_cd (rows home, orders, catalog, help, drivers,
--            billing_invoices, assembly, catalog_addons, jhtestui). Data only.
-- Related:   0729 (previous menu fixes, same pattern).
-- Idempotent: plain UPDATEs keyed by comp_code; running twice changes nothing more.
--
-- Rollback (manual): set label2 back to NULL for the eight rows, assembly label
--   back to 'AssemblyJh', and jhtestui is_active = TRUE, rec_status = 1.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- (1) + (2): Arabic labels, and the assembly English label.
UPDATE public.sys_components_cd AS c
SET label        = COALESCE(v.label, c.label),
    label2       = v.label2,
    updated_at   = NOW(),
    updated_by   = 'system',
    updated_info = '0740 nav Arabic labels'
FROM (VALUES
  ('home',             NULL::text,  'لوحة التحكم'),
  ('orders',           NULL::text,  'الطلبات'),
  ('catalog',          NULL::text,  'الترميزات والتسعير'),
  ('help',             NULL::text,  'المساعدة'),
  ('drivers',          NULL::text,  'السائقون والمسارات'),
  ('billing_invoices', NULL::text,  'الفواتير'),
  ('assembly',         'Assembly',  'التجميع'),
  ('catalog_addons',   NULL::text,  'الإضافات')
) AS v(comp_code, label, label2)
WHERE c.comp_code = v.comp_code;

-- (3): retire the developer JWT Test page from the menu (soft delete: is_active = false, rec_status = 0).
/*
UPDATE public.sys_components_cd
SET is_active    = FALSE,
    rec_status   = 0,
    updated_at   = NOW(),
    updated_by   = 'system',
    updated_info = '0740 jwt test retired from menu'
WHERE comp_code = 'jhtestui';
*/

-- Self-check: every row exists and has the intended state, or the migration rolls back.
DO $$
DECLARE
  v_missing INTEGER;
BEGIN
  SELECT count(*) INTO v_missing
    FROM (VALUES ('home'), ('orders'), ('catalog'), ('help'), ('drivers'), ('billing_invoices'), ('assembly'), ('catalog_addons')) AS v(comp_code)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.sys_components_cd c
      WHERE c.comp_code = v.comp_code AND NULLIF(btrim(c.label2), '') IS NOT NULL);
  IF v_missing > 0 THEN
    RAISE EXCEPTION '0740 self-check: % menu rows still have no Arabic label', v_missing;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sys_components_cd WHERE comp_code = 'assembly' AND label = 'Assembly') THEN
    RAISE EXCEPTION '0740 self-check: assembly label not renamed';
  END IF;
  /*
  IF EXISTS (SELECT 1 FROM public.sys_components_cd WHERE comp_code = 'jhtestui' AND (is_active OR rec_status <> 0)) THEN
    RAISE EXCEPTION '0740 self-check: jhtestui still active';
  END IF;
  */
  
END $$;

COMMIT;
