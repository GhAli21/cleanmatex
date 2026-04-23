-- =====================================================
-- Migration: Developer Portal & API Documentation
-- Purpose: Support API key management, usage analytics, and docs
-- PRD: PRD-SAAS-MNG-0018
-- Version: 0242
-- =====================================================

BEGIN;

-- =====================================================
-- 1. sys_dev_api_keys_mst - Developer API Keys
-- =====================================================

CREATE TABLE IF NOT EXISTS sys_dev_api_keys_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID REFERENCES org_tenants_mst(id),
  
  -- API key identity
  key_name VARCHAR(250) NOT NULL,
  api_key_hash VARCHAR(128) NOT NULL UNIQUE,  -- SHA-256 hash
  api_key_prefix VARCHAR(20) NOT NULL,        -- First 8 chars for display
  
  -- Owner/Metadata
  user_id UUID,                               -- Optional: User who created it
  developer_email VARCHAR(250),               -- For external/third-party developers
  
  -- Permissions & Config
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,   -- ["orders:read", "orders:write"]
  environment VARCHAR(20) DEFAULT 'production', -- "sandbox", "production"
  
  -- Rate limiting
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_day INTEGER DEFAULT 10000,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  
  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  total_requests INTEGER DEFAULT 0,
  
  -- Expiration
  expires_at TIMESTAMPTZ,
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dev_api_keys_hash ON sys_dev_api_keys_mst(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_dev_api_keys_tenant ON sys_dev_api_keys_mst(tenant_org_id);
CREATE INDEX IF NOT EXISTS idx_dev_api_keys_active ON sys_dev_api_keys_mst(is_active, is_revoked);

-- RLS
ALTER TABLE sys_dev_api_keys_mst ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_dev_api_keys ON sys_dev_api_keys_mst
  FOR ALL USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));

-- =====================================================
-- 2. sys_dev_api_usage_tr - API Usage Logs
-- =====================================================

CREATE TABLE IF NOT EXISTS sys_dev_api_usage_tr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID REFERENCES org_tenants_mst(id),
  
  -- API key reference
  api_key_id UUID REFERENCES sys_dev_api_keys_mst(id),
  api_key_prefix VARCHAR(20),
  
  -- Request info
  http_method VARCHAR(10) NOT NULL,
  endpoint VARCHAR(250) NOT NULL,
  request_size_bytes INTEGER,
  
  -- Response info
  response_status INTEGER,
  response_size_bytes INTEGER,
  response_time_ms INTEGER,
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  
  -- Timing & Audit
  requested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  rec_status SMALLINT DEFAULT 1
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dev_usage_api_key ON sys_dev_api_usage_tr(api_key_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_dev_usage_tenant ON sys_dev_api_usage_tr(tenant_org_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_dev_usage_requested ON sys_dev_api_usage_tr(requested_at DESC);

-- RLS
ALTER TABLE sys_dev_api_usage_tr ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_dev_api_usage ON sys_dev_api_usage_tr
  FOR ALL USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));

-- =====================================================
-- 3. sys_dev_docs_pages_mst - Documentation Pages
-- =====================================================

CREATE TABLE IF NOT EXISTS sys_dev_docs_pages_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Page identity
  page_slug VARCHAR(120) NOT NULL UNIQUE,     -- "getting-started", "authentication"
  page_title VARCHAR(250) NOT NULL,
  page_title_ar VARCHAR(250),                 -- Arabic support
  page_category VARCHAR(60),                  -- "guides", "reference", "tutorials"
  
  -- Content
  content_markdown TEXT NOT NULL,
  content_markdown_ar TEXT,                   -- Arabic support
  content_html TEXT,                          -- Rendered cache
  
  -- Metadata
  description TEXT,
  description_ar TEXT,
  keywords JSONB DEFAULT '[]'::jsonb,
  author VARCHAR(120),
  
  -- Navigation
  parent_page_id UUID REFERENCES sys_dev_docs_pages_mst(id),
  sort_order INTEGER DEFAULT 0,
  
  -- Status
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  
  -- Versioning
  version_tag VARCHAR(20) DEFAULT 'v1',       -- "v1", "v2"
  
  -- Analytics
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT DEFAULT 1,
  is_active BOOLEAN DEFAULT true
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dev_docs_slug ON sys_dev_docs_pages_mst(page_slug);
CREATE INDEX IF NOT EXISTS idx_dev_docs_category ON sys_dev_docs_pages_mst(page_category, sort_order);
CREATE INDEX IF NOT EXISTS idx_dev_docs_published ON sys_dev_docs_pages_mst(is_published, is_active);

-- RLS (Public Read for published, Admin Write)
ALTER TABLE sys_dev_docs_pages_mst ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to published docs"
  ON sys_dev_docs_pages_mst
  FOR SELECT
  USING (is_published = true AND is_active = true);

-- Note: HQ Console uses service role, so no specific write policy needed here for admins.

-- =====================================================
-- 4. Audit & Trigger Functions
-- =====================================================

-- Trigger for sys_dev_api_keys_mst updated_at
DROP TRIGGER IF EXISTS update_sys_dev_api_keys_updated_at ON sys_dev_api_keys_mst;
CREATE TRIGGER update_sys_dev_api_keys_updated_at
    BEFORE UPDATE ON sys_dev_api_keys_mst
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for sys_dev_docs_pages_mst updated_at
DROP TRIGGER IF EXISTS update_sys_dev_docs_pages_updated_at ON sys_dev_docs_pages_mst;
CREATE TRIGGER update_sys_dev_docs_pages_updated_at
    BEFORE UPDATE ON sys_dev_docs_pages_mst
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;
