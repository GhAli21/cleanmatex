-- ============================================================
-- Migration: 0503_ntf_runtime_wa_sandbox_to.sql
-- Purpose:   Add optional WhatsApp sandbox destination override.
--            Empty value keeps customer / order-mobile routing.
-- Affected:  sys_ntf_runtime_cf
-- Related:   0502_ntf_runtime_hub_flags.sql
-- ============================================================
-- Do not apply automatically. Review first.
-- ROLLBACK PLAN: DELETE FROM sys_ntf_runtime_cf WHERE key = 'wa_sandbox_to_phone';
-- ON CONFLICT DO NOTHING so re-apply does not overwrite ops edits.

BEGIN;

INSERT INTO public.sys_ntf_runtime_cf (
  key,
  value,
  is_active,
  rec_status,
  rec_notes,
  created_by,
  created_info
)
VALUES
  (
    'wa_sandbox_to_phone',
    '',
    true,
    1,
    'Env: TWILIO_WHATSAPP_SANDBOX_TO. Optional sandbox To number (E.164 or whatsapp:+E.164). Empty = customer phone, then org_orders_mst.customer_mobile_number. Leave empty in production.',
    'system',
    '0503_ntf_runtime_wa_sandbox_to'
  )
ON CONFLICT (key) DO NOTHING;

COMMIT;
