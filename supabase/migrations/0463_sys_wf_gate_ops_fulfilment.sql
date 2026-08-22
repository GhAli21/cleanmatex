-- ==================================================================
-- 0463_sys_wf_gate_ops_fulfilment.sql
-- Purpose: Register piece, QA, fulfilment, and evidence gate codes used by
--          the shared semantic workflow evaluator. HQ can bind these gates
--          only after this catalog seed exists.
-- Author: CleanMateX Development Team
-- Created: 2026-08-22
-- Dependencies: 0427_sys_wf_catalogs_and_state_version.sql,
--               0449_sys_wf_gate_prep_not_completed.sql
-- DO NOT APPLY automatically — review then run via normal DB process.
-- ==================================================================

BEGIN;

INSERT INTO public.sys_wf_gate_defs_cd (gate_code, name, name2, description) VALUES
  (
    'all_pieces_scanned',
    'All pieces scanned',
    'كل القطع ممسوحة',
    'When piece tracking is enabled, every active piece must be scanned before the bound action.'
  ),
  (
    'all_items_ready',
    'All items ready',
    'كل البنود جاهزة',
    'Every active order item must be ready before the bound action.'
  ),
  (
    'all_pieces_ready',
    'All pieces ready',
    'كل القطع جاهزة',
    'When piece tracking is enabled, every active piece must be ready before the bound action.'
  ),
  (
    'qa_passed',
    'Quality passed',
    'الجودة مجتازة',
    'Quality must be passed and open issues closed before the bound action.'
  ),
  (
    'unpaid_cancel_disposition',
    'Unpaid cancel disposition',
    'تصرف إلغاء غير مدفوع',
    'Blocks cancel while an outstanding balance remains and no finance disposition exists.'
  ),
  (
    'pickup_collection_settled',
    'Pickup collection settled',
    'تحصيل الاستلام مكتمل',
    'Pay-on-collection balance must be settled before confirming counter pickup.'
  ),
  (
    'delivery_collection_settled',
    'Delivery collection settled',
    'تحصيل التوصيل مكتمل',
    'Pay-on-collection balance must be settled before confirming delivery.'
  ),
  (
    'pickup_release_valid',
    'Pickup release valid',
    'إفراج الاستلام صالح',
    'Staged pickup requires an open pickup release record.'
  ),
  (
    'delivery_stop_active',
    'Delivery stop active',
    'محطة التوصيل نشطة',
    'Delivery confirmation requires an active pending or in-transit stop.'
  ),
  (
    'pod_evidence_valid',
    'POD evidence valid',
    'إثبات التسليم صالح',
    'Configured signature or photo proof-of-delivery must be present at execute. OTP remains unsupported.'
  ),
  (
    'partial_fulfilment_supported',
    'Partial fulfilment supported',
    'التنفيذ الجزئي مدعوم',
    'Fails closed until selected-piece partial fulfilment services exist.'
  ),
  (
    'return_service_available',
    'Return service available',
    'خدمة الإرجاع متاحة',
    'Fails closed until the V1.1 return sub-order service exists.'
  )
ON CONFLICT (gate_code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  is_active = true,
  rec_status = 1,
  updated_at = CURRENT_TIMESTAMP;

COMMIT;
