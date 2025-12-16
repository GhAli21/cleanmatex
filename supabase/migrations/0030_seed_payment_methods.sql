/*
  Migration: Seed Payment Methods
  Created: 2025-11-07
  Description: Seeds sys_payment_method_cd with standard payment methods supporting CleanMateX operations

  Payment Methods:
  - CASH: Cash payment
  - CARD: Credit/Debit card
  - PAY_ON_COLLECTION: Pay when customer collects order
  - CHECK: Bank check/cheque
  - INVOICE: Invoice for corporate/credit customers
  - HYPERPAY: HyperPay gateway (GCC)
  - PAYTABS: PayTabs gateway (GCC)
  - STRIPE: Stripe gateway (International)
*/

BEGIN;

-- ============================================================================
-- Insert Payment Methods
-- ============================================================================

INSERT INTO sys_payment_method_cd (
  payment_method_code,
  payment_method_name,
  payment_method_name2,
  is_enabled,
  is_active,
  payment_type_icon,
  payment_type_color1,
  rec_notes
) VALUES
  -- Cash Payment
  (
    'CASH',
    'Cash',
    'نقدي',
    true,
    true,
    'banknotes',
    '#10b981',  -- Green
    'Cash payment at store or on delivery'
  ),

  -- Card Payment (Generic)
  (
    'CARD',
    'Card',
    'بطاقة',
    true,
    true,
    'credit-card',
    '#3b82f6',  -- Blue
    'Credit or debit card payment'
  ),

  -- Pay on Collection
  (
    'PAY_ON_COLLECTION',
    'Pay on Collection',
    'الدفع عند الاستلام',
    true,
    true,
    'hand-coins',
    '#f59e0b',  -- Amber
    'Customer pays when collecting order'
  ),

  -- Bank Check
  (
    'CHECK',
    'Check',
    'شيك',
    true,
    true,
    'receipt',
    '#8b5cf6',  -- Purple
    'Payment by bank check/cheque'
  ),

  -- Invoice (Credit)
  (
    'INVOICE',
    'Invoice',
    'فاتورة',
    true,
    true,
    'file-text',
    '#06b6d4',  -- Cyan
    'Invoice for corporate/credit customers with payment terms'
  ),

  -- HyperPay Gateway (GCC)
  (
    'HYPERPAY',
    'HyperPay',
    'هايبر باي',
    false,  -- Disabled until configured
    true,
    'credit-card',
    '#ff6b6b',  -- Red
    'HyperPay payment gateway - popular in GCC region'
  ),

  -- PayTabs Gateway (GCC)
  (
    'PAYTABS',
    'PayTabs',
    'باي تابس',
    false,  -- Disabled until configured
    true,
    'credit-card',
    '#4ecdc4',  -- Teal
    'PayTabs payment gateway - GCC focused'
  ),

  -- Stripe Gateway (International)
  (
    'STRIPE',
    'Stripe',
    'سترايب',
    false,  -- Disabled until configured
    true,
    'credit-card',
    '#635bff',  -- Stripe Purple
    'Stripe payment gateway - international card processing'
  ),

  -- Bank Transfer
  (
    'BANK_TRANSFER',
    'Bank Transfer',
    'تحويل بنكي',
    true,
    true,
    'building-2',
    '#64748b',  -- Slate
    'Direct bank transfer'
  ),

  -- Mobile Payment (Generic)
  (
    'MOBILE_PAYMENT',
    'Mobile Payment',
    'دفع عبر الجوال',
    false,  -- Disabled until configured
    true,
    'smartphone',
    '#ec4899',  -- Pink
    'Mobile payment apps and wallets'
  )

ON CONFLICT (payment_method_code) DO UPDATE SET
  payment_method_name = EXCLUDED.payment_method_name,
  payment_method_name2 = EXCLUDED.payment_method_name2,
  payment_type_icon = EXCLUDED.payment_type_icon,
  payment_type_color1 = EXCLUDED.payment_type_color1,
  rec_notes = EXCLUDED.rec_notes,
  updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- Insert Payment Types (if table exists from schema_06.sql)
-- ============================================================================

-- Check if sys_payment_type_cd table exists and insert data
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'sys_payment_type_cd'
  ) THEN
    INSERT INTO sys_payment_type_cd (
      payment_type_id,
      payment_type_name,
      payment_type_name2,
      is_enabled,
      has_plan,
      is_active,
      payment_type_icon,
      payment_type_color1,
      rec_notes
    ) VALUES
      (
        'PAY_IN_ADVANCE',
        'Pay in Advance',
        'الدفع المسبق',
        true,
        false,
        true,
        'coins',
        '#10b981',
        'Customer pays before order is processed'
      ),
      (
        'PAY_ON_COLLECTION',
        'Pay on Collection',
        'الدفع عند الاستلام',
        true,
        false,
        true,
        'hand-coins',
        '#f59e0b',
        'Customer pays when collecting order'
      ),
      (
        'PAY_ON_DELIVERY',
        'Pay on Delivery',
        'الدفع عند التوصيل',
        true,
        false,
        true,
        'truck',
        '#3b82f6',
        'Customer pays when order is delivered'
      ),
      (
        'CREDIT_INVOICE',
        'Credit/Invoice',
        'فاتورة آجلة',
        true,
        true,
        true,
        'file-invoice',
        '#06b6d4',
        'Corporate/credit customers with payment terms'
      )
    ON CONFLICT (payment_type_id) DO UPDATE SET
      payment_type_name = EXCLUDED.payment_type_name,
      payment_type_name2 = EXCLUDED.payment_type_name2,
      payment_type_icon = EXCLUDED.payment_type_icon,
      payment_type_color1 = EXCLUDED.payment_type_color1,
      rec_notes = EXCLUDED.rec_notes,
      updated_at = CURRENT_TIMESTAMP;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- Verification Query (Comment out or remove in production)
-- ============================================================================

-- Verify inserted payment methods
-- SELECT
--   payment_method_code,
--   payment_method_name,
--   payment_method_name2,
--   is_enabled,
--   is_active,
--   payment_type_icon
-- FROM sys_payment_method_cd
-- ORDER BY payment_method_code;
