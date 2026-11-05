-- =============================================================================
-- hfc_f5_drop_order_label_image_cols_safety.test.sql
-- Safety checks for migration 0696 (FOLLOWUPS #5).
-- Asserts org_orders_mst no longer has qr_code/barcode, while piece/item/receipt
-- barcode|qr columns remain when those tables exist.
-- =============================================================================
BEGIN;

DO $$
DECLARE
  v_n INTEGER;
BEGIN
  IF to_regclass('public.org_orders_mst') IS NULL THEN
    RAISE EXCEPTION 'FAIL: org_orders_mst missing';
  END IF;

  SELECT count(*) INTO v_n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'org_orders_mst'
     AND column_name IN ('qr_code', 'barcode');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'FAIL: org_orders_mst still has % of qr_code/barcode column(s)', v_n;
  END IF;
  RAISE NOTICE 'PASS: org_orders_mst.qr_code and barcode are gone';

  -- Sibling columns must remain
  IF to_regclass('public.org_order_pieces_dtl') IS NOT NULL THEN
    SELECT count(*) INTO v_n FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'org_order_pieces_dtl' AND column_name = 'barcode';
    IF v_n = 0 THEN
      RAISE EXCEPTION 'FAIL: org_order_pieces_dtl.barcode was removed (must stay)';
    END IF;
    RAISE NOTICE 'PASS: org_order_pieces_dtl.barcode still present';
  END IF;

  IF to_regclass('public.org_rcpt_receipts_mst') IS NOT NULL THEN
    SELECT count(*) INTO v_n FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'org_rcpt_receipts_mst' AND column_name = 'qr_code';
    IF v_n = 0 THEN
      RAISE EXCEPTION 'FAIL: org_rcpt_receipts_mst.qr_code was removed (must stay)';
    END IF;
    RAISE NOTICE 'PASS: org_rcpt_receipts_mst.qr_code still present';
  END IF;

  RAISE NOTICE 'PASS: hfc_f5_drop_order_label_image_cols_safety';
END
$$;

ROLLBACK;