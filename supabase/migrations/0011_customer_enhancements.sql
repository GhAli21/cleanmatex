-- ==================================================================
-- 0011_customer_enhancements.sql
-- Purpose: PRD-003 Customer Management - Progressive Customer Engagement
-- Author: CleanMateX Development Team
-- Created: 2025-10-24
-- Dependencies: 0001_core_schema.sql
-- ==================================================================
-- This migration enhances customer management with:
-- - Progressive customer types (guest, stub, full)
-- - Customer addresses support
-- - OTP verification for phone registration
-- - Customer merge audit trail
-- ==================================================================

BEGIN;

-- ==================================================================
-- ENHANCE GLOBAL CUSTOMERS TABLE
-- ==================================================================

-- Add new columns to sys_customers_mst for progressive engagement
ALTER TABLE sys_customers_mst ADD COLUMN IF NOT EXISTS customer_number VARCHAR(50);
ALTER TABLE sys_customers_mst ADD COLUMN IF NOT EXISTS profile_status VARCHAR(20) DEFAULT 'guest';
ALTER TABLE sys_customers_mst ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;
ALTER TABLE sys_customers_mst ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE sys_customers_mst ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);

-- Add comments
COMMENT ON COLUMN sys_customers_mst.customer_number IS 'Tenant-specific customer number (CUST-00001)';
COMMENT ON COLUMN sys_customers_mst.profile_status IS 'Customer profile type: guest, stub, full';
COMMENT ON COLUMN sys_customers_mst.phone_verified IS 'Phone verified via OTP';
COMMENT ON COLUMN sys_customers_mst.email_verified IS 'Email verified via link';
COMMENT ON COLUMN sys_customers_mst.avatar_url IS 'Profile picture URL';

-- Add indexes for search performance
CREATE INDEX IF NOT EXISTS idx_customers_phone ON sys_customers_mst(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_email ON sys_customers_mst(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_number ON sys_customers_mst(customer_number) WHERE customer_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_status ON sys_customers_mst(profile_status);

-- Full-text search index on customer names
CREATE INDEX IF NOT EXISTS idx_customers_search ON sys_customers_mst
  USING gin(to_tsvector('english', coalesce(first_name, '') || ' ' || coalesce(last_name, '')));

-- ==================================================================
-- CUSTOMER ADDRESSES TABLE
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_customer_addresses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       UUID NOT NULL,
  tenant_org_id     UUID NOT NULL,

  -- Address type and label
  address_type      VARCHAR(20) DEFAULT 'home',
  label             VARCHAR(100),

  -- Address fields
  building          VARCHAR(100),
  floor             VARCHAR(50),
  apartment         VARCHAR(50),
  street            VARCHAR(200),
  area              VARCHAR(100),
  city              VARCHAR(100),
  country           VARCHAR(2) DEFAULT 'OM',
  postal_code       VARCHAR(20),

  -- GPS coordinates
  latitude          NUMERIC(10,8),
  longitude         NUMERIC(11,8),

  -- Metadata
  is_default        BOOLEAN DEFAULT false,
  delivery_notes    TEXT,

  -- Audit fields
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by        VARCHAR(120),
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by        VARCHAR(120),
  is_active         BOOLEAN DEFAULT true
);

-- Add foreign key constraints
ALTER TABLE org_customer_addresses
  ADD CONSTRAINT fk_address_customer
    FOREIGN KEY (customer_id) REFERENCES org_customers_mst(id) ON DELETE CASCADE;

ALTER TABLE org_customer_addresses
  ADD CONSTRAINT fk_address_tenant
    FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE;

COMMENT ON TABLE org_customer_addresses IS 'Customer addresses with multi-tenant isolation';
COMMENT ON COLUMN org_customer_addresses.address_type IS 'Address type: home, work, other';
COMMENT ON COLUMN org_customer_addresses.label IS 'User-friendly label (e.g., "Home", "Office", "Villa in Muscat")';
COMMENT ON COLUMN org_customer_addresses.is_default IS 'Default address for deliveries';
COMMENT ON COLUMN org_customer_addresses.delivery_notes IS 'Special delivery instructions';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_addresses_customer ON org_customer_addresses(customer_id, tenant_org_id);
CREATE INDEX IF NOT EXISTS idx_addresses_tenant ON org_customer_addresses(tenant_org_id);
CREATE INDEX IF NOT EXISTS idx_addresses_default ON org_customer_addresses(customer_id, tenant_org_id, is_default) WHERE is_default = true;

-- ==================================================================
-- OTP VERIFICATION CODES TABLE
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_otp_codes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone             VARCHAR(50) NOT NULL,
  code              VARCHAR(6) NOT NULL,
  purpose           VARCHAR(20) NOT NULL,
  expires_at        TIMESTAMP NOT NULL,
  verified_at       TIMESTAMP,
  attempts          INTEGER DEFAULT 0,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE sys_otp_codes IS 'OTP verification codes for phone registration';
COMMENT ON COLUMN sys_otp_codes.purpose IS 'OTP purpose: registration, login, verification';
COMMENT ON COLUMN sys_otp_codes.expires_at IS 'OTP expiration time (typically 5 minutes)';
COMMENT ON COLUMN sys_otp_codes.verified_at IS 'Timestamp when OTP was successfully verified';
COMMENT ON COLUMN sys_otp_codes.attempts IS 'Number of verification attempts (max 3)';

-- Indexes for OTP lookup and cleanup
CREATE INDEX IF NOT EXISTS idx_otp_phone ON sys_otp_codes(phone, expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON sys_otp_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_verified ON sys_otp_codes(verified_at) WHERE verified_at IS NOT NULL;

-- ==================================================================
-- CUSTOMER MERGE AUDIT LOG
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_customer_merge_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID NOT NULL,
  source_customer_id UUID NOT NULL,
  target_customer_id UUID NOT NULL,
  merged_by         UUID NOT NULL,
  merge_reason      TEXT,
  orders_moved      INTEGER DEFAULT 0,
  loyalty_points_merged INTEGER DEFAULT 0,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE
);

COMMENT ON TABLE org_customer_merge_log IS 'Audit trail for customer merge operations';
COMMENT ON COLUMN org_customer_merge_log.source_customer_id IS 'Customer being merged (will be deactivated)';
COMMENT ON COLUMN org_customer_merge_log.target_customer_id IS 'Customer to merge into (receives data)';
COMMENT ON COLUMN org_customer_merge_log.merged_by IS 'User ID who performed the merge';
COMMENT ON COLUMN org_customer_merge_log.orders_moved IS 'Number of orders transferred';
COMMENT ON COLUMN org_customer_merge_log.loyalty_points_merged IS 'Loyalty points combined';

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_merge_log_tenant ON org_customer_merge_log(tenant_org_id);
CREATE INDEX IF NOT EXISTS idx_merge_log_source ON org_customer_merge_log(source_customer_id);
CREATE INDEX IF NOT EXISTS idx_merge_log_target ON org_customer_merge_log(target_customer_id);
CREATE INDEX IF NOT EXISTS idx_merge_log_date ON org_customer_merge_log(created_at DESC);

-- ==================================================================
-- CUSTOMER NUMBER SEQUENCE FUNCTION
-- ==================================================================

-- Function to generate sequential customer number per tenant
CREATE OR REPLACE FUNCTION generate_customer_number(p_tenant_org_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  v_next_number INTEGER;
  v_customer_number VARCHAR(50);
BEGIN
  -- Get the next sequential number for this tenant
  -- This is a simplified version - in production, consider using a sequence per tenant
  SELECT COALESCE(MAX(CAST(SUBSTRING(customer_number FROM 6) AS INTEGER)), 0) + 1
  INTO v_next_number
  FROM sys_customers_mst
  WHERE first_tenant_org_id = p_tenant_org_id
    AND customer_number IS NOT NULL
    AND customer_number ~ '^CUST-[0-9]+$';

  -- Format as CUST-00001
  v_customer_number := 'CUST-' || LPAD(v_next_number::TEXT, 5, '0');

  RETURN v_customer_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_customer_number IS 'Generate sequential customer number per tenant (CUST-00001 format)';

-- ==================================================================
-- OTP CLEANUP FUNCTION
-- ==================================================================

-- Function to cleanup expired OTP codes
CREATE OR REPLACE FUNCTION cleanup_expired_otp_codes()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM sys_otp_codes
  WHERE expires_at < NOW() - INTERVAL '1 hour';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_otp_codes IS 'Delete OTP codes expired more than 1 hour ago';

-- ==================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==================================================================

-- Enable RLS on customer addresses
ALTER TABLE org_customer_addresses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see addresses for their tenant's customers
CREATE POLICY tenant_isolation_addresses ON org_customer_addresses
  FOR ALL
  USING (tenant_org_id = (auth.jwt() ->> 'tenant_org_id')::uuid);

-- Policy: Service role can access all addresses
CREATE POLICY service_role_addresses ON org_customer_addresses
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Enable RLS on customer merge log
ALTER TABLE org_customer_merge_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see merge logs for their tenant
CREATE POLICY tenant_isolation_merge_log ON org_customer_merge_log
  FOR ALL
  USING (tenant_org_id = (auth.jwt() ->> 'tenant_org_id')::uuid);

-- Policy: Service role can access all merge logs
CREATE POLICY service_role_merge_log ON org_customer_merge_log
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Note: sys_otp_codes is system-level, no tenant isolation needed
-- OTP verification is handled at application level

-- ==================================================================
-- TRIGGERS
-- ==================================================================

-- Trigger to automatically set updated_at timestamp on address updates
CREATE OR REPLACE FUNCTION update_customer_address_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_customer_address_timestamp
  BEFORE UPDATE ON org_customer_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_address_timestamp();

-- Trigger to ensure only one default address per customer per tenant
CREATE OR REPLACE FUNCTION ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    -- Unset other default addresses for this customer/tenant
    UPDATE org_customer_addresses
    SET is_default = false
    WHERE customer_id = NEW.customer_id
      AND tenant_org_id = NEW.tenant_org_id
      AND id != NEW.id
      AND is_default = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ensure_single_default_address
  BEFORE INSERT OR UPDATE OF is_default ON org_customer_addresses
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_address();

COMMIT;

-- ==================================================================
-- Migration Complete: Customer Management Enhancements
-- ==================================================================
