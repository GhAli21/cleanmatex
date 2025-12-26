-- ==================================================================
-- 0051_quality_workflow_tables.sql
-- Purpose: Create Quality & Workflow code tables
-- Author: CleanMateX Development Team
-- Created: 2025-01-22
-- PRD: PRD-SAAS-MNG-0006 - Core Data & Code Management
-- ==================================================================
-- This migration creates code tables for quality and workflow:
-- 1. sys_quality_check_status_cd - QA statuses
-- 2. sys_issue_type_cd - Issue types
-- 3. sys_workflow_step_cd - Workflow steps
-- ==================================================================

BEGIN;

-- ==================================================================
-- TABLE: sys_quality_check_status_cd
-- Purpose: Quality check status codes
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_quality_check_status_cd (
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

  -- Status Configuration
  status_type VARCHAR(20),                         -- 'passed', 'failed', 'pending', 'needs_review'
  allows_proceed BOOLEAN DEFAULT true,              -- Can order proceed with this status?
  requires_action BOOLEAN DEFAULT false,             -- Requires corrective action?

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,                  -- System statuses cannot be deleted
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,
  /*
    Example:
    {
      "notification_required": true,
      "escalation_level": "low" | "medium" | "high",
      "auto_resolve": false,
      "requires_photo": false
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
CREATE INDEX idx_quality_status_active
  ON sys_quality_check_status_cd(is_active, display_order);

CREATE INDEX idx_quality_status_type
  ON sys_quality_check_status_cd(status_type, is_active);

-- Comments
COMMENT ON TABLE sys_quality_check_status_cd IS
  'Quality check status codes (PASSED, FAILED, PENDING, NEEDS_REVIEW)';

COMMENT ON COLUMN sys_quality_check_status_cd.code IS
  'Unique quality status code (e.g., PASSED, FAILED, PENDING, NEEDS_REVIEW)';

-- ==================================================================
-- TABLE: sys_issue_type_cd
-- Purpose: Issue type codes
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_issue_type_cd (
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

  -- Issue Classification
  issue_category VARCHAR(50),                      -- 'stain', 'damage', 'missing', 'quality', 'other'
  severity_level VARCHAR(20),                      -- 'low', 'medium', 'high', 'critical'
  requires_customer_notification BOOLEAN DEFAULT true,
  requires_refund BOOLEAN DEFAULT false,
  requires_replacement BOOLEAN DEFAULT false,

  -- Resolution
  default_resolution_action TEXT,                 -- Default action to resolve
  estimated_resolution_hours INTEGER,

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,                  -- System issue types cannot be deleted
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,
  /*
    Example:
    {
      "common_causes": ["handling", "equipment", "customer"],
      "prevention_tips": "Handle with care during processing",
      "compensation_required": true,
      "photo_required": true
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
CREATE INDEX idx_issue_type_active
  ON sys_issue_type_cd(is_active, display_order);

CREATE INDEX idx_issue_type_category
  ON sys_issue_type_cd(issue_category, is_active);

CREATE INDEX idx_issue_type_severity
  ON sys_issue_type_cd(severity_level, is_active);

-- Comments
COMMENT ON TABLE sys_issue_type_cd IS
  'Issue type codes (STAIN, DAMAGE, MISSING_ITEM, COLOR_BLEED, etc.)';

COMMENT ON COLUMN sys_issue_type_cd.code IS
  'Unique issue type code (e.g., STAIN, DAMAGE, MISSING_ITEM)';

COMMENT ON COLUMN sys_issue_type_cd.severity_level IS
  'Severity level (low, medium, high, critical)';

-- ==================================================================
-- TABLE: sys_workflow_step_cd
-- Purpose: Workflow step codes
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_workflow_step_cd (
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

  -- Step Configuration
  step_category VARCHAR(50),                       -- 'intake', 'processing', 'quality', 'delivery', 'completed'
  step_type VARCHAR(50),                           -- 'operational', 'qa', 'delivery', 'administrative'
  is_required BOOLEAN DEFAULT true,                -- Is this step required?
  estimated_duration_hours INTEGER,                 -- Estimated duration

  -- Workflow
  allowed_next_steps VARCHAR(50)[],                -- Array of step codes that can follow
  requires_scan BOOLEAN DEFAULT false,              -- Requires barcode scan
  requires_signature BOOLEAN DEFAULT false,         -- Requires customer signature
  requires_photo BOOLEAN DEFAULT false,             -- Requires photo documentation

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,                  -- System steps cannot be deleted
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,
  /*
    Example:
    {
      "equipment_required": ["washing_machine", "dryer"],
      "staff_role_required": "OPERATOR",
      "sla_hours": 24,
      "can_skip": false,
      "parallel_allowed": false
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
CREATE INDEX idx_workflow_step_active
  ON sys_workflow_step_cd(is_active, display_order);

CREATE INDEX idx_workflow_step_category
  ON sys_workflow_step_cd(step_category, is_active);

CREATE INDEX idx_workflow_step_type
  ON sys_workflow_step_cd(step_type, is_active);

-- Comments
COMMENT ON TABLE sys_workflow_step_cd IS
  'Workflow step codes (INTAKE, SORTING, WASHING, DRYING, PRESSING, PACKAGING, DELIVERY)';

COMMENT ON COLUMN sys_workflow_step_cd.code IS
  'Unique workflow step code (e.g., INTAKE, WASHING, PRESSING, DELIVERY)';

COMMENT ON COLUMN sys_workflow_step_cd.allowed_next_steps IS
  'Array of step codes that can follow this step';

-- ==================================================================
-- SEED DATA: sys_quality_check_status_cd
-- ==================================================================

INSERT INTO sys_quality_check_status_cd (
  code,
  name,
  name2,
  description,
  description2,
  display_order,
  icon,
  color,
  status_type,
  allows_proceed,
  requires_action,
  is_system,
  is_active,
  metadata
) VALUES
  (
    'PASSED',
    'Passed',
    'نجح',
    'Quality check passed',
    'نجح فحص الجودة',
    1,
    'check-circle',
    '#10B981',
    'passed',
    true,
    false,
    true,
    true,
    '{"notification_required": false, "escalation_level": "low", "auto_resolve": true, "requires_photo": false}'::jsonb
  ),
  (
    'FAILED',
    'Failed',
    'فشل',
    'Quality check failed',
    'فشل فحص الجودة',
    2,
    'x-circle',
    '#EF4444',
    'failed',
    false,
    true,
    true,
    true,
    '{"notification_required": true, "escalation_level": "high", "auto_resolve": false, "requires_photo": true}'::jsonb
  ),
  (
    'PENDING',
    'Pending',
    'قيد الانتظار',
    'Quality check pending',
    'فحص الجودة قيد الانتظار',
    3,
    'clock',
    '#F59E0B',
    'pending',
    false,
    false,
    true,
    true,
    '{"notification_required": false, "escalation_level": "low", "auto_resolve": false, "requires_photo": false}'::jsonb
  ),
  (
    'NEEDS_REVIEW',
    'Needs Review',
    'يحتاج مراجعة',
    'Quality check needs manual review',
    'فحص الجودة يحتاج مراجعة يدوية',
    4,
    'eye',
    '#8B5CF6',
    'needs_review',
    false,
    true,
    true,
    true,
    '{"notification_required": true, "escalation_level": "medium", "auto_resolve": false, "requires_photo": true}'::jsonb
  ),
  (
    'CONDITIONAL_PASS',
    'Conditional Pass',
    'نجاح مشروط',
    'Passed with conditions',
    'نجح بشروط',
    5,
    'alert-circle',
    '#F59E0B',
    'passed',
    true,
    true,
    true,
    true,
    '{"notification_required": true, "escalation_level": "medium", "auto_resolve": false, "requires_photo": false}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  status_type = EXCLUDED.status_type,
  allows_proceed = EXCLUDED.allows_proceed,
  requires_action = EXCLUDED.requires_action,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

-- ==================================================================
-- SEED DATA: sys_issue_type_cd
-- ==================================================================

INSERT INTO sys_issue_type_cd (
  code,
  name,
  name2,
  description,
  description2,
  display_order,
  icon,
  color,
  issue_category,
  severity_level,
  requires_customer_notification,
  requires_refund,
  requires_replacement,
  default_resolution_action,
  estimated_resolution_hours,
  is_system,
  is_active,
  metadata
) VALUES
  -- Stains
  (
    'STAIN',
    'Stain',
    'بقعة',
    'Stain on garment',
    'بقعة على الملابس',
    1,
    'droplet',
    '#EF4444',
    'stain',
    'medium',
    true,
    false,
    false,
    'Attempt stain removal, notify customer if unsuccessful',
    2,
    true,
    true,
    '{"common_causes": ["handling", "equipment"], "prevention_tips": "Handle with care during processing", "compensation_required": false, "photo_required": true}'::jsonb
  ),
  (
    'PERSISTENT_STAIN',
    'Persistent Stain',
    'بقعة مستعصية',
    'Stain that cannot be removed',
    'بقعة لا يمكن إزالتها',
    2,
    'alert-triangle',
    '#DC2626',
    'stain',
    'high',
    true,
    true,
    false,
    'Notify customer, offer refund or discount',
    0,
    true,
    true,
    '{"common_causes": ["customer"], "prevention_tips": "Inspect items at intake", "compensation_required": true, "photo_required": true}'::jsonb
  ),
  -- Damage
  (
    'DAMAGE',
    'Damage',
    'تلف',
    'Damage to garment',
    'تلف في الملابس',
    10,
    'alert-circle',
    '#EF4444',
    'damage',
    'high',
    true,
    true,
    true,
    'Notify customer immediately, offer replacement or refund',
    0,
    true,
    true,
    '{"common_causes": ["handling", "equipment"], "prevention_tips": "Follow care instructions carefully", "compensation_required": true, "photo_required": true}'::jsonb
  ),
  (
    'TEAR',
    'Tear',
    'تمزق',
    'Tear in fabric',
    'تمزق في القماش',
    11,
    'scissors',
    '#DC2626',
    'damage',
    'critical',
    true,
    true,
    true,
    'Notify customer immediately, offer replacement or full refund',
    0,
    true,
    true,
    '{"common_causes": ["equipment", "handling"], "prevention_tips": "Check for existing damage at intake", "compensation_required": true, "photo_required": true}'::jsonb
  ),
  (
    'SHRINKAGE',
    'Shrinkage',
    'انكماش',
    'Garment shrunk during processing',
    'انكماش الملابس أثناء المعالجة',
    12,
    'minimize-2',
    '#F59E0B',
    'damage',
    'high',
    true,
    true,
    true,
    'Notify customer, offer replacement or refund',
    0,
    true,
    true,
    '{"common_causes": ["equipment"], "prevention_tips": "Follow fabric care instructions", "compensation_required": true, "photo_required": true}'::jsonb
  ),
  (
    'COLOR_BLEED',
    'Color Bleed',
    'انسكاب اللون',
    'Color bleeding or fading',
    'انسكاب أو بهتان اللون',
    13,
    'palette',
    '#8B5CF6',
    'damage',
    'high',
    true,
    true,
    false,
    'Notify customer, offer discount or refund',
    0,
    true,
    true,
    '{"common_causes": ["equipment"], "prevention_tips": "Sort by color, use appropriate detergents", "compensation_required": true, "photo_required": true}'::jsonb
  ),
  -- Missing Items
  (
    'MISSING_ITEM',
    'Missing Item',
    'عنصر مفقود',
    'Item missing from order',
    'عنصر مفقود من الطلب',
    20,
    'package-x',
    '#EF4444',
    'missing',
    'critical',
    true,
    true,
    true,
    'Locate item immediately, notify customer if not found',
    4,
    true,
    true,
    '{"common_causes": ["handling"], "prevention_tips": "Use barcode scanning, maintain inventory", "compensation_required": true, "photo_required": false}'::jsonb
  ),
  (
    'WRONG_ITEM',
    'Wrong Item',
    'عنصر خاطئ',
    'Wrong item in order',
    'عنصر خاطئ في الطلب',
    21,
    'package-check',
    '#F59E0B',
    'missing',
    'high',
    true,
    true,
    true,
    'Locate correct item, return wrong item, notify customer',
    2,
    true,
    true,
    '{"common_causes": ["handling"], "prevention_tips": "Verify items at each step", "compensation_required": false, "photo_required": true}'::jsonb
  ),
  -- Quality Issues
  (
    'POOR_CLEANING',
    'Poor Cleaning',
    'تنظيف رديء',
    'Item not cleaned properly',
    'العنصر لم يتم تنظيفه بشكل صحيح',
    30,
    'sparkles',
    '#F59E0B',
    'quality',
    'medium',
    true,
    false,
    false,
    'Re-clean item, notify customer of delay',
    4,
    true,
    true,
    '{"common_causes": ["equipment", "staff"], "prevention_tips": "Follow cleaning procedures", "compensation_required": false, "photo_required": false}'::jsonb
  ),
  (
    'WRINKLED',
    'Wrinkled',
    'مجعد',
    'Item not pressed properly',
    'العنصر لم يتم كيه بشكل صحيح',
    31,
    'wind',
    '#6B7280',
    'quality',
    'low',
    true,
    false,
    false,
    'Re-press item, notify customer of delay',
    1,
    true,
    true,
    '{"common_causes": ["staff"], "prevention_tips": "Follow pressing procedures", "compensation_required": false, "photo_required": false}'::jsonb
  ),
  (
    'ODOR',
    'Odor',
    'رائحة',
    'Unpleasant odor on item',
    'رائحة كريهة على العنصر',
    32,
    'wind',
    '#F59E0B',
    'quality',
    'medium',
    true,
    false,
    false,
    'Re-clean item with odor removal, notify customer',
    4,
    true,
    true,
    '{"common_causes": ["equipment"], "prevention_tips": "Use appropriate detergents and cleaning agents", "compensation_required": false, "photo_required": false}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  issue_category = EXCLUDED.issue_category,
  severity_level = EXCLUDED.severity_level,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

-- ==================================================================
-- SEED DATA: sys_workflow_step_cd
-- ==================================================================

INSERT INTO sys_workflow_step_cd (
  code,
  name,
  name2,
  description,
  description2,
  display_order,
  icon,
  color,
  step_category,
  step_type,
  is_required,
  estimated_duration_hours,
  allowed_next_steps,
  requires_scan,
  requires_signature,
  requires_photo,
  is_system,
  is_active,
  metadata
) VALUES
  -- Intake Steps
  (
    'INTAKE',
    'Intake',
    'استلام',
    'Order intake and initial inspection',
    'استلام الطلب والفحص الأولي',
    1,
    'package',
    '#3B82F6',
    'intake',
    'operational',
    true,
    1,
    ARRAY['SORTING', 'CANCELLED'],
    true,
    false,
    true,
    true,
    true,
    '{"equipment_required": [], "staff_role_required": "OPERATOR", "sla_hours": 1, "can_skip": false, "parallel_allowed": false}'::jsonb
  ),
  (
    'SORTING',
    'Sorting',
    'فرز',
    'Sort items by type and service',
    'فرز العناصر حسب النوع والخدمة',
    2,
    'layers',
    '#8B5CF6',
    'intake',
    'operational',
    true,
    1,
    ARRAY['WASHING', 'DRY_CLEANING', 'PRESSING'],
    false,
    false,
    false,
    true,
    true,
    '{"equipment_required": [], "staff_role_required": "OPERATOR", "sla_hours": 2, "can_skip": false, "parallel_allowed": true}'::jsonb
  ),
  -- Processing Steps
  (
    'WASHING',
    'Washing',
    'غسيل',
    'Wash items',
    'غسيل العناصر',
    10,
    'droplet',
    '#10B981',
    'processing',
    'operational',
    false,
    2,
    ARRAY['DRYING', 'PRESSING'],
    false,
    false,
    false,
    true,
    true,
    '{"equipment_required": ["washing_machine"], "staff_role_required": "OPERATOR", "sla_hours": 4, "can_skip": false, "parallel_allowed": true}'::jsonb
  ),
  (
    'DRY_CLEANING',
    'Dry Cleaning',
    'تنظيف جاف',
    'Dry clean items',
    'تنظيف جاف للعناصر',
    11,
    'wind',
    '#6366F1',
    'processing',
    'operational',
    false,
    4,
    ARRAY['PRESSING'],
    false,
    false,
    false,
    true,
    true,
    '{"equipment_required": ["dry_cleaning_machine"], "staff_role_required": "OPERATOR", "sla_hours": 8, "can_skip": false, "parallel_allowed": true}'::jsonb
  ),
  (
    'DRYING',
    'Drying',
    'تجفيف',
    'Dry items',
    'تجفيف العناصر',
    12,
    'sun',
    '#F59E0B',
    'processing',
    'operational',
    false,
    2,
    ARRAY['PRESSING'],
    false,
    false,
    false,
    true,
    true,
    '{"equipment_required": ["dryer"], "staff_role_required": "OPERATOR", "sla_hours": 3, "can_skip": false, "parallel_allowed": true}'::jsonb
  ),
  (
    'PRESSING',
    'Pressing',
    'كيّ',
    'Press and iron items',
    'كيّ وكي العناصر',
    13,
    'zap',
    '#EF4444',
    'processing',
    'operational',
    false,
    2,
    ARRAY['QUALITY_CHECK', 'PACKAGING'],
    false,
    false,
    false,
    true,
    true,
    '{"equipment_required": ["iron", "steamer"], "staff_role_required": "OPERATOR", "sla_hours": 3, "can_skip": false, "parallel_allowed": true}'::jsonb
  ),
  -- Quality Steps
  (
    'QUALITY_CHECK',
    'Quality Check',
    'فحص الجودة',
    'Quality assurance check',
    'فحص ضمان الجودة',
    20,
    'award',
    '#8B5CF6',
    'quality',
    'qa',
    true,
    1,
    ARRAY['PACKAGING', 'REWORK'],
    false,
    false,
    true,
    true,
    true,
    '{"equipment_required": [], "staff_role_required": "MANAGER", "sla_hours": 2, "can_skip": false, "parallel_allowed": false}'::jsonb
  ),
  (
    'REWORK',
    'Rework',
    'إعادة العمل',
    'Rework required items',
    'إعادة عمل العناصر المطلوبة',
    21,
    'refresh-cw',
    '#F59E0B',
    'quality',
    'operational',
    false,
    4,
    ARRAY['QUALITY_CHECK'],
    false,
    false,
    true,
    true,
    true,
    '{"equipment_required": [], "staff_role_required": "OPERATOR", "sla_hours": 6, "can_skip": false, "parallel_allowed": false}'::jsonb
  ),
  -- Packaging & Delivery
  (
    'PACKAGING',
    'Packaging',
    'التغليف',
    'Package items for delivery',
    'تغليف العناصر للتسليم',
    30,
    'package-check',
    '#10B981',
    'delivery',
    'operational',
    true,
    1,
    ARRAY['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'],
    true,
    false,
    false,
    true,
    true,
    '{"equipment_required": [], "staff_role_required": "OPERATOR", "sla_hours": 1, "can_skip": false, "parallel_allowed": false}'::jsonb
  ),
  (
    'READY_FOR_PICKUP',
    'Ready for Pickup',
    'جاهز للاستلام',
    'Order ready for customer pickup',
    'الطلب جاهز لاستلام العميل',
    31,
    'check-circle',
    '#10B981',
    'delivery',
    'delivery',
    false,
    0,
    ARRAY['PICKED_UP', 'OUT_FOR_DELIVERY'],
    false,
    false,
    false,
    true,
    true,
    '{"equipment_required": [], "staff_role_required": "OPERATOR", "sla_hours": 0, "can_skip": false, "parallel_allowed": false}'::jsonb
  ),
  (
    'OUT_FOR_DELIVERY',
    'Out for Delivery',
    'خارج للتسليم',
    'Order out for delivery',
    'الطلب خارج للتسليم',
    32,
    'truck',
    '#3B82F6',
    'delivery',
    'delivery',
    false,
    4,
    ARRAY['DELIVERED', 'DELIVERY_FAILED'],
    false,
    false,
    false,
    true,
    true,
    '{"equipment_required": ["delivery_vehicle"], "staff_role_required": "DRIVER", "sla_hours": 8, "can_skip": false, "parallel_allowed": false}'::jsonb
  ),
  (
    'DELIVERED',
    'Delivered',
    'تم التسليم',
    'Order delivered to customer',
    'تم تسليم الطلب للعميل',
    33,
    'check-circle-2',
    '#10B981',
    'completed',
    'delivery',
    false,
    0,
    ARRAY[]::VARCHAR(50)[],
    false,
    true,
    false,
    true,
    true,
    '{"equipment_required": [], "staff_role_required": "DRIVER", "sla_hours": 0, "can_skip": false, "parallel_allowed": false}'::jsonb
  ),
  (
    'PICKED_UP',
    'Picked Up',
    'تم الاستلام',
    'Order picked up by customer',
    'تم استلام الطلب من قبل العميل',
    34,
    'user-check',
    '#10B981',
    'completed',
    'delivery',
    false,
    0,
    ARRAY[]::VARCHAR(50)[],
    false,
    true,
    false,
    true,
    true,
    '{"equipment_required": [], "staff_role_required": "OPERATOR", "sla_hours": 0, "can_skip": false, "parallel_allowed": false}'::jsonb
  ),
  (
    'DELIVERY_FAILED',
    'Delivery Failed',
    'فشل التسليم',
    'Delivery attempt failed',
    'فشلت محاولة التسليم',
    35,
    'x-circle',
    '#EF4444',
    'delivery',
    'delivery',
    false,
    0,
    ARRAY['OUT_FOR_DELIVERY', 'READY_FOR_PICKUP'],
    false,
    false,
    true,
    true,
    true,
    '{"equipment_required": [], "staff_role_required": "DRIVER", "sla_hours": 0, "can_skip": false, "parallel_allowed": false}'::jsonb
  ),
  -- Administrative Steps
  (
    'CANCELLED',
    'Cancelled',
    'ملغي',
    'Order cancelled',
    'الطلب ملغي',
    40,
    'x',
    '#6B7280',
    'completed',
    'administrative',
    false,
    0,
    ARRAY[]::VARCHAR(50)[],
    false,
    false,
    false,
    true,
    true,
    '{"equipment_required": [], "staff_role_required": "MANAGER", "sla_hours": 0, "can_skip": false, "parallel_allowed": false}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  step_category = EXCLUDED.step_category,
  step_type = EXCLUDED.step_type,
  allowed_next_steps = EXCLUDED.allowed_next_steps,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

-- ==================================================================
-- REGISTER TABLES IN REGISTRY
-- ==================================================================

INSERT INTO sys_code_tables_registry (
  table_name,
  display_name,
  display_name2,
  description,
  description2,
  category,
  display_order,
  is_editable,
  is_extensible,
  supports_tenant_override,
  requires_unique_name,
  metadata
) VALUES
  (
    'sys_quality_check_status_cd',
    'Quality Check Statuses',
    'حالات فحص الجودة',
    'Quality check status codes',
    'رموز حالات فحص الجودة',
    'Quality & Workflow',
    1,
    true,
    true,
    false,
    true,
    '{"icon": "award", "color": "#8B5CF6", "help_text": "Manage quality check status codes"}'::jsonb
  ),
  (
    'sys_issue_type_cd',
    'Issue Types',
    'أنواع المشاكل',
    'Issue type codes',
    'رموز أنواع المشاكل',
    'Quality & Workflow',
    2,
    true,
    true,
    false,
    true,
    '{"icon": "alert-triangle", "color": "#EF4444", "help_text": "Manage issue type codes"}'::jsonb
  ),
  (
    'sys_workflow_step_cd',
    'Workflow Steps',
    'خطوات سير العمل',
    'Workflow step codes',
    'رموز خطوات سير العمل',
    'Quality & Workflow',
    3,
    true,
    true,
    false,
    true,
    '{"icon": "workflow", "color": "#3B82F6", "help_text": "Manage workflow step codes"}'::jsonb
  )
ON CONFLICT (table_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  display_name2 = EXCLUDED.display_name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  category = EXCLUDED.category,
  display_order = EXCLUDED.display_order,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

COMMIT;

