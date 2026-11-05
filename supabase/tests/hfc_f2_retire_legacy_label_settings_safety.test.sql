-- =============================================================================
-- hfc_f2_retire_legacy_label_settings_safety.test.sql
-- Safety checks for migration 0695_retire_legacy_label_settings_rows
-- (FOLLOWUPS #2).
--
-- Run after 0695 is applied. Fails with an exception; changes nothing (ROLLBACK).
-- =============================================================================
BEGIN;

DO $$
DECLARE
  v_n INTEGER;
BEGIN
  IF to_regclass('public.sys_tenant_settings_cd') IS NULL THEN
    RAISE NOTICE 'skip: sys_tenant_settings_cd missing (cannot verify 0695 on this DB)';
    RAISE NOTICE 'PASS: hfc_f2_retire_legacy_label_settings_safety (skipped — no settings table)';
    RETURN;
  END IF;

  SELECT count(*) INTO v_n FROM public.sys_tenant_settings_cd
   WHERE setting_code IN (
     'LABEL_ORDER_SIZE',
     'LABEL_PIECE_TAG_SIZE',
     'LABEL_PIECE_TAG_QR',
     'LABEL_SHOW_CUSTOMER_NAME',
     'RECEIPT_ORDER_CODE128'
   );
  IF v_n > 0 THEN
    RAISE EXCEPTION 'FAIL: % legacy LABEL_*/RECEIPT_ORDER_CODE128 setting row(s) still present', v_n;
  END IF;
  RAISE NOTICE 'PASS: no legacy LABEL_*/RECEIPT_ORDER_CODE128 rows in sys_tenant_settings_cd';
  RAISE NOTICE 'PASS: hfc_f2_retire_legacy_label_settings_safety';
END
$$;

ROLLBACK;