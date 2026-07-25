-- ==================================================================
-- 0439_org_orders_mst_state_version_to_integer.sql
-- Purpose: Fix root cause of "Do not know how to serialize a BigInt"
--          crashes on GET/PATCH /api/v1/orders/[id] (Edit Order page).
--
-- org_orders_mst.state_version was created as BIGINT by migration
-- 0427 (sys_wf_catalogs_and_state_version) for workflow-engine
-- optimistic concurrency. Prisma maps SQL BIGINT to the native JS
-- `bigint` type, which `JSON.stringify` (used by every
-- NextResponse.json() call) cannot serialize. Any route that returns
-- a raw org_orders_mst row throws at request time.
--
-- state_version is a per-order revision counter starting at 1,
-- incremented by 1 per workflow transition (never reset, never
-- shared across orders) — it will never approach the ~2.147 billion
-- ceiling of INTEGER. Verified against live data before authoring
-- this migration (2026-07-25, remote DB): MAX(state_version) = 7
-- across 72 orders. INTEGER is correct and permanently removes this
-- whole bug class (every current and future read site), instead of
-- patching each JSON-serialization call site one at a time.
--
-- Author: CleanMateX Development Team
-- Created: 2026-07-25
-- Dependencies: 0427_sys_wf_catalogs_and_state_version.sql
-- DO NOT APPLY automatically — review then run via normal DB process.
-- ==================================================================

BEGIN;

ALTER TABLE public.org_orders_mst
  ALTER COLUMN state_version TYPE INTEGER USING state_version::integer;

COMMENT ON COLUMN public.org_orders_mst.state_version IS
  'Workflow-engine optimistic concurrency token (per-order revision counter). '
  'INTEGER, not BIGINT — see migration 0439 for why.';

COMMIT;
