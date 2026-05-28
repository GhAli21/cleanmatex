-- ============================================================
-- Migration: 0328 — Fix B5/B6/B8 + orphan voucher test-data cleanup
-- ============================================================
-- Phase 1B Round 2 stabilization fixes uncovered by manual QA
-- on 2026-05-28. Reference: RESUME doc sleepy-zooming-goose-RESUME.md
--
-- Three independent fix groups, applied atomically:
--   1. P1  — Sync org_payment_methods_cf flags from sys + drop
--             NOT NULL so future tenant onboarding can use COALESCE.
--   2. B8  — Backfill historical voucher status triple-column
--             drift across all tenants (39 rows currently mismatched).
--   3. Cleanup — Void the single orphan voucher RV-2026-000012
--             and soft-delete the failed attempt-1 order
--             (data integrity casualty of the B6 sub-key bleed).
-- ============================================================

BEGIN;

-- ============================================================
-- PART 1 — Payment method config drift (B5/B6 root cause)
-- ============================================================
-- Problem: migration 0325 wrote
--   UPDATE org_payment_methods_cf
--   SET requires_cash_drawer = COALESCE(o.requires_cash_drawer, s.requires_cash_drawer)
-- but the org column is NOT NULL DEFAULT FALSE, so COALESCE never
-- fell through to the sys value. Result for every existing tenant:
--   - CASH.requires_cash_drawer            = FALSE (should be TRUE)
--   - BANK_TRANSFER.requires_reference     = FALSE (should be TRUE)
--   - CHECK.requires_reference             = FALSE (should be TRUE)
--   - CREDIT_INVOICE.requires_reference    = FALSE (should be TRUE)
-- The planner reads effective flags, sees FALSE, and silently skips
-- cash-drawer wiring + reference validation (B5 + part of B6).

-- 1a. Sync requires_cash_drawer from sys defaults
UPDATE org_payment_methods_cf o
SET    requires_cash_drawer = s.requires_cash_drawer,
       updated_at           = now(),
       updated_by           = 'migration_0328',
       updated_info         = 'B5 fix: sync requires_cash_drawer from sys defaults'
FROM   sys_payment_method_cd s
WHERE  o.payment_method_code = s.payment_method_code
  AND  o.requires_cash_drawer IS DISTINCT FROM s.requires_cash_drawer;

-- 1b. Sync requires_reference from sys defaults
UPDATE org_payment_methods_cf o
SET    requires_reference = s.requires_reference,
       updated_at         = now(),
       updated_by         = 'migration_0328',
       updated_info       = 'B5 fix: sync requires_reference from sys defaults'
FROM   sys_payment_method_cd s
WHERE  o.payment_method_code = s.payment_method_code
  AND  o.requires_reference IS DISTINCT FROM s.requires_reference;

-- 1c. Long-term: make both columns NULLABLE so future tenant rows
--     created with NULL inherit the sys default via COALESCE in the
--     application layer. Existing rows keep their (now-correct) values.
ALTER TABLE org_payment_methods_cf
  ALTER COLUMN requires_cash_drawer DROP NOT NULL,
  ALTER COLUMN requires_cash_drawer DROP DEFAULT,
  ALTER COLUMN requires_reference   DROP NOT NULL,
  ALTER COLUMN requires_reference   DROP DEFAULT;

ALTER TABLE sys_payment_method_cd
  ALTER COLUMN requires_cash_drawer DROP NOT NULL,
  ALTER COLUMN requires_cash_drawer DROP DEFAULT,
  ALTER COLUMN requires_reference   DROP NOT NULL,
  ALTER COLUMN requires_reference   DROP DEFAULT;

-- ============================================================
-- PART 2 — Voucher status triple-column backfill (B8)
-- ============================================================
-- Problem: org_fin_vouchers_mst has three columns describing the same
-- concept (legacy 'status', Phase-1A 'voucher_status', wiring 'posting_status').
-- Posting code updates voucher_status but never touches the other two,
-- producing 39 historically inconsistent rows across the system.
--
-- CHECK constraints already in DB:
--   status:           draft | issued | voided          (NOT VALID)
--   voucher_status:   DRAFT | POSTED | CANCELLED       (implicit via app)
--   posting_status:   NOT_POSTED | POSTED | POSTING_FAILED
--
-- Authoritative mapping (matches voucher-wiring.service.ts code-sync added in P4):
--   DRAFT     -> status='draft',  posting_status='NOT_POSTED'
--   POSTED    -> status='issued', posting_status='POSTED'
--   CANCELLED -> status='voided', posting_status='NOT_POSTED'  (CANCELLED is not a valid posting_status)
--
-- voucher_status is the source of truth; the other two are reconciled to it.

UPDATE org_fin_vouchers_mst
SET    status         = 'draft',
       posting_status = 'NOT_POSTED',
       updated_at     = now(),
       updated_by     = 'migration_0328',
       updated_info   = 'B8 fix: sync legacy status + posting_status with voucher_status=DRAFT'
WHERE  voucher_status = 'DRAFT'
  AND  (status IS DISTINCT FROM 'draft' OR posting_status IS DISTINCT FROM 'NOT_POSTED');

UPDATE org_fin_vouchers_mst
SET    status         = 'issued',
       posting_status = 'POSTED',
       updated_at     = now(),
       updated_by     = 'migration_0328',
       updated_info   = 'B8 fix: sync legacy status + posting_status with voucher_status=POSTED'
WHERE  voucher_status = 'POSTED'
  AND  (status IS DISTINCT FROM 'issued' OR posting_status IS DISTINCT FROM 'POSTED');

UPDATE org_fin_vouchers_mst
SET    status         = 'voided',
       posting_status = 'NOT_POSTED',
       updated_at     = now(),
       updated_by     = 'migration_0328',
       updated_info   = 'B8 fix: sync legacy status + posting_status with voucher_status=CANCELLED'
WHERE  voucher_status = 'CANCELLED'
  AND  (status IS DISTINCT FROM 'voided' OR posting_status IS DISTINCT FROM 'NOT_POSTED');

-- ============================================================
-- PART 3 — Orphan voucher / order test-data cleanup (B6 fallout)
-- ============================================================
-- Problem: voucher RV-2026-000012 (d193858e-be0c-47a7-8906-b8d5b8523d2b)
-- has header.source_ref_id = 433d736f (failed attempt 1) but its only
-- line carries order_id = d935ddd5 (successful attempt 2) — the only
-- row in the system where header order != line order. Caused by the
-- B6 sub-key bleed; fixed forward by P3 in this round but the orphan
-- data remains.
--
-- Best-practice cleanup: VOID the orphan voucher (do NOT force-link;
-- force-linking masks the original violation and confuses audit). The
-- failed attempt-1 order is soft-deleted (rec_status=0) since it never
-- received any payment rows.

-- 3a. Void the orphan voucher header
UPDATE org_fin_vouchers_mst
SET    voucher_status     = 'CANCELLED',
       status             = 'voided',
       posting_status     = 'NOT_POSTED',
       voided_at          = now(),
       reversed_at        = now(),
       reversed_by        = 'migration_0328',
       reversal_reason    = 'Test data cleanup: orphan from B6 idempotency sub-key bleed (header tied to failed order 433d736f, line wired to retry order d935ddd5). See RESUME doc 2026-05-28.',
       void_reason        = 'orphan_idempotency_bleed',
       reason_code        = 'TEST_DATA_CLEANUP',
       outstanding_amount = 0,
       updated_at         = now(),
       updated_by         = 'migration_0328',
       updated_info       = 'Phase 1B Round 2 — orphan voucher cleanup'
WHERE  id = 'd193858e-be0c-47a7-8906-b8d5b8523d2b'::uuid;

-- 3b. Reverse the voucher line
UPDATE org_fin_voucher_trx_lines_dtl
SET    line_status   = 'REVERSED',
       wiring_status = 'REVERSED',
       updated_at    = now(),
       updated_by    = 'migration_0328',
       updated_info  = 'B6 orphan cleanup: line reversed alongside voucher void'
WHERE  id = '1890cec4-c11e-4734-9a5c-8e2b48f048dc'::uuid;

-- 3c. Detach the order_payment row on the surviving order (d935ddd5)
--     so the user can retry payment cleanly. payment_status stays
--     PENDING — the user can resubmit via Payment Modal V4 and the
--     P3 fix will create a fresh voucher tied correctly to this order.
-- NOTE: org_order_payments_dtl.updated_by is UUID (not text), so the
-- migration sentinel goes into updated_info only; updated_by is left
-- untouched to avoid a 22P02 cast error.
UPDATE org_order_payments_dtl
SET    fin_voucher_id = NULL,
       updated_at     = now(),
       updated_info   = 'migration_0328: B6 orphan cleanup — detach voided voucher; retry will re-wire'
WHERE  id = 'aecc3898-fc97-4739-b928-48471e20d9fa'::uuid;

-- 3d. Soft-delete the failed attempt-1 order (no payments, no taxes,
--     no charges — confirmed by RESUME doc cross-table query). Keeping
--     rec_status=1 would leave a phantom partial order in the list.
UPDATE org_orders_mst
SET    rec_status   = 0,
       payment_status = 'CANCELLED',
       updated_at   = now(),
       updated_by   = 'migration_0328',
       updated_info = 'B6 orphan cleanup: attempt-1 of duplicate submit (idempotency root key ab70272b...). Replaced by order d935ddd5 in attempt 2. No payment/tax/charge rows present.'
WHERE  id = '433d736f-7e2b-42fb-886c-0f1281938ece'::uuid;

COMMIT;
