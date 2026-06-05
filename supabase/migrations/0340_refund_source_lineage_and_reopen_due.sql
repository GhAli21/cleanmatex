-- ==================================================================
-- 0340_refund_source_lineage_and_reopen_due.sql
-- Purpose: Order Fin v1.1 Phase 6 (ADR-030) — Normalize refund
--          source lineage and add reopens_due_amount.
--
-- Adds two columns to org_order_refunds_dtl:
--   1. refund_source_type TEXT NOT NULL — 7-value CHECK enum classifying
--      WHY a refund was issued and WHAT value vehicle it reversed.
--   2. reopens_due_amount DECIMAL(19,4) NOT NULL DEFAULT 0 — amount of
--      outstanding that reopens on the order due to this refund.
--
-- NOTE: existing column `original_payment_id` already references
-- org_order_payments_dtl(id) and serves as the FK for REAL_PAYMENT_REFUND
-- lineage. A duplicate source_payment_id column is NOT added.
--
-- Backfill logic mirrors the application-level classifyRefunds() heuristic
-- in order-financial-write.service.ts. Rows that cannot be confidently
-- classified are set to 'MANUAL_EXCEPTION' and listed in a review query
-- at the end of this migration for finance lead sign-off.
--
-- Plan: docs/features/Order_Fin/Fix_29_05_2026/
--       order-fin-v1_1-full-alignment-implementation-plan.md § Phase 6
-- ==================================================================
-- WHY this migration is safe:
--   • Additive only — no existing columns dropped or altered.
--   • refund_source_type starts as nullable; CHECK + NOT NULL are added
--     only after the backfill ensures every row has a value.
--   • MANUAL_EXCEPTION is the conservative fallback — it never silently
--     misclassifies a refund; finance can correct via the review query.
--   • reopens_due_amount defaults to 0 — preserves current behavior where
--     no reopen-due amount was tracked.
-- ==================================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────────
-- Step 1 — Add columns (nullable initially to allow safe backfill)
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE public.org_order_refunds_dtl
  ADD COLUMN IF NOT EXISTS refund_source_type TEXT NULL,
  ADD COLUMN IF NOT EXISTS reopens_due_amount DECIMAL(19, 4) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.org_order_refunds_dtl.refund_source_type IS
  'ADR-030 refund source classification. Identifies which value vehicle was reversed: REAL_PAYMENT_REFUND, GIFT_CARD_RESTORE, WALLET_RESTORE, CUSTOMER_ADVANCE_RESTORE, CUSTOMER_CREDIT_ISSUE, CREDIT_NOTE_ISSUE, or MANUAL_EXCEPTION.';

COMMENT ON COLUMN public.org_order_refunds_dtl.reopens_due_amount IS
  'Amount by which the order outstanding reopens after this refund (e.g. REAL_PAYMENT_REFUND that restores cash but the service was already rendered). Default 0 means no reopen. Must be <= refund_amount.';

-- ──────────────────────────────────────────────────────────────────
-- Step 2 — Backfill refund_source_type
--
-- Priority order matches classifyRefunds() in the write service:
--   1. REAL_PAYMENT_REFUND  — cash/card reverse; original_payment_id IS NOT NULL
--      OR refund_method_code IN ('CASH', 'ORIGINAL_METHOD')
--   2. GIFT_CARD_RESTORE    — metadata.original_credit_type = 'GIFT_CARD'
--   3. CUSTOMER_ADVANCE_RESTORE — metadata.original_credit_type = 'CUSTOMER_ADVANCE'
--   4. WALLET_RESTORE       — WALLET method, LOYALTY_CREDIT, or generic STORED_VALUE
--   5. CREDIT_NOTE_ISSUE    — credit note document issued
--   6. CUSTOMER_CREDIT_ISSUE — customer credit balance issued
--   7. MANUAL_EXCEPTION     — everything else (finance review required)
-- ──────────────────────────────────────────────────────────────────

UPDATE public.org_order_refunds_dtl
SET refund_source_type = CASE

  -- Priority 1: real payment reversal — cash, card, check, or linked payment row
  WHEN original_payment_id IS NOT NULL
    OR refund_method_code IN ('CASH', 'ORIGINAL_METHOD')
    THEN 'REAL_PAYMENT_REFUND'

  -- Priority 2: gift card balance restoration
  WHEN (metadata ->> 'original_credit_type') = 'GIFT_CARD'
    OR (metadata ->> 'refund_destination_type') = 'GIFT_CARD'
    THEN 'GIFT_CARD_RESTORE'

  -- Priority 3: customer advance restoration
  WHEN (metadata ->> 'original_credit_type') = 'CUSTOMER_ADVANCE'
    THEN 'CUSTOMER_ADVANCE_RESTORE'

  -- Priority 4: wallet / loyalty-credit / generic stored-value restoration
  WHEN refund_method_code = 'WALLET'
    OR (metadata ->> 'original_credit_type') IN ('WALLET', 'LOYALTY_CREDIT')
    OR (metadata ->> 'refund_destination_type') = 'STORED_VALUE'
    THEN 'WALLET_RESTORE'

  -- Priority 5: credit note fiscal document issued
  WHEN refund_method_code = 'CREDIT_NOTE'
    THEN 'CREDIT_NOTE_ISSUE'

  -- Priority 6: customer credit balance issued (no fiscal document)
  WHEN (metadata ->> 'refund_destination_type') = 'CUSTOMER_CREDIT'
    THEN 'CUSTOMER_CREDIT_ISSUE'

  -- Priority 7: cannot confidently classify — flag for manual review
  ELSE 'MANUAL_EXCEPTION'

END
WHERE refund_source_type IS NULL;

-- ──────────────────────────────────────────────────────────────────
-- Step 3 — Validate backfill completeness
-- ──────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_null_count INTEGER;
  v_exception_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_null_count
  FROM public.org_order_refunds_dtl
  WHERE refund_source_type IS NULL;

  IF v_null_count > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: % rows still have NULL refund_source_type', v_null_count;
  END IF;

  SELECT COUNT(*) INTO v_exception_count
  FROM public.org_order_refunds_dtl
  WHERE refund_source_type = 'MANUAL_EXCEPTION';

  IF v_exception_count > 0 THEN
    RAISE NOTICE '⚠ % refund row(s) could not be auto-classified and were set to MANUAL_EXCEPTION.', v_exception_count;
    RAISE NOTICE 'Finance lead must review these rows before claiming ADR-030 compliance.';
    RAISE NOTICE 'Run the review query at the bottom of this migration file to list them.';
  ELSE
    RAISE NOTICE '✅ All refund rows classified — 0 MANUAL_EXCEPTION rows.';
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────
-- Step 4 — Add NOT NULL + CHECK constraints
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE public.org_order_refunds_dtl
  ALTER COLUMN refund_source_type SET NOT NULL;

ALTER TABLE public.org_order_refunds_dtl
  DROP CONSTRAINT IF EXISTS chk_refund_source_type RESTRICT;

ALTER TABLE public.org_order_refunds_dtl
  ADD CONSTRAINT chk_refund_source_type
    CHECK (refund_source_type IN (
      'REAL_PAYMENT_REFUND',
      'GIFT_CARD_RESTORE',
      'WALLET_RESTORE',
      'CUSTOMER_ADVANCE_RESTORE',
      'CUSTOMER_CREDIT_ISSUE',
      'CREDIT_NOTE_ISSUE',
      'MANUAL_EXCEPTION'
    ));

-- reopens_due_amount must not exceed the refund_amount
ALTER TABLE public.org_order_refunds_dtl
  DROP CONSTRAINT IF EXISTS chk_reopens_due_lte_refund RESTRICT;

ALTER TABLE public.org_order_refunds_dtl
  ADD CONSTRAINT chk_reopens_due_lte_refund
    CHECK (reopens_due_amount >= 0 AND reopens_due_amount <= refund_amount);

-- ──────────────────────────────────────────────────────────────────
-- Step 5 — Supporting index
-- ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ord_refunds_source_type
  ON public.org_order_refunds_dtl (tenant_org_id, refund_source_type)
  WHERE is_active = true;

-- ──────────────────────────────────────────────────────────────────
-- Step 6 — Seed MANUAL_EXCEPTION permission (ADR-030)
--
-- Creating or elevating a refund to MANUAL_EXCEPTION requires this
-- permission + a mandatory reason field + audit log entry.
-- ──────────────────────────────────────────────────────────────────

INSERT INTO public.sys_auth_permissions (
  code,
  name,
  name2,
  category,
  description,
  description2,
  category_main,
  is_active,
  is_enabled,
  rec_status,
  created_at,
  created_by
) VALUES (
  'refunds:mark_manual_exception',
  'Mark Refund as Manual Exception',
  'تمييز استرداد كاستثناء يدوي',
  'finance',
  'Allows marking a refund source as MANUAL_EXCEPTION when the source cannot be auto-classified. Requires a reason field.',
  'يسمح بتمييز مصدر الاسترداد كاستثناء يدوي عند تعذّر التصنيف التلقائي. يتطلب حقل السبب.',
  'Finance',
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  category_main = EXCLUDED.category_main,
  is_active = true,
  is_enabled = true,
  rec_status = 1,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin',
  updated_info = 'Migration: 0340_refund_source_lineage_and_reopen_due.sql';

-- Assign to finance lead roles only (not general admin)
INSERT INTO public.sys_auth_role_default_permissions (
  role_code,
  permission_code,
  is_enabled,
  is_active,
  rec_status,
  created_at,
  created_by
)
SELECT r.code, 'refunds:mark_manual_exception', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
WHERE r.code IN ('super_admin', 'tenant_admin')
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = 'refunds:mark_manual_exception'
  );

COMMIT;

-- ================================================================
-- REVIEW QUERY — run manually after applying migration
-- Finance lead should review ALL rows with refund_source_type =
-- 'MANUAL_EXCEPTION' and update them to the correct type or confirm
-- MANUAL_EXCEPTION is the right classification.
-- ================================================================
-- SELECT
--   r.id,
--   r.tenant_org_id,
--   r.order_id,
--   r.refund_amount,
--   r.refund_method_code,
--   r.refund_source_type,
--   r.metadata,
--   r.created_at
-- FROM public.org_order_refunds_dtl r
-- WHERE r.refund_source_type = 'MANUAL_EXCEPTION'
-- ORDER BY r.tenant_org_id, r.created_at DESC;
