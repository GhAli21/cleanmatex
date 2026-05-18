-- ============================================================
-- Migration 0289: Tax Configuration Tables
-- Phase 5 of the Order Financial Platform
--
-- Tables created:
--   org_tax_profiles_cf    — per-tenant tax rate profiles (VAT, GST, CUSTOM)
--   org_tax_exemptions_cf  — customer/service-level tax exemptions
--
-- FK added:
--   org_order_taxes_dtl.tax_profile_id → org_tax_profiles_cf(id)
--
-- Seed: GCC-market profiles for tenant 1 (Oman/OMR);
--       Saudi profiles for tenant 2 (conditional on tenant existing)
-- ============================================================

-- ── org_tax_profiles_cf ───────────────────────────────────────────────────────
-- Stores the tax rate/type configuration a tenant applies to orders.
-- applies_to = NULL means the profile applies to all service types.
-- is_default = TRUE marks the profile auto-applied when no explicit profile is chosen.
CREATE TABLE org_tax_profiles_cf (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID        NOT NULL,
  name            TEXT        NOT NULL,
  name2           TEXT,
  tax_type        TEXT        NOT NULL CHECK (tax_type IN ('VAT','GST','CUSTOM')),
  rate            DECIMAL(5,2)   NOT NULL CHECK (rate >= 0 AND rate <= 100),
  is_compound     BOOLEAN     NOT NULL DEFAULT FALSE,
  applies_to      TEXT[],
  effective_from  DATE        NOT NULL,
  effective_to    DATE,
  is_default      BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  rec_status      SMALLINT    NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  created_info    TEXT,
  updated_at      TIMESTAMPTZ,
  updated_by      UUID,
  updated_info    TEXT
);

CREATE INDEX IF NOT EXISTS idx_tax_profiles_tenant
  ON org_tax_profiles_cf (tenant_org_id, is_active, is_default);

ALTER TABLE org_tax_profiles_cf ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_tax_profiles_cf
  ON org_tax_profiles_cf FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- ── org_tax_exemptions_cf ─────────────────────────────────────────────────────
-- Records which customers or service types are exempt from tax.
-- customer_id = NULL means the exemption applies to all customers of that service_type.
-- service_type = NULL means the exemption applies to all services for that customer.
CREATE TABLE org_tax_exemptions_cf (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID        NOT NULL,
  customer_id     UUID,
  service_type    TEXT,
  exemption_type  TEXT        NOT NULL,
  certificate_no  TEXT,
  valid_from      DATE        NOT NULL,
  valid_to        DATE,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  rec_status      SMALLINT    NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  created_info    TEXT,
  updated_at      TIMESTAMPTZ,
  updated_by      UUID,
  updated_info    TEXT
);

CREATE INDEX IF NOT EXISTS idx_tax_exemptions_tenant
  ON org_tax_exemptions_cf (tenant_org_id, customer_id, is_active);

ALTER TABLE org_tax_exemptions_cf ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_tax_exemptions_cf
  ON org_tax_exemptions_cf FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- ── FK: org_order_taxes_dtl.tax_profile_id ────────────────────────────────────
-- Column was added in migration 0281 without a FK (table didn't exist yet).
-- org_tax_profiles_cf now exists — wire it up.

ALTER TABLE org_order_taxes_dtl
  ADD CONSTRAINT fk_order_taxes_profile
    FOREIGN KEY (tax_profile_id) REFERENCES org_tax_profiles_cf(id) ON DELETE SET NULL;

-- ── Seed: Tenant 1 — Oman (OMR) ──────────────────────────────────────────────
-- Oman VAT introduced at 5% effective April 2021 (Royal Decree 121/2020)

INSERT INTO org_tax_profiles_cf
  (id, tenant_org_id, name, name2, tax_type, rate, is_compound,
   applies_to, effective_from, is_default, is_active, rec_status, created_by)
VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   'VAT 5%', 'ضريبة القيمة المضافة 5%',
   'VAT', 5.00, false, NULL, '2024-01-01', true, true, 1, NULL),

  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   'VAT Exempt', 'معفى من ضريبة القيمة المضافة',
   'VAT', 0.00, false, ARRAY['EXEMPT_SERVICE'], '2024-01-01', false, true, 1, NULL),

  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   'Zero-Rated VAT', 'ضريبة صفرية',
   'VAT', 0.00, false, ARRAY['EXPORT'], '2024-01-01', false, true, 1, NULL),

  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   'Selective Tax 100%', 'ضريبة انتقائية 100%',
   'CUSTOM', 100.00, false, ARRAY['TOBACCO'], '2024-01-01', false, true, 1, NULL);

-- Exemption — tenant 1: government entity class-level exemption (no specific customer)
INSERT INTO org_tax_exemptions_cf
  (id, tenant_org_id, customer_id, exemption_type, certificate_no,
   valid_from, is_active, created_by)
VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   NULL, 'GOVERNMENT_ENTITY', 'GOV-OM-2024-001', '2024-01-01', true, NULL);

-- ── Seed: Tenant 2 — Saudi Arabia (SAR) ──────────────────────────────────────
-- Wrapped in DO block so the insert is skipped if tenant 2 doesn't exist locally.
-- Saudi VAT raised to 15% effective July 2020 (Royal Decree M/113)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM org_tenants_mst
    WHERE id = 'c9ac29d1-219c-4a3a-8887-f860550c32be'
  ) THEN
    INSERT INTO org_tax_profiles_cf
      (id, tenant_org_id, name, name2, tax_type, rate, is_compound,
       applies_to, effective_from, is_default, is_active, rec_status, created_by)
    VALUES
      (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
       'VAT 15%', 'ضريبة القيمة المضافة 15%',
       'VAT', 15.00, false, NULL, '2024-01-01', true, true, 1, NULL),

      (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
       'VAT Exempt', 'معفى من ضريبة القيمة المضافة',
       'VAT', 0.00, false, ARRAY['EXEMPT_SERVICE'], '2024-01-01', false, true, 1, NULL),

      (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
       'Zero-Rated VAT', 'ضريبة صفرية',
       'VAT', 0.00, false, ARRAY['EXPORT'], '2024-01-01', false, true, 1, NULL),

      (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
       'Selective Tax 100%', 'ضريبة انتقائية 100%',
       'CUSTOM', 100.00, false, ARRAY['TOBACCO'], '2024-01-01', false, true, 1, NULL),

      (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
       'Municipal Fee 2%', 'رسوم بلدية 2%',
       'CUSTOM', 2.00, false, NULL, '2024-01-01', false, true, 1, NULL);

    INSERT INTO org_tax_exemptions_cf
      (id, tenant_org_id, customer_id, exemption_type, certificate_no,
       valid_from, is_active, created_by)
    VALUES
      (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
       NULL, 'GOVERNMENT_ENTITY', 'GOV-SA-2024-001', '2024-01-01', true, NULL),

      (gen_random_uuid(), 'c9ac29d1-219c-4a3a-8887-f860550c32be',
       NULL, 'DIPLOMATIC_MISSION', 'DIP-SA-2024-001', '2024-01-01', true, NULL);
  END IF;
END $$;
