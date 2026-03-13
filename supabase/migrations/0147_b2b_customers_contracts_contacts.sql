-- Migration 0147: B2B Feature - Customers, Contacts, Contracts, Statements
-- Full B2B Feature Implementation Plan
-- DO NOT APPLY automatically - create file only; user applies migrations
--
-- PK strategy: id only (UUID) - matches org_customers_mst, org_orders_mst.
-- Simpler API routes, ORM, and FKs. Tenant isolation via RLS + tenant_org_id filter.

BEGIN;

-- ==================================================================
-- 1. Extend org_customers_mst (B2B columns - nullable)
-- ==================================================================
ALTER TABLE org_customers_mst
  ADD COLUMN IF NOT EXISTS company_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS company_name2 VARCHAR(255),
  ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS cr_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(19, 4),
  ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER,
  ADD COLUMN IF NOT EXISTS cost_center_code VARCHAR(50);

COMMENT ON COLUMN org_customers_mst.company_name IS 'B2B: Company name (EN)';
COMMENT ON COLUMN org_customers_mst.company_name2 IS 'B2B: Company name (AR)';
COMMENT ON COLUMN org_customers_mst.tax_id IS 'B2B: Tax/VAT registration';
COMMENT ON COLUMN org_customers_mst.cr_id IS 'B2B: Commercial registration';
COMMENT ON COLUMN org_customers_mst.credit_limit IS 'B2B: Credit limit';
COMMENT ON COLUMN org_customers_mst.payment_terms_days IS 'B2B: Payment terms in days (e.g. 30, 60)';
COMMENT ON COLUMN org_customers_mst.cost_center_code IS 'B2B: Cost center code';

-- ==================================================================
-- 2. org_b2b_contacts_dtl (multi-contact support)
-- ==================================================================
CREATE TABLE IF NOT EXISTS org_b2b_contacts_dtl (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES org_customers_mst(id) ON DELETE CASCADE,
  contact_name VARCHAR(255),
  contact_name2 VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  role_cd VARCHAR(30),
  is_primary BOOLEAN DEFAULT false,
  rec_status SMALLINT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  rec_notes TEXT,
  rec_order INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT,
  CONSTRAINT pk_org_b2b_contacts_dtl PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_b2b_contacts_tenant_cust ON org_b2b_contacts_dtl(tenant_org_id, customer_id);
COMMENT ON TABLE org_b2b_contacts_dtl IS 'B2B additional contacts per customer';

-- Trigger: enforce one primary contact per customer
CREATE OR REPLACE FUNCTION fn_b2b_contacts_one_primary()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE org_b2b_contacts_dtl
    SET is_primary = false
    WHERE customer_id = NEW.customer_id
      AND tenant_org_id = NEW.tenant_org_id
      AND id != NEW.id
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_b2b_contacts_one_primary ON org_b2b_contacts_dtl;
CREATE TRIGGER trg_b2b_contacts_one_primary
  BEFORE INSERT OR UPDATE OF is_primary ON org_b2b_contacts_dtl
  FOR EACH ROW
  EXECUTE FUNCTION fn_b2b_contacts_one_primary();

-- ==================================================================
-- 3. org_b2b_contracts_mst
-- ==================================================================
CREATE TABLE IF NOT EXISTS org_b2b_contracts_mst (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES org_customers_mst(id) ON DELETE CASCADE,
  contract_no VARCHAR(100) NOT NULL,
  effective_from DATE,
  effective_to DATE,
  pricing_terms JSONB DEFAULT '{}',
  rec_status SMALLINT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  rec_notes TEXT,
  rec_order INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT,
  CONSTRAINT pk_org_b2b_contracts_mst PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_b2b_contracts_tenant_no ON org_b2b_contracts_mst(tenant_org_id, contract_no);
CREATE INDEX IF NOT EXISTS idx_b2b_contracts_tenant_cust ON org_b2b_contracts_mst(tenant_org_id, customer_id);
COMMENT ON TABLE org_b2b_contracts_mst IS 'B2B contracts';

-- ==================================================================
-- 4. org_b2b_statements_mst
-- ==================================================================
CREATE TABLE IF NOT EXISTS org_b2b_statements_mst (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES org_customers_mst(id) ON DELETE CASCADE,
  contract_id UUID NULL REFERENCES org_b2b_contracts_mst(id) ON DELETE SET NULL,
  statement_no VARCHAR(100) NOT NULL,
  period_from DATE,
  period_to DATE,
  due_date DATE,
  total_amount DECIMAL(19, 4) DEFAULT 0,
  paid_amount DECIMAL(19, 4) DEFAULT 0,
  balance_amount DECIMAL(19, 4) DEFAULT 0,
  currency_cd VARCHAR(3),
  status_cd VARCHAR(20) DEFAULT 'DRAFT',
  rec_status SMALLINT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT,
  CONSTRAINT pk_org_b2b_statements_mst PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_b2b_statements_tenant_no ON org_b2b_statements_mst(tenant_org_id, statement_no);
CREATE INDEX IF NOT EXISTS idx_b2b_statements_tenant_cust ON org_b2b_statements_mst(tenant_org_id, customer_id);
COMMENT ON TABLE org_b2b_statements_mst IS 'B2B consolidated statements';

-- ==================================================================
-- 5. Extend org_invoice_mst
-- ==================================================================
ALTER TABLE org_invoice_mst
  ADD COLUMN IF NOT EXISTS invoice_type_cd VARCHAR(20),
  ADD COLUMN IF NOT EXISTS b2b_contract_id UUID,
  ADD COLUMN IF NOT EXISTS statement_id UUID,
  ADD COLUMN IF NOT EXISTS cost_center_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS po_number VARCHAR(100);

-- FK b2b_contract_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_invoice_b2b_contract' AND table_name = 'org_invoice_mst') THEN
    ALTER TABLE org_invoice_mst
      ADD CONSTRAINT fk_invoice_b2b_contract
      FOREIGN KEY (b2b_contract_id) REFERENCES org_b2b_contracts_mst(id) ON DELETE SET NULL;
  END IF;
END $$;

-- FK statement_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_invoice_b2b_statement' AND table_name = 'org_invoice_mst') THEN
    ALTER TABLE org_invoice_mst
      ADD CONSTRAINT fk_invoice_b2b_statement
      FOREIGN KEY (statement_id) REFERENCES org_b2b_statements_mst(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoice_b2b_contract ON org_invoice_mst(tenant_org_id, b2b_contract_id);
CREATE INDEX IF NOT EXISTS idx_invoice_b2b_statement ON org_invoice_mst(tenant_org_id, statement_id);
CREATE INDEX IF NOT EXISTS idx_invoice_type ON org_invoice_mst(tenant_org_id, invoice_type_cd);

-- ==================================================================
-- 6. Extend org_orders_mst
-- ==================================================================
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS b2b_contract_id UUID,
  ADD COLUMN IF NOT EXISTS cost_center_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS po_number VARCHAR(100);

-- FK b2b_contract_id (must be added after org_b2b_contracts_mst exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_orders_b2b_contract' AND table_name = 'org_orders_mst') THEN
    ALTER TABLE org_orders_mst
      ADD CONSTRAINT fk_orders_b2b_contract
      FOREIGN KEY (b2b_contract_id) REFERENCES org_b2b_contracts_mst(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_b2b_contract ON org_orders_mst(tenant_org_id, b2b_contract_id);

-- ==================================================================
-- 7. RLS on new tables
-- ==================================================================
ALTER TABLE org_b2b_contacts_dtl ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_b2b_contracts_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_b2b_statements_mst ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_b2b_contacts ON org_b2b_contacts_dtl;
CREATE POLICY tenant_isolation_b2b_contacts ON org_b2b_contacts_dtl
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_b2b_contracts ON org_b2b_contracts_mst;
CREATE POLICY tenant_isolation_b2b_contracts ON org_b2b_contracts_mst
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_b2b_statements ON org_b2b_statements_mst;
CREATE POLICY tenant_isolation_b2b_statements ON org_b2b_statements_mst
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
