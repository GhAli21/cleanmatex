-- Migration: Add created_by column to org_order_items_dtl
-- Purpose: Fix Prisma schema mismatch - column exists in schema but not in DB
-- Error: "The column org_order_items_dtl.created_by does not exist in the current database"
-- Created: 2026-03-09

ALTER TABLE org_order_items_dtl
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(120) NULL;

COMMENT ON COLUMN org_order_items_dtl.created_by IS 'User ID who created the order item';
