-- =============================================================================
-- 0415_b30_b32_payment_transitions_and_permissions.sql
-- B30 — Pending-Payment Back-office Lifecycle
-- B32 — Drawer Status Gating and Status Override
-- (Order Fin Remediation, Remediation_Work_Packages)
--
-- Purpose:
--   1. Add dedicated actor-audit + fallback-classification columns to
--      org_order_payments_dtl for the new VERIFY / CANCEL / FAIL_BOUNCE
--      back-office transition service (D001 canonical graph subset,
--      D009 governed fallback classification). Existing verifyPaymentTx
--      keeps writing updated_by/paid_at unchanged — these are additive,
--      dedicated columns so the worklist UI can show "who/when" without
--      waiting on the async outbox → order_history path.
--   2. Seed three new orders:* permissions (pending_payments_view,
--      cancel_payment, fail_payment) and grant to the finance-capable
--      roles — mirrors 0332's orders:verify_payment precedent. B30's own
--      doc assumed B27 had already seeded cancel/fail codes; re-verified
--      against migration 0411 and the live permission set — it had not
--      (0411 §7 only confirms the unrelated, orphaned `payments:cancel`
--      code from 0095). This migration closes that gap.
--   3. Extend chk_history_action_type with PAYMENT_CANCELLED and
--      PAYMENT_FAILED so the outbox-driven history consumer can persist
--      the two new transition outcomes (mirrors 0332's PAYMENT_VERIFIED).
--   4. Seed a sys_components_cd nav entry for the new cross-order
--      pending-payments worklist screen.
--
-- Decisions: D001 (transition graph + controlled override), D009 (fallback
--            classification), D010 (idempotency/lineage — enforced in code
--            via the existing org_idempotency_keys table, no schema change).
-- Dependencies:
--   0325_payment_method_config_enrichment.sql          — allow_status_override column (B32)
--   0332_phase6_verify_payment_permission_and_action.sql — PAYMENT_VERIFIED precedent
--   0410_b07_financial_outbox_processor.sql            — nav/perm seeding pattern copied
--   0411_b27_financial_permissions_and_approvals.sql   — same
-- Work packages:
--   docs/features/Order_Fin/Remediation_Work_Packages/B30_Pending_Payment_Backoffice_Lifecycle.md
--   docs/features/Order_Fin/Remediation_Work_Packages/B32_Drawer_Status_Gating_And_Status_Override.md
--
-- WHY this migration is safe:
--   • New columns are nullable, additive — no backfill, no existing-row impact.
--   • Permission INSERTs use ON CONFLICT DO NOTHING (idempotent).
--   • Role mappings use NOT EXISTS (idempotent).
--   • CHECK constraint dropped with RESTRICT and re-added in the same
--     transaction (proves no dependent objects); new values are additive
--     so every existing row still satisfies the new constraint.
--   • Nav insert uses ON CONFLICT DO UPDATE (idempotent, re-runnable).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Actor-audit + fallback-classification columns on org_order_payments_dtl
-- -----------------------------------------------------------------------------

ALTER TABLE public.org_order_payments_dtl
  ADD COLUMN IF NOT EXISTS verified_by            UUID NULL,
  ADD COLUMN IF NOT EXISTS verified_at             TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS cancelled_by            UUID NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at            TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS failed_by               UUID NULL,
  ADD COLUMN IF NOT EXISTS failed_at               TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS transition_reason       TEXT NULL,
  ADD COLUMN IF NOT EXISTS fallback_classification TEXT NULL;

COMMENT ON COLUMN public.org_order_payments_dtl.verified_by IS
  'B30 — actor who transitioned this leg PENDING/PROCESSING -> COMPLETED via the back-office transition service (payment-transition.service.ts). Distinct from the generic updated_by, which the pre-existing verifyPaymentTx path continues to write unchanged.';
COMMENT ON COLUMN public.org_order_payments_dtl.cancelled_by IS
  'B30 — actor who transitioned this leg PENDING/PROCESSING -> CANCELLED.';
COMMENT ON COLUMN public.org_order_payments_dtl.failed_by IS
  'B30 — actor who transitioned this leg PENDING/PROCESSING -> FAILED (bounce/reject).';
COMMENT ON COLUMN public.org_order_payments_dtl.transition_reason IS
  'B30 — mandatory operator reason recorded on CANCEL/FAIL_BOUNCE transitions (D001 controlled-override governance). NULL for VERIFY (no reason required).';
COMMENT ON COLUMN public.org_order_payments_dtl.fallback_classification IS
  'D009 — governed fallback classification recorded at the moment a pending/processing leg is cancelled or marked failed. One of RETRY_TENDER, PAY_ON_COLLECTION, AR_CREDIT_INVOICE, CANCEL_ORDER_OR_REVERSE_SERVICE, MANUAL_REVIEW. NULL for VERIFY.';

ALTER TABLE public.org_order_payments_dtl
  ADD CONSTRAINT chk_ord_pay_fallback_classification
  CHECK (fallback_classification IS NULL OR fallback_classification IN (
    'RETRY_TENDER',
    'PAY_ON_COLLECTION',
    'AR_CREDIT_INVOICE',
    'CANCEL_ORDER_OR_REVERSE_SERVICE',
    'MANUAL_REVIEW'
  ));

-- Worklist query: cross-order scan of PENDING/PROCESSING real-payment legs
-- for a tenant (optionally filtered by branch/method in application code).
CREATE INDEX IF NOT EXISTS idx_ord_pay_dtl_worklist
  ON public.org_order_payments_dtl (tenant_org_id, payment_status, created_at)
  WHERE payment_nature_snapshot = 'REAL_PAYMENT';

-- -----------------------------------------------------------------------------
-- 2. Permissions + role grants
-- -----------------------------------------------------------------------------

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('orders:pending_payments_view',
   'View Pending Payments Worklist', 'عرض قائمة الدفعات المعلقة',
   'crud',
   'View the cross-order pending/processing payment worklist (B30 back-office lifecycle)',
   'عرض قائمة الدفعات المعلقة أو قيد المعالجة عبر جميع الطلبات (دورة العمليات الخلفية B30)',
   'Orders', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('orders:cancel_payment',
   'Cancel Pending Payment', 'إلغاء دفعة معلقة',
   'actions',
   'Cancel a PENDING or PROCESSING payment leg with a mandatory reason and D009 fallback classification',
   'إلغاء دفعة معلقة أو قيد المعالجة مع سبب إلزامي وتصنيف بديل حسب القرار D009',
   'Orders', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('orders:fail_payment',
   'Mark Payment Failed / Bounced', 'تحديد الدفعة كفاشلة أو مرتجعة',
   'actions',
   'Mark a PENDING or PROCESSING payment leg as FAILED (bounced check, rejected bank transfer, etc.) with a mandatory reason and D009 fallback classification',
   'تحديد دفعة معلقة أو قيد المعالجة كفاشلة (شيك مرتجع، حوالة بنكية مرفوضة، إلخ) مع سبب إلزامي وتصنيف بديل',
   'Orders', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO UPDATE SET
  name          = EXCLUDED.name,
  name2         = EXCLUDED.name2,
  category      = EXCLUDED.category,
  description   = EXCLUDED.description,
  description2  = EXCLUDED.description2,
  category_main = EXCLUDED.category_main,
  is_active     = EXCLUDED.is_active,
  is_enabled    = EXCLUDED.is_enabled,
  rec_status    = EXCLUDED.rec_status;

-- View grant: broader read-only reach (mirrors finance_outbox:view roles).
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin', 'branch_manager', 'finance_manager')
  AND p.code = 'orders:pending_payments_view'
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- Cancel/fail grant: same finance-control role set as orders:verify_payment (0332) —
-- front-desk collects, finance/management verifies AND corrects.
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin', 'branch_manager')
  AND p.code IN ('orders:cancel_payment', 'orders:fail_payment')
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- -----------------------------------------------------------------------------
-- 3. Extend chk_history_action_type with PAYMENT_CANCELLED / PAYMENT_FAILED
-- -----------------------------------------------------------------------------

ALTER TABLE public.org_order_history DROP CONSTRAINT IF EXISTS chk_history_action_type RESTRICT;

ALTER TABLE public.org_order_history
  ADD CONSTRAINT chk_history_action_type
  CHECK (action_type IN (
    -- Legacy (mig 0022 + 0133)
    'ORDER_CREATED',
    'STATUS_CHANGE',
    'FIELD_UPDATE',
    'SPLIT',
    'QA_DECISION',
    'ITEM_STEP',
    'ISSUE_CREATED',
    'ISSUE_SOLVED',
    'ORDER_CANCELLED',
    'CUSTOMER_RETURN',
    -- BVM Phase 5 (outbox-driven)
    'ORDER_COMPLETED',
    'VOUCHER_POSTED_AND_WIRED',
    'AR_INVOICE_ISSUED',
    -- BVM Phase 6 Sub-item 1 (outbox-driven)
    'PAYMENT_VERIFIED',
    -- B30 (this migration; outbox-driven)
    'PAYMENT_CANCELLED',
    'PAYMENT_FAILED'
  ));

COMMENT ON COLUMN public.org_order_history.action_type IS
  'Action type. Legacy: ORDER_CREATED, STATUS_CHANGE, FIELD_UPDATE, SPLIT, QA_DECISION, ITEM_STEP, ISSUE_CREATED, ISSUE_SOLVED, ORDER_CANCELLED, CUSTOMER_RETURN. BVM Phase 5 (outbox-driven): ORDER_COMPLETED, VOUCHER_POSTED_AND_WIRED, AR_INVOICE_ISSUED. BVM Phase 6: PAYMENT_VERIFIED. B30: PAYMENT_CANCELLED, PAYMENT_FAILED.';

-- -----------------------------------------------------------------------------
-- 4. Navigation — pending-payments worklist screen
-- -----------------------------------------------------------------------------

INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code, label, label2, description, description2,
  comp_path, comp_icon, comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, metadata, rec_status
) VALUES (
  'billing_pending_payments', 'billing',
  'Pending Payments', 'الدفعات المعلقة',
  'Cross-order back-office worklist for PENDING/PROCESSING payment legs — verify, cancel, or mark failed/bounced',
  'قائمة عمليات خلفية عبر جميع الطلبات للدفعات المعلقة أو قيد المعالجة — تحقق أو إلغاء أو تحديد كفاشلة/مرتجعة',
  '/dashboard/internal_fin/pending-payments', 'ClockAlert',
  1, 72,
  TRUE, TRUE, TRUE, TRUE, TRUE,
  '["super_admin","tenant_admin","admin","branch_manager","finance_manager"]'::jsonb,
  'orders:pending_payments_view',
  '{"feature":"B30"}'::jsonb,
  1
) ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code = EXCLUDED.parent_comp_code, label = EXCLUDED.label, label2 = EXCLUDED.label2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  comp_path = EXCLUDED.comp_path, comp_icon = EXCLUDED.comp_icon,
  comp_level = EXCLUDED.comp_level, display_order = EXCLUDED.display_order,
  is_leaf = EXCLUDED.is_leaf, is_navigable = EXCLUDED.is_navigable, is_active = EXCLUDED.is_active,
  is_system = EXCLUDED.is_system, is_for_tenant_use = EXCLUDED.is_for_tenant_use,
  roles = EXCLUDED.roles, main_permission_code = EXCLUDED.main_permission_code,
  metadata = EXCLUDED.metadata, updated_at = CURRENT_TIMESTAMP;

UPDATE public.sys_components_cd c
SET parent_comp_id = p.comp_id
FROM public.sys_components_cd p
WHERE c.comp_code = 'billing_pending_payments'
  AND c.parent_comp_code = p.comp_code
  AND (c.parent_comp_id IS NULL OR c.parent_comp_id <> p.comp_id);

-- -----------------------------------------------------------------------------
-- 5. Validation
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.sys_auth_permissions
  WHERE code IN ('orders:pending_payments_view', 'orders:cancel_payment', 'orders:fail_payment');
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'B30 permissions not fully seeded (found % of 3)', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.sys_auth_role_default_permissions
  WHERE permission_code IN ('orders:cancel_payment', 'orders:fail_payment')
    AND role_code = 'super_admin';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'orders:cancel_payment/fail_payment missing super_admin grant';
  END IF;

  SELECT COUNT(*) INTO v_count FROM information_schema.check_constraints
  WHERE constraint_name = 'chk_history_action_type'
    AND check_clause LIKE '%PAYMENT_CANCELLED%'
    AND check_clause LIKE '%PAYMENT_FAILED%';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'chk_history_action_type missing PAYMENT_CANCELLED/PAYMENT_FAILED';
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.sys_components_cd
  WHERE comp_code = 'billing_pending_payments' AND parent_comp_id IS NOT NULL;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'billing_pending_payments nav entry missing or parent_comp_id not resolved';
  END IF;

  SELECT COUNT(*) INTO v_count FROM information_schema.columns
  WHERE table_name = 'org_order_payments_dtl' AND column_name = 'fallback_classification';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'org_order_payments_dtl.fallback_classification column not created';
  END IF;

  RAISE NOTICE '✓ Migration 0415 validation passed';
  RAISE NOTICE '  - actor-audit + fallback-classification columns added to org_order_payments_dtl';
  RAISE NOTICE '  - orders:pending_payments_view / orders:cancel_payment / orders:fail_payment seeded + granted';
  RAISE NOTICE '  - chk_history_action_type extended with PAYMENT_CANCELLED, PAYMENT_FAILED';
  RAISE NOTICE '  - billing_pending_payments nav entry seeded';
END $$;

COMMIT;

-- =============================================================================
-- POST-MIGRATION NOTES
-- =============================================================================
-- 1. Prisma schema.prisma must be hand-updated to mirror the 8 new columns on
--    org_order_payments_dtl (this project maintains schema.prisma by hand, not
--    via `prisma db pull`), then `npx prisma generate` re-run.
-- 2. The new transition service lives at lib/services/payment-transition.service.ts;
--    routes at:
--      GET  /api/v1/finance/pending-payments
--      POST /api/v1/finance/pending-payments/[paymentId]/transition
-- 3. B32's cash-drawer-wiring.handler.ts status gate and the
--    order-settlement-planner.service.ts allow_status_override enforcement are
--    pure application-code changes — no schema impact, not part of this file.
-- 4. To rollback: drop the nav row, revoke the three role grants, delete the
--    three sys_auth_permissions rows, revert chk_history_action_type to the
--    0332 form, drop chk_ord_pay_fallback_classification + the two new
--    indexes, drop the 8 new columns (all additive/nullable — safe to drop).
-- =============================================================================
