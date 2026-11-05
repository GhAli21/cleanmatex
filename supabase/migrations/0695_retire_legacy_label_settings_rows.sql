-- =============================================================================
-- 0695_retire_legacy_label_settings_rows.sql
-- Human-Friendly Codes (HFC) follow-up #2 / A-48 / 0685 NOTICE cleanup:
-- Delete superseded draft label-printing settings from sys_tenant_settings_cd.
--
-- Why: an earlier draft of 0685 would have seeded five setting_code rows.
-- The applied 0685 uses sys_label_printing_cf / org_label_printing_cf instead
-- and only RAISES NOTICE when those old codes are present ("remove separately").
-- Nothing in app code reads these codes after 0685.
--
-- Codes deleted (exact match only):
--   LABEL_ORDER_SIZE
--   LABEL_PIECE_TAG_SIZE
--   LABEL_PIECE_TAG_QR
--   LABEL_SHOW_CUSTOMER_NAME
--   RECEIPT_ORDER_CODE128
--
-- Guards: missing table → NOTICE and skip. Zero matches → NOTICE (idempotent
-- no-op). Safe to run twice.
--
-- Undo: re-insert from backup or from the superseded 0685 draft seed (if any).
-- Prefer restore from DB backup taken before this migration.
-- =============================================================================

DO $$
DECLARE
  v_deleted INTEGER := 0;
  v_codes   TEXT[] := ARRAY[
    'LABEL_ORDER_SIZE',
    'LABEL_PIECE_TAG_SIZE',
    'LABEL_PIECE_TAG_QR',
    'LABEL_SHOW_CUSTOMER_NAME',
    'RECEIPT_ORDER_CODE128'
  ];
BEGIN
  IF to_regclass('public.sys_tenant_settings_cd') IS NULL THEN
    RAISE NOTICE '0695: sys_tenant_settings_cd missing — nothing to retire';
    RETURN;
  END IF;

  DELETE FROM public.sys_tenant_settings_cd
   WHERE setting_code = ANY (v_codes);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RAISE NOTICE '0695: no legacy LABEL_*/RECEIPT_ORDER_CODE128 rows (already gone or never seeded) — no-op';
  ELSE
    RAISE NOTICE '0695: deleted % legacy label setting row(s) from sys_tenant_settings_cd', v_deleted;
  END IF;
END
$$;