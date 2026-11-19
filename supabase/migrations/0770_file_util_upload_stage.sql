-- =============================================================================
-- 0770_file_util_upload_stage
--
-- File Util: record the workflow stage of the owning record at upload time.
--
-- Why: `source_code` says which screen a file came from, but a screen such as
-- order details is open in every stage. With `stage_code`, the server writes the
-- owning record's status at upload (for an order: intake, preparation, processing,
-- assembly, qa, packing, ready, ready_for_pickup, out_for_delivery, delivered ...).
-- The UI and reports can then group a record's files by stage.
--
-- Also:
--   * Adds the ORDER_PACKING upload source (the packing screen now attaches files).
--   * Adds the order statuses PROCESSING and READY_FOR_PICKUP to
--     sys_order_status_cd. The workflow uses them (lib/types/workflow.ts), but the
--     lookup did not have them. File Util reads stage names from this lookup.
--
-- Existing files keep stage_code NULL: their stage at upload is not known. No
-- backfill is made, because a guess would be wrong data.
-- =============================================================================

BEGIN;

-- 1. Stage snapshot on every file ---------------------------------------------

-- Filled only by the server (file-util.service initFileUpload), never by the client.
-- No FK: each category takes its stage from a different domain (orders now; other
-- record types may follow), so the column holds that domain's code as the record
-- stores it.
ALTER TABLE public.org_file_mst
  ADD COLUMN IF NOT EXISTS stage_code TEXT NULL;

COMMENT ON COLUMN public.org_file_mst.stage_code IS
  'Workflow stage of the owning record when the file was uploaded, written by the server (ORDER_FILE: org_orders_mst.current_status, lowercase, e.g. preparation, ready_for_pickup). NULL when the category has no stages or the file is older than 0770. Never changes after upload.';

-- 2. Upload source for the packing screen ---------------------------------------

INSERT INTO public.sys_file_source_cd
  (source_code, name, name2, rec_order, created_by, created_info)
VALUES
  ('ORDER_PACKING', 'Packing', 'التغليف', 75, 'system', '0770_file_util_upload_stage')
ON CONFLICT (source_code) DO NOTHING;

-- 3. Missing order statuses in the lookup ----------------------------------------

-- Display data only: the workflow engine does not read this table, so
-- allowed_next_statuses and SLA stay empty. Codes are uppercase like the existing rows.
-- File Util matches them to the lowercase order status without regard to case.
INSERT INTO public.sys_order_status_cd
  (code, name, name2, display_order, is_initial_status, is_final_status, is_system, is_active, created_info)
VALUES
  ('PROCESSING', 'Processing', 'المعالجة', 4, false, false, true, true, '0770_file_util_upload_stage'),
  ('READY_FOR_PICKUP', 'Ready for pickup', 'جاهز للاستلام', 12, false, false, true, true, '0770_file_util_upload_stage')
ON CONFLICT (code) DO NOTHING;

COMMIT;
