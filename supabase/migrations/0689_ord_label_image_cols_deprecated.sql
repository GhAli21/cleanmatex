-- =============================================================================
-- 0689_ord_label_image_cols_deprecated.sql
-- Human-Friendly Codes (HFC) phase P6, decision A-48 (2): mark the old label
-- image columns on org_orders_mst as DEPRECATED.
--
-- org_orders_mst.qr_code and org_orders_mst.barcode held data-URL images for
-- label printing (0012). They were never filled and, since P4 (0685), no code
-- reads them: labels are built at print time from org_orders_mst.order_no by
-- GET /api/v1/orders/[id]/label-data.
--
-- Comment only. No data, column, index or policy is changed or dropped.
-- Dropping the columns is a separate migration that needs its own approval.
-- Rollback: re-run the two COMMENT ON statements from 0012_order_intake_enhancements.sql.
-- =============================================================================

COMMENT ON COLUMN public.org_orders_mst.qr_code IS
  'DEPRECATED (HFC P6, 0689): unused since P4. Was a QR data URL for label printing; labels are now built at print time from order_no. Do not read or write. Drop only with a separate approval. See docs/features/Human_Friendly_Codes.';

COMMENT ON COLUMN public.org_orders_mst.barcode IS
  'DEPRECATED (HFC P6, 0689): unused since P4. Was a barcode data URL for label printing; labels are now built at print time from order_no. Do not read or write. Drop only with a separate approval. See docs/features/Human_Friendly_Codes.';
