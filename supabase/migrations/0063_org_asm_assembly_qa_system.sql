-- ==================================================================
-- 0063_org_asm_assembly_qa_system.sql
-- Purpose: Assembly & QA Workflow System for PRD-009
-- Author: CleanMateX Development Team
-- Created: 2025-01-20
-- PRD: PRD-009 - Assembly & QA Workflow
-- Dependencies: 0001_core_schema.sql, 0013_workflow_status_system.sql
-- ==================================================================
-- This migration creates:
-- - Assembly task management tables
-- - Assembly item tracking tables
-- - Assembly exception handling tables
-- - Assembly location management tables
-- - QA decision tracking tables
-- - Packing list generation tables
-- - Code tables for lookups
-- - RLS policies for multi-tenant isolation
-- - Performance indexes
-- ==================================================================

BEGIN;

-- ==================================================================
-- CODE TABLES (System-wide lookups)
-- ==================================================================

-- Exception Types
CREATE TABLE IF NOT EXISTS sys_asm_exception_type_cd (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  severity_level VARCHAR(20) DEFAULT 'MEDIUM',
  requires_action BOOLEAN DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  CHECK (severity_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);

COMMENT ON TABLE sys_asm_exception_type_cd IS 'System-wide exception types: MISSING, WRONG_ITEM, DAMAGED, EXTRA, QUALITY_ISSUE';
COMMENT ON COLUMN sys_asm_exception_type_cd.severity_level IS 'Default severity level for this exception type';

-- Location Types
CREATE TABLE IF NOT EXISTS sys_asm_location_type_cd (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  default_capacity INTEGER DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120)
);

COMMENT ON TABLE sys_asm_location_type_cd IS 'System-wide location types: BIN, RACK, SHELF, FLOOR, HANGING';

-- QA Decision Types
CREATE TABLE IF NOT EXISTS sys_qa_decision_type_cd (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  allows_proceed BOOLEAN DEFAULT false,
  requires_rework BOOLEAN DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120)
);

COMMENT ON TABLE sys_qa_decision_type_cd IS 'System-wide QA decision types: PASS, FAIL, PENDING';

-- Packaging Types
CREATE TABLE IF NOT EXISTS sys_pck_packaging_type_cd (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120)
);

COMMENT ON TABLE sys_pck_packaging_type_cd IS 'System-wide packaging types: BOX, HANGER, BAG, ROLL, MIXED';

-- ==================================================================
-- ASSEMBLY LOCATIONS (Physical locations: bins, racks, shelves)
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_asm_locations_mst (
  id UUID DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  branch_id UUID,
  
  -- Location identification
  location_code VARCHAR(100) NOT NULL,
  location_name VARCHAR(250) NOT NULL,
  location_name2 VARCHAR(250),
  location_type_code VARCHAR(50) NOT NULL,
  
  -- Capacity management
  capacity INTEGER DEFAULT 50,
  current_load INTEGER DEFAULT 0,
  
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
  
  constraint PK_org_asm_locations_mst primary key (id, tenant_org_id),
  -- Unique constraint: tenant + code
  UNIQUE(tenant_org_id, location_code)
);

COMMENT ON TABLE org_asm_locations_mst IS 'Physical locations for assembly items (bins, racks, shelves)';
COMMENT ON COLUMN org_asm_locations_mst.location_code IS 'Unique location code within tenant (e.g., "RACK-A1", "BIN-23")';
COMMENT ON COLUMN org_asm_locations_mst.current_load IS 'Current number of items in this location';

-- ==================================================================
-- ASSEMBLY TASKS (One task per order)
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_asm_tasks_mst (
  id UUID DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  order_id UUID NOT NULL,
  branch_id UUID,
  
  -- Assignment
  assigned_to UUID,
  location_id UUID,
  
  -- Status tracking
  task_status VARCHAR(50) DEFAULT 'PENDING',
  
  -- Counters
  total_items INTEGER DEFAULT 0,
  scanned_items INTEGER DEFAULT 0,
  exception_items INTEGER DEFAULT 0,
  
  -- Timestamps
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- QA tracking
  qa_status VARCHAR(50),
  qa_by UUID,
  qa_at TIMESTAMP,
  qa_note TEXT,
  qa_photo_url TEXT,
  
  -- Packing
  packaging_type_code VARCHAR(50),
  packing_note TEXT,
  packed_at TIMESTAMP,
  packed_by UUID,
  
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
  
  constraint PK_org_asm_tasks_mst primary key (id, tenant_org_id),
  -- Unique constraint: one task per order
  UNIQUE(tenant_org_id, order_id)
);

COMMENT ON TABLE org_asm_tasks_mst IS 'Assembly tasks - one task per order';
COMMENT ON COLUMN org_asm_tasks_mst.task_status IS 'Task status: PENDING, IN_PROGRESS, COMPLETE, QA_PENDING, QA_PASSED, QA_FAILED, PACKING, READY';
COMMENT ON COLUMN org_asm_tasks_mst.total_items IS 'Total expected items for this order';
COMMENT ON COLUMN org_asm_tasks_mst.scanned_items IS 'Number of items successfully scanned';
COMMENT ON COLUMN org_asm_tasks_mst.exception_items IS 'Number of items with exceptions';

-- ==================================================================
-- ASSEMBLY ITEMS (Track each order item during assembly)
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_asm_items_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  order_item_id UUID NOT NULL,
  tenant_org_id UUID NOT NULL,
  
  -- Item details (cached for performance)
  item_name VARCHAR(250),
  item_name2 VARCHAR(250),
  barcode TEXT,
  
  -- Scanning
  item_status VARCHAR(50) DEFAULT 'PENDING',
  scanned_at TIMESTAMP,
  scanned_by UUID,
  
  -- Exception tracking
  has_exception BOOLEAN DEFAULT false,
  exception_id UUID,
  
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
  
  -- Unique constraint: one assembly item per order item
  UNIQUE(task_id, order_item_id)
);

COMMENT ON TABLE org_asm_items_dtl IS 'Assembly items - tracks each order item during assembly';
COMMENT ON COLUMN org_asm_items_dtl.item_status IS 'Item status: PENDING, SCANNED, EXCEPTION, RESOLVED';
COMMENT ON COLUMN org_asm_items_dtl.barcode IS 'Barcode/QR code for scanning';

-- ==================================================================
-- ASSEMBLY EXCEPTIONS (Missing/wrong/damaged items)
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_asm_exceptions_tr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  tenant_org_id UUID NOT NULL,
  
  -- Exception details
  exception_type_code VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'MEDIUM',
  
  description TEXT NOT NULL,
  description2 TEXT,
  
  -- Evidence
  photo_urls JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  
  -- Resolution
  exception_status VARCHAR(50) DEFAULT 'OPEN',
  resolved_at TIMESTAMP,
  resolved_by UUID,
  resolution TEXT,
  
  -- Financial impact
  refund_amount DECIMAL(19, 4),
  
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

COMMENT ON TABLE org_asm_exceptions_tr IS 'Assembly exceptions - missing, wrong, or damaged items';
COMMENT ON COLUMN org_asm_exceptions_tr.exception_status IS 'Exception status: OPEN, IN_PROGRESS, RESOLVED, CUSTOMER_NOTIFIED';
COMMENT ON COLUMN org_asm_exceptions_tr.photo_urls IS 'Array of photo URLs as evidence';

-- ==================================================================
-- QA DECISIONS (QA pass/fail records)
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_qa_decisions_tr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  tenant_org_id UUID NOT NULL,
  order_id UUID NOT NULL,
  
  -- Decision details
  decision_type_code VARCHAR(50) NOT NULL,
  qa_by UUID NOT NULL,
  qa_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  qa_note TEXT,
  qa_photo_url TEXT,
  
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

COMMENT ON TABLE org_qa_decisions_tr IS 'QA decisions - pass/fail records for quality assurance';
COMMENT ON COLUMN org_qa_decisions_tr.decision_type_code IS 'QA decision: PASS, FAIL, PENDING';

-- ==================================================================
-- PACKING LISTS (Bilingual packing lists)
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_pck_packing_lists_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  order_id UUID NOT NULL,
  task_id UUID NOT NULL,
  
  -- List details
  list_number VARCHAR(100) NOT NULL,
  
  -- Items summary (cached JSON)
  items_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Packaging details
  packaging_type_code VARCHAR(50) NOT NULL,
  item_count INTEGER DEFAULT 0,
  
  -- QR code for verification
  qr_code TEXT,
  
  -- Generation
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  generated_by UUID NOT NULL,
  
  -- Print tracking
  printed_at TIMESTAMP,
  print_count INTEGER DEFAULT 0,
  
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
  
  -- Unique constraint: one packing list per order
  UNIQUE(tenant_org_id, order_id)
);

COMMENT ON TABLE org_pck_packing_lists_mst IS 'Bilingual packing lists for orders';
COMMENT ON COLUMN org_pck_packing_lists_mst.items_summary IS 'JSON array of items with names (EN/AR)';
COMMENT ON COLUMN org_pck_packing_lists_mst.qr_code IS 'QR code data URL for verification';

-- ==================================================================
-- FOREIGN KEYS
-- ==================================================================

-- Assembly Locations
ALTER TABLE org_asm_locations_mst
  ADD CONSTRAINT fk_asm_location_tenant
  FOREIGN KEY (tenant_org_id)
  REFERENCES org_tenants_mst(id)
  ON DELETE CASCADE;

-- Composite FK: Location references branch (if branch_id provided)
ALTER TABLE org_asm_locations_mst
  ADD CONSTRAINT fk_asm_location_branch
  FOREIGN KEY (branch_id, tenant_org_id)
  REFERENCES org_branches_mst(id, tenant_org_id)
  ON DELETE SET NULL;

-- Assembly Tasks
ALTER TABLE org_asm_tasks_mst
  ADD CONSTRAINT fk_asm_task_tenant
  FOREIGN KEY (tenant_org_id)
  REFERENCES org_tenants_mst(id)
  ON DELETE CASCADE;

-- Composite FK: Task references order
ALTER TABLE org_asm_tasks_mst
  ADD CONSTRAINT fk_asm_task_order
  FOREIGN KEY (order_id, tenant_org_id)
  REFERENCES org_orders_mst(id, tenant_org_id)
  ON DELETE CASCADE;

-- Composite FK: Task references location
ALTER TABLE org_asm_tasks_mst
  ADD CONSTRAINT fk_asm_task_location
  FOREIGN KEY (location_id, tenant_org_id)
  REFERENCES org_asm_locations_mst(id, tenant_org_id)
  ON DELETE SET NULL;

-- Assembly Items
ALTER TABLE org_asm_items_dtl
  ADD CONSTRAINT fk_asm_item_task
  FOREIGN KEY (task_id, tenant_org_id)
  REFERENCES org_asm_tasks_mst(id, tenant_org_id)
  ON DELETE CASCADE;

-- Composite FK: Assembly item references order item
ALTER TABLE org_asm_items_dtl
  ADD CONSTRAINT fk_asm_item_order_item
  FOREIGN KEY (order_item_id, tenant_org_id)
  REFERENCES org_order_items_dtl(id, tenant_org_id)
  ON DELETE CASCADE;

-- Assembly Exceptions
ALTER TABLE org_asm_exceptions_tr
  ADD CONSTRAINT fk_asm_exception_task
  FOREIGN KEY (task_id, tenant_org_id)
  REFERENCES org_asm_tasks_mst(id, tenant_org_id)
  ON DELETE CASCADE;

-- QA Decisions
ALTER TABLE org_qa_decisions_tr
  ADD CONSTRAINT fk_qa_decision_task
  FOREIGN KEY (task_id, tenant_org_id)
  REFERENCES org_asm_tasks_mst(id, tenant_org_id)
  ON DELETE CASCADE;

-- Composite FK: QA decision references order
ALTER TABLE org_qa_decisions_tr
  ADD CONSTRAINT fk_qa_decision_order
  FOREIGN KEY (order_id, tenant_org_id)
  REFERENCES org_orders_mst(id, tenant_org_id)
  ON DELETE CASCADE;

-- Packing Lists
ALTER TABLE org_pck_packing_lists_mst
  ADD CONSTRAINT fk_pck_list_tenant
  FOREIGN KEY (tenant_org_id)
  REFERENCES org_tenants_mst(id)
  ON DELETE CASCADE;

-- Composite FK: Packing list references order
ALTER TABLE org_pck_packing_lists_mst
  ADD CONSTRAINT fk_pck_list_order
  FOREIGN KEY (order_id, tenant_org_id)
  REFERENCES org_orders_mst(id, tenant_org_id)
  ON DELETE CASCADE;

-- Composite FK: Packing list references task
ALTER TABLE org_pck_packing_lists_mst
  ADD CONSTRAINT fk_pck_list_task
  FOREIGN KEY (task_id, tenant_org_id)
  REFERENCES org_asm_tasks_mst(id, tenant_org_id)
  ON DELETE CASCADE;

-- ==================================================================
-- INDEXES (Performance Optimization)
-- ==================================================================

-- Assembly Locations
CREATE INDEX idx_asm_locations_tenant ON org_asm_locations_mst(tenant_org_id);
CREATE INDEX idx_asm_locations_tenant_status ON org_asm_locations_mst(tenant_org_id, rec_status);
CREATE INDEX idx_asm_locations_tenant_active ON org_asm_locations_mst(tenant_org_id, is_active);
CREATE INDEX idx_asm_locations_branch ON org_asm_locations_mst(tenant_org_id, branch_id);

-- Assembly Tasks
CREATE INDEX idx_asm_tasks_tenant ON org_asm_tasks_mst(tenant_org_id);
CREATE INDEX idx_asm_tasks_tenant_status ON org_asm_tasks_mst(tenant_org_id, rec_status);
CREATE INDEX idx_asm_tasks_order ON org_asm_tasks_mst(order_id);
CREATE INDEX idx_asm_tasks_status ON org_asm_tasks_mst(tenant_org_id, task_status);
CREATE INDEX idx_asm_tasks_assigned ON org_asm_tasks_mst(tenant_org_id, assigned_to);
CREATE INDEX idx_asm_tasks_location ON org_asm_tasks_mst(tenant_org_id, location_id);
CREATE INDEX idx_asm_tasks_created ON org_asm_tasks_mst(tenant_org_id, created_at DESC);

-- Assembly Items
CREATE INDEX idx_asm_items_task ON org_asm_items_dtl(task_id);
CREATE INDEX idx_asm_items_order_item ON org_asm_items_dtl(order_item_id);
CREATE INDEX idx_asm_items_barcode ON org_asm_items_dtl(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_asm_items_status ON org_asm_items_dtl(task_id, item_status);
CREATE INDEX idx_asm_items_exception ON org_asm_items_dtl(exception_id) WHERE exception_id IS NOT NULL;

-- Assembly Exceptions
CREATE INDEX idx_asm_exceptions_task ON org_asm_exceptions_tr(task_id);
CREATE INDEX idx_asm_exceptions_status ON org_asm_exceptions_tr(task_id, exception_status);
CREATE INDEX idx_asm_exceptions_type ON org_asm_exceptions_tr(tenant_org_id, exception_type_code);

-- QA Decisions
CREATE INDEX idx_qa_decisions_task ON org_qa_decisions_tr(task_id);
CREATE INDEX idx_qa_decisions_order ON org_qa_decisions_tr(order_id);
CREATE INDEX idx_qa_decisions_tenant ON org_qa_decisions_tr(tenant_org_id);
CREATE INDEX idx_qa_decisions_created ON org_qa_decisions_tr(tenant_org_id, created_at DESC);

-- Packing Lists
CREATE INDEX idx_pck_lists_tenant ON org_pck_packing_lists_mst(tenant_org_id);
CREATE INDEX idx_pck_lists_order ON org_pck_packing_lists_mst(order_id);
CREATE INDEX idx_pck_lists_task ON org_pck_packing_lists_mst(task_id);
CREATE INDEX idx_pck_lists_created ON org_pck_packing_lists_mst(tenant_org_id, created_at DESC);

-- ==================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==================================================================

-- Enable RLS on all tenant tables
ALTER TABLE org_asm_locations_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_asm_tasks_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_asm_items_dtl ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_asm_exceptions_tr ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_qa_decisions_tr ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_pck_packing_lists_mst ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Assembly Locations
CREATE POLICY org_asm_locations_tenant_isolation ON org_asm_locations_mst
  FOR ALL
  USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));

-- RLS Policy: Assembly Tasks
CREATE POLICY org_asm_tasks_tenant_isolation ON org_asm_tasks_mst
  FOR ALL
  USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));

-- RLS Policy: Assembly Items
CREATE POLICY org_asm_items_tenant_isolation ON org_asm_items_dtl
  FOR ALL
  USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));

-- RLS Policy: Assembly Exceptions
CREATE POLICY org_asm_exceptions_tenant_isolation ON org_asm_exceptions_tr
  FOR ALL
  USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));

-- RLS Policy: QA Decisions
CREATE POLICY org_qa_decisions_tenant_isolation ON org_qa_decisions_tr
  FOR ALL
  USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));

-- RLS Policy: Packing Lists
CREATE POLICY org_pck_lists_tenant_isolation ON org_pck_packing_lists_mst
  FOR ALL
  USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));

-- ==================================================================
-- SEED DATA (Code Tables)
-- ==================================================================

-- Exception Types
INSERT INTO sys_asm_exception_type_cd (code, name, name2, description, description2, severity_level, requires_action)
VALUES
  ('MISSING', 'Missing Item', 'عنصر مفقود', 'Item not found during assembly', 'لم يتم العثور على العنصر أثناء التجميع', 'HIGH', true),
  ('WRONG_ITEM', 'Wrong Item', 'عنصر خاطئ', 'Scanned wrong item (belongs to different order)', 'عنصر خاطئ (ينتمي إلى طلب مختلف)', 'CRITICAL', true),
  ('DAMAGED', 'Damaged Item', 'عنصر تالف', 'Item damaged during processing', 'عنصر تالف أثناء المعالجة', 'MEDIUM', true),
  ('EXTRA', 'Extra Item', 'عنصر إضافي', 'Unexpected item found', 'عنصر غير متوقع', 'LOW', false),
  ('QUALITY_ISSUE', 'Quality Issue', 'مشكلة جودة', 'Quality problem detected', 'تم اكتشاف مشكلة في الجودة', 'MEDIUM', true)
ON CONFLICT (code) DO NOTHING;

-- Location Types
INSERT INTO sys_asm_location_type_cd (code, name, name2, description, description2, default_capacity)
VALUES
  ('BIN', 'Bin', 'سلة', 'Storage bin', 'سلة التخزين', 30),
  ('RACK', 'Rack', 'رف', 'Hanging rack', 'رف التعليق', 100),
  ('SHELF', 'Shelf', 'رف', 'Storage shelf', 'رف التخزين', 50),
  ('FLOOR', 'Floor Area', 'منطقة الأرضية', 'Floor storage area', 'منطقة التخزين الأرضية', 200),
  ('HANGING', 'Hanging Area', 'منطقة التعليق', 'Hanging storage area', 'منطقة التخزين المعلقة', 200)
ON CONFLICT (code) DO NOTHING;

-- QA Decision Types
INSERT INTO sys_qa_decision_type_cd (code, name, name2, description, description2, allows_proceed, requires_rework)
VALUES
  ('PASS', 'Pass', 'نجح', 'QA passed - order can proceed', 'نجح فحص الجودة - يمكن متابعة الطلب', true, false),
  ('FAIL', 'Fail', 'فشل', 'QA failed - requires rework', 'فشل فحص الجودة - يتطلب إعادة العمل', false, true),
  ('PENDING', 'Pending', 'قيد الانتظار', 'QA pending review', 'فحص الجودة قيد المراجعة', false, false)
ON CONFLICT (code) DO NOTHING;

-- Packaging Types
INSERT INTO sys_pck_packaging_type_cd (code, name, name2, description, description2)
VALUES
  ('BOX', 'Box', 'صندوق', 'Cardboard box', 'صندوق كرتوني'),
  ('HANGER', 'Hanger', 'علاقة', 'On hanger', 'على علاقة'),
  ('BAG', 'Bag', 'كيس', 'Plastic bag', 'كيس بلاستيكي'),
  ('ROLL', 'Roll', 'لفة', 'Rolled packaging', 'تغليف ملفوف'),
  ('MIXED', 'Mixed', 'مختلط', 'Mixed packaging', 'تغليف مختلط')
ON CONFLICT (code) DO NOTHING;

COMMIT;

