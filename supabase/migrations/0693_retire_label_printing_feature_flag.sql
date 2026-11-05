-- =============================================================================
-- 0693_retire_label_printing_feature_flag.sql
-- Human-Friendly Codes (HFC) follow-up #1 / decision A-72 / A-47:
-- Retire the tenant feature flag `label_printing` from the HQ catalog.
--
-- Why: label printing is available to every tenant (0685 config tables +
-- Settings → Labels & Tags). Code already dropped the flag key from the
-- web-admin catalog / FEATURE_FLAG_KEYS / TenantFeatureFlags (P11 A-72).
-- The DB row and its plan mappings are leftover clutter.
--
-- Scope (exact key only — does NOT touch siblings):
--   DELETE plan mappings for flag_key = 'label_printing'
--   DELETE optional tenant overrides for the same key (org_ff_overrides_cf)
--   DELETE the hq_ff_feature_flags_mst row for 'label_printing'
-- Leaves: label_printing_58mm, label_printing_80mm, intake_label_printing,
--         human_codes_scan_labels, and the 0685 label config tables.
--
-- FK note: sys_ff_pln_flag_mappings_dtl.flag_key → hq_ff_feature_flags_mst
--   ON DELETE RESTRICT (0154). Mappings must be removed before the flag row.
-- Audit history (hq_ff_audit_history_tr) has no FK; rows are left as history.
--
-- Guards: missing tables / missing row → NOTICE and continue (idempotent).
-- Safe to run twice: second run notices "already gone".
--
-- Undo (re-seed from 0066/0067 pattern, or re-insert from backup):
--   Re-insert hq_ff_feature_flags_mst row for 'label_printing' (see 0066 seed),
--   then re-insert sys_ff_pln_flag_mappings_dtl plan rows (see 0067),
--   then npm run rebuild:platform-info-inventories from the repo root.
-- =============================================================================

DO $$
DECLARE
  v_maps   INTEGER := 0;
  v_ovr    INTEGER := 0;
  v_flags  INTEGER := 0;
BEGIN
  IF to_regclass('public.hq_ff_feature_flags_mst') IS NULL THEN
    RAISE NOTICE '0693: hq_ff_feature_flags_mst missing — nothing to retire';
    RETURN;
  END IF;

  -- 1) Plan mappings first (RESTRICT FK)
  IF to_regclass('public.sys_ff_pln_flag_mappings_dtl') IS NOT NULL THEN
    DELETE FROM public.sys_ff_pln_flag_mappings_dtl
     WHERE flag_key = 'label_printing';
    GET DIAGNOSTICS v_maps = ROW_COUNT;
    IF v_maps = 0 THEN
      RAISE NOTICE '0693: no plan mappings for label_printing (already gone or never seeded)';
    ELSE
      RAISE NOTICE '0693: deleted % plan mapping row(s) for label_printing', v_maps;
    END IF;
  ELSE
    RAISE NOTICE '0693: sys_ff_pln_flag_mappings_dtl missing — skipped mapping delete';
  END IF;

  -- 2) Tenant overrides (no FK to mst; clean orphans for this key only)
  IF to_regclass('public.org_ff_overrides_cf') IS NOT NULL THEN
    DELETE FROM public.org_ff_overrides_cf
     WHERE flag_key = 'label_printing';
    GET DIAGNOSTICS v_ovr = ROW_COUNT;
    IF v_ovr = 0 THEN
      RAISE NOTICE '0693: no org_ff_overrides_cf rows for label_printing';
    ELSE
      RAISE NOTICE '0693: deleted % org_ff_overrides_cf row(s) for label_printing', v_ovr;
    END IF;
  ELSE
    RAISE NOTICE '0693: org_ff_overrides_cf missing — skipped override delete';
  END IF;

  -- 3) Flag definition
  DELETE FROM public.hq_ff_feature_flags_mst
   WHERE flag_key = 'label_printing';
  GET DIAGNOSTICS v_flags = ROW_COUNT;
  IF v_flags = 0 THEN
    RAISE NOTICE '0693: hq_ff_feature_flags_mst has no label_printing row (already retired)';
  ELSE
    RAISE NOTICE '0693: deleted label_printing from hq_ff_feature_flags_mst';
  END IF;

  -- Sibling sanity (must still exist if they were seeded; do not fail if absent)
  IF EXISTS (
    SELECT 1 FROM public.hq_ff_feature_flags_mst
     WHERE flag_key IN ('label_printing_58mm', 'label_printing_80mm', 'intake_label_printing')
  ) THEN
    RAISE NOTICE '0693: sibling label_* / intake_label_printing flags left in place';
  END IF;
END
$$;