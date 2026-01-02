-- ==================================================================
-- 0065_org_dlv_delivery_management.sql
-- Purpose: Delivery Management & POD System for PRD-013
-- Author: CleanMateX Development Team
-- Created: 2025-01-20
-- PRD: PRD-013 - Delivery Management & POD
-- Dependencies: 0001_core_schema.sql, 0013_workflow_status_system.sql
-- ==================================================================
-- This migration creates:
-- - Delivery routes management tables
-- - Delivery stops (orders in routes) tables
-- - Proof of Delivery (POD) records tables
-- - Delivery time slots tables
-- - Code tables for route statuses, stop statuses, and POD methods
-- - RLS policies for multi-tenant isolation
-- - Performance indexes
-- ==================================================================

BEGIN;

-- ==================================================================
-- CODE TABLES (System-wide lookups)
-- ==================================================================

-- Route Statuses
CREATE TABLE IF NOT EXISTS sys_dlv_route_status_cd (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  allows_modification BOOLEAN DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120)
);

COMMENT ON TABLE sys_dlv_route_status_cd IS 'System-wide route statuses: planned, in_progress, completed, cancelled';

-- Stop Statuses
CREATE TABLE IF NOT EXISTS sys_dlv_stop_status_cd (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  is_final BOOLEAN DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120)
);

COMMENT ON TABLE sys_dlv_stop_status_cd IS 'System-wide stop statuses: pending, in_transit, delivered, failed, cancelled';

-- POD Methods
CREATE TABLE IF NOT EXISTS sys_dlv_pod_method_cd (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  requires_verification BOOLEAN DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120)
);

COMMENT ON TABLE sys_dlv_pod_method_cd IS 'System-wide POD methods: OTP, SIGNATURE, PHOTO, MIXED';

-- ==================================================================
-- DELIVERY ROUTES (Master table)
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_dlv_routes_mst (
  id UUID DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  branch_id UUID,
  
  -- Route identification
  route_number VARCHAR(100) NOT NULL,
  
  -- Assignment
  driver_id UUID,
  
  -- Status
  route_status_code VARCHAR(50) DEFAULT 'planned',
  
  -- Statistics
  total_stops INTEGER DEFAULT 0,
  completed_stops INTEGER DEFAULT 0,
  
  -- Timestamps
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Route details
  estimated_duration_minutes INTEGER,
  total_distance_km DECIMAL(10, 2),
  
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
  
  constraint PK_org_dlv_routes_mst primary key(id, tenant_org_id),
  -- Unique constraint: tenant + route number
  UNIQUE(tenant_org_id, route_number)
);

COMMENT ON TABLE org_dlv_routes_mst IS 'Delivery routes - master table';
COMMENT ON COLUMN org_dlv_routes_mst.route_number IS 'Unique route number within tenant (e.g., "RT-2025-001")';

-- ==================================================================
-- DELIVERY STOPS (Detail table - one per order)
-- ==================================================================
--
CREATE TABLE IF NOT EXISTS org_dlv_stops_dtl (
  id UUID DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL,
  order_id UUID NOT NULL,
  tenant_org_id UUID NOT NULL,
  
  -- Stop sequence
  sequence INTEGER NOT NULL,
  
  -- Address details
  address TEXT NOT NULL,
  address_lat DECIMAL(10, 8),
  address_lng DECIMAL(11, 8),
  
  -- Status
  stop_status_code VARCHAR(50) DEFAULT 'pending',
  
  -- Scheduling
  scheduled_time TIMESTAMP,
  estimated_arrival TIMESTAMP,
  actual_time TIMESTAMP,
  
  -- Contact
  contact_name VARCHAR(255),
  contact_phone VARCHAR(50),
  
  -- Notes
  notes TEXT,
  
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
  
  constraint PK_org_dlv_stops_dtl primary key(id, tenant_org_id),
  -- Unique constraint: one stop per order per route
  UNIQUE(tenant_org_id, route_id, order_id)
);

COMMENT ON TABLE org_dlv_stops_dtl IS 'Delivery stops - one stop per order in a route';
COMMENT ON COLUMN org_dlv_stops_dtl.sequence IS 'Stop sequence number in route (1, 2, 3, ...)';

-- ==================================================================
-- PROOF OF DELIVERY (Transaction table)
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_dlv_pod_tr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id UUID NOT NULL,
  tenant_org_id UUID NOT NULL,
  
  -- POD method
  pod_method_code VARCHAR(50) NOT NULL,
  
  -- OTP verification
  otp_code VARCHAR(10),
  otp_verified BOOLEAN DEFAULT false,
  
  -- Signature
  signature_url TEXT,
  
  -- Photo evidence
  photo_urls JSONB DEFAULT '[]'::jsonb,
  
  -- Verification
  verified_at TIMESTAMP,
  verified_by UUID,
  
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

COMMENT ON TABLE org_dlv_pod_tr IS 'Proof of Delivery records - OTP, signature, photo';
COMMENT ON COLUMN org_dlv_pod_tr.otp_code IS '4-digit OTP code (encrypted)';
COMMENT ON COLUMN org_dlv_pod_tr.photo_urls IS 'Array of photo URLs as evidence';

-- ==================================================================
-- DELIVERY SLOTS (Time slots for pickup/delivery)
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_dlv_slots_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  branch_id UUID,
  
  -- Slot details
  slot_date DATE NOT NULL,
  time_range_start TIME NOT NULL,
  time_range_end TIME NOT NULL,
  slot_type VARCHAR(20) NOT NULL,
  
  -- Capacity
  capacity INTEGER DEFAULT 10,
  booked_count INTEGER DEFAULT 0,
  
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
  
  -- Unique constraint: tenant + date + time range + type
  UNIQUE(tenant_org_id, slot_date, time_range_start, time_range_end, slot_type)
);

COMMENT ON TABLE org_dlv_slots_mst IS 'Pickup/delivery time slots';
COMMENT ON COLUMN org_dlv_slots_mst.slot_type IS 'Slot type: pickup, delivery';
COMMENT ON COLUMN org_dlv_slots_mst.capacity IS 'Maximum number of orders for this slot';

-- ==================================================================
-- FOREIGN KEYS
-- ==================================================================

-- Routes
ALTER TABLE org_dlv_routes_mst
  ADD CONSTRAINT fk_dlv_route_tenant
  FOREIGN KEY (tenant_org_id)
  REFERENCES org_tenants_mst(id)
  ON DELETE CASCADE;

-- Composite FK: Route references branch
ALTER TABLE org_dlv_routes_mst
  ADD CONSTRAINT fk_dlv_route_branch
  FOREIGN KEY (branch_id, tenant_org_id)
  REFERENCES org_branches_mst(id, tenant_org_id)
  ON DELETE SET NULL;

-- Stops
ALTER TABLE org_dlv_stops_dtl
  ADD CONSTRAINT fk_dlv_stop_route
  FOREIGN KEY (route_id, tenant_org_id)
  REFERENCES org_dlv_routes_mst(id, tenant_org_id)
  ON DELETE CASCADE;

-- Composite FK: Stop references order
ALTER TABLE org_dlv_stops_dtl
  ADD CONSTRAINT fk_dlv_stop_order
  FOREIGN KEY (order_id, tenant_org_id)
  REFERENCES org_orders_mst(id, tenant_org_id)
  ON DELETE CASCADE;

-- POD
ALTER TABLE org_dlv_pod_tr
  ADD CONSTRAINT fk_dlv_pod_stop
  FOREIGN KEY (stop_id, tenant_org_id)
  REFERENCES org_dlv_stops_dtl(id, tenant_org_id)
  ON DELETE CASCADE;

-- Slots
ALTER TABLE org_dlv_slots_mst
  ADD CONSTRAINT fk_dlv_slot_tenant
  FOREIGN KEY (tenant_org_id)
  REFERENCES org_tenants_mst(id)
  ON DELETE CASCADE;

-- Composite FK: Slot references branch
ALTER TABLE org_dlv_slots_mst
  ADD CONSTRAINT fk_dlv_slot_branch
  FOREIGN KEY (branch_id, tenant_org_id)
  REFERENCES org_branches_mst(id, tenant_org_id)
  ON DELETE SET NULL;

-- ==================================================================
-- INDEXES (Performance Optimization)
-- ==================================================================

-- Routes
CREATE INDEX idx_dlv_routes_tenant ON org_dlv_routes_mst(tenant_org_id);
CREATE INDEX idx_dlv_routes_tenant_status ON org_dlv_routes_mst(tenant_org_id, rec_status);
CREATE INDEX idx_dlv_routes_driver ON org_dlv_routes_mst(tenant_org_id, driver_id);
CREATE INDEX idx_dlv_routes_status ON org_dlv_routes_mst(tenant_org_id, route_status_code);
CREATE INDEX idx_dlv_routes_created ON org_dlv_routes_mst(tenant_org_id, created_at DESC);

-- Stops
CREATE INDEX idx_dlv_stops_route ON org_dlv_stops_dtl(route_id);
CREATE INDEX idx_dlv_stops_order ON org_dlv_stops_dtl(order_id);
CREATE INDEX idx_dlv_stops_status ON org_dlv_stops_dtl(route_id, stop_status_code);
CREATE INDEX idx_dlv_stops_scheduled ON org_dlv_stops_dtl(tenant_org_id, scheduled_time);

-- POD
CREATE INDEX idx_dlv_pod_stop ON org_dlv_pod_tr(stop_id);
CREATE INDEX idx_dlv_pod_tenant ON org_dlv_pod_tr(tenant_org_id);
CREATE INDEX idx_dlv_pod_created ON org_dlv_pod_tr(tenant_org_id, created_at DESC);

-- Slots
CREATE INDEX idx_dlv_slots_tenant ON org_dlv_slots_mst(tenant_org_id);
CREATE INDEX idx_dlv_slots_date ON org_dlv_slots_mst(tenant_org_id, slot_date);
CREATE INDEX idx_dlv_slots_type ON org_dlv_slots_mst(tenant_org_id, slot_type);

-- ==================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==================================================================

-- Enable RLS on all tenant tables
ALTER TABLE org_dlv_routes_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_dlv_stops_dtl ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_dlv_pod_tr ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_dlv_slots_mst ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Routes
CREATE POLICY org_dlv_routes_tenant_isolation ON org_dlv_routes_mst
  FOR ALL
  USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));

-- RLS Policy: Stops
CREATE POLICY org_dlv_stops_tenant_isolation ON org_dlv_stops_dtl
  FOR ALL
  USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));

-- RLS Policy: POD
CREATE POLICY org_dlv_pod_tenant_isolation ON org_dlv_pod_tr
  FOR ALL
  USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));

-- RLS Policy: Slots
CREATE POLICY org_dlv_slots_tenant_isolation ON org_dlv_slots_mst
  FOR ALL
  USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));

-- ==================================================================
-- SEED DATA (Code Tables)
-- ==================================================================

-- Route Statuses
INSERT INTO sys_dlv_route_status_cd (code, name, name2, description, description2, allows_modification)
VALUES
  ('planned', 'Planned', 'مخطط', 'Route planned but not started', 'الطريق مخطط ولكن لم يبدأ', true),
  ('in_progress', 'In Progress', 'قيد التنفيذ', 'Route in progress', 'الطريق قيد التنفيذ', true),
  ('completed', 'Completed', 'مكتمل', 'Route completed', 'اكتمل الطريق', false),
  ('cancelled', 'Cancelled', 'ملغي', 'Route cancelled', 'تم إلغاء الطريق', false)
ON CONFLICT (code) DO NOTHING;

-- Stop Statuses
INSERT INTO sys_dlv_stop_status_cd (code, name, name2, description, description2, is_final)
VALUES
  ('pending', 'Pending', 'قيد الانتظار', 'Stop pending', 'التوقف قيد الانتظار', false),
  ('in_transit', 'In Transit', 'في الطريق', 'Stop in transit', 'التوقف في الطريق', false),
  ('delivered', 'Delivered', 'تم التسليم', 'Stop delivered', 'تم تسليم التوقف', true),
  ('failed', 'Failed', 'فشل', 'Stop delivery failed', 'فشل تسليم التوقف', true),
  ('cancelled', 'Cancelled', 'ملغي', 'Stop cancelled', 'تم إلغاء التوقف', true)
ON CONFLICT (code) DO NOTHING;

-- POD Methods
INSERT INTO sys_dlv_pod_method_cd (code, name, name2, description, description2, requires_verification)
VALUES
  ('OTP', 'OTP', 'رمز التحقق', 'One-time password verification', 'التحقق بكلمة مرور لمرة واحدة', true),
  ('SIGNATURE', 'Signature', 'توقيع', 'Digital signature', 'التوقيع الرقمي', true),
  ('PHOTO', 'Photo', 'صورة', 'Photo evidence', 'دليل الصورة', true),
  ('MIXED', 'Mixed', 'مختلط', 'Multiple POD methods', 'طرق POD متعددة', true)
ON CONFLICT (code) DO NOTHING;

COMMIT;

