-- =============================================================================
-- Migration 0283: Harden Credit Apps + Fix Refund FK + payment_nature_snapshot
-- 1. Extend org_order_credit_apps_dtl with balance tracking + idempotency
-- 2. Extend org_order_refunds_dtl with refund_no, reason_code, idempotency
-- 3. Fix org_order_refunds_dtl FK: old table org_payments_dtl_tr → org_order_payments_dtl
-- 4. Add payment_nature_snapshot to org_order_payments_dtl (REAL_PAYMENT only constraint)
-- =============================================================================

BEGIN;

-- ── 1. Extend org_order_credit_apps_dtl ──────────────────────────────────────
ALTER TABLE public.org_order_credit_apps_dtl
  ADD COLUMN IF NOT EXISTS credit_note_no   TEXT,
  ADD COLUMN IF NOT EXISTS balance_before   DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS balance_after    DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS idempotency_key  TEXT;

ALTER TABLE public.org_order_credit_apps_dtl
  DROP CONSTRAINT IF EXISTS uq_credit_app_idempotency;

ALTER TABLE public.org_order_credit_apps_dtl
  ADD CONSTRAINT uq_credit_app_idempotency
    UNIQUE (tenant_org_id, idempotency_key);

-- ── 2. Extend org_order_refunds_dtl ──────────────────────────────────────────
ALTER TABLE public.org_order_refunds_dtl
  ADD COLUMN IF NOT EXISTS refund_no        TEXT,
  ADD COLUMN IF NOT EXISTS reason_code      TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key  TEXT;

ALTER TABLE public.org_order_refunds_dtl
  DROP CONSTRAINT IF EXISTS uq_refund_idempotency;

ALTER TABLE public.org_order_refunds_dtl
  ADD CONSTRAINT uq_refund_idempotency
    UNIQUE (tenant_org_id, idempotency_key);

-- ── 3. Fix org_order_refunds_dtl FK: org_payments_dtl_tr → org_order_payments_dtl
-- Drop the old FK (name may vary — try both convention-based names)
ALTER TABLE public.org_order_refunds_dtl
  DROP CONSTRAINT IF EXISTS org_order_refunds_dtl_original_payment_id_fkey;

-- Add new FK pointing to the normalized payments table
-- ON DELETE RESTRICT prevents deleting a payment that has been refunded
ALTER TABLE public.org_order_refunds_dtl
  ADD CONSTRAINT fk_refund_original_payment
    FOREIGN KEY (original_payment_id)
    REFERENCES public.org_order_payments_dtl(id)
    ON DELETE RESTRICT;

-- ── 4. Add payment_nature_snapshot to org_order_payments_dtl ─────────────────
-- Enforces that this table contains REAL_PAYMENT legs only.
-- Credit applications and deferred settlements are NEVER written here.
ALTER TABLE public.org_order_payments_dtl
  ADD COLUMN IF NOT EXISTS payment_nature_snapshot TEXT
    NOT NULL DEFAULT 'REAL_PAYMENT'
    CHECK (payment_nature_snapshot = 'REAL_PAYMENT');

COMMIT;
