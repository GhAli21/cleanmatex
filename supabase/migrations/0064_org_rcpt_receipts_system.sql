-- ==================================================================
-- 0064_org_rcpt_receipts_system.sql
-- Purpose: Digital Receipts System for PRD-006
-- Author: CleanMateX Development Team
-- Created: 2025-01-20
-- PRD: PRD-006 - Digital Receipts
-- Dependencies: 0001_core_schema.sql
-- ==================================================================
-- This migration creates:
-- - Receipt records table
-- - Receipt templates table
-- - Code tables for receipt types, delivery channels, and statuses
-- - RLS policies for multi-tenant isolation
-- - Performance indexes
-- ==================================================================

BEGIN;

-- ==================================================================
-- CODE TABLES (System-wide lookups)
-- ==================================================================

-- Receipt Types
CREATE TABLE IF NOT EXISTS sys_rcpt_receipt_type_cd (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  supports_bilingual BOOLEAN DEFAULT true,
  supports_qr_code BOOLEAN DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120)
);

COMMENT ON TABLE sys_rcpt_receipt_type_cd IS 'System-wide receipt types: whatsapp_text, whatsapp_image, in_app, pdf, print';

-- Delivery Channels
CREATE TABLE IF NOT EXISTS sys_rcpt_delivery_channel_cd (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  requires_api_key BOOLEAN DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120)
);

COMMENT ON TABLE sys_rcpt_delivery_channel_cd IS 'System-wide delivery channels: whatsapp, sms, email, app';

-- Delivery Statuses
CREATE TABLE IF NOT EXISTS sys_rcpt_delivery_status_cd (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  is_final BOOLEAN DEFAULT false,
  allows_retry BOOLEAN DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120)
);

COMMENT ON TABLE sys_rcpt_delivery_status_cd IS 'System-wide delivery statuses: pending, sent, delivered, failed';

-- ==================================================================
-- RECEIPT RECORDS (Master table)
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_rcpt_receipts_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  order_id UUID NOT NULL,
  
  -- Receipt details
  receipt_type_code VARCHAR(50) NOT NULL,
  delivery_channel_code VARCHAR(50) NOT NULL,
  delivery_status_code VARCHAR(50) DEFAULT 'pending',
  
  -- Content
  content_text TEXT,
  content_html TEXT,
  qr_code TEXT,
  
  -- Recipient
  recipient_phone VARCHAR(50),
  recipient_email VARCHAR(255),
  
  -- Delivery tracking
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT
);

COMMENT ON TABLE org_rcpt_receipts_mst IS 'Receipt records with delivery status tracking';
COMMENT ON COLUMN org_rcpt_receipts_mst.content_text IS 'Plain text receipt content';
COMMENT ON COLUMN org_rcpt_receipts_mst.content_html IS 'HTML receipt content';
COMMENT ON COLUMN org_rcpt_receipts_mst.qr_code IS 'QR code data URL or external URL';
COMMENT ON COLUMN org_rcpt_receipts_mst.metadata IS 'Additional metadata (messageId, deliveryId, etc.)';

-- ==================================================================
-- RECEIPT TEMPLATES (Configuration table)
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_rcpt_templates_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  
  -- Template identification
  template_type VARCHAR(50) NOT NULL,
  language VARCHAR(10) NOT NULL,
  
  -- Template content
  template_content TEXT NOT NULL,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT,
  
  -- Unique constraint: one template per type/language per tenant
  UNIQUE(tenant_org_id, template_type, language)
);

COMMENT ON TABLE org_rcpt_templates_cf IS 'Tenant-customizable receipt templates (EN/AR)';
COMMENT ON COLUMN org_rcpt_templates_cf.template_type IS 'Template type: whatsapp_text, whatsapp_image, in_app, pdf';
COMMENT ON COLUMN org_rcpt_templates_cf.language IS 'Language code: en, ar';
COMMENT ON COLUMN org_rcpt_templates_cf.template_content IS 'Template content with placeholders: {{orderNumber}}, {{customerName}}, etc.';

-- ==================================================================
-- FOREIGN KEYS
-- ==================================================================

-- Receipts
ALTER TABLE org_rcpt_receipts_mst
  ADD CONSTRAINT fk_rcpt_receipt_tenant
  FOREIGN KEY (tenant_org_id)
  REFERENCES org_tenants_mst(id)
  ON DELETE CASCADE;

-- Composite FK: Receipt references order
ALTER TABLE org_rcpt_receipts_mst
  ADD CONSTRAINT fk_rcpt_receipt_order
  FOREIGN KEY (order_id, tenant_org_id)
  REFERENCES org_orders_mst(id, tenant_org_id)
  ON DELETE CASCADE;

-- Templates
ALTER TABLE org_rcpt_templates_cf
  ADD CONSTRAINT fk_rcpt_template_tenant
  FOREIGN KEY (tenant_org_id)
  REFERENCES org_tenants_mst(id)
  ON DELETE CASCADE;

-- ==================================================================
-- INDEXES (Performance Optimization)
-- ==================================================================

-- Receipts
CREATE INDEX idx_rcpt_receipts_tenant ON org_rcpt_receipts_mst(tenant_org_id);
CREATE INDEX idx_rcpt_receipts_tenant_status ON org_rcpt_receipts_mst(tenant_org_id, rec_status);
CREATE INDEX idx_rcpt_receipts_order ON org_rcpt_receipts_mst(order_id);
CREATE INDEX idx_rcpt_receipts_delivery_status ON org_rcpt_receipts_mst(tenant_org_id, delivery_status_code, created_at);
CREATE INDEX idx_rcpt_receipts_created ON org_rcpt_receipts_mst(tenant_org_id, created_at DESC);

-- Templates
CREATE INDEX idx_rcpt_templates_tenant ON org_rcpt_templates_cf(tenant_org_id);
CREATE INDEX idx_rcpt_templates_type_lang ON org_rcpt_templates_cf(tenant_org_id, template_type, language);

-- ==================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==================================================================

-- Enable RLS on all tenant tables
ALTER TABLE org_rcpt_receipts_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_rcpt_templates_cf ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Receipts
CREATE POLICY org_rcpt_receipts_tenant_isolation ON org_rcpt_receipts_mst
  FOR ALL
  USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));

-- RLS Policy: Templates
CREATE POLICY org_rcpt_templates_tenant_isolation ON org_rcpt_templates_cf
  FOR ALL
  USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));

-- ==================================================================
-- SEED DATA (Code Tables)
-- ==================================================================

-- Receipt Types
INSERT INTO sys_rcpt_receipt_type_cd (code, name, name2, description, description2, supports_bilingual, supports_qr_code)
VALUES
  ('whatsapp_text', 'WhatsApp Text', 'واتساب نصي', 'Text-only WhatsApp receipt', 'إيصال واتساب نصي فقط', true, true),
  ('whatsapp_image', 'WhatsApp Image', 'واتساب صورة', 'Image-based WhatsApp receipt', 'إيصال واتساب بصورة', true, true),
  ('in_app', 'In-App Receipt', 'إيصال داخل التطبيق', 'In-app receipt viewer', 'عارض الإيصال داخل التطبيق', true, true),
  ('pdf', 'PDF Receipt', 'إيصال PDF', 'PDF receipt document', 'مستند إيصال PDF', true, true),
  ('print', 'Print Receipt', 'إيصال طباعة', 'Printed receipt', 'إيصال مطبوع', true, false)
ON CONFLICT (code) DO NOTHING;

-- Delivery Channels
INSERT INTO sys_rcpt_delivery_channel_cd (code, name, name2, description, description2, requires_api_key)
VALUES
  ('whatsapp', 'WhatsApp', 'واتساب', 'WhatsApp Business API', 'واجهة برمجة تطبيقات واتساب للأعمال', true),
  ('sms', 'SMS', 'رسالة نصية', 'SMS delivery', 'التسليم عبر الرسائل النصية', true),
  ('email', 'Email', 'بريد إلكتروني', 'Email delivery', 'التسليم عبر البريد الإلكتروني', false),
  ('app', 'In-App', 'داخل التطبيق', 'In-app notification', 'إشعار داخل التطبيق', false)
ON CONFLICT (code) DO NOTHING;

-- Delivery Statuses
INSERT INTO sys_rcpt_delivery_status_cd (code, name, name2, description, description2, is_final, allows_retry)
VALUES
  ('pending', 'Pending', 'قيد الانتظار', 'Receipt pending delivery', 'الإيصال في انتظار التسليم', false, true),
  ('sent', 'Sent', 'تم الإرسال', 'Receipt sent successfully', 'تم إرسال الإيصال بنجاح', false, true),
  ('delivered', 'Delivered', 'تم التسليم', 'Receipt delivered to recipient', 'تم تسليم الإيصال للمستلم', true, false),
  ('failed', 'Failed', 'فشل', 'Receipt delivery failed', 'فشل تسليم الإيصال', false, true)
ON CONFLICT (code) DO NOTHING;

COMMIT;

