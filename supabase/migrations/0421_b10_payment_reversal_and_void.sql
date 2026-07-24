-- =============================================================================
-- 0421_b10_payment_reversal_and_void.sql
-- B10 — Payment Reversal and Void
-- (Order Fin Remediation, Remediation_Work_Packages)
--
-- Purpose:
--   1. Add dedicated actor-audit columns (voided_by/at, reversed_by/at) to
--      org_order_payments_dtl for the new VOID / REVERSE back-office
--      transitions (D001 canonical graph; D004 Option B taxonomy) — mirrors
--      migration 0415's verified_by/cancelled_by/failed_by precedent.
--   2. Add a `reversed_payment_id` lineage column to
--      org_cash_drawer_movements_dtl for REVERSE's compensating OUT movement.
--      Deliberately NOT `order_payment_id` — B16/B35's expected-cash formula
--      only treats `order_payment_id IS NULL` movements as "manual"
--      (compensating); reusing that column would make the compensating
--      movement invisible to the drawer's expected-cash math.
--   3. Seed sys_cash_drawer_movement_type_cd with PAYMENT_REVERSAL (mirrors
--      migration 0412's SV_FUNDING_TENDER precedent).
--   4. Seed two new orders:* permissions (void_payment, reverse_payment) and
--      grant to the same finance-control role set as 0415's cancel/fail
--      codes.
--   5. Extend chk_history_action_type with PAYMENT_VOIDED and
--      PAYMENT_REVERSED so the outbox-driven history consumer can persist
--      the two new transition outcomes (mirrors 0415's PAYMENT_CANCELLED/
--      PAYMENT_FAILED addition).
--
-- Decisions: D001 (transition graph — COMPLETED/CAPTURED/SETTLED -> REVERSED,
--            AUTHORIZED -> VOIDED), D004 (refund vs reversal vs void — Option
--            B, three distinct transaction types), D010 (idempotency —
--            enforced in code via the existing org_idempotency_keys table,
--            no schema change).
-- Dependencies:
--   0415_b30_b32_payment_transitions_and_permissions.sql — actor-audit column precedent
--   0412_b03_stored_value_funding_capture.sql            — movement-type seed precedent
--   0271_v1_payment_linking_cols.sql                     — fk_org_cdm_order_payment precedent
-- Work packages:
--   docs/features/Order_Fin/Remediation_Work_Packages/B10_Payment_Reversal_And_Void.md
--
-- WHY this migration is safe:
--   • New columns are nullable, additive — no backfill, no existing-row impact.
--   • Permission INSERTs use ON CONFLICT DO NOTHING (idempotent).
--   • Role mappings use NOT EXISTS (idempotent).
--   • Movement-type seed uses ON CONFLICT DO UPDATE (idempotent).
--   • CHECK constraint dropped with RESTRICT and re-added in the same
--     transaction (proves no dependent objects); new values are additive
--     so every existing row still satisfies the new constraint.
--   • New FK is nullable and ON DELETE SET NULL — cannot orphan a row.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Actor-audit columns on org_order_payments_dtl (VOID / REVERSE)
-- -----------------------------------------------------------------------------

ALTER TABLE public.org_order_payments_dtl
  ADD COLUMN IF NOT EXISTS voided_by   UUID NULL,
  ADD COLUMN IF NOT EXISTS voided_at   TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS reversed_by UUID NULL,
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.org_order_payments_dtl.voided_by IS
  'B10 — actor who transitioned this leg PENDING/PROCESSING/AUTHORIZED -> VOIDED via the back-office transition service (payment-transition.service.ts). A never-effective leg erased as a mistaken/duplicate entry — distinct from CANCEL, which corrects a genuinely failed settlement plan (D004 Option B).';
COMMENT ON COLUMN public.org_order_payments_dtl.reversed_at IS
  'B10 — actor/timestamp of the transition COMPLETED/CAPTURED/SETTLED -> REVERSED (error-correction negation with mandatory lineage, D004 Option B). Cash-family legs carry a compensating org_cash_drawer_movements_dtl OUT row linked via reversed_payment_id.';

-- -----------------------------------------------------------------------------
-- 2. Reversal lineage column on org_cash_drawer_movements_dtl
-- -----------------------------------------------------------------------------

ALTER TABLE public.org_cash_drawer_movements_dtl
  ADD COLUMN IF NOT EXISTS reversed_payment_id UUID NULL;

COMMENT ON COLUMN public.org_cash_drawer_movements_dtl.reversed_payment_id IS
  'B10 — back-link to the org_order_payments_dtl row this PAYMENT_REVERSAL OUT movement compensates. Deliberately distinct from order_payment_id: the B16/B35 expected-cash formula only treats order_payment_id IS NULL movements as manual/compensating, and this movement must count as compensating (the original payment already left the COMPLETED set at the moment this movement is created).';

ALTER TABLE public.org_cash_drawer_movements_dtl
  ADD CONSTRAINT fk_org_cdm_reversed_payment
  FOREIGN KEY (reversed_payment_id) REFERENCES public.org_order_payments_dtl (id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_org_cdm_reversed_payment
  ON public.org_cash_drawer_movements_dtl (reversed_payment_id)
  WHERE reversed_payment_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. New cash-drawer movement type — PAYMENT_REVERSAL
-- -----------------------------------------------------------------------------

INSERT INTO public.sys_cash_drawer_movement_type_cd (
  code, name, name2, description, description2,
  default_direction, affects_expected_cash, display_order, is_active, rec_status, created_at
) VALUES (
  'PAYMENT_REVERSAL', 'Payment Reversal', 'عكس دفعة',
  'Compensating cash-out movement for a reversed (error-corrected) COMPLETED cash-family payment leg',
  'حركة إخراج نقدي تعويضية لدفعة نقدية مكتملة تم عكسها (تصحيح خطأ)',
  'OUT', TRUE, 70, TRUE, 1, CURRENT_TIMESTAMP
)
ON CONFLICT (code) DO UPDATE SET
  name                  = EXCLUDED.name,
  name2                 = EXCLUDED.name2,
  description           = EXCLUDED.description,
  description2          = EXCLUDED.description2,
  default_direction     = EXCLUDED.default_direction,
  affects_expected_cash = EXCLUDED.affects_expected_cash,
  is_active             = EXCLUDED.is_active,
  rec_status            = EXCLUDED.rec_status;

-- -----------------------------------------------------------------------------
-- 4. Permissions + role grants
-- -----------------------------------------------------------------------------

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('orders:void_payment',
   'Void Payment Leg', 'إلغاء دفعة (تصفير)',
   'actions',
   'Void a PENDING/PROCESSING/AUTHORIZED payment leg (mistaken/duplicate entry) with a mandatory reason — no money movement',
   'إلغاء دفعة معلقة أو قيد المعالجة أو مصرح بها (إدخال خاطئ أو مكرر) مع سبب إلزامي — دون أي حركة مالية',
   'Orders', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('orders:reverse_payment',
   'Reverse Payment Leg', 'عكس دفعة',
   'actions',
   'Reverse a COMPLETED/CAPTURED/SETTLED payment leg as an error correction (mandatory reason; cash legs require an open drawer session for the compensating movement)',
   'عكس دفعة مكتملة كتصحيح لخطأ (سبب إلزامي؛ الدفعات النقدية تتطلب جلسة درج نقدي مفتوحة للحركة التعويضية)',
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

-- Same finance-control role set as 0415's orders:cancel_payment/fail_payment —
-- front-desk collects, finance/management corrects/voids/reverses.
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin', 'branch_manager')
  AND p.code IN ('orders:void_payment', 'orders:reverse_payment')
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- -----------------------------------------------------------------------------
-- 5. Extend chk_history_action_type with PAYMENT_VOIDED / PAYMENT_REVERSED
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
    -- B30 (migration 0415; outbox-driven)
    'PAYMENT_CANCELLED',
    'PAYMENT_FAILED',
    -- B10 (this migration; outbox-driven)
    'PAYMENT_VOIDED',
    'PAYMENT_REVERSED'
  ));

COMMENT ON COLUMN public.org_order_history.action_type IS
  'Action type. Legacy: ORDER_CREATED, STATUS_CHANGE, FIELD_UPDATE, SPLIT, QA_DECISION, ITEM_STEP, ISSUE_CREATED, ISSUE_SOLVED, ORDER_CANCELLED, CUSTOMER_RETURN. BVM Phase 5 (outbox-driven): ORDER_COMPLETED, VOUCHER_POSTED_AND_WIRED, AR_INVOICE_ISSUED. BVM Phase 6: PAYMENT_VERIFIED. B30: PAYMENT_CANCELLED, PAYMENT_FAILED. B10: PAYMENT_VOIDED, PAYMENT_REVERSED.';

-- -----------------------------------------------------------------------------
-- 6. Validation
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.sys_auth_permissions
  WHERE code IN ('orders:void_payment', 'orders:reverse_payment');
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'B10 permissions not fully seeded (found % of 2)', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.sys_auth_role_default_permissions
  WHERE permission_code IN ('orders:void_payment', 'orders:reverse_payment')
    AND role_code = 'super_admin';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'orders:void_payment/reverse_payment missing super_admin grant';
  END IF;

  SELECT COUNT(*) INTO v_count FROM information_schema.check_constraints
  WHERE constraint_name = 'chk_history_action_type'
    AND check_clause LIKE '%PAYMENT_VOIDED%'
    AND check_clause LIKE '%PAYMENT_REVERSED%';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'chk_history_action_type missing PAYMENT_VOIDED/PAYMENT_REVERSED';
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.sys_cash_drawer_movement_type_cd
  WHERE code = 'PAYMENT_REVERSAL';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'PAYMENT_REVERSAL movement type was not seeded';
  END IF;

  SELECT COUNT(*) INTO v_count FROM information_schema.columns
  WHERE table_name = 'org_order_payments_dtl' AND column_name IN ('voided_by', 'voided_at', 'reversed_by', 'reversed_at');
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'org_order_payments_dtl actor-audit columns not fully created (found % of 4)', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM information_schema.columns
  WHERE table_name = 'org_cash_drawer_movements_dtl' AND column_name = 'reversed_payment_id';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'org_cash_drawer_movements_dtl.reversed_payment_id column not created';
  END IF;

  RAISE NOTICE '✓ Migration 0421 validation passed';
  RAISE NOTICE '  - voided_by/at + reversed_by/at added to org_order_payments_dtl';
  RAISE NOTICE '  - reversed_payment_id added to org_cash_drawer_movements_dtl (+ FK + index)';
  RAISE NOTICE '  - PAYMENT_REVERSAL movement type seeded';
  RAISE NOTICE '  - orders:void_payment / orders:reverse_payment seeded + granted';
  RAISE NOTICE '  - chk_history_action_type extended with PAYMENT_VOIDED, PAYMENT_REVERSED';
END $$;

COMMIT;

-- =============================================================================
-- POST-MIGRATION NOTES
-- =============================================================================
-- 1. Prisma schema.prisma must be hand-updated to mirror the 4 new columns on
--    org_order_payments_dtl and the 1 new column + FK on
--    org_cash_drawer_movements_dtl (this project maintains schema.prisma by
--    hand, not via `prisma db pull`), then `npx prisma generate` re-run.
-- 2. The transition service (extended, not new) lives at
--    lib/services/payment-transition.service.ts; same routes as B30:
--      GET  /api/v1/finance/pending-payments
--      POST /api/v1/finance/pending-payments/[paymentId]/transition
--    (action: VOID | REVERSE, alongside the existing VERIFY/CANCEL/FAIL_BOUNCE)
-- 3. B13 (Voucher Reversal Operational Unwind) depends on this migration's
--    REVERSED writer as its payment-reversal primitive — do not begin B13
--    implementation until this migration is applied and B10 is VERIFIED.
-- 4. To rollback: revoke the two role grants, delete the two
--    sys_auth_permissions rows, revert chk_history_action_type to the 0415
--    form, drop fk_org_cdm_reversed_payment + idx_org_cdm_reversed_payment,
--    drop the reversed_payment_id column, drop the 4 new
--    org_order_payments_dtl columns (all additive/nullable — safe to drop),
--    leave the PAYMENT_REVERSAL movement-type row (harmless if unused).
-- =============================================================================
