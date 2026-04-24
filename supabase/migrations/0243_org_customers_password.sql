-- =============================================================================
-- Migration: 0243_org_customers_password.sql
-- Purpose:   Add optional password authentication to org_customers_mst.
--            NULL password_hash means OTP-only login (default, no change to
--            existing customers). Customers explicitly set a password after
--            their first OTP verification — no system-generated defaults.
-- =============================================================================

ALTER TABLE org_customers_mst
  ADD COLUMN IF NOT EXISTS password_hash        TEXT,
  ADD COLUMN IF NOT EXISTS password_updated_at  TIMESTAMPTZ;

COMMENT ON COLUMN org_customers_mst.password_hash
  IS 'bcrypt hash (cost >= 12) of customer-set password. NULL = OTP-only login. Never returned in API responses.';

COMMENT ON COLUMN org_customers_mst.password_updated_at
  IS 'Timestamp of last password set or change by the customer.';
