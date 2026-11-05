-- =============================================================================
-- 0696_drop_org_orders_mst_label_image_cols.sql
-- Human-Friendly Codes (HFC) follow-up #5 / A-56 / A-48 (2):
-- DROP the deprecated label-image columns on org_orders_mst.
--
-- Why: 0689 marked org_orders_mst.qr_code and org_orders_mst.barcode DEPRECATED.
-- They held data-URL images for label printing (0012), were never filled, and
-- since P4 (0685) no code reads them — labels are built at print time from
-- order_no via GET /api/v1/orders/[id]/label-data.
--
-- Scope (ORDER TABLE ONLY — does NOT touch):
--   org_order_items_dtl.barcode (item serial / scan)
--   org_order_pieces_dtl.barcode (external tag)
--   org_rcpt_receipts_mst.qr_code (receipt tracking QR)
--   packaging / assembly / other qr_code columns
--
-- Destructive: column data is permanently removed.
-- Undo: restore the two columns from a DB backup taken before this migration,
-- then re-apply COMMENT ON from 0689 (or 0012). There is no in-migration undo.
--
-- Guards: DROP COLUMN IF EXISTS (idempotent). Missing table → NOTICE + skip.
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('public.org_orders_mst') IS NULL THEN
    RAISE NOTICE '0696: org_orders_mst missing — nothing to drop';
    RETURN;
  END IF;

  ALTER TABLE public.org_orders_mst
    DROP COLUMN IF EXISTS qr_code,
    DROP COLUMN IF EXISTS barcode;

  RAISE NOTICE '0696: dropped org_orders_mst.qr_code and org_orders_mst.barcode (IF EXISTS)';
END
$$;