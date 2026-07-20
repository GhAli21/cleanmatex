-- ==================================================================
-- 0414_order_issues_rename_and_scope.sql
-- Purpose: Rename issues table, add ORDER/ITEM/PIECE scope, piece FK
-- Author: CleanMateX Development Team
-- Created: 2026-07-20
-- Dependencies: 0021_order_issues_steps.sql, 0413_order_issues_nullable_item.sql
-- ==================================================================
-- - Rename org_order_item_issues → org_order_issues
-- - Recreate RLS policy with new name
-- - Add scope_level + order_item_piece_id + scope CHECK
-- - Replace has_unresolved_issues (+ org_ord_* alias)
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 1. Rename table (RLS policies move with the table OID)
-- ------------------------------------------------------------------
ALTER TABLE IF EXISTS org_order_item_issues RENAME TO org_order_issues;

COMMENT ON TABLE org_order_issues IS
  'Order issues at ORDER, ITEM, or PIECE scope (damage, stain, complaint, other)';

-- ------------------------------------------------------------------
-- 2. Recreate RLS policy with new name
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_isolation_issues ON org_order_issues;
DROP POLICY IF EXISTS tenant_isolation_org_order_item_issues ON org_order_issues;
DROP POLICY IF EXISTS tenant_isolation_org_order_issues ON org_order_issues;

CREATE POLICY tenant_isolation_org_order_issues ON org_order_issues
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_org_order_issues ON org_order_issues IS
  'Tenant isolation for org_order_issues via current_tenant_id()';

-- ------------------------------------------------------------------
-- 3. Scope + piece columns
-- ------------------------------------------------------------------
ALTER TABLE org_order_issues
  ADD COLUMN IF NOT EXISTS scope_level TEXT;

ALTER TABLE org_order_issues
  ADD COLUMN IF NOT EXISTS order_item_piece_id UUID;

-- Backfill scope before NOT NULL
UPDATE org_order_issues
SET scope_level = CASE
  WHEN order_item_id IS NULL THEN 'ORDER'
  ELSE 'ITEM'
END
WHERE scope_level IS NULL;

ALTER TABLE org_order_issues
  ALTER COLUMN scope_level SET NOT NULL;

ALTER TABLE org_order_issues
  DROP CONSTRAINT IF EXISTS chk_issue_scope_level;

ALTER TABLE org_order_issues
  ADD CONSTRAINT chk_issue_scope_level
  CHECK (scope_level IN ('ORDER', 'ITEM', 'PIECE'));

ALTER TABLE org_order_issues
  DROP CONSTRAINT IF EXISTS chk_order_issue_scope;

ALTER TABLE org_order_issues
  ADD CONSTRAINT chk_order_issue_scope
  CHECK (
    (scope_level = 'ORDER' AND order_item_id IS NULL AND order_item_piece_id IS NULL)
    OR (scope_level = 'ITEM' AND order_item_id IS NOT NULL AND order_item_piece_id IS NULL)
    OR (scope_level = 'PIECE' AND order_item_id IS NOT NULL AND order_item_piece_id IS NOT NULL)
  );

-- Piece FK (RESTRICT-safe; no CASCADE drop)
ALTER TABLE org_order_issues
  DROP CONSTRAINT IF EXISTS fk_issue_order_item_piece;

ALTER TABLE org_order_issues
  ADD CONSTRAINT fk_issue_order_item_piece
  FOREIGN KEY (order_item_piece_id)
  REFERENCES org_order_item_pieces_dtl(id)
  ON DELETE CASCADE;

COMMENT ON COLUMN org_order_issues.scope_level IS
  'ORDER | ITEM | PIECE — which entity the issue is attached to';
COMMENT ON COLUMN org_order_issues.order_item_id IS
  'Order item for ITEM/PIECE scope; NULL for ORDER scope';
COMMENT ON COLUMN org_order_issues.order_item_piece_id IS
  'Piece for PIECE scope; NULL for ORDER/ITEM scope';

-- ------------------------------------------------------------------
-- 4. Indexes
-- ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ord_issue_tenant_order_solved
  ON org_order_issues (tenant_org_id, order_id, solved_at);

CREATE INDEX IF NOT EXISTS idx_ord_issue_item_open
  ON org_order_issues (order_item_id, created_at DESC)
  WHERE solved_at IS NULL AND order_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ord_issue_piece_open
  ON org_order_issues (order_item_piece_id, created_at DESC)
  WHERE solved_at IS NULL AND order_item_piece_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ord_issue_scope
  ON org_order_issues (tenant_org_id, scope_level, created_at DESC);

-- ------------------------------------------------------------------
-- 5. Helper functions (query new table; include piece under item)
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
    WHERE i.solved_at IS NULL
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
  'True if item has open ITEM-scoped issues or open PIECE-scoped issues under the item';

CREATE OR REPLACE FUNCTION org_ord_has_unresolved_issues(p_order_item_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN has_unresolved_issues(p_order_item_id);
END;
$$;

COMMENT ON FUNCTION org_ord_has_unresolved_issues(UUID) IS
  'Naming-convention alias for has_unresolved_issues';

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
      AND i.solved_at IS NULL
  );
END;
$$;

COMMENT ON FUNCTION org_ord_has_unresolved_order_issues(UUID) IS
  'True if the order has any open issues at ORDER/ITEM/PIECE scope';

COMMIT;
