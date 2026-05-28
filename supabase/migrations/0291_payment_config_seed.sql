-- ============================================================
-- Migration 0291: Extend Payment Config Tables + Seed
-- Phase 6.2 of the Order Financial Platform
--
-- Steps:
--   0a. Add HQ global-disable controls to sys_payment_method_cd
--   0b. Add HQ global-disable controls to sys_payment_gateway_cd
--   0c. Add platform-disable controls to org_payment_methods_cf
--   1.  Add routing/eligibility columns to org_payment_methods_cf
--   2.  Seed sys_payment_method_cd with missing codes
--   3.  Seed cash drawers (branch_id resolved dynamically)
--   4.  Seed payment method config — 3-batch (Batch A/B/C) per tenant
--   5.  Seed payment terminals
-- ============================================================

-- ── Step 0a: HQ global-disable controls on sys_payment_method_cd ─────────────
ALTER TABLE sys_payment_method_cd
  ADD COLUMN IF NOT EXISTS is_globally_disabled     BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS globally_disabled_reason TEXT,
  ADD COLUMN IF NOT EXISTS globally_disabled_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS globally_disabled_by     TEXT;

-- ── Step 0b: HQ global-disable controls on sys_payment_gateway_cd ────────────
ALTER TABLE sys_payment_gateway_cd
  ADD COLUMN IF NOT EXISTS is_globally_disabled     BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS globally_disabled_reason TEXT,
  ADD COLUMN IF NOT EXISTS globally_disabled_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS globally_disabled_by     TEXT;

-- ── Step 0c: Platform-disable controls on org_payment_methods_cf ─────────────
-- HQ disables a specific method for one specific tenant (compliance, plan limits)
ALTER TABLE org_payment_methods_cf
  ADD COLUMN IF NOT EXISTS is_platform_disabled     BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS platform_disabled_reason TEXT,
  ADD COLUMN IF NOT EXISTS platform_disabled_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS platform_disabled_by     TEXT;

-- ── Step 1: Routing + eligibility columns on org_payment_methods_cf ──────────
ALTER TABLE org_payment_methods_cf
  ADD COLUMN IF NOT EXISTS settlement_type_code    TEXT
    CHECK (settlement_type_code IN (
      'PAY_IN_ADVANCE','PAY_ON_COLLECTION','PAY_ON_DELIVERY','CREDIT_INVOICE'
    )),
  ADD COLUMN IF NOT EXISTS credit_application_type TEXT
    CHECK (credit_application_type IN (
      'GIFT_CARD','WALLET','ADVANCE','CREDIT_NOTE','LOYALTY_POINTS'
    )),
  ADD COLUMN IF NOT EXISTS requires_cash_drawer    BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requires_terminal       BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS min_order_amount        DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS max_order_amount        DECIMAL(19,4);

-- Step 2: unique index uq_org_payment_methods_cf ALREADY EXISTS from migration 0269
-- Do NOT recreate — it is an expression-based index on COALESCE(gateway_code,'').

-- ── Step 2: Seed sys_payment_method_cd — add missing codes ───────────────────
-- Adds CREDIT_APPLICATION types + PAY_ON_DELIVERY + CREDIT_INVOICE.
-- Re-activates PAY_ON_COLLECTION (deprecated in 0267; unified design needs it).
-- PAYMENT_GATEWAY already seeded in 0267 → ON CONFLICT DO NOTHING.

INSERT INTO sys_payment_method_cd
  (payment_method_code, payment_method_name, payment_method_name2,
   payment_nature, method_category, is_enabled, is_active, rec_status,
   is_deprecated, replacement_code)
VALUES
  ('GIFT_CARD',       'Gift Card',          'بطاقة هدية',         'CREDIT_APPLICATION',  'STORED_VALUE', true,  true, 1, false, NULL),
  ('WALLET',          'Wallet',             'المحفظة',            'CREDIT_APPLICATION',  'STORED_VALUE', true,  true, 1, false, NULL),
  ('ADVANCE',         'Customer Advance',   'مقدم من العميل',        'CREDIT_APPLICATION',  'STORED_VALUE', true,  true, 1, false, NULL),
  ('CREDIT_NOTE',     'Credit Note',        'إشعار دائن',         'CREDIT_APPLICATION',  'STORED_VALUE', true,  true, 1, false, NULL),
  ('LOYALTY_POINTS',  'Loyalty Points',     'نقاط الولاء',        'CREDIT_APPLICATION',  'LOYALTY',      true,  true, 1, false, NULL),
  ('PAYMENT_GATEWAY', 'Payment Gateway',    'بوابة الدفع',        'REAL_PAYMENT',        'GATEWAY',      true,  true, 1, false, NULL),
  ('PAY_ON_DELIVERY', 'Pay on Delivery',    'الدفع عند التسليم',  'DEFERRED_SETTLEMENT', 'TIMING',       true,  true, 1, false, NULL),
  ('CREDIT_INVOICE',  'Credit Invoice',     'فاتورة آجلة',        'AR_ALLOCATION',       'INVOICE',      false, true, 1, false, NULL)
ON CONFLICT (payment_method_code) DO NOTHING;

-- Re-activate PAY_ON_COLLECTION — deprecated in 0267 but needed for unified checkout
UPDATE sys_payment_method_cd
SET is_deprecated     = false,
    is_active         = true,
    rec_status        = 1,
    payment_nature    = 'DEFERRED_SETTLEMENT',
    method_category   = 'TIMING',
    replacement_code  = NULL
WHERE payment_method_code = 'PAY_ON_COLLECTION';

-- ── Step 3: Cash Drawers ──────────────────────────────────────────────────────
-- branch_id is NOT NULL; we resolve the first available branch per tenant dynamically.
-- If no branch exists yet, the seed is skipped for that tenant gracefully.

DO $$
DECLARE
  v_branch_id UUID;
BEGIN
  -- Tenant 1 cash drawers
  SELECT id INTO v_branch_id
  FROM org_branches_mst
  WHERE tenant_org_id = '11111111-1111-1111-1111-111111111111'
    AND is_active = true
  ORDER BY created_at
  LIMIT 1;

  IF v_branch_id IS NOT NULL THEN
    INSERT INTO org_cash_drawers_mst
      (id, tenant_org_id, branch_id, drawer_code, drawer_name, drawer_name2,
       drawer_type, currency_code, requires_session, opening_float_required,
       max_cash_limit, is_active, rec_status, created_by)
    VALUES
      (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
       v_branch_id, 'DRAWER-01', 'Main Counter Drawer', 'صندوق الكاونتر الرئيسي',
       'COUNTER', 'OMR', true, true, 2000.000, true, 1, NULL),
      (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
       v_branch_id, 'SAFE-01', 'Branch Safe', 'خزنة الفرع',
       'SAFE', 'OMR', false, false, 20000.000, true, 1, NULL),
      (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
       v_branch_id, 'DRIVER-01', 'Driver Bag #1', 'حقيبة السائق 1',
       'DRIVER_BAG', 'OMR', true, false, 800.000, true, 1, NULL)
    ON CONFLICT (tenant_org_id, drawer_code) DO NOTHING;
  END IF;

  -- Tenant 2 cash drawers (conditional on tenant existing)
  IF EXISTS (
    SELECT 1 FROM org_tenants_mst
    WHERE id = 'c9ac29d1-219c-4a3a-8887-f860550c32be'
  ) THEN
    SELECT id INTO v_branch_id
    FROM org_branches_mst
    WHERE tenant_org_id = 'c9ac29d1-219c-4a3a-8887-f860550c32be'
      AND is_active = true
    ORDER BY created_at
    LIMIT 1;

    IF v_branch_id IS NOT NULL THEN
      INSERT INTO org_cash_drawers_mst
        (id, tenant_org_id, branch_id, drawer_code, drawer_name, drawer_name2,
         drawer_type, currency_code, requires_session, opening_float_required,
         max_cash_limit, is_active, rec_status, created_by)
      VALUES
        (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
         v_branch_id, 'DRAWER-01', 'Reception Drawer', 'صندوق الاستقبال',
         'COUNTER', 'SAR', true, true, 10000.000, true, 1, NULL),
        (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
         v_branch_id, 'DRAWER-02', 'VIP Counter Drawer', 'صندوق كاونتر VIP',
         'COUNTER', 'SAR', true, true, 10000.000, true, 1, NULL),
        (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
         v_branch_id, 'SAFE-01', 'Main Safe', 'الخزنة الرئيسية',
         'SAFE', 'SAR', false, false, 100000.000, true, 1, NULL),
        (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
         v_branch_id, 'DRIVER-01', 'Driver Bag #1', 'حقيبة السائق 1',
         'DRIVER_BAG', 'SAR', true, false, 3000.000, true, 1, NULL),
        (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
         v_branch_id, 'DRIVER-02', 'Driver Bag #2', 'حقيبة السائق 2',
         'DRIVER_BAG', 'SAR', true, false, 3000.000, true, 1, NULL)
      ON CONFLICT (tenant_org_id, drawer_code) DO NOTHING;
    END IF;
  END IF;
END $$;

-- ── Step 4: Payment Method Config — Tenant 1 ─────────────────────────────────

-- Batch A: REAL_PAYMENT + CREDIT_APPLICATION from sys_payment_method_cd
INSERT INTO org_payment_methods_cf (
  id, tenant_org_id, payment_method_code, payment_nature, gateway_code,
  settlement_type_code, credit_application_type,
  requires_cash_drawer, requires_terminal,
  is_enabled, is_platform_disabled,
  is_active, rec_status, rec_order, rec_notes,
  created_at, created_by, created_info, updated_at, updated_by, updated_info,
  display_name, display_name2, metadata,
  allowed_in_pos, allowed_in_customer_app, allowed_in_staff_app, allowed_in_admin_app,
  allowed_for_pay_now, allowed_for_pay_on_collection,
  allowed_for_invoice_payment, allowed_for_refund,
  supports_partial_payment, supports_change_return, supports_overpayment,
  requires_reference, requires_approval, display_order
)
SELECT
  gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  s.payment_method_code, s.payment_nature, NULL,
  NULL,
  CASE s.payment_method_code
    WHEN 'GIFT_CARD'      THEN 'GIFT_CARD'
    WHEN 'WALLET'         THEN 'WALLET'
    WHEN 'ADVANCE'        THEN 'ADVANCE'
    WHEN 'CREDIT_NOTE'    THEN 'CREDIT_NOTE'
    WHEN 'LOYALTY_POINTS' THEN 'LOYALTY_POINTS'
    ELSE NULL
  END,
  CASE WHEN s.payment_method_code = 'CASH' THEN true ELSE false END,
  CASE WHEN s.payment_method_code = 'CARD' THEN true ELSE false END,
  s.is_enabled, false,
  s.is_active, s.rec_status, s.rec_order, s.rec_notes,
  s.created_at, s.created_by, s.created_info, s.updated_at, s.updated_by, s.updated_info,
  s.payment_method_name, s.payment_method_name2,
  jsonb_build_object(
    'method_category',       s.method_category,
    'payment_method_color1', s.payment_method_color1,
    'payment_method_color2', s.payment_method_color2,
    'payment_method_color3', s.payment_method_color3,
    'payment_method_icon',   s.payment_method_icon,
    'payment_method_image',  s.payment_method_image
  ),
  true, false, false, true, true, true, true, true,
  true,
  CASE WHEN s.payment_method_code = 'CASH' THEN true ELSE false END,
  CASE WHEN s.payment_method_code = 'CASH' THEN true ELSE false END,
  false, false,
  ROW_NUMBER() OVER (ORDER BY s.payment_nature, s.payment_method_code)
FROM sys_payment_method_cd s
WHERE s.is_active = true AND s.is_enabled = true AND s.rec_status = 1
  AND s.is_deprecated = false AND s.is_globally_disabled = false
  AND s.payment_nature IN ('REAL_PAYMENT', 'CREDIT_APPLICATION')
  AND s.payment_method_code != 'PAYMENT_GATEWAY'
  AND NOT EXISTS (
    SELECT 1 FROM org_payment_methods_cf o
    WHERE o.tenant_org_id = '11111111-1111-1111-1111-111111111111'
      AND o.payment_method_code = s.payment_method_code
      AND COALESCE(o.gateway_code, '') = ''
  );

-- Batch B: One row per active gateway — PAYMENT_GATEWAY + gateway_code
INSERT INTO org_payment_methods_cf (
  id, tenant_org_id, payment_method_code, payment_nature, gateway_code,
  settlement_type_code, credit_application_type,
  requires_cash_drawer, requires_terminal,
  is_enabled, is_platform_disabled,
  is_active, rec_status,
  display_name, display_name2, metadata,
  allowed_in_pos, allowed_in_customer_app, allowed_in_staff_app, allowed_in_admin_app,
  allowed_for_pay_now, allowed_for_pay_on_collection,
  allowed_for_invoice_payment, allowed_for_refund,
  supports_partial_payment, supports_change_return, supports_overpayment,
  requires_reference, requires_approval, display_order
)
SELECT
  gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  'PAYMENT_GATEWAY', 'REAL_PAYMENT', g.code,
  NULL, NULL,
  false, true,
  true, false,
  true, 1,
  g.name, g.name2,
  jsonb_build_object('gateway_type', g.gateway_type, 'fee_percentage', g.fee_percentage),
  true, false, false, true, true, true, true, true,
  true, false, false, false, false,
  100 + ROW_NUMBER() OVER (ORDER BY g.code)
FROM sys_payment_gateway_cd g
WHERE g.is_active = true AND g.is_globally_disabled = false
  AND NOT EXISTS (
    SELECT 1 FROM org_payment_methods_cf o
    WHERE o.tenant_org_id = '11111111-1111-1111-1111-111111111111'
      AND o.payment_method_code = 'PAYMENT_GATEWAY'
      AND o.gateway_code = g.code
  );

-- Batch C: DEFERRED_SETTLEMENT + AR_ALLOCATION — direct insert
INSERT INTO org_payment_methods_cf (
  id, tenant_org_id, payment_method_code, payment_nature, gateway_code,
  settlement_type_code, credit_application_type,
  requires_cash_drawer, requires_terminal,
  is_enabled, is_platform_disabled,
  is_active, rec_status,
  display_name, display_name2, metadata,
  allowed_in_pos, allowed_in_customer_app, allowed_in_staff_app, allowed_in_admin_app,
  allowed_for_pay_now, allowed_for_pay_on_collection,
  allowed_for_invoice_payment, allowed_for_refund,
  supports_partial_payment, supports_change_return, supports_overpayment,
  requires_reference, requires_approval, display_order
)
SELECT * FROM (VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111'::UUID,
   'PAY_ON_COLLECTION', 'DEFERRED_SETTLEMENT', NULL::TEXT,
   'PAY_ON_COLLECTION', NULL::TEXT, false, false,
   true, false, true, 1,
   'Pay on Collection', 'الدفع عند الاستلام', '{}'::JSONB,
   true, false, false, true, false, true, false, false,
   true, false, false, false, false, 200),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111'::UUID,
   'PAY_ON_DELIVERY', 'DEFERRED_SETTLEMENT', NULL::TEXT,
   'PAY_ON_DELIVERY', NULL::TEXT, false, false,
   true, false, true, 1,
   'Pay on Delivery', 'الدفع عند التسليم', '{}'::JSONB,
   false, false, false, true, false, false, false, false,
   true, false, false, false, false, 201),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111'::UUID,
   'CREDIT_INVOICE', 'AR_ALLOCATION', NULL::TEXT,
   'CREDIT_INVOICE', NULL::TEXT, false, false,
   false, false, true, 1,
   'Credit Invoice', 'فاتورة آجلة', '{}'::JSONB,
   false, false, false, true, false, false, true, false,
   true, false, false, true, true, 202)
) AS v(id, tenant_org_id, payment_method_code, payment_nature, gateway_code,
        settlement_type_code, credit_application_type,
        requires_cash_drawer, requires_terminal,
        is_enabled, is_platform_disabled, is_active, rec_status,
        display_name, display_name2, metadata,
        allowed_in_pos, allowed_in_customer_app, allowed_in_staff_app, allowed_in_admin_app,
        allowed_for_pay_now, allowed_for_pay_on_collection,
        allowed_for_invoice_payment, allowed_for_refund,
        supports_partial_payment, supports_change_return, supports_overpayment,
        requires_reference, requires_approval, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM org_payment_methods_cf o
  WHERE o.tenant_org_id = v.tenant_org_id
    AND o.payment_method_code = v.payment_method_code
    AND COALESCE(o.gateway_code, '') = ''
);

-- ── Step 5: Payment Terminals — Tenant 1 ─────────────────────────────────────

INSERT INTO org_payment_terminals_cf
  (id, tenant_org_id, branch_id, terminal_code, terminal_name, terminal_name2,
   terminal_type, is_enabled, is_active, rec_status, created_by)
VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   NULL, 'POS-001', 'Main POS Terminal', 'جهاز البيع الرئيسي',
   'POS_CARD_TERMINAL', true, true, 1, NULL),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   NULL, 'MOB-001', 'Mobile POS #1', 'جهاز بيع متنقل 1',
   'POS_CARD_TERMINAL', true, true, 1, NULL)
ON CONFLICT (tenant_org_id, terminal_code) DO NOTHING;

-- ── Step 6: Payment Config + Terminals — Tenant 2 (conditional) ──────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org_tenants_mst
    WHERE id = 'c9ac29d1-219c-4a3a-8887-f860550c32be'
  ) THEN
    RETURN;
  END IF;

  -- Batch A: REAL_PAYMENT + CREDIT_APPLICATION
  INSERT INTO org_payment_methods_cf (
    id, tenant_org_id, payment_method_code, payment_nature, gateway_code,
    settlement_type_code, credit_application_type,
    requires_cash_drawer, requires_terminal,
    is_enabled, is_platform_disabled,
    is_active, rec_status, rec_order, rec_notes,
    created_at, created_by, created_info, updated_at, updated_by, updated_info,
    display_name, display_name2, metadata,
    allowed_in_pos, allowed_in_customer_app, allowed_in_staff_app, allowed_in_admin_app,
    allowed_for_pay_now, allowed_for_pay_on_collection,
    allowed_for_invoice_payment, allowed_for_refund,
    supports_partial_payment, supports_change_return, supports_overpayment,
    requires_reference, requires_approval, display_order
  )
  SELECT
    gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
    s.payment_method_code, s.payment_nature, NULL,
    NULL,
    CASE s.payment_method_code
      WHEN 'GIFT_CARD'      THEN 'GIFT_CARD'
      WHEN 'WALLET'         THEN 'WALLET'
      WHEN 'ADVANCE'        THEN 'ADVANCE'
      WHEN 'CREDIT_NOTE'    THEN 'CREDIT_NOTE'
      WHEN 'LOYALTY_POINTS' THEN 'LOYALTY_POINTS'
      ELSE NULL
    END,
    CASE WHEN s.payment_method_code = 'CASH' THEN true ELSE false END,
    CASE WHEN s.payment_method_code = 'CARD' THEN true ELSE false END,
    s.is_enabled, false,
    s.is_active, s.rec_status, s.rec_order, s.rec_notes,
    s.created_at, s.created_by, s.created_info, s.updated_at, s.updated_by, s.updated_info,
    s.payment_method_name, s.payment_method_name2,
    jsonb_build_object(
      'method_category',       s.method_category,
      'payment_method_color1', s.payment_method_color1,
      'payment_method_color2', s.payment_method_color2,
      'payment_method_color3', s.payment_method_color3,
      'payment_method_icon',   s.payment_method_icon,
      'payment_method_image',  s.payment_method_image
    ),
    true, false, false, true, true, true, true, true,
    true,
    CASE WHEN s.payment_method_code = 'CASH' THEN true ELSE false END,
    CASE WHEN s.payment_method_code = 'CASH' THEN true ELSE false END,
    false, false,
    ROW_NUMBER() OVER (ORDER BY s.payment_nature, s.payment_method_code)
  FROM sys_payment_method_cd s
  WHERE s.is_active = true AND s.is_enabled = true AND s.rec_status = 1
    AND s.is_deprecated = false AND s.is_globally_disabled = false
    AND s.payment_nature IN ('REAL_PAYMENT', 'CREDIT_APPLICATION')
    AND s.payment_method_code != 'PAYMENT_GATEWAY'
    AND NOT EXISTS (
      SELECT 1 FROM org_payment_methods_cf o
      WHERE o.tenant_org_id = 'c9ac29d1-219c-4a3a-8887-f860550c32be'
        AND o.payment_method_code = s.payment_method_code
        AND COALESCE(o.gateway_code, '') = ''
    );

  -- Batch B: gateway rows
  INSERT INTO org_payment_methods_cf (
    id, tenant_org_id, payment_method_code, payment_nature, gateway_code,
    settlement_type_code, credit_application_type,
    requires_cash_drawer, requires_terminal,
    is_enabled, is_platform_disabled,
    is_active, rec_status,
    display_name, display_name2, metadata,
    allowed_in_pos, allowed_in_customer_app, allowed_in_staff_app, allowed_in_admin_app,
    allowed_for_pay_now, allowed_for_pay_on_collection,
    allowed_for_invoice_payment, allowed_for_refund,
    supports_partial_payment, supports_change_return, supports_overpayment,
    requires_reference, requires_approval, display_order
  )
  SELECT
    gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
    'PAYMENT_GATEWAY', 'REAL_PAYMENT', g.code,
    NULL, NULL,
    false, true,
    true, false,
    true, 1,
    g.name, g.name2,
    jsonb_build_object('gateway_type', g.gateway_type, 'fee_percentage', g.fee_percentage),
    true, false, false, true, true, true, true, true,
    true, false, false, false, false,
    100 + ROW_NUMBER() OVER (ORDER BY g.code)
  FROM sys_payment_gateway_cd g
  WHERE g.is_active = true AND g.is_globally_disabled = false
    AND NOT EXISTS (
      SELECT 1 FROM org_payment_methods_cf o
      WHERE o.tenant_org_id = 'c9ac29d1-219c-4a3a-8887-f860550c32be'
        AND o.payment_method_code = 'PAYMENT_GATEWAY'
        AND o.gateway_code = g.code
    );

  -- Batch C: DEFERRED + AR
  INSERT INTO org_payment_methods_cf (
    id, tenant_org_id, payment_method_code, payment_nature, gateway_code,
    settlement_type_code, credit_application_type,
    requires_cash_drawer, requires_terminal,
    is_enabled, is_platform_disabled,
    is_active, rec_status,
    display_name, display_name2, metadata,
    allowed_in_pos, allowed_in_customer_app, allowed_in_staff_app, allowed_in_admin_app,
    allowed_for_pay_now, allowed_for_pay_on_collection,
    allowed_for_invoice_payment, allowed_for_refund,
    supports_partial_payment, supports_change_return, supports_overpayment,
    requires_reference, requires_approval, display_order
  )
  SELECT * FROM (VALUES
    (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be'::UUID,
     'PAY_ON_COLLECTION', 'DEFERRED_SETTLEMENT', NULL::TEXT,
     'PAY_ON_COLLECTION', NULL::TEXT, false, false,
     true, false, true, 1,
     'Pay on Collection', 'الدفع عند الاستلام', '{}'::JSONB,
     true, false, false, true, false, true, false, false,
     true, false, false, false, false, 200),
    (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be'::UUID,
     'PAY_ON_DELIVERY', 'DEFERRED_SETTLEMENT', NULL::TEXT,
     'PAY_ON_DELIVERY', NULL::TEXT, false, false,
     true, false, true, 1,
     'Pay on Delivery', 'الدفع عند التسليم', '{}'::JSONB,
     false, false, false, true, false, false, false, false,
     true, false, false, false, false, 201),
    (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be'::UUID,
     'CREDIT_INVOICE', 'AR_ALLOCATION', NULL::TEXT,
     'CREDIT_INVOICE', NULL::TEXT, false, false,
     false, false, true, 1,
     'Credit Invoice', 'فاتورة آجلة', '{}'::JSONB,
     false, false, false, true, false, false, true, false,
     true, false, false, true, true, 202)
  ) AS v(id, tenant_org_id, payment_method_code, payment_nature, gateway_code,
          settlement_type_code, credit_application_type,
          requires_cash_drawer, requires_terminal,
          is_enabled, is_platform_disabled, is_active, rec_status,
          display_name, display_name2, metadata,
          allowed_in_pos, allowed_in_customer_app, allowed_in_staff_app, allowed_in_admin_app,
          allowed_for_pay_now, allowed_for_pay_on_collection,
          allowed_for_invoice_payment, allowed_for_refund,
          supports_partial_payment, supports_change_return, supports_overpayment,
          requires_reference, requires_approval, display_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM org_payment_methods_cf o
    WHERE o.tenant_org_id = v.tenant_org_id
      AND o.payment_method_code = v.payment_method_code
      AND COALESCE(o.gateway_code, '') = ''
  );

  -- Terminals
  INSERT INTO org_payment_terminals_cf
    (id, tenant_org_id, branch_id, terminal_code, terminal_name, terminal_name2,
     terminal_type, is_enabled, is_active, rec_status, created_by)
  VALUES
    (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
     NULL, 'POS-001', 'Reception POS', 'جهاز استقبال POS',
     'POS_CARD_TERMINAL', true, true, 1, NULL),
    (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
     NULL, 'POS-002', 'VIP Counter POS', 'جهاز VIP POS',
     'POS_CARD_TERMINAL', true, true, 1, NULL),
    (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
     NULL, 'MOB-001', 'Driver Mobile POS', 'جهاز السائق المتنقل',
     'POS_CARD_TERMINAL', true, true, 1, NULL)
  ON CONFLICT (tenant_org_id, terminal_code) DO NOTHING;

END $$;
