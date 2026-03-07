-- Migration: Fix unique constraint column order for Prisma one-to-one relations
-- Prisma requires @@unique([order_id, tenant_org_id]) to match relation fields [order_id, tenant_org_id]
-- This aligns the database with the Prisma schema to avoid "one-to-one relation must use unique fields" errors
-- See: https://www.prisma.io/docs/orm/reference/prisma-schema-reference#unique
-- Idempotent: safe to run multiple times (e.g. after git pull)

DO $$
BEGIN
  -- org_asm_tasks_mst: Change UNIQUE(tenant_org_id, order_id) -> UNIQUE(order_id, tenant_org_id)
  ALTER TABLE org_asm_tasks_mst
    DROP CONSTRAINT IF EXISTS org_asm_tasks_mst_tenant_org_id_order_id_key;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'org_asm_tasks_mst_order_id_tenant_org_id_key'
      AND conrelid = 'org_asm_tasks_mst'::regclass
  ) THEN
    ALTER TABLE org_asm_tasks_mst
      ADD CONSTRAINT org_asm_tasks_mst_order_id_tenant_org_id_key
      UNIQUE (order_id, tenant_org_id);
  END IF;

  -- org_pck_packing_lists_mst: Change UNIQUE(tenant_org_id, order_id) -> UNIQUE(order_id, tenant_org_id)
  ALTER TABLE org_pck_packing_lists_mst
    DROP CONSTRAINT IF EXISTS org_pck_packing_lists_mst_tenant_org_id_order_id_key;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'org_pck_packing_lists_mst_order_id_tenant_org_id_key'
      AND conrelid = 'org_pck_packing_lists_mst'::regclass
  ) THEN
    ALTER TABLE org_pck_packing_lists_mst
      ADD CONSTRAINT org_pck_packing_lists_mst_order_id_tenant_org_id_key
      UNIQUE (order_id, tenant_org_id);
  END IF;
END $$;
