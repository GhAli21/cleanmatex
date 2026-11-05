-- =============================================================================
-- hfc_f1_retire_label_printing_safety.test.sql
-- Safety checks for migration 0693_retire_label_printing_feature_flag
-- (FOLLOWUPS #1 / A-72 / A-47).
--
-- Run after 0693 is applied. Fails with an exception; changes nothing (ROLLBACK).
-- Missing sibling flags are reported and skipped (they may not exist in a
-- minimal scratch DB). The retired key must be absent from the flag master
-- and from plan mappings / tenant overrides when those tables exist.
-- =============================================================================
BEGIN;

DO $$
DECLARE
  v_n INTEGER;
BEGIN
  IF to_regclass('public.hq_ff_feature_flags_mst') IS NULL THEN
    RAISE EXCEPTION 'FAIL: hq_ff_feature_flags_mst missing (cannot verify 0693)';
  END IF;

  SELECT count(*) INTO v_n FROM public.hq_ff_feature_flags_mst
   WHERE flag_key = 'label_printing';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'FAIL: label_printing still present in hq_ff_feature_flags_mst (% row(s))', v_n;
  END IF;
  RAISE NOTICE 'PASS: label_printing absent from hq_ff_feature_flags_mst';

  IF to_regclass('public.sys_ff_pln_flag_mappings_dtl') IS NOT NULL THEN
    SELECT count(*) INTO v_n FROM public.sys_ff_pln_flag_mappings_dtl
     WHERE flag_key = 'label_printing';
    IF v_n > 0 THEN
      RAISE EXCEPTION 'FAIL: % plan mapping(s) still reference label_printing', v_n;
    END IF;
    RAISE NOTICE 'PASS: no plan mappings for label_printing';
  ELSE
    RAISE NOTICE 'skip: sys_ff_pln_flag_mappings_dtl not in this database';
  END IF;

  IF to_regclass('public.org_ff_overrides_cf') IS NOT NULL THEN
    SELECT count(*) INTO v_n FROM public.org_ff_overrides_cf
     WHERE flag_key = 'label_printing';
    IF v_n > 0 THEN
      RAISE EXCEPTION 'FAIL: % org override(s) still reference label_printing', v_n;
    END IF;
    RAISE NOTICE 'PASS: no org_ff_overrides_cf rows for label_printing';
  ELSE
    RAISE NOTICE 'skip: org_ff_overrides_cf not in this database';
  END IF;

  -- Siblings must not have been deleted by 0693 when they exist.
  IF EXISTS (SELECT 1 FROM public.hq_ff_feature_flags_mst WHERE flag_key = 'label_printing_58mm') THEN
    RAISE NOTICE 'PASS: sibling label_printing_58mm still present';
  ELSE
    RAISE NOTICE 'skip: sibling label_printing_58mm not seeded in this database';
  END IF;
  IF EXISTS (SELECT 1 FROM public.hq_ff_feature_flags_mst WHERE flag_key = 'human_codes_scan_labels') THEN
    RAISE NOTICE 'PASS: human_codes_scan_labels still present';
  ELSE
    RAISE NOTICE 'skip: human_codes_scan_labels not seeded in this database';
  END IF;

  RAISE NOTICE 'PASS: hfc_f1_retire_label_printing_safety';
END
$$;

ROLLBACK;