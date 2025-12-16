-- ==================================================================
-- 0042_sys_critical_code_tables.sql
-- Purpose: Create critical system code tables for core operations
-- Author: CleanMateX Development Team
-- Created: 2025-01-22
-- PRD: PRD-SAAS-MNG-0006 - Core Data & Code Management
-- ==================================================================
-- This migration creates the most critical code tables needed for
-- platform operations:
-- 1. sys_order_status_cd - Order lifecycle statuses
-- 2. sys_payment_status_cd - Payment processing statuses
-- 3. sys_payment_gateway_cd - Payment gateway configurations
-- 4. sys_service_type_cd - Service type classifications
-- ==================================================================

BEGIN;

-- ==================================================================
-- TABLE: sys_order_status_cd
-- Purpose: Order lifecycle statuses (DRAFT, INTAKE, WASHING, etc.)
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_order_status_cd (
  code VARCHAR(50) PRIMARY KEY,

  -- Display
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),                              -- Arabic
  description TEXT,
  description2 TEXT,                               -- Arabic

  -- UI
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),
  color VARCHAR(60),                               -- Hex color for UI

  -- Workflow
  is_initial_status BOOLEAN DEFAULT false,
  is_final_status BOOLEAN DEFAULT false,
  allowed_next_statuses VARCHAR(50)[],             -- Array of status codes

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,                  -- System statuses cannot be deleted
  is_active BOOLEAN DEFAULT true,

  -- SLA
  default_sla_hours INTEGER,

  -- Metadata
  metadata JSONB,
  /*
    Example:
    {
      "requires_qa": true,
      "sends_notification": true,
      "notification_template": "order_ready",
      "stage": "processing" | "quality" | "delivery" | "completed"
    }
  */

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1
);

-- Indexes
CREATE INDEX idx_order_status_active
  ON sys_order_status_cd(is_active, display_order);

CREATE INDEX idx_order_status_initial
  ON sys_order_status_cd(is_initial_status) WHERE is_initial_status = true;

CREATE INDEX idx_order_status_final
  ON sys_order_status_cd(is_final_status) WHERE is_final_status = true;

-- Comments
COMMENT ON TABLE sys_order_status_cd IS
  'System-wide order status codes defining the complete order lifecycle';

COMMENT ON COLUMN sys_order_status_cd.code IS
  'Unique status code (e.g., DRAFT, INTAKE, WASHING, READY, DELIVERED)';

COMMENT ON COLUMN sys_order_status_cd.allowed_next_statuses IS
  'Array of status codes that this status can transition to';

COMMENT ON COLUMN sys_order_status_cd.is_system IS
  'True for system-critical statuses that cannot be deleted';

-- ==================================================================
-- TABLE: sys_payment_status_cd
-- Purpose: Payment processing statuses
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_payment_status_cd (
  code VARCHAR(50) PRIMARY KEY,

  -- Display
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),                              -- Arabic
  description TEXT,
  description2 TEXT,                               -- Arabic

  -- UI
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),
  color VARCHAR(60),                               -- Hex color for UI

  -- Behavior
  is_final BOOLEAN DEFAULT false,                  -- Cannot transition from this state
  is_successful BOOLEAN DEFAULT false,             -- Indicates successful payment
  is_failed BOOLEAN DEFAULT false,                 -- Indicates failed payment
  allows_retry BOOLEAN DEFAULT false,              -- Can retry payment from this state

  -- Behavior flags
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,
  /*
    Example:
    {
      "requires_notification": true,
      "notification_template": "payment_confirmed",
      "webhook_event": "payment.succeeded"
    }
  */

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1
);

-- Indexes
CREATE INDEX idx_payment_status_active
  ON sys_payment_status_cd(is_active, display_order);

CREATE INDEX idx_payment_status_final
  ON sys_payment_status_cd(is_final) WHERE is_final = true;

-- Comments
COMMENT ON TABLE sys_payment_status_cd IS
  'Payment processing status codes (PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED)';

COMMENT ON COLUMN sys_payment_status_cd.is_final IS
  'True if payment cannot transition to another state';

COMMENT ON COLUMN sys_payment_status_cd.allows_retry IS
  'True if payment can be retried from this status';

-- ==================================================================
-- TABLE: sys_payment_gateway_cd
-- Purpose: Payment gateway configurations
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_payment_gateway_cd (
  code VARCHAR(50) PRIMARY KEY,

  -- Display
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),                              -- Arabic
  description TEXT,
  description2 TEXT,                               -- Arabic

  -- UI
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),
  logo_url VARCHAR(500),

  -- Configuration
  gateway_type VARCHAR(50) NOT NULL,               -- 'stripe', 'hyperpay', 'paytabs', 'manual'
  is_online BOOLEAN DEFAULT true,                  -- Online vs offline gateway
  requires_api_key BOOLEAN DEFAULT true,

  -- Support
  supported_payment_methods VARCHAR(50)[],         -- Array of payment method codes
  supported_currencies VARCHAR(10)[],              -- Array of currency codes (SAR, USD, etc.)

  -- Fees
  has_transaction_fee BOOLEAN DEFAULT false,
  fee_percentage DECIMAL(5,2),
  fee_fixed_amount DECIMAL(10,3),

  -- Availability
  available_for_plans VARCHAR(50)[],               -- NULL = all plans
  min_transaction_amount DECIMAL(10,3),
  max_transaction_amount DECIMAL(10,3),

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,
  /*
    Example:
    {
      "api_endpoint": "https://api.stripe.com/v1",
      "webhook_url": "https://platform.cleanmatex.com/webhooks/stripe",
      "docs_url": "https://stripe.com/docs/api",
      "sandbox_mode": false,
      "config_schema": {
        "required": ["api_key", "secret_key"],
        "optional": ["webhook_secret"]
      }
    }
  */

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1
);

-- Indexes
CREATE INDEX idx_payment_gateway_active
  ON sys_payment_gateway_cd(is_active, display_order);

CREATE INDEX idx_payment_gateway_type
  ON sys_payment_gateway_cd(gateway_type);

-- Comments
COMMENT ON TABLE sys_payment_gateway_cd IS
  'Payment gateway configurations (Stripe, HyperPay, PayTabs, etc.)';

COMMENT ON COLUMN sys_payment_gateway_cd.gateway_type IS
  'Type of payment gateway (stripe, hyperpay, paytabs, manual)';

COMMENT ON COLUMN sys_payment_gateway_cd.supported_payment_methods IS
  'Array of payment method codes this gateway supports';

-- ==================================================================
-- TABLE: sys_service_type_cd
-- Purpose: Service type classifications
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_service_type_cd (
  code VARCHAR(50) PRIMARY KEY,

  -- Display
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),                              -- Arabic
  description TEXT,
  description2 TEXT,                               -- Arabic

  -- UI
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),
  color VARCHAR(60),

  -- Classification
  service_category_code VARCHAR(50),               -- Links to sys_service_category_cd
  requires_item_count BOOLEAN DEFAULT true,
  requires_weight BOOLEAN DEFAULT false,
  requires_dimensions BOOLEAN DEFAULT false,

  -- Pricing
  default_pricing_unit VARCHAR(20),                -- 'per_item', 'per_kg', 'per_sqm'
  default_unit_price DECIMAL(10,3),
  express_multiplier DECIMAL(5,2) DEFAULT 1.5,

  -- Workflow
  estimated_turnaround_hours INTEGER,
  express_turnaround_hours INTEGER,
  default_workflow_steps VARCHAR(50)[],            -- Array of workflow step codes

  -- Availability
  is_express_available BOOLEAN DEFAULT true,
  is_subscription_available BOOLEAN DEFAULT true,

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,
  /*
    Example:
    {
      "special_handling": true,
      "requires_inspection": true,
      "damage_risk": "low" | "medium" | "high",
      "common_garments": ["SHIRT", "PANTS", "DRESS"]
    }
  */

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1,

  -- Foreign keys
  CONSTRAINT fk_service_type_category
    FOREIGN KEY (service_category_code)
    REFERENCES sys_service_category_cd(service_category_code)
    ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_service_type_active
  ON sys_service_type_cd(is_active, display_order);

CREATE INDEX idx_service_type_category
  ON sys_service_type_cd(service_category_code);

-- Comments
COMMENT ON TABLE sys_service_type_cd IS
  'Service type codes (WASH_AND_IRON, DRY_CLEAN, IRON_ONLY, etc.)';

COMMENT ON COLUMN sys_service_type_cd.service_category_code IS
  'Parent service category this type belongs to';

COMMENT ON COLUMN sys_service_type_cd.default_pricing_unit IS
  'How this service is priced: per_item, per_kg, per_sqm';

-- ==================================================================
-- REGISTER NEW TABLES IN REGISTRY
-- ==================================================================

INSERT INTO sys_code_tables_registry (
  table_name,
  display_name,
  display_name2,
  category,
  is_editable,
  is_extensible,
  supports_tenant_override,
  display_order,
  code_pattern,
  description
) VALUES
  (
    'sys_order_status_cd',
    'Order Statuses',
    'حالات الطلب',
    'order_management',
    false,  -- Cannot edit system statuses
    false,  -- Cannot add new statuses
    false,  -- Tenants cannot override
    1,
    '^[A-Z_]+$',
    'Order lifecycle statuses defining the complete workflow'
  ),
  (
    'sys_payment_status_cd',
    'Payment Statuses',
    'حالات الدفع',
    'billing',
    false,
    false,
    false,
    5,
    '^[A-Z_]+$',
    'Payment processing status codes'
  ),
  (
    'sys_payment_gateway_cd',
    'Payment Gateways',
    'بوابات الدفع',
    'billing',
    true,   -- Can edit gateway configurations
    true,   -- Can add new gateways
    true,   -- Tenants can have specific gateway configs
    6,
    '^[A-Z_]+$',
    'Payment gateway configurations and integrations'
  ),
  (
    'sys_service_type_cd',
    'Service Types',
    'أنواع الخدمات',
    'services',
    true,
    true,
    true,   -- Tenants can customize pricing, turnaround
    3,
    '^[A-Z_]+$',
    'Service type classifications and configurations'
  )
ON CONFLICT (table_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  display_name2 = EXCLUDED.display_name2,
  category = EXCLUDED.category,
  is_editable = EXCLUDED.is_editable,
  is_extensible = EXCLUDED.is_extensible,
  supports_tenant_override = EXCLUDED.supports_tenant_override,
  display_order = EXCLUDED.display_order,
  code_pattern = EXCLUDED.code_pattern,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;

COMMIT;

-- ==================================================================
-- END OF MIGRATION
-- ==================================================================
