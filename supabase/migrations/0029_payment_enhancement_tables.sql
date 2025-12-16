/*
  Migration: Payment Enhancement Tables
  Created: 2025-11-07
  Description: Creates tables for promo codes, gift cards, and discount rules to support full payment functionality

  Tables Created:
  - org_promo_codes_mst: Promotional codes/coupons
  - org_gift_cards_mst: Gift card tracking
  - org_discount_rules_cf: Discount campaign rules
  - org_promo_usage_log: Track promo code usage
  - org_gift_card_transactions: Track gift card usage
*/

BEGIN;


-- ============================================================================
-- Table: org_promo_codes_mst
-- Description: Store promotional codes with validation rules
-- ============================================================================
CREATE TABLE IF NOT EXISTS org_promo_codes_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,

  -- Promo code details
  promo_code VARCHAR(50) NOT NULL,
  promo_name VARCHAR(250),
  promo_name2 VARCHAR(250),  -- Arabic name
  description TEXT,
  description2 TEXT,  -- Arabic description

  -- Discount configuration
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value DECIMAL(10,3) NOT NULL CHECK (discount_value > 0),
  max_discount_amount DECIMAL(10,3),  -- Max discount for percentage type

  -- Validation rules
  min_order_amount DECIMAL(10,3) DEFAULT 0,
  max_order_amount DECIMAL(10,3),
  applicable_categories JSONB,  -- Array of service category codes

  -- Usage limits
  max_uses INTEGER,  -- NULL = unlimited
  max_uses_per_customer INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,

  -- Validity period
  valid_from TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valid_to TIMESTAMPTZ,

  -- Status and metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,  -- Additional flexible data

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(1000),

  -- Constraints
  CONSTRAINT org_promo_codes_tenant_fk
    FOREIGN KEY (tenant_org_id)
    REFERENCES org_tenants_mst(id)
    ON DELETE CASCADE,

  CONSTRAINT org_promo_codes_unique
    UNIQUE (tenant_org_id, promo_code)
);

-- Indexes for org_promo_codes_mst
CREATE INDEX idx_promo_codes_tenant ON org_promo_codes_mst(tenant_org_id);
CREATE INDEX idx_promo_codes_code ON org_promo_codes_mst(tenant_org_id, promo_code) WHERE is_active = true;
CREATE INDEX idx_promo_codes_validity ON org_promo_codes_mst(tenant_org_id, valid_from, valid_to) WHERE is_active = true;

COMMENT ON TABLE org_promo_codes_mst IS 'Promotional codes/coupons for order discounts';
COMMENT ON COLUMN org_promo_codes_mst.discount_type IS 'percentage: discount as %, fixed_amount: fixed OMR amount';
COMMENT ON COLUMN org_promo_codes_mst.applicable_categories IS 'JSON array of service category codes this promo applies to';

-- ============================================================================
-- Table: org_promo_usage_log
-- Description: Track promo code usage history
-- ============================================================================
CREATE TABLE IF NOT EXISTS org_promo_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  promo_code_id UUID NOT NULL,

  -- Usage details
  customer_id UUID,
  order_id UUID,
  invoice_id UUID,

  -- Discount applied
  discount_amount DECIMAL(10,3) NOT NULL,
  order_total_before DECIMAL(10,3) NOT NULL,
  order_total_after DECIMAL(10,3) NOT NULL,

  -- Metadata
  used_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_by VARCHAR(120),
  metadata JSONB,

  -- Constraints
  CONSTRAINT org_promo_usage_tenant_fk
    FOREIGN KEY (tenant_org_id)
    REFERENCES org_tenants_mst(id)
    ON DELETE CASCADE,

  CONSTRAINT org_promo_usage_promo_fk
    FOREIGN KEY (promo_code_id)
    REFERENCES org_promo_codes_mst(id)
    ON DELETE CASCADE
);

-- Indexes for org_promo_usage_log
CREATE INDEX idx_promo_usage_tenant ON org_promo_usage_log(tenant_org_id);
CREATE INDEX idx_promo_usage_promo ON org_promo_usage_log(tenant_org_id, promo_code_id);
CREATE INDEX idx_promo_usage_customer ON org_promo_usage_log(tenant_org_id, customer_id);
CREATE INDEX idx_promo_usage_order ON org_promo_usage_log(tenant_org_id, order_id);

COMMENT ON TABLE org_promo_usage_log IS 'Track promotional code usage history for audit and limit enforcement';

-- ============================================================================
-- Table: org_gift_cards_mst
-- Description: Gift card tracking and balance management
-- ============================================================================
CREATE TABLE IF NOT EXISTS org_gift_cards_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,

  -- Card identification
  card_number VARCHAR(50) NOT NULL UNIQUE,
  card_pin VARCHAR(20),  -- Optional PIN for security

  -- Card details
  card_name VARCHAR(250),
  card_name2 VARCHAR(250),  -- Arabic name

  -- Balance tracking
  original_amount DECIMAL(10,3) NOT NULL CHECK (original_amount > 0),
  current_balance DECIMAL(10,3) NOT NULL CHECK (current_balance >= 0),

  -- Validity
  issued_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expiry_date TIMESTAMPTZ,

  -- Customer association
  issued_to_customer_id UUID,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'used', 'expired', 'cancelled', 'suspended')),
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Metadata
  metadata JSONB,
  rec_notes VARCHAR(1000),

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,

  -- Constraints
  CONSTRAINT org_gift_cards_tenant_fk
    FOREIGN KEY (tenant_org_id)
    REFERENCES org_tenants_mst(id)
    ON DELETE CASCADE
);

-- Indexes for org_gift_cards_mst
CREATE INDEX idx_gift_cards_tenant ON org_gift_cards_mst(tenant_org_id);
CREATE INDEX idx_gift_cards_number ON org_gift_cards_mst(card_number) WHERE is_active = true;
CREATE INDEX idx_gift_cards_customer ON org_gift_cards_mst(tenant_org_id, issued_to_customer_id);
CREATE INDEX idx_gift_cards_status ON org_gift_cards_mst(tenant_org_id, status) WHERE is_active = true;

COMMENT ON TABLE org_gift_cards_mst IS 'Gift card tracking with balance management';
COMMENT ON COLUMN org_gift_cards_mst.status IS 'active: can be used, used: fully depleted, expired: past expiry date, cancelled: manually cancelled';

-- ============================================================================
-- Table: org_gift_card_transactions
-- Description: Track all gift card balance changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS org_gift_card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  gift_card_id UUID NOT NULL,

  -- Transaction details
  transaction_type VARCHAR(20) NOT NULL
    CHECK (transaction_type IN ('redemption', 'refund', 'adjustment', 'cancellation')),
  amount DECIMAL(10,3) NOT NULL,
  balance_before DECIMAL(10,3) NOT NULL,
  balance_after DECIMAL(10,3) NOT NULL,

  -- Related entities
  order_id UUID,
  invoice_id UUID,

  -- Transaction metadata
  notes TEXT,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_by VARCHAR(120),
  metadata JSONB,

  -- Constraints
  CONSTRAINT org_gift_card_trans_tenant_fk
    FOREIGN KEY (tenant_org_id)
    REFERENCES org_tenants_mst(id)
    ON DELETE CASCADE,

  CONSTRAINT org_gift_card_trans_card_fk
    FOREIGN KEY (gift_card_id)
    REFERENCES org_gift_cards_mst(id)
    ON DELETE CASCADE
);

-- Indexes for org_gift_card_transactions
CREATE INDEX idx_gift_card_trans_tenant ON org_gift_card_transactions(tenant_org_id);
CREATE INDEX idx_gift_card_trans_card ON org_gift_card_transactions(tenant_org_id, gift_card_id);
CREATE INDEX idx_gift_card_trans_order ON org_gift_card_transactions(tenant_org_id, order_id);
CREATE INDEX idx_gift_card_trans_date ON org_gift_card_transactions(tenant_org_id, transaction_date DESC);

COMMENT ON TABLE org_gift_card_transactions IS 'Audit trail of all gift card balance changes';

-- ============================================================================
-- Table: org_discount_rules_cf
-- Description: Configure automated discount campaigns and rules
-- ============================================================================
CREATE TABLE IF NOT EXISTS org_discount_rules_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,

  -- Rule identification
  rule_code VARCHAR(50) NOT NULL,
  rule_name VARCHAR(250) NOT NULL,
  rule_name2 VARCHAR(250),  -- Arabic name
  description TEXT,
  description2 TEXT,  -- Arabic description

  -- Rule type
  rule_type VARCHAR(30) NOT NULL
    CHECK (rule_type IN ('bulk_discount', 'category_discount', 'customer_tier', 'seasonal', 'first_order', 'loyalty')),

  -- Discount configuration
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value DECIMAL(10,3) NOT NULL CHECK (discount_value > 0),

  -- Conditions (stored as JSONB for flexibility)
  conditions JSONB NOT NULL,
  /*
    Example conditions structure:
    {
      "min_order_amount": 50.000,
      "min_items": 10,
      "service_categories": ["DRY_CLEAN", "LAUNDRY"],
      "customer_tiers": ["gold", "platinum"],
      "days_of_week": [1, 2, 3],
      "time_ranges": [{"start": "09:00", "end": "12:00"}]
    }
  */

  -- Priority and stacking
  priority INTEGER DEFAULT 0,  -- Higher priority rules applied first
  can_stack_with_promo BOOLEAN DEFAULT false,
  can_stack_with_other_rules BOOLEAN DEFAULT false,

  -- Validity
  valid_from TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valid_to TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Metadata
  metadata JSONB,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(1000),

  -- Constraints
  CONSTRAINT org_discount_rules_tenant_fk
    FOREIGN KEY (tenant_org_id)
    REFERENCES org_tenants_mst(id)
    ON DELETE CASCADE,

  CONSTRAINT org_discount_rules_unique
    UNIQUE (tenant_org_id, rule_code)
);

-- Indexes for org_discount_rules_cf
CREATE INDEX idx_discount_rules_tenant ON org_discount_rules_cf(tenant_org_id);
CREATE INDEX idx_discount_rules_type ON org_discount_rules_cf(tenant_org_id, rule_type) WHERE is_active = true;
CREATE INDEX idx_discount_rules_priority ON org_discount_rules_cf(tenant_org_id, priority DESC) WHERE is_active = true;
CREATE INDEX idx_discount_rules_validity ON org_discount_rules_cf(tenant_org_id, valid_from, valid_to) WHERE is_active = true;

COMMENT ON TABLE org_discount_rules_cf IS 'Automated discount rules and campaigns';
COMMENT ON COLUMN org_discount_rules_cf.conditions IS 'JSONB object with flexible rule conditions';
COMMENT ON COLUMN org_discount_rules_cf.priority IS 'Higher priority rules evaluated first (0 = lowest)';

-- ============================================================================
-- Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE org_promo_codes_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_promo_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_gift_cards_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_gift_card_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_discount_rules_cf ENABLE ROW LEVEL SECURITY;

-- RLS Policies for org_promo_codes_mst
CREATE POLICY tenant_isolation_promo_codes ON org_promo_codes_mst
  FOR ALL
  USING (
    tenant_org_id IN (
      SELECT tenant_org_id FROM org_users_mst WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for org_promo_usage_log
CREATE POLICY tenant_isolation_promo_usage ON org_promo_usage_log
  FOR ALL
  USING (
    tenant_org_id IN (
      SELECT tenant_org_id FROM org_users_mst WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for org_gift_cards_mst
CREATE POLICY tenant_isolation_gift_cards ON org_gift_cards_mst
  FOR ALL
  USING (
    tenant_org_id IN (
      SELECT tenant_org_id FROM org_users_mst WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for org_gift_card_transactions
CREATE POLICY tenant_isolation_gift_card_trans ON org_gift_card_transactions
  FOR ALL
  USING (
    tenant_org_id IN (
      SELECT tenant_org_id FROM org_users_mst WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for org_discount_rules_cf
CREATE POLICY tenant_isolation_discount_rules ON org_discount_rules_cf
  FOR ALL
  USING (
    tenant_org_id IN (
      SELECT tenant_org_id FROM org_users_mst WHERE user_id = auth.uid()
    )
  );

COMMIT;
