-- ============================================================================
-- 0393 — Retire 'billing_payments' navigation entry
-- ============================================================================
-- Context : Order-Fin remediation 2026-07, Phase 3
--           (docs/features/Order_Fin/Order_Fin_Remediation_2026-07/PLAN.md).
--           The /dashboard/internal_fin/payments screens were removed from the
--           frontend: they listed/created/cancelled rows in the DEPRECATED
--           org_payments_dtl_tr ledger (ADR-002 — no new writes; canonical
--           money entry is order checkout / collect-payment, AR invoice
--           payments, and customer receipts).
-- Dual-write: web-admin/config/navigation.ts removed the 'billing_payments'
--           child in the same change set. Neither side alone is complete.
-- Safety  : soft-retire only (is_active=false, rec_status=0) — reversible,
--           no row deletion, idempotent. Descendants: none (leaf node).
-- ============================================================================

UPDATE public.sys_components_cd
SET
  is_active    = false,
  is_navigable = false,
  rec_status   = 0,
  updated_at   = now(),
  updated_info = 'Order-Fin remediation Phase 3 — internal_fin/payments screens retired with deprecated org_payments_dtl_tr ledger (ADR-002); migration 0393'
WHERE comp_code = 'billing_payments';

-- Verification (expected: 1 row, is_active=false, is_navigable=false):
--   SELECT comp_code, is_active, is_navigable, rec_status
--   FROM sys_components_cd WHERE comp_code = 'billing_payments';