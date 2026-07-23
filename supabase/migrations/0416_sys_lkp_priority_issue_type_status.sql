-- ==================================================================
-- 0416_sys_lkp_priority_issue_type_status.sql
-- Purpose: Reusable priority lookup; issue_code → sys_issue_type_cd;
--          status OPEN|SOLVED dual-write with solved_at; helpers + indexes
-- Author: CleanMateX Development Team
-- Created: 2026-07-23
-- Dependencies: 0021, 0051, 0414
-- DO NOT APPLY automatically — review then run via normal DB process.
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 1. Seed missing issue types (COMPLAINT, OTHER)
-- ------------------------------------------------------------------
INSERT INTO sys_issue_type_cd (
  code, name, name2, description, description2,
  display_order, icon, color,
  issue_category, severity_level,
  requires_customer_notification, requires_refund, requires_replacement,
  default_resolution_action, estimated_resolution_hours,
  is_default, is_system, is_active, rec_status
) VALUES
  (
    'COMPLAINT',
    'Complaint',
    'شكوى',
    'Customer or operational complaint',
    'شكوى من العميل أو التشغيل',
    90,
    'message-circle',
    '#F59E0B',
    'other',
    'medium',
    true, false, false,
    'Investigate and resolve with customer',
    24,
    false, true, true, 1
  ),
  (
    'OTHER',
    'Other',
    'أخرى',
    'Uncategorized issue',
    'مشكلة غير مصنفة',
    99,
    'help-circle',
    '#6B7280',
    'other',
    'low',
    false, false, false,
    'Review and classify',
    8,
    true, true, true, 1
  )
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------------
-- 2. Reusable priority lookup
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys_lkp_priority_cd (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name2 TEXT,
  description TEXT,
  description2 TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  icon TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  rec_status SMALLINT NOT NULL DEFAULT 1
);

COMMENT ON TABLE sys_lkp_priority_cd IS
  'Reusable priority codes (low, normal, high, urgent) for any feature';

CREATE INDEX IF NOT EXISTS idx_sys_lkp_priority_active
  ON sys_lkp_priority_cd (is_active, display_order);

INSERT INTO sys_lkp_priority_cd (
  code, name, name2, description, description2,
  display_order, color, icon, is_default, is_active, is_system, rec_status
) VALUES
  ('urgent', 'Urgent', 'عاجل', 'Highest priority', 'أعلى أولوية', 1, '#DC2626', 'alert-octagon', false, true, true, 1),
  ('high', 'High', 'عالية', 'High priority', 'أولوية عالية', 2, '#EA580C', 'alert-triangle', false, true, true, 1),
  ('normal', 'Normal', 'عادية', 'Default priority', 'الأولوية الافتراضية', 3, '#2563EB', 'minus', true, true, true, 1),
  ('low', 'Low', 'منخفضة', 'Low priority', 'أولوية منخفضة', 4, '#6B7280', 'arrow-down', false, true, true, 1)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  display_order = EXCLUDED.display_order,
  color = EXCLUDED.color,
  is_default = EXCLUDED.is_default,
  is_active = EXCLUDED.is_active,
  updated_at = CURRENT_TIMESTAMP;

-- ------------------------------------------------------------------
-- 3. Remap legacy issue_code values
-- ------------------------------------------------------------------
UPDATE org_order_issues
SET issue_code = CASE lower(issue_code)
  WHEN 'damage' THEN 'DAMAGE'
  WHEN 'stain' THEN 'STAIN'
  WHEN 'complaint' THEN 'COMPLAINT'
  WHEN 'other' THEN 'OTHER'
  ELSE issue_code
END
WHERE issue_code IS NOT NULL
  AND lower(issue_code) IN ('damage', 'stain', 'complaint', 'other');

-- Fail migration if orphans remain
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM org_order_issues i
  WHERE i.issue_code IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM sys_issue_type_cd t WHERE t.code = i.issue_code
    );
  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      '0416: % org_order_issues rows have issue_code not in sys_issue_type_cd',
      orphan_count;
  END IF;
END $$;

-- ------------------------------------------------------------------
-- 4. Drop CHECKs; add FKs
-- ------------------------------------------------------------------
ALTER TABLE org_order_issues DROP CONSTRAINT IF EXISTS chk_issue_code;
ALTER TABLE org_order_issues DROP CONSTRAINT IF EXISTS chk_issue_priority;

ALTER TABLE org_order_issues
  DROP CONSTRAINT IF EXISTS fk_ord_issue_issue_code;

ALTER TABLE org_order_issues
  ADD CONSTRAINT fk_ord_issue_issue_code
  FOREIGN KEY (issue_code)
  REFERENCES sys_issue_type_cd (code)
  ON DELETE RESTRICT;

ALTER TABLE org_order_issues
  DROP CONSTRAINT IF EXISTS fk_ord_issue_priority;

ALTER TABLE org_order_issues
  ADD CONSTRAINT fk_ord_issue_priority
  FOREIGN KEY (priority)
  REFERENCES sys_lkp_priority_cd (code)
  ON DELETE RESTRICT;

-- ------------------------------------------------------------------
-- 5. Status column + backfill
-- ------------------------------------------------------------------
ALTER TABLE org_order_issues
  ADD COLUMN IF NOT EXISTS status TEXT;

UPDATE org_order_issues
SET status = CASE
  WHEN solved_at IS NULL THEN 'OPEN'
  ELSE 'SOLVED'
END
WHERE status IS NULL;

ALTER TABLE org_order_issues
  ALTER COLUMN status SET DEFAULT 'OPEN';

ALTER TABLE org_order_issues
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE org_order_issues
  DROP CONSTRAINT IF EXISTS chk_ord_issue_status;

ALTER TABLE org_order_issues
  ADD CONSTRAINT chk_ord_issue_status
  CHECK (status IN ('OPEN', 'SOLVED'));

COMMENT ON COLUMN org_order_issues.status IS
  'OPEN | SOLVED — dual-written with solved_at on create/resolve';
COMMENT ON COLUMN org_order_issues.priority IS
  'FK to sys_lkp_priority_cd.code';
COMMENT ON COLUMN org_order_issues.issue_code IS
  'FK to sys_issue_type_cd.code';

-- ------------------------------------------------------------------
-- 6. Helpers use status = OPEN
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION has_unresolved_issues(p_order_item_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM org_order_issues i
    WHERE i.status = 'OPEN'
      AND (
        i.order_item_id = p_order_item_id
        OR i.order_item_piece_id IN (
          SELECT p.id
          FROM org_order_item_pieces_dtl p
          WHERE p.order_item_id = p_order_item_id
        )
      )
  );
END;
$$;

COMMENT ON FUNCTION has_unresolved_issues(UUID) IS
  'True if item has open ITEM/PIECE issues (status = OPEN)';

CREATE OR REPLACE FUNCTION org_ord_has_unresolved_issues(p_order_item_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN has_unresolved_issues(p_order_item_id);
END;
$$;

CREATE OR REPLACE FUNCTION org_ord_has_unresolved_order_issues(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM org_order_issues i
    WHERE i.order_id = p_order_id
      AND i.status = 'OPEN'
  );
END;
$$;

COMMENT ON FUNCTION org_ord_has_unresolved_order_issues(UUID) IS
  'True if the order has any OPEN issues at ORDER/ITEM/PIECE scope';

-- ------------------------------------------------------------------
-- 7. Indexes — open predicate on status
-- ------------------------------------------------------------------
DROP INDEX IF EXISTS idx_issue_unresolved;
DROP INDEX IF EXISTS idx_issue_priority;
DROP INDEX IF EXISTS idx_ord_issue_item_open;
DROP INDEX IF EXISTS idx_ord_issue_piece_open;
DROP INDEX IF EXISTS idx_ord_issue_tenant_order_solved;

CREATE INDEX IF NOT EXISTS idx_ord_issue_unresolved
  ON org_order_issues (tenant_org_id, order_id, created_at DESC)
  WHERE status = 'OPEN';

CREATE INDEX IF NOT EXISTS idx_ord_issue_priority_open
  ON org_order_issues (tenant_org_id, priority, created_at DESC)
  WHERE status = 'OPEN';

CREATE INDEX IF NOT EXISTS idx_ord_issue_item_open
  ON org_order_issues (order_item_id, created_at DESC)
  WHERE status = 'OPEN' AND order_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ord_issue_piece_open
  ON org_order_issues (order_item_piece_id, created_at DESC)
  WHERE status = 'OPEN' AND order_item_piece_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ord_issue_tenant_status_created
  ON org_order_issues (tenant_org_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ord_issue_tenant_scope_status
  ON org_order_issues (tenant_org_id, scope_level, status, created_at DESC);

COMMIT;
