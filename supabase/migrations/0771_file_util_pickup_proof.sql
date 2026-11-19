-- =============================================================================
-- 0771_file_util_pickup_proof
--
-- File Util: proof of a counter pickup.
--
-- Staff can photograph the handover (customer with the order, receipt, ID shown)
-- on the Ready screen before confirming the pickup. The pickup completion command
-- (lib/services/pickup/pickup-completion.service.ts) locks these files in the same
-- transaction as the CONFIRM_PICKUP workflow step, like the delivery proof
-- (DELIVERY_PROOF, 0758). A locked file cannot be edited or deleted.
--
-- Adds:
--   * ORDER_FILE purpose PICKUP_PROOF (images; at most 10 per order).
--   * Its allowed file types: the same image types as DELIVERY_PROOF.
-- =============================================================================

BEGIN;

-- Not the default purpose: the category already has BEFORE_IMAGE as default.
INSERT INTO public.sys_file_purpose_cd
  (category_code, purpose_code, max_files, max_size_bytes, is_default, name, name2, description, description2, rec_order, created_by, created_info)
VALUES
  ('ORDER_FILE', 'PICKUP_PROOF', 10, NULL, false, 'Pickup proof', 'إثبات الاستلام',
   'Photos taken when the customer collects the order at the counter; locked when the pickup is confirmed.',
   'صور عند استلام العميل للطلب من الفرع؛ تُقفل عند تأكيد الاستلام.',
   85, 'system', '0771_file_util_pickup_proof')
ON CONFLICT (category_code, purpose_code) DO NOTHING;

-- Same image types as DELIVERY_PROOF (no PDF, no video: proof is a photo).
INSERT INTO public.sys_file_purpose_mime_dtl
  (category_code, purpose_code, mime_type, rec_order, created_by, created_info)
VALUES
  ('ORDER_FILE', 'PICKUP_PROOF', 'image/jpeg', 10, 'system', '0771_file_util_pickup_proof'),
  ('ORDER_FILE', 'PICKUP_PROOF', 'image/png', 20, 'system', '0771_file_util_pickup_proof'),
  ('ORDER_FILE', 'PICKUP_PROOF', 'image/webp', 30, 'system', '0771_file_util_pickup_proof'),
  ('ORDER_FILE', 'PICKUP_PROOF', 'image/heic', 40, 'system', '0771_file_util_pickup_proof'),
  ('ORDER_FILE', 'PICKUP_PROOF', 'image/heif', 50, 'system', '0771_file_util_pickup_proof')
ON CONFLICT (category_code, purpose_code, mime_type) DO NOTHING;

COMMIT;
