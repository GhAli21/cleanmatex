-- Migration: 0257_gift_card_v1_schema.sql
-- Description: Gift Card V1 — stored-value semantic cleanup, status migration,
--              dual PIN, idempotency, purchased_by, issue_type, currency_code,
--              permission seeds.
-- Author: system
-- Date: 2026-05-09
-- WARNING: Review carefully before applying. Renames columns and table.
--          Have rollback migration ready.

BEGIN;

-- ============================================================================
-- Section 1 — Rename gift_card_discount_amount → gift_card_applied_amount
--             on org_orders_mst and org_invoice_mst.
--
-- Rationale: The column name "gift_card_discount_amount" is semantically
-- incorrect. A gift card is stored value, not a discount. "applied_amount"
-- matches the language used in the payments layer (org_payments_dtl_tr
-- already uses gift_card_applied_amount).
--
-- Confirmed present in Prisma schema (schema.prisma lines 915 and 631).
-- org_payments_dtl_tr.gift_card_applied_amount is already correctly named
-- and is NOT touched by this migration.
-- ============================================================================

ALTER TABLE org_orders_mst
  RENAME COLUMN gift_card_discount_amount TO gift_card_applied_amount;

ALTER TABLE org_invoice_mst
  RENAME COLUMN gift_card_discount_amount TO gift_card_applied_amount;

-- ============================================================================
-- Section 2 — Rename card_number → gift_card_code on org_gift_cards_mst.
--
-- Rationale: "card_number" implies a PAN (payment card number), which invites
-- PCI-DSS concerns. "gift_card_code" is the correct domain term for a
-- customer-facing redemption code.
--
-- Confirmed present in Prisma schema (schema.prisma line 2230: card_number).
-- ============================================================================

ALTER TABLE org_gift_cards_mst
  RENAME COLUMN card_number TO gift_card_code;

-- ============================================================================
-- Section 3 — Rename ledger table org_gift_card_transactions →
--             org_gift_card_txn_dtl.
--
-- Rationale: Aligns with the project naming convention (org_*_dtl suffix for
-- detail/child tables). "transactions" is ambiguous; "txn_dtl" clearly marks
-- this as the gift-card-specific transaction detail table.
--
-- Steps:
--   a) Drop the known RLS policy (policy name confirmed via migration 0081).
--   b) Drop known indexes (confirmed via migrations 0029 and 0106).
--   c) Rename the table.
--   d) Re-enable RLS on the renamed table.
--   e) Recreate the RLS policy under the new table name.
--   f) Recreate all indexes under the new table name.
-- ============================================================================

-- 3a. Drop known RLS policy before rename (policy names from migrations 0029,
--     0061, 0081 — 0081 is the last canonical version).
DROP POLICY IF EXISTS tenant_isolation_org_gift_card_transactions
  ON org_gift_card_transactions;
DROP POLICY IF EXISTS tenant_isolation_gift_card_trans
  ON org_gift_card_transactions;

-- 3b. Drop known indexes before rename (PostgreSQL renames indexes
--     automatically on table rename, but we drop and recreate to apply the
--     new shorter naming convention used throughout this migration).
DROP INDEX IF EXISTS idx_gift_card_trans_tenant;
DROP INDEX IF EXISTS idx_gift_card_trans_card;
DROP INDEX IF EXISTS idx_gift_card_trans_order;
DROP INDEX IF EXISTS idx_gift_card_trans_date;
DROP INDEX IF EXISTS idx_gift_card_trans_branch;

-- 3c. Rename the table.
ALTER TABLE org_gift_card_transactions
  RENAME TO org_gift_card_txn_dtl;

-- 3d. Re-enable RLS (rename preserves the RLS-enabled flag, but being
--     explicit ensures correctness).
ALTER TABLE org_gift_card_txn_dtl ENABLE ROW LEVEL SECURITY;

-- 3e. Recreate RLS policy on the renamed table.
--     Uses current_tenant_id() helper (established in migration 0061).
CREATE POLICY tenant_isolation_gc_txn_dtl ON org_gift_card_txn_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- 3f. Recreate indexes on the renamed table.
CREATE INDEX IF NOT EXISTS idx_gc_txn_tenant
  ON org_gift_card_txn_dtl (tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_gc_txn_card
  ON org_gift_card_txn_dtl (tenant_org_id, gift_card_id);

CREATE INDEX IF NOT EXISTS idx_gc_txn_order
  ON org_gift_card_txn_dtl (tenant_org_id, order_id);

CREATE INDEX IF NOT EXISTS idx_gc_txn_date
  ON org_gift_card_txn_dtl (tenant_org_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_gc_txn_branch
  ON org_gift_card_txn_dtl (tenant_org_id, branch_id)
  WHERE branch_id IS NOT NULL;

-- ============================================================================
-- Section 4 — Card number format update.
--
-- Update all existing gift_card_code values that do not already follow the
-- CMX-XXXX-XXXX-XXXX format to a newly generated code in that format.
-- Uses gen_random_bytes to produce hex segments then upper-cases them.
-- This ensures no two cards get the same generated code (collisions are
-- astronomically unlikely; the unique index in Section 12 enforces it).
-- ============================================================================

UPDATE org_gift_cards_mst
SET gift_card_code =
  'CMX-' ||
  upper(substring(replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 4)) || '-' ||
  upper(substring(replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 4)) || '-' ||
  upper(substring(replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 4))
WHERE gift_card_code NOT LIKE 'CMX-%';

-- ============================================================================
-- Section 5 — Status enum migration.
--
-- Migrates existing lowercase/old status values to the new canonical
-- uppercase status vocabulary. After migration a CHECK constraint is added
-- so that no non-canonical value can be inserted going forward.
--
-- Mapping:
--   expired     → EXPIRED
--   cancelled   → VOIDED   (cancelled is a user-facing term; VOIDED is the
--                            canonical stored-value term for admin voids)
--   suspended   → SUSPENDED
--   used        → FULLY_REDEEMED
--   active + partial balance → PARTIALLY_REDEEMED
--   active + full balance    → ACTIVE
--   active + zero balance    → FULLY_REDEEMED (edge case)
-- ============================================================================

-- Drop the existing status CHECK constraint before migrating values.
-- Constraint name confirmed from DB error: org_gift_cards_mst_status_check
ALTER TABLE org_gift_cards_mst
  DROP CONSTRAINT IF EXISTS org_gift_cards_mst_status_check;

UPDATE org_gift_cards_mst SET status = 'EXPIRED'        WHERE status = 'expired';
UPDATE org_gift_cards_mst SET status = 'VOIDED'         WHERE status = 'cancelled';
UPDATE org_gift_cards_mst SET status = 'SUSPENDED'      WHERE status = 'suspended';
UPDATE org_gift_cards_mst SET status = 'FULLY_REDEEMED' WHERE status = 'used';

-- Active cards with a partial remaining balance.
UPDATE org_gift_cards_mst
  SET status = 'PARTIALLY_REDEEMED'
  WHERE status = 'active'
    AND current_balance < original_amount
    AND current_balance > 0;

-- Active cards at full (or over) balance — treat as fully active.
UPDATE org_gift_cards_mst
  SET status = 'ACTIVE'
  WHERE status = 'active'
    AND current_balance >= original_amount;

-- Edge: active cards with a zero balance that were not caught above.
UPDATE org_gift_cards_mst
  SET status = 'FULLY_REDEEMED'
  WHERE status = 'active' AND current_balance = 0;

-- Add CHECK constraint to enforce canonical status values going forward.
ALTER TABLE org_gift_cards_mst
  ADD CONSTRAINT chk_gift_card_status
  CHECK (status IN (
    'DRAFT',
    'GENERATED',
    'ACTIVE',
    'PARTIALLY_REDEEMED',
    'FULLY_REDEEMED',
    'EXPIRED',
    'VOIDED',
    'SUSPENDED'
  ));

-- ============================================================================
-- Section 6 — Add pin_hash column; keep card_pin as legacy read-only.
--
-- Rationale: card_pin stores the PIN in plain text (or weakly encoded), which
-- is a security risk. New card issuance will write only pin_hash (bcrypt or
-- Argon2 hash). card_pin is retained as a legacy column — existing code that
-- reads it will continue to work; no data is deleted in this migration.
-- ============================================================================

ALTER TABLE org_gift_cards_mst
  ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- ============================================================================
-- Section 7 — Add new semantic columns to org_gift_cards_mst.
--
-- All columns use ADD COLUMN IF NOT EXISTS for idempotency.
-- Money columns: DECIMAL(19,4) per project convention.
-- String columns: TEXT per project convention (no VARCHAR).
-- Columns confirmed absent from Prisma schema (schema.prisma lines 2227-2260).
-- ============================================================================

ALTER TABLE org_gift_cards_mst
  ADD COLUMN IF NOT EXISTS available_amount     DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS redeemed_amount      DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_amount         DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_remaining      DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS activation_date      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS batch_id             UUID,
  ADD COLUMN IF NOT EXISTS is_reloadable        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_transferable      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS max_redemptions      INT,
  ADD COLUMN IF NOT EXISTS redemption_count     INT NOT NULL DEFAULT 0,
  -- Full semantic name: purchased_by_customer_id; shortened to 30 chars.
  ADD COLUMN IF NOT EXISTS purchased_by_cust_id UUID,
  ADD COLUMN IF NOT EXISTS issue_type           TEXT NOT NULL DEFAULT 'SOLD',
  ADD COLUMN IF NOT EXISTS gift_card_type       TEXT NOT NULL DEFAULT 'FIXED_VALUE',
  -- No default for currency_code; back-filled in Section 9, then default dropped.
  -- Temporary DEFAULT 'USD' allows NOT NULL constraint during back-fill.
  ADD COLUMN IF NOT EXISTS currency_code        TEXT NOT NULL DEFAULT 'USD';

-- Add CHECK constraints for the new enumerated text columns.
ALTER TABLE org_gift_cards_mst
  ADD CONSTRAINT chk_gc_issue_type
    CHECK (issue_type IN (
      'SOLD', 'PROMOTIONAL', 'CORPORATE', 'GOODWILL', 'MIGRATION', 'REPLACEMENT'
    )),
  ADD CONSTRAINT chk_gc_type
    CHECK (gift_card_type IN (
      'FIXED_VALUE', 'PROMOTIONAL', 'CORPORATE'
    )),
  ADD CONSTRAINT chk_gc_available_nn
    CHECK (available_amount >= 0),
  ADD CONSTRAINT chk_gc_redeemed_nn
    CHECK (redeemed_amount >= 0),
  ADD CONSTRAINT chk_gc_bonus_nn
    CHECK (bonus_amount >= 0),
  ADD CONSTRAINT chk_gc_bonus_rem_nn
    CHECK (bonus_remaining >= 0),
  ADD CONSTRAINT chk_gc_redemption_cnt_nn
    CHECK (redemption_count >= 0);

-- ============================================================================
-- Section 8 — Back-fill available_amount and redeemed_amount from existing
--             balance columns.
--
-- available_amount mirrors current_balance for existing cards.
-- redeemed_amount is inferred as (original_amount - current_balance), floored
-- at 0 to handle any data anomalies.
-- Only rows where available_amount is still at the 0 default and
-- original_amount > 0 are updated (idempotent re-run safety).
-- ============================================================================

UPDATE org_gift_cards_mst
SET
  available_amount = COALESCE(current_balance, 0),
  redeemed_amount  = GREATEST(
    COALESCE(original_amount, 0) - COALESCE(current_balance, 0),
    0
  )
WHERE available_amount = 0
  AND original_amount > 0;

-- ============================================================================
-- Section 9 — Back-fill currency_code from per-tenant settings.
--
-- Queries org_tenant_settings_cf (the per-tenant override table) for the
-- 'default_currency_code' setting. Falls back to 'USD' for tenants that have
-- no explicit currency setting (COALESCE ensures the WHERE clause below does
-- not accidentally clear rows that already have a non-USD value).
--
-- Note: sys_tenant_settings_cd is a global settings catalog (no tenant_org_id)
-- and does not store per-tenant values. Per-tenant values live in
-- org_tenant_settings_cf (confirmed in Prisma schema lines 2561-2589).
--
-- After back-fill, the temporary DEFAULT 'USD' is dropped so that future
-- inserts must supply an explicit currency_code.
-- ============================================================================

UPDATE org_gift_cards_mst g
SET currency_code = COALESCE(
  (
    SELECT s.setting_value
    FROM org_tenant_settings_cf s
    WHERE s.tenant_org_id = g.tenant_org_id
      AND s.setting_code   = 'default_currency_code'
      AND s.is_active      = TRUE
      AND s.rec_status     = 1
    ORDER BY s.created_at DESC
    LIMIT 1
  ),
  'USD'
)
WHERE g.currency_code = 'USD';

-- Drop the temporary default so future inserts must be explicit.
ALTER TABLE org_gift_cards_mst ALTER COLUMN currency_code DROP DEFAULT;

-- ============================================================================
-- Section 10 — FK for purchased_by_cust_id.
--
-- Skipped: org_customers_mst does NOT have a composite unique constraint on
-- (tenant_org_id, id). Its PK is on id alone (@@id on id), and the only
-- composite unique is on (tenant_org_id, customer_id) — not (tenant_org_id, id).
-- PostgreSQL requires a unique or primary-key constraint on the referenced
-- columns to create a composite FK.
--
-- Action: A simple single-column FK referencing org_customers_mst.id is added
-- instead. This is safe because id is the PK and globally unique. The FK is
-- DEFERRABLE to avoid ordering issues on bulk inserts.
-- ============================================================================

ALTER TABLE org_gift_cards_mst
  ADD CONSTRAINT fk_gc_purchased_by
    FOREIGN KEY (purchased_by_cust_id)
    REFERENCES org_customers_mst (id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;

-- ============================================================================
-- Section 11 — Add idempotency_key to ledger table; migrate transaction_type
--              values; add CHECK constraint on transaction_type.
--
-- idempotency_key: allows callers to safely retry gift-card operations without
-- double-crediting/debiting. The unique index is partial (WHERE NOT NULL) so
-- that rows without a key do not conflict with each other.
--
-- transaction_type mapping (old lowercase → new canonical uppercase):
--   redemption   → REDEEM
--   refund       → REFUND
--   adjustment   → ADJUSTMENT
--   cancellation → VOID
-- ============================================================================

ALTER TABLE org_gift_card_txn_dtl
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Partial unique index: idempotency per tenant, only when key is supplied.
-- Index name: uq_gc_txn_idem (14 chars — within 30-char limit).
CREATE UNIQUE INDEX IF NOT EXISTS uq_gc_txn_idem
  ON org_gift_card_txn_dtl (tenant_org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Drop existing transaction_type CHECK constraint before migrating values.
-- Constraint name confirmed from DB error: org_gift_card_transactions_transaction_type_check
ALTER TABLE org_gift_card_txn_dtl
  DROP CONSTRAINT IF EXISTS org_gift_card_transactions_transaction_type_check;

-- Migrate existing transaction_type values to canonical uppercase vocabulary.
UPDATE org_gift_card_txn_dtl SET transaction_type = 'REDEEM'     WHERE transaction_type = 'redemption';
UPDATE org_gift_card_txn_dtl SET transaction_type = 'REFUND'     WHERE transaction_type = 'refund';
UPDATE org_gift_card_txn_dtl SET transaction_type = 'ADJUSTMENT' WHERE transaction_type = 'adjustment';
UPDATE org_gift_card_txn_dtl SET transaction_type = 'VOID'       WHERE transaction_type = 'cancellation';

-- Add CHECK constraint for transaction_type canonical values.
ALTER TABLE org_gift_card_txn_dtl
  ADD CONSTRAINT chk_gc_txn_type
    CHECK (transaction_type IN (
      'ISSUE',
      'SALE',
      'ACTIVATE',
      'REDEEM',
      'REFUND',
      'VOID',
      'EXPIRE',
      'ADJUSTMENT',
      'BONUS_ADD',
      'BONUS_REDEEM'
    ));

-- ============================================================================
-- Section 12 — Constraints and indexes on org_gift_cards_mst.
--
-- Index name length check (all names ≤ 30 characters):
--   uq_gc_code_tenant    → 18 chars  ✓
--   idx_gc_tenant_status → 20 chars  ✓
--   idx_gc_tenant_cust   → 18 chars  ✓  (shortened from idx_gc_tenant_customer)
--   idx_gc_tenant_buyer  → 19 chars  ✓
--   idx_gc_tenant_expiry → 20 chars  ✓
--   idx_gc_tenant_batch  → 19 chars  ✓
--   idx_gc_txn_card_date → 20 chars  ✓
-- ============================================================================

-- Tenant-scoped unique gift-card code (ensures no duplicate codes within a
-- tenant after the card_number → gift_card_code rename in Section 2).
CREATE UNIQUE INDEX IF NOT EXISTS uq_gc_code_tenant
  ON org_gift_cards_mst (tenant_org_id, gift_card_code);

-- Status lookup — used by expiry jobs and list views filtered by status.
CREATE INDEX IF NOT EXISTS idx_gc_tenant_status
  ON org_gift_cards_mst (tenant_org_id, status);

-- Customer lookup — supports "my gift cards" view for a given customer.
-- Shortened: idx_gc_tenant_cust (was idx_gc_tenant_customer = 22 chars, fine,
-- but shortened for consistency with the 30-char rule).
CREATE INDEX IF NOT EXISTS idx_gc_tenant_cust
  ON org_gift_cards_mst (tenant_org_id, issued_to_customer_id);

-- Buyer lookup — supports "cards purchased by customer" query.
CREATE INDEX IF NOT EXISTS idx_gc_tenant_buyer
  ON org_gift_cards_mst (tenant_org_id, purchased_by_cust_id);

-- Expiry scan — used by the background expiry job.
CREATE INDEX IF NOT EXISTS idx_gc_tenant_expiry
  ON org_gift_cards_mst (tenant_org_id, expiry_date);

-- Batch lookup — used for bulk-issued card batch management.
CREATE INDEX IF NOT EXISTS idx_gc_tenant_batch
  ON org_gift_cards_mst (tenant_org_id, batch_id);

-- Transaction history ordered by date — the primary access pattern for the
-- card ledger detail view.
CREATE INDEX IF NOT EXISTS idx_gc_txn_card_date
  ON org_gift_card_txn_dtl (tenant_org_id, gift_card_id, transaction_date DESC);

-- ============================================================================
-- Section 13 — Permission seeds.
--
-- Adds operational gift-card permissions not already present (gift_cards:read
-- was seeded in migration 0251; new permissions cover transactional operations).
-- Uses the exact column signature from sys_auth_permissions confirmed in
-- migration 0251: code, name, name2, category, description, description2,
-- category_main, is_active, is_enabled, rec_status, created_at, created_by.
--
-- Role assignments go to sys_auth_role_default_permissions (confirmed in
-- migration 0251 — NOT sys_auth_role_permissions).
-- ============================================================================

INSERT INTO sys_auth_permissions (
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
)
VALUES
  (
    'gift_cards:sell',
    'Sell Gift Cards',
    'بيع بطاقات الهدايا',
    'action',
    'Sell gift cards at POS',
    'بيع بطاقات الهدايا عند نقطة البيع',
    'Marketing',
    true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  ),
  (
    'gift_cards:issue',
    'Issue Gift Cards',
    'إصدار بطاقات الهدايا',
    'action',
    'Issue promotional or corporate gift cards',
    'إصدار بطاقات هدايا ترويجية أو مؤسسية',
    'Marketing',
    true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  ),
  (
    'gift_cards:activate',
    'Activate Gift Cards',
    'تفعيل بطاقات الهدايا',
    'action',
    'Manually activate gift cards',
    'تفعيل بطاقات الهدايا يدوياً',
    'Marketing',
    true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  ),
  (
    'gift_cards:redeem',
    'Redeem Gift Cards',
    'استرداد بطاقات الهدايا',
    'action',
    'Apply gift card balance at checkout',
    'تطبيق رصيد بطاقة الهدايا عند الدفع',
    'Marketing',
    true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  ),
  (
    'gift_cards:refund',
    'Refund Gift Cards',
    'استرداد مبلغ بطاقة الهدايا',
    'action',
    'Reverse a gift card redemption',
    'عكس عملية استرداد بطاقة الهدايا',
    'Marketing',
    true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  ),
  (
    'gift_cards:void',
    'Void Gift Cards',
    'إلغاء بطاقات الهدايا',
    'action',
    'Void or cancel gift cards',
    'إلغاء بطاقات الهدايا',
    'Marketing',
    true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  ),
  (
    'gift_cards:adjust',
    'Adjust Gift Cards',
    'تعديل بطاقات الهدايا',
    'action',
    'Manual balance adjustment on gift cards',
    'تعديل رصيد بطاقة الهدايا يدوياً',
    'Marketing',
    true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  ),
  (
    'gift_cards:expire',
    'Expire Gift Cards',
    'إنهاء صلاحية بطاقة الهدايا',
    'action',
    'Manually expire gift cards',
    'إنهاء صلاحية بطاقات الهدايا يدوياً',
    'Marketing',
    true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  )
ON CONFLICT (code) DO NOTHING;

-- Grant all new gift_cards permissions to super_admin and tenant_admin.
INSERT INTO sys_auth_role_default_permissions (
  role_code,
  permission_code,
  is_enabled,
  is_active,
  rec_status,
  created_at,
  created_by
)
SELECT
  r.code,
  p.code,
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
FROM sys_auth_roles r
CROSS JOIN sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin')
  AND p.code IN (
    'gift_cards:sell',
    'gift_cards:issue',
    'gift_cards:activate',
    'gift_cards:redeem',
    'gift_cards:refund',
    'gift_cards:void',
    'gift_cards:adjust',
    'gift_cards:expire'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM sys_auth_role_default_permissions e
    WHERE e.role_code       = r.code
      AND e.permission_code = p.code
  );

-- Grant read, sell, and redeem to operator role.
INSERT INTO sys_auth_role_default_permissions (
  role_code,
  permission_code,
  is_enabled,
  is_active,
  rec_status,
  created_at,
  created_by
)
SELECT
  'operator',
  p.code,
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
FROM sys_auth_permissions p
WHERE p.code IN (
  'gift_cards:read',
  'gift_cards:sell',
  'gift_cards:redeem'
)
  AND NOT EXISTS (
    SELECT 1
    FROM sys_auth_role_default_permissions e
    WHERE e.role_code       = 'operator'
      AND e.permission_code = p.code
  );

COMMIT;
