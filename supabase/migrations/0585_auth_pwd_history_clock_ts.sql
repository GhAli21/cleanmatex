-- =============================================================================
-- 0585_auth_pwd_history_clock_ts.sql
-- Purpose:  User Session Lifecycle — password management hardening of 0581.
--           sys_auth_pwd_history_dtl.created_at defaulted to now(), which is the TRANSACTION start time: two
--           password changes inside one transaction (a batch/admin script, a test) got identical timestamps,
--           so "the most recent N hashes" (fn_auth_pwd_reuse_check) and the 24-row prune in fn_auth_pwd_capture
--           had no defined order. clock_timestamp() is the real wall-clock time of each insert, so the order is
--           always the order in which passwords were replaced.
-- Depends:  0581.
-- Idempotent: re-running changes nothing.
-- Reversal (forward-only):
--   ALTER TABLE public.sys_auth_pwd_history_dtl ALTER COLUMN created_at SET DEFAULT now();
-- =============================================================================

BEGIN;

-- New rows only; existing rows keep their timestamps.
ALTER TABLE public.sys_auth_pwd_history_dtl
  ALTER COLUMN created_at SET DEFAULT clock_timestamp();

COMMENT ON COLUMN public.sys_auth_pwd_history_dtl.created_at IS
  'Wall-clock time (clock_timestamp) the password was replaced; defines "most recent" for the reuse check and pruning.';

COMMIT;
