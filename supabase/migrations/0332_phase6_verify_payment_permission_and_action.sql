-- ==================================================================
-- 0332_phase6_verify_payment_permission_and_action.sql
-- Purpose: BVM Wiring Phase 6 Sub-item 1 — Verify-Payment feature
--          (1) Seed the new `orders:verify_payment` permission and
--              map it to financial roles (super_admin, tenant_admin,
--              admin, branch_manager).
--          (2) Extend `chk_history_action_type` on org_order_history
--              to allow the new PAYMENT_VERIFIED action emitted by the
--              outbox-history consumer when a PENDING REAL_PAYMENT leg
--              is flipped to COMPLETED via the verify endpoint.
-- Plan: docs/features/Order_Fin/bvm_wiring_phase6_to_program_end_RESUME.md § Sub-item 1
-- PRD: CleanMateX_Business_Voucher_Wiring_PRD_v2_1_Ready_For_Implementation.md
-- Dependencies:
--   0022_order_history_canonical.sql                 — base chk_history_action_type
--   0133_order_history_action_types_cancel_return.sql — extended action types
--   0294_financial_permissions_seed.sql              — orders financial permission family
--   0330_phase5_order_history_bvm_action_types.sql   — outbox-driven action types
-- ==================================================================
-- WHY this migration is safe:
--   • Permission INSERTs use ON CONFLICT DO NOTHING (idempotent).
--   • Role mappings use NOT EXISTS (idempotent, skips roles that do not
--     yet exist via CROSS JOIN semantics).
--   • CHECK constraint is dropped with RESTRICT and re-added in the same
--     transaction; CHECK constraints have no dependents.
--   • New action type is additive — existing rows still satisfy the new
--     constraint because their action_type was valid before.
-- ==================================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────────
-- Step 1 — Seed `orders:verify_payment` permission
-- ──────────────────────────────────────────────────────────────────
-- Why a dedicated permission and not orders:collect_payment:
-- Verifying that a gateway-routed or check-tendered payment has actually
-- cleared is a back-office assurance step distinct from collecting cash
-- at the counter. Operators may collect but only managers/finance flip
-- PENDING → COMPLETED once the bank/gateway confirms.

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('orders:verify_payment',
   'Verify Payment',
   'التحقق من الدفعة',
   'actions',
   'Verify that a PENDING order payment has cleared at the gateway/bank and flip it to COMPLETED',
   'التحقق من تسوية الدفعة المعلقة لدى البوابة/البنك وتحويلها إلى مكتملة',
   'Orders', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────
-- Step 2 — Role default mappings (finance-capable roles only)
-- ──────────────────────────────────────────────────────────────────
-- Why these roles:
-- Verification is a financial control. super_admin / tenant_admin / admin
-- have full financial reach. branch_manager owns operational finance at
-- the branch level. operator is intentionally excluded — front-desk
-- collects, finance/management verifies.

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin', 'branch_manager')
  AND p.code = 'orders:verify_payment'
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- ──────────────────────────────────────────────────────────────────
-- Step 3 — Extend chk_history_action_type with PAYMENT_VERIFIED
-- ──────────────────────────────────────────────────────────────────
-- Why this constraint changes:
-- The verify endpoint emits an outbox event PAYMENT_VERIFIED. The
-- Phase 5 order-history consumer translates that event into an
-- org_order_history row keyed by action_type. The action_type column
-- has a strict CHECK enum and would reject the new value without this
-- ALTER. Dropping with RESTRICT proves no dependent objects exist.

ALTER TABLE org_order_history DROP CONSTRAINT IF EXISTS chk_history_action_type RESTRICT;

ALTER TABLE org_order_history
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
    -- BVM Phase 6 Sub-item 1 (outbox-driven; emitted by verify endpoint
    -- when a PENDING REAL_PAYMENT leg is flipped to COMPLETED)
    'PAYMENT_VERIFIED'
  ));

COMMENT ON COLUMN org_order_history.action_type IS
  'Action type. Legacy: ORDER_CREATED, STATUS_CHANGE, FIELD_UPDATE, SPLIT, QA_DECISION, ITEM_STEP, ISSUE_CREATED, ISSUE_SOLVED, ORDER_CANCELLED, CUSTOMER_RETURN. BVM Phase 5 (outbox-driven): ORDER_COMPLETED, VOUCHER_POSTED_AND_WIRED, AR_INVOICE_ISSUED. BVM Phase 6: PAYMENT_VERIFIED.';

-- ──────────────────────────────────────────────────────────────────
-- Step 4 — Validation
-- ──────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_permission_exists BOOLEAN;
  v_role_mapping_count INTEGER;
  v_check_includes_verified INTEGER;
BEGIN
  -- Permission must exist
  SELECT EXISTS (
    SELECT 1 FROM public.sys_auth_permissions
    WHERE code = 'orders:verify_payment'
  ) INTO v_permission_exists;

  IF NOT v_permission_exists THEN
    RAISE EXCEPTION 'orders:verify_payment permission not seeded';
  END IF;

  -- At least super_admin must be mapped (other roles may not exist yet
  -- in fresh installs and are skipped by the CROSS JOIN; that is OK).
  SELECT COUNT(*) INTO v_role_mapping_count
  FROM public.sys_auth_role_default_permissions
  WHERE permission_code = 'orders:verify_payment'
    AND role_code IN ('super_admin', 'tenant_admin', 'admin', 'branch_manager');

  IF v_role_mapping_count = 0 THEN
    RAISE EXCEPTION 'orders:verify_payment has no role default mappings';
  END IF;

  -- CHECK constraint must include PAYMENT_VERIFIED
  SELECT COUNT(*) INTO v_check_includes_verified
  FROM information_schema.check_constraints
  WHERE constraint_name = 'chk_history_action_type'
    AND check_clause LIKE '%PAYMENT_VERIFIED%';

  IF v_check_includes_verified = 0 THEN
    RAISE EXCEPTION 'chk_history_action_type does not include PAYMENT_VERIFIED';
  END IF;

  RAISE NOTICE '✓ Migration 0332 validation passed';
  RAISE NOTICE '  - orders:verify_payment permission seeded';
  RAISE NOTICE '  - Role default mappings created (%)', v_role_mapping_count;
  RAISE NOTICE '  - chk_history_action_type extended with PAYMENT_VERIFIED';
END $$;

COMMIT;

-- ==================================================================
-- POST-MIGRATION NOTES
-- ==================================================================
-- 1. No Prisma schema regeneration required — no new tables or columns.
-- 2. The verify endpoint lives at:
--      POST /api/v1/orders/[id]/payments/[paymentId]/verify
-- 3. The order-history consumer must be updated (in the same Phase 6
--    Sub-item 1 PR) to map PAYMENT_VERIFIED outbox events to history
--    rows. See lib/services/order-history-consumer.service.ts.
-- 4. To rollback: revert chk_history_action_type to the 0330 form and
--    revoke the permission via sys_auth_role_default_permissions DELETE.
