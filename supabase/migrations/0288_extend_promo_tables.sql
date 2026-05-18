-- ============================================================
-- Migration 0288: Rename + Extend Promotion Tables
-- Phase 4 of the Order Financial Platform
--
-- Changes:
--   1. Rename org_promo_codes_mst  → org_promotions_mst
--   2. Rename org_promo_usage_log  → org_promotion_usage_dtl
--   3. Rename associated indexes
--   4. Drop old RLS policies; recreate with new names
--   5. Extend org_promotions_mst   — campaign-level columns + allow NULL promo_code
--   6. Extend org_promotion_usage_dtl — currency, exchange_rate, idempotency_key
--   7. Add FK org_order_discounts_dtl.promotion_id → org_promotions_mst(id)
--   8. Seed 12 realistic promotions (6 per demo tenant)
-- ============================================================

-- ── Step 1: Rename tables ─────────────────────────────────────────────────────

ALTER TABLE org_promo_codes_mst RENAME TO org_promotions_mst;
ALTER TABLE org_promo_usage_log RENAME TO org_promotion_usage_dtl;

-- ── Step 2: Rename indexes ────────────────────────────────────────────────────

ALTER INDEX IF EXISTS idx_promo_codes_tenant   RENAME TO idx_promotions_tenant;
ALTER INDEX IF EXISTS idx_promo_codes_code     RENAME TO idx_promotions_code;
ALTER INDEX IF EXISTS idx_promo_codes_validity RENAME TO idx_promotions_validity;
ALTER INDEX IF EXISTS idx_promo_usage_tenant   RENAME TO idx_promo_usage_dtl_tenant;
ALTER INDEX IF EXISTS idx_promo_usage_promo    RENAME TO idx_promo_usage_dtl_promo;
ALTER INDEX IF EXISTS idx_promo_usage_customer RENAME TO idx_promo_usage_dtl_customer;
ALTER INDEX IF EXISTS idx_promo_usage_order    RENAME TO idx_promo_usage_dtl_order;

-- ── Step 3: Drop old RLS policies; recreate with new names ───────────────────
-- After table rename, old policies survive on the renamed table — drop them all.

DROP POLICY IF EXISTS tenant_isolation_promo_codes           ON org_promotions_mst;
DROP POLICY IF EXISTS tenant_isolation_org_promo_codes_mst   ON org_promotions_mst;

CREATE POLICY tenant_isolation_org_promotions_mst ON org_promotions_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_promo_usage           ON org_promotion_usage_dtl;
DROP POLICY IF EXISTS tenant_isolation_org_promo_usage_log   ON org_promotion_usage_dtl;

CREATE POLICY tenant_isolation_org_prom_usage_dtl ON org_promotion_usage_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- ── Step 4: Extend org_promotions_mst ────────────────────────────────────────
-- Allow NULL promo_code so auto-apply rules (no code) can be stored.
ALTER TABLE org_promotions_mst
  ALTER COLUMN promo_code DROP NOT NULL;

-- Campaign-level columns
ALTER TABLE org_promotions_mst
  ADD COLUMN IF NOT EXISTS promo_type               TEXT,
  ADD COLUMN IF NOT EXISTS stackable                BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stacking_group           TEXT,
  ADD COLUMN IF NOT EXISTS max_stacking_discount    DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS applicable_customer_grps TEXT[],
  ADD COLUMN IF NOT EXISTS currency_code            TEXT,
  ADD COLUMN IF NOT EXISTS exchange_rate            DECIMAL(19,6) NOT NULL DEFAULT 1;

-- Partial index for efficient auto-apply rule lookup (no promo code)
CREATE INDEX IF NOT EXISTS idx_promotions_auto_apply
  ON org_promotions_mst (tenant_org_id, is_active, valid_from, valid_to)
  WHERE promo_code IS NULL;

-- ── Step 5: Extend org_promotion_usage_dtl ───────────────────────────────────

ALTER TABLE org_promotion_usage_dtl
  ADD COLUMN IF NOT EXISTS currency_code    TEXT,
  ADD COLUMN IF NOT EXISTS exchange_rate    DECIMAL(19,6) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS idempotency_key  TEXT;

ALTER TABLE org_promotion_usage_dtl
  ADD CONSTRAINT uq_promo_usage_idempotency
    UNIQUE (tenant_org_id, idempotency_key);

-- ── Step 6: FK on org_order_discounts_dtl.promotion_id ───────────────────────
-- promotion_id column was added in migration 0278 without a FK (table didn't exist yet).
-- org_promotions_mst now exists — add the FK.

ALTER TABLE org_order_discounts_dtl
  ADD CONSTRAINT fk_ord_disc_promo
    FOREIGN KEY (promotion_id) REFERENCES org_promotions_mst(id) ON DELETE SET NULL;

-- ── Step 7: Seed — Tenant 1 (Oman / OMR) ────────────────────────────────────
-- discount_type uses existing DB enum values: 'percentage' | 'fixed_amount' (lowercase)

INSERT INTO org_promotions_mst
  (id, tenant_org_id, promo_code, promo_name, promo_name2,
   discount_type, discount_value, promo_type,
   min_order_amount, max_uses, max_uses_per_customer,
   valid_from, valid_to, stackable, currency_code,
   is_active, rec_status, created_by)
VALUES

-- Welcome — auto-apply (NULL code), first-order only
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  NULL, 'Welcome 10% Off', 'خصم ترحيبي 10%',
  'percentage', 10.000, 'PERCENTAGE',
  NULL, NULL, 1, '2024-01-01', NULL, false, 'OMR', true, 1, NULL),

-- Ramadan campaign
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  'RAMADAN25', 'Ramadan Special 25%', 'عرض رمضان 25%',
  'percentage', 25.000, 'PERCENTAGE',
  20.000, 500, 1, '2025-03-01', '2025-03-31', false, 'OMR', true, 1, NULL),

-- Fixed OMR discount
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  'SAVE8', 'Save 8 OMR', 'وفّر 8 ريال عماني',
  'fixed_amount', 8.000, 'FIXED_AMOUNT',
  40.000, 1000, 2, '2024-01-01', NULL, false, 'OMR', true, 1, NULL),

-- Weekend stackable
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  'WEEKEND15', 'Weekend 15% Off', 'خصم نهاية الأسبوع 15%',
  'percentage', 15.000, 'PERCENTAGE',
  12.000, NULL, NULL, '2024-01-01', NULL, true, 'OMR', true, 1, NULL),

-- Bulk auto-apply — stackable
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  NULL, 'Bulk Order 5% Off', 'خصم الطلبات الكبيرة 5%',
  'percentage', 5.000, 'PERCENTAGE',
  80.000, NULL, NULL, '2024-01-01', NULL, true, 'OMR', true, 1, NULL),

-- B2B corporate
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  'CORP30', 'Corporate Partner 30%', 'شريك مؤسسي 30%',
  'percentage', 30.000, 'PERCENTAGE',
  60.000, NULL, NULL, '2024-01-01', NULL, false, 'OMR', true, 1, NULL);

-- ── Step 8: Seed — Tenant 2 (Saudi Arabia / SAR) ─────────────────────────────
-- Wrapped in DO block so the insert is silently skipped if tenant 2 doesn't
-- exist in this environment (local dev may only have tenant 1).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM org_tenants_mst
    WHERE id = 'c9ac29d1-219c-4a3a-8887-f860550c32be'
  ) THEN
    INSERT INTO org_promotions_mst
      (id, tenant_org_id, promo_code, promo_name, promo_name2,
       discount_type, discount_value, promo_type,
       min_order_amount, max_uses, max_uses_per_customer,
       valid_from, valid_to, stackable, currency_code,
       is_active, rec_status, created_by)
    VALUES
      -- Welcome — auto-apply, first-order only
      (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
        NULL, 'First Order 20 SAR Off', 'خصم 20 ريال للطلب الأول',
        'fixed_amount', 20.000, 'FIXED_AMOUNT',
        NULL, NULL, 1, '2024-01-01', NULL, false, 'SAR', true, 1, NULL),
      -- Saudi National Day 94th (23 Sep 2025)
      (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
        'KSA94', 'National Day 25% Off', 'عروض اليوم الوطني 25%',
        'percentage', 25.000, 'PERCENTAGE',
        80.000, 500, 1, '2025-09-20', '2025-09-23', false, 'SAR', true, 1, NULL),
      -- Referral bonus
      (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
        'REFER25', 'Referral 25 SAR', 'مكافأة الإحالة 25 ريال',
        'fixed_amount', 25.000, 'FIXED_AMOUNT',
        50.000, NULL, 1, '2024-01-01', NULL, false, 'SAR', true, 1, NULL),
      -- VIP auto-apply stackable
      (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
        NULL, 'VIP Member 10% Extra', 'خصم إضافي للأعضاء 10%',
        'percentage', 10.000, 'PERCENTAGE',
        NULL, NULL, NULL, '2024-01-01', NULL, true, 'SAR', true, 1, NULL),
      -- Summer clearance
      (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
        'SUMMER20', 'Summer Sale 20%', 'تخفيضات الصيف 20%',
        'percentage', 20.000, 'PERCENTAGE',
        60.000, 300, 2, '2025-06-01', '2025-08-31', false, 'SAR', true, 1, NULL),
      -- Express add-on stackable
      (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
        'EXPRESS30', 'Express 30 SAR Off', 'خصم 30 ريال على الخدمة السريعة',
        'fixed_amount', 30.000, 'FIXED_AMOUNT',
        150.000, NULL, NULL, '2024-01-01', NULL, true, 'SAR', true, 1, NULL);
  END IF;
END $$;
