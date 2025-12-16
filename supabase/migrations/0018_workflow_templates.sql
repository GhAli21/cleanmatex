-- ==================================================================
-- 0018_workflow_templates.sql
-- Purpose: Global workflow template system for PRD-010
-- Author: CleanMateX Development Team
-- Created: 2025-11-05
-- Dependencies: 0001_core_schema.sql
-- ==================================================================
-- This migration creates the global workflow template system:
-- - sys_workflow_template_cd: Template definitions
-- - sys_workflow_template_stages: Stages per template
-- - sys_workflow_template_transitions: Allowed transitions with rules
-- - Seeds 5 default templates as per PRD-010 spec
-- ==================================================================

BEGIN;

-- ==================================================================
-- TABLE 1: sys_workflow_template_cd
-- Purpose: Global workflow template definitions
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_workflow_template_cd (
  template_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_code     VARCHAR(50) NOT NULL UNIQUE,
  template_name     VARCHAR(250) NOT NULL,
  template_name2    VARCHAR(250),
  template_desc     TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  rec_order         INTEGER DEFAULT 0,
  rec_status        SMALLINT DEFAULT 1,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ
);

COMMENT ON TABLE sys_workflow_template_cd IS 'Global workflow template definitions shared across all tenants';
COMMENT ON COLUMN sys_workflow_template_cd.template_code IS 'Template code (WF_SIMPLE, WF_STANDARD, etc.)';
COMMENT ON COLUMN sys_workflow_template_cd.template_name IS 'Template name (English)';
COMMENT ON COLUMN sys_workflow_template_cd.template_name2 IS 'Template name (Arabic)';

-- ==================================================================
-- TABLE 2: sys_workflow_template_stages
-- Purpose: Stages per template with sequence ordering
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_workflow_template_stages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id       UUID NOT NULL REFERENCES sys_workflow_template_cd(template_id) ON DELETE CASCADE,
  stage_code        VARCHAR(50) NOT NULL,
  stage_name        VARCHAR(250) NOT NULL,
  stage_name2       VARCHAR(250),
  stage_type        VARCHAR(50) NOT NULL, -- operational, qa, delivery
  seq_no            INTEGER NOT NULL,
  is_terminal       BOOLEAN DEFAULT false,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ,
  UNIQUE (template_id, stage_code)
);

COMMENT ON TABLE sys_workflow_template_stages IS 'Stages per workflow template with sequence and metadata';
COMMENT ON COLUMN sys_workflow_template_stages.stage_code IS 'Stage code (intake, preparing, processing, assembly, qa, ready, delivered)';
COMMENT ON COLUMN sys_workflow_template_stages.stage_type IS 'Stage type: operational, qa, delivery';
COMMENT ON COLUMN sys_workflow_template_stages.seq_no IS 'Sequence number defining order of stages';
COMMENT ON COLUMN sys_workflow_template_stages.is_terminal IS 'True if this is a terminal stage (cannot transition from)';

-- ==================================================================
-- TABLE 3: sys_workflow_template_transitions
-- Purpose: Allowed transitions between stages with validation rules
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_workflow_template_transitions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id           UUID NOT NULL REFERENCES sys_workflow_template_cd(template_id) ON DELETE CASCADE,
  from_stage_code       VARCHAR(50) NOT NULL,
  to_stage_code         VARCHAR(50) NOT NULL,
  requires_scan_ok      BOOLEAN DEFAULT false,
  requires_invoice      BOOLEAN DEFAULT false,
  requires_pod          BOOLEAN DEFAULT false,
  allow_manual          BOOLEAN DEFAULT true,
  auto_when_done        BOOLEAN DEFAULT false,
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ,
  UNIQUE (template_id, from_stage_code, to_stage_code)
);

COMMENT ON TABLE sys_workflow_template_transitions IS 'Allowed transitions between stages with validation rules';
COMMENT ON COLUMN sys_workflow_template_transitions.requires_scan_ok IS 'Require successful scan to allow transition';
COMMENT ON COLUMN sys_workflow_template_transitions.requires_invoice IS 'Require invoice to allow transition';
COMMENT ON COLUMN sys_workflow_template_transitions.requires_pod IS 'Require proof of delivery to allow transition';
COMMENT ON COLUMN sys_workflow_template_transitions.allow_manual IS 'Allow manual transition by user';
COMMENT ON COLUMN sys_workflow_template_transitions.auto_when_done IS 'Auto-transition when all items are done';

-- ==================================================================
-- INDEXES FOR PERFORMANCE
-- ==================================================================

CREATE INDEX IF NOT EXISTS idx_template_code ON sys_workflow_template_cd(template_code);
CREATE INDEX IF NOT EXISTS idx_template_active ON sys_workflow_template_cd(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_stages_template ON sys_workflow_template_stages(template_id, seq_no);
CREATE INDEX IF NOT EXISTS idx_transitions_template ON sys_workflow_template_transitions(template_id, from_stage_code);
CREATE INDEX IF NOT EXISTS idx_transitions_active ON sys_workflow_template_transitions(is_active) WHERE is_active = true;

-- ==================================================================
-- SEED DATA: 5 Default Templates
-- ==================================================================

-- 1. WF_SIMPLE (intake → ready → delivered)
INSERT INTO sys_workflow_template_cd (template_code, template_name, template_name2, template_desc, rec_order, is_active)
VALUES 
  ('WF_SIMPLE', 'Simple Workflow', 'سير عمل بسيط', 'Minimal workflow for basic operations: intake → ready → delivered', 1, true)
ON CONFLICT (template_code) DO NOTHING;

-- 2. WF_STANDARD (intake → processing → ready → delivered)
INSERT INTO sys_workflow_template_cd (template_code, template_name, template_name2, template_desc, rec_order, is_active)
VALUES 
  ('WF_STANDARD', 'Standard Workflow', 'سير العمل القياسي', 'Standard workflow with processing stage', 2, true)
ON CONFLICT (template_code) DO NOTHING;

-- 3. WF_ASSEMBLY_QA (intake → processing → assembly → qa → ready → delivered)
INSERT INTO sys_workflow_template_cd (template_code, template_name, template_name2, template_desc, rec_order, is_active)
VALUES 
  ('WF_ASSEMBLY_QA', 'Assembly QA Workflow', 'سير عمل التجميع وضبط الجودة', 'Workflow with assembly and QA stages', 3, true)
ON CONFLICT (template_code) DO NOTHING;

-- 4. WF_PICKUP_DELIVERY (intake → processing → ready → out_for_delivery → delivered)
INSERT INTO sys_workflow_template_cd (template_code, template_name, template_name2, template_desc, rec_order, is_active)
VALUES 
  ('WF_PICKUP_DELIVERY', 'Pickup & Delivery Workflow', 'سير عمل الاستلام والتوصيل', 'Workflow with pickup and delivery tracking', 4, true)
ON CONFLICT (template_code) DO NOTHING;

-- 5. WF_ISSUE_REPROCESS (intake → processing → ready → delivered → issue_to_solve → reprocess → ready → delivered)
INSERT INTO sys_workflow_template_cd (template_code, template_name, template_name2, template_desc, rec_order, is_active)
VALUES 
  ('WF_ISSUE_REPROCESS', 'Issue Reprocess Workflow', 'سير عمل حل المشكلات وإعادة المعالجة', 'Workflow with issue resolution and reprocessing', 5, true)
ON CONFLICT (template_code) DO NOTHING;

-- ==================================================================
-- SEED STAGES FOR EACH TEMPLATE
-- ==================================================================

-- WF_SIMPLE stages
WITH template AS (SELECT template_id FROM sys_workflow_template_cd WHERE template_code = 'WF_SIMPLE')
INSERT INTO sys_workflow_template_stages (template_id, stage_code, stage_name, stage_name2, stage_type, seq_no, is_terminal)
SELECT 
  t.template_id,
  stage_code,
  stage_name,
  stage_name2,
  stage_type::VARCHAR(50),
  seq_no,
  (stage_code = 'delivered')
FROM template t
CROSS JOIN (
  VALUES 
    ('intake', 'Intake', 'استقبال', 'operational', 1),
    ('ready', 'Ready', 'جاهز', 'operational', 2),
    ('delivered', 'Delivered', 'تم التسليم', 'delivery', 3)
) AS stages(stage_code, stage_name, stage_name2, stage_type, seq_no)
ON CONFLICT (template_id, stage_code) DO NOTHING;

-- WF_STANDARD stages
WITH template AS (SELECT template_id FROM sys_workflow_template_cd WHERE template_code = 'WF_STANDARD')
INSERT INTO sys_workflow_template_stages (template_id, stage_code, stage_name, stage_name2, stage_type, seq_no, is_terminal)
SELECT 
  t.template_id,
  stage_code,
  stage_name,
  stage_name2,
  stage_type::VARCHAR(50),
  seq_no,
  (stage_code = 'delivered')
FROM template t
CROSS JOIN (
  VALUES 
    ('intake', 'Intake', 'استقبال', 'operational', 1),
    ('processing', 'Processing', 'معالجة', 'operational', 2),
    ('ready', 'Ready', 'جاهز', 'operational', 3),
    ('delivered', 'Delivered', 'تم التسليم', 'delivery', 4)
) AS stages(stage_code, stage_name, stage_name2, stage_type, seq_no)
ON CONFLICT (template_id, stage_code) DO NOTHING;

-- WF_ASSEMBLY_QA stages
WITH template AS (SELECT template_id FROM sys_workflow_template_cd WHERE template_code = 'WF_ASSEMBLY_QA')
INSERT INTO sys_workflow_template_stages (template_id, stage_code, stage_name, stage_name2, stage_type, seq_no, is_terminal)
SELECT 
  t.template_id,
  stage_code,
  stage_name,
  stage_name2,
  stage_type::VARCHAR(50),
  seq_no,
  (stage_code = 'delivered')
FROM template t
CROSS JOIN (
  VALUES 
    ('intake', 'Intake', 'استقبال', 'operational', 1),
    ('processing', 'Processing', 'معالجة', 'operational', 2),
    ('assembly', 'Assembly', 'تجميع', 'operational', 3),
    ('qa', 'Quality Check', 'فحص الجودة', 'qa', 4),
    ('ready', 'Ready', 'جاهز', 'operational', 5),
    ('delivered', 'Delivered', 'تم التسليم', 'delivery', 6)
) AS stages(stage_code, stage_name, stage_name2, stage_type, seq_no)
ON CONFLICT (template_id, stage_code) DO NOTHING;

-- WF_PICKUP_DELIVERY stages
WITH template AS (SELECT template_id FROM sys_workflow_template_cd WHERE template_code = 'WF_PICKUP_DELIVERY')
INSERT INTO sys_workflow_template_stages (template_id, stage_code, stage_name, stage_name2, stage_type, seq_no, is_terminal)
SELECT 
  t.template_id,
  stage_code,
  stage_name,
  stage_name2,
  stage_type::VARCHAR(50),
  seq_no,
  (stage_code = 'delivered')
FROM template t
CROSS JOIN (
  VALUES 
    ('intake', 'Intake', 'استقبال', 'operational', 1),
    ('processing', 'Processing', 'معالجة', 'operational', 2),
    ('ready', 'Ready', 'جاهز', 'operational', 3),
    ('out_for_delivery', 'Out for Delivery', 'قيد التوصيل', 'delivery', 4),
    ('delivered', 'Delivered', 'تم التسليم', 'delivery', 5)
) AS stages(stage_code, stage_name, stage_name2, stage_type, seq_no)
ON CONFLICT (template_id, stage_code) DO NOTHING;

-- WF_ISSUE_REPROCESS stages
WITH template AS (SELECT template_id FROM sys_workflow_template_cd WHERE template_code = 'WF_ISSUE_REPROCESS')
INSERT INTO sys_workflow_template_stages (template_id, stage_code, stage_name, stage_name2, stage_type, seq_no, is_terminal)
SELECT 
  t.template_id,
  stage_code,
  stage_name,
  stage_name2,
  stage_type::VARCHAR(50),
  seq_no,
  (stage_code = 'delivered')
FROM template t
CROSS JOIN (
  VALUES 
    ('intake', 'Intake', 'استقبال', 'operational', 1),
    ('processing', 'Processing', 'معالجة', 'operational', 2),
    ('ready', 'Ready', 'جاهز', 'operational', 3),
    ('delivered', 'Delivered', 'تم التسليم', 'delivery', 4),
    ('issue_to_solve', 'Issue to Solve', 'مشكلة لحل', 'operational', 5),
    ('reprocess', 'Reprocess', 'إعادة معالجة', 'operational', 6)
) AS stages(stage_code, stage_name, stage_name2, stage_type, seq_no)
ON CONFLICT (template_id, stage_code) DO NOTHING;

-- ==================================================================
-- SEED TRANSITIONS FOR EACH TEMPLATE
-- ==================================================================

-- WF_SIMPLE transitions
WITH template AS (SELECT template_id FROM sys_workflow_template_cd WHERE template_code = 'WF_SIMPLE')
INSERT INTO sys_workflow_template_transitions (template_id, from_stage_code, to_stage_code, auto_when_done)
SELECT 
  t.template_id,
  from_stage,
  to_stage,
  (to_stage = 'delivered') as auto_when_done
FROM template t
CROSS JOIN (
  VALUES 
    ('intake', 'ready'),
    ('ready', 'delivered')
) AS trans(from_stage, to_stage)
ON CONFLICT (template_id, from_stage_code, to_stage_code) DO NOTHING;

-- WF_STANDARD transitions
WITH template AS (SELECT template_id FROM sys_workflow_template_cd WHERE template_code = 'WF_STANDARD')
INSERT INTO sys_workflow_template_transitions (template_id, from_stage_code, to_stage_code, auto_when_done)
SELECT 
  t.template_id,
  from_stage,
  to_stage,
  (to_stage = 'ready') as auto_when_done
FROM template t
CROSS JOIN (
  VALUES 
    ('intake', 'processing'),
    ('processing', 'ready'),
    ('ready', 'delivered')
) AS trans(from_stage, to_stage)
ON CONFLICT (template_id, from_stage_code, to_stage_code) DO NOTHING;

-- WF_ASSEMBLY_QA transitions
WITH template AS (SELECT template_id FROM sys_workflow_template_cd WHERE template_code = 'WF_ASSEMBLY_QA')
INSERT INTO sys_workflow_template_transitions (template_id, from_stage_code, to_stage_code, auto_when_done)
SELECT 
  t.template_id,
  from_stage,
  to_stage,
  (to_stage IN ('assembly', 'ready')) as auto_when_done
FROM template t
CROSS JOIN (
  VALUES 
    ('intake', 'processing'),
    ('processing', 'assembly'),
    ('assembly', 'qa'),
    ('qa', 'ready'),
    ('ready', 'delivered')
) AS trans(from_stage, to_stage)
ON CONFLICT (template_id, from_stage_code, to_stage_code) DO NOTHING;

-- WF_PICKUP_DELIVERY transitions
WITH template AS (SELECT template_id FROM sys_workflow_template_cd WHERE template_code = 'WF_PICKUP_DELIVERY')
INSERT INTO sys_workflow_template_transitions (template_id, from_stage_code, to_stage_code, requires_pod, auto_when_done)
SELECT 
  t.template_id,
  from_stage,
  to_stage,
  (to_stage = 'delivered') as requires_pod,
  (to_stage = 'ready') as auto_when_done
FROM template t
CROSS JOIN (
  VALUES 
    ('intake', 'processing'),
    ('processing', 'ready'),
    ('ready', 'out_for_delivery'),
    ('out_for_delivery', 'delivered')
) AS trans(from_stage, to_stage)
ON CONFLICT (template_id, from_stage_code, to_stage_code) DO NOTHING;

-- WF_ISSUE_REPROCESS transitions
WITH template AS (SELECT template_id FROM sys_workflow_template_cd WHERE template_code = 'WF_ISSUE_REPROCESS')
INSERT INTO sys_workflow_template_transitions (template_id, from_stage_code, to_stage_code, auto_when_done)
SELECT 
  t.template_id,
  from_stage,
  to_stage,
  (to_stage = 'ready') as auto_when_done
FROM template t
CROSS JOIN (
  VALUES 
    ('intake', 'processing'),
    ('processing', 'ready'),
    ('ready', 'delivered'),
    ('delivered', 'issue_to_solve'),
    ('issue_to_solve', 'reprocess'),
    ('reprocess', 'ready')
) AS trans(from_stage, to_stage)
ON CONFLICT (template_id, from_stage_code, to_stage_code) DO NOTHING;

-- ==================================================================
-- VALIDATION CHECKS
-- ==================================================================

DO $$
DECLARE
  v_template_count INTEGER;
  v_stage_count INTEGER;
  v_transition_count INTEGER;
BEGIN
  -- Verify 5 templates were created
  SELECT COUNT(*) INTO v_template_count
  FROM sys_workflow_template_cd
  WHERE is_active = true;
  
  IF v_template_count != 5 THEN
    RAISE EXCEPTION 'Expected 5 active templates, found %', v_template_count;
  END IF;

  -- Verify stages were created
  SELECT COUNT(*) INTO v_stage_count
  FROM sys_workflow_template_stages
  WHERE is_active = true;
  
  IF v_stage_count < 15 THEN
    RAISE WARNING 'Expected at least 15 stages, found %. Check stage seeding.', v_stage_count;
  END IF;

  -- Verify transitions were created
  SELECT COUNT(*) INTO v_transition_count
  FROM sys_workflow_template_transitions
  WHERE is_active = true;
  
  IF v_transition_count < 10 THEN
    RAISE WARNING 'Expected at least 10 transitions, found %. Check transition seeding.', v_transition_count;
  END IF;

  RAISE NOTICE '✓ Migration 0018 validation passed successfully';
  RAISE NOTICE '  - % templates created', v_template_count;
  RAISE NOTICE '  - % stages created', v_stage_count;
  RAISE NOTICE '  - % transitions created', v_transition_count;
END $$;

COMMIT;

-- ==================================================================
-- POST-MIGRATION NOTES
-- ==================================================================

-- NEXT STEPS:
-- 1. Create tenant workflow configuration tables (0019)
-- 2. Extend orders tables with workflow fields (0020)
-- 3. Implement transition function (0023)

-- TESTING:
-- 1. SELECT * FROM sys_workflow_template_cd;
-- 2. SELECT * FROM sys_workflow_template_stages ORDER BY template_id, seq_no;
-- 3. SELECT * FROM sys_workflow_template_transitions ORDER BY template_id, from_stage_code;

