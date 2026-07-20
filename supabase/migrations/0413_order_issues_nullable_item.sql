-- ==================================================================
-- 0413_order_issues_nullable_item.sql
-- Purpose: Allow order-level issues (no specific order item)
-- Author: CleanMateX Development Team
-- Created: 2026-07-20
-- Dependencies: 0021_order_issues_steps.sql
-- ==================================================================
-- Simple Processing "Report Issue" posts order-level issues with
-- orderItemId = null. Previously the service stuffed order_id into
-- order_item_id, which failed FK fk_issue_order_item.
-- Making order_item_id nullable is the correct model for order-level
-- issues; item-level issues still supply a valid item id.
-- ==================================================================

BEGIN;

ALTER TABLE org_order_item_issues
  ALTER COLUMN order_item_id DROP NOT NULL;

COMMENT ON COLUMN org_order_item_issues.order_item_id IS
  'Order item this issue belongs to; NULL = order-level issue (not tied to a specific item)';

COMMIT;
