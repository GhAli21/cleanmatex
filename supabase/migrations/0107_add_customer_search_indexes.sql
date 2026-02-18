-- Add indexes for fast customer search on org_customers_mst
-- Enables efficient ilike search on phone, first_name, last_name, display_name, email

-- Enable pg_trgm for trigram-based ilike (significantly speeds up partial matches)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Composite index for tenant + active (most selective first)
CREATE INDEX IF NOT EXISTS idx_org_customers_tenant_active
  ON org_customers_mst(tenant_org_id, is_active)
  WHERE is_active = true;

-- GIN trigram indexes for fast ilike search
CREATE INDEX IF NOT EXISTS idx_org_customers_phone_trgm
  ON org_customers_mst USING gin(phone gin_trgm_ops)
  WHERE tenant_org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_customers_first_name_trgm
  ON org_customers_mst USING gin(first_name gin_trgm_ops)
  WHERE tenant_org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_customers_last_name_trgm
  ON org_customers_mst USING gin(last_name gin_trgm_ops)
  WHERE tenant_org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_customers_display_name_trgm
  ON org_customers_mst USING gin(display_name gin_trgm_ops)
  WHERE tenant_org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_customers_email_trgm
  ON org_customers_mst USING gin(email gin_trgm_ops)
  WHERE tenant_org_id IS NOT NULL;
