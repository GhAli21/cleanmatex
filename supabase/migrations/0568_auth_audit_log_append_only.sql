-- ============================================================
-- Migration: 0568_auth_audit_log_append_only.sql
-- Purpose:   Make sys_auth_audit_log genuinely append-only. Migration 0561 documented the table as
--            insert-only but only revoked API roles; Supabase default privileges had already granted
--            ALL on the new table to service_role, so server code (and anyone holding the service
--            key) could still UPDATE/DELETE/TRUNCATE audit rows. Found by the db-integration test
--            auth-identity-hardening.db.test.ts.
-- Affected:  sys_auth_audit_log (privileges + immutability trigger)
-- Related:   0561 (creates sys_auth_audit_log, fn_auth_log_event)
-- ============================================================

-- service_role keeps SELECT + INSERT only (server routes read the trail and fn_auth_log_event
-- inserts). Retention deletes run later as the table owner / pg_cron job, never as service_role.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE sys_auth_audit_log FROM service_role;

-- Rows are immutable once written, even for the table owner or a superuser: audit evidence must not be
-- editable. DELETE stays possible for the owner so the scheduled retention purge can run.
CREATE OR REPLACE FUNCTION fn_auth_audit_block_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'sys_auth_audit_log rows are immutable (append-only)'
    USING ERRCODE = '42501';
END;
$$;

COMMENT ON FUNCTION fn_auth_audit_block_update() IS
  'BEFORE UPDATE guard that keeps sys_auth_audit_log rows immutable; retention uses DELETE as table owner.';

REVOKE EXECUTE ON FUNCTION fn_auth_audit_block_update() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_auth_audit_block_update
  BEFORE UPDATE ON sys_auth_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION fn_auth_audit_block_update();
COMMENT ON TRIGGER trg_auth_audit_block_update ON sys_auth_audit_log IS
  'Rejects every UPDATE so audit rows stay immutable.';

-- ROLLBACK PLAN:
--   DROP TRIGGER trg_auth_audit_block_update ON sys_auth_audit_log; DROP FUNCTION fn_auth_audit_block_update();
--   GRANT UPDATE, DELETE, TRUNCATE ON TABLE sys_auth_audit_log TO service_role;  -- not recommended
