-- ============================================================================
-- 0394 — Retire 'billing_cashup' navigation entry
-- ============================================================================
-- Context : Order-Fin remediation 2026-07, Phase 5
--           (docs/features/Order_Fin/Order_Fin_Remediation_2026-07/PLAN.md).
--           The legacy Cash Up screen computed expected cash from the
--           DEPRECATED org_payments_dtl_tr ledger (ADR-002) and is superseded
--           by cash drawer sessions + the D-09 cash-drawer reconciliation
--           report (validation finding FN-06). The frontend page, service,
--           and actions are removed in the same change set.
-- Dual-write: web-admin/config/navigation.ts removes the 'billing_cashup'
--           child in the same change set. Neither side alone is complete.
-- Safety  : soft-retire only (is_active=false, rec_status=0) — reversible,
--           no row deletion, idempotent. Leaf node, no descendants.
-- ============================================================================

UPDATE public.sys_components_cd
SET
  is_active    = false,
  is_navigable = false,
  rec_status   = 0,
  updated_at   = now(),
  updated_info = 'Order-Fin remediation Phase 5 — Cash Up superseded by cash drawer sessions + D-09 reconciliation (FN-06, ADR-002); migration 0394'
WHERE comp_code = 'billing_cashup';

-- Verification (expected: 1 row, is_active=false, is_navigable=false):
--   SELECT comp_code, is_active, is_navigable, rec_status
--   FROM sys_components_cd WHERE comp_code = 'billing_cashup';
