-- ==================================================================
-- Migration: 0466_rename_cleanup_tenant_orders_function
-- Purpose: Rename cleanup_tenant_orders(...) (0465_cleanup_tenant_orders_function.sql)
--   to hq_mntnc_cleanup_tenant_orders(...), matching the hq_* platform-table
--   naming convention (hq_roles, hq_users, hq_audit_logs, ...) with an
--   mntnc (tenant-maintenance) feature abbreviation.
--
-- ALTER FUNCTION ... RENAME TO preserves the function's OID, so its body,
-- GRANT EXECUTE (service_role only), and COMMENT ON FUNCTION all carry over
-- unchanged — only the identifier changes. No behavior change.
-- ==================================================================

BEGIN;

ALTER FUNCTION cleanup_tenant_orders(
  UUID, TEXT, UUID[], TEXT[], TEXT, TIMESTAMP, TIMESTAMP, BOOLEAN, INT, BOOLEAN
) RENAME TO hq_mntnc_cleanup_tenant_orders;

COMMIT;
