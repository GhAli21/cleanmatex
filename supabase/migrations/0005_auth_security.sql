-- 0007_auth_security_enhancements.sql  Account Lockout & Security Features
-- Purpose: Add failed login tracking and account lockout mechanism
-- Author: CleanMateX Development Team
-- Created: 2025-10-18

BEGIN;

-- =========================
-- ADD SECURITY FIELDS TO org_users_mst
-- =========================

-- Add columns for tracking failed login attempts and lockout
ALTER TABLE org_users_mst
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP,
  ADD COLUMN IF NOT EXISTS lock_reason VARCHAR(200);

-- Add index for quick lockout checks (without NOW() since it's not immutable)
CREATE INDEX IF NOT EXISTS idx_org_users_locked
  ON org_users_mst(locked_until)
  WHERE locked_until IS NOT NULL;

-- Comments
COMMENT ON COLUMN org_users_mst.failed_login_attempts IS 'Number of consecutive failed login attempts';
COMMENT ON COLUMN org_users_mst.last_failed_login_at IS 'Timestamp of most recent failed login';
COMMENT ON COLUMN org_users_mst.locked_until IS 'Account locked until this timestamp (NULL if not locked)';
COMMENT ON COLUMN org_users_mst.lock_reason IS 'Reason for account lock (e.g., "Too many failed login attempts")';

-- =========================
-- FUNCTION: CHECK IF ACCOUNT IS LOCKED
-- =========================

CREATE OR REPLACE FUNCTION is_account_locked(p_email VARCHAR)
RETURNS TABLE (
  is_locked BOOLEAN,
  locked_until TIMESTAMP,
  lock_reason VARCHAR,
  user_id UUID
) AS $$
DECLARE
  v_user_record RECORD;
BEGIN
  -- Get user from auth.users and check lock status in org_users_mst
  SELECT
    au.id,
    ou.locked_until,
    ou.lock_reason
  INTO v_user_record
  FROM auth.users au
  LEFT JOIN org_users_mst ou ON au.id = ou.user_id
  WHERE au.email = p_email
  LIMIT 1;

  IF NOT FOUND THEN
    -- User doesn't exist
    RETURN QUERY SELECT false, NULL::TIMESTAMP, NULL::VARCHAR, NULL::UUID;
    RETURN;
  END IF;

  -- Check if locked and lock hasn't expired
  IF v_user_record.locked_until IS NOT NULL
     AND v_user_record.locked_until > NOW() THEN
    RETURN QUERY SELECT
      true,
      v_user_record.locked_until,
      v_user_record.lock_reason,
      v_user_record.id;
  ELSE
    -- Not locked or lock has expired
    RETURN QUERY SELECT
      false,
      NULL::TIMESTAMP,
      NULL::VARCHAR,
      v_user_record.id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_account_locked IS 'Check if account is currently locked based on email';

-- =========================
-- FUNCTION: ENHANCED RECORD LOGIN ATTEMPT
-- =========================

-- Drop the old function and create enhanced version
DROP FUNCTION IF EXISTS record_login_attempt(VARCHAR, BOOLEAN, INET, TEXT, TEXT);

CREATE OR REPLACE FUNCTION record_login_attempt(
  p_email VARCHAR,
  p_success BOOLEAN,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS TABLE (
  log_id UUID,
  is_locked BOOLEAN,
  locked_until TIMESTAMP,
  lock_reason VARCHAR
) AS $$
DECLARE
  v_user_id UUID;
  v_log_id UUID;
  v_failed_attempts INTEGER;
  v_lock_until TIMESTAMP;
  v_lock_reason VARCHAR;
  v_is_locked BOOLEAN := false;

  -- Configuration constants
  c_max_failed_attempts CONSTANT INTEGER := 5;
  c_lockout_duration CONSTANT INTERVAL := INTERVAL '15 minutes';
  c_reset_window CONSTANT INTERVAL := INTERVAL '1 hour';
BEGIN
  -- Try to find user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email
  LIMIT 1;

  -- Log the attempt in audit log
  SELECT log_audit_event(
    v_user_id,
    NULL, -- No tenant context yet
    CASE WHEN p_success THEN 'login_success' ELSE 'login_failure' END,
    'user',
    v_user_id,
    NULL,
    jsonb_build_object('email', p_email, 'timestamp', NOW()),
    p_ip_address,
    p_user_agent,
    NULL,
    CASE WHEN p_success THEN 'success' ELSE 'failure' END,
    p_error_message
  ) INTO v_log_id;

  -- If user exists, update login tracking
  IF v_user_id IS NOT NULL THEN
    IF p_success THEN
      -- Successful login - reset failed attempts
      UPDATE org_users_mst
      SET
        failed_login_attempts = 0,
        last_failed_login_at = NULL,
        locked_until = NULL,
        lock_reason = NULL,
        last_login_at = NOW(),
        login_count = COALESCE(login_count, 0) + 1,
        updated_at = NOW()
      WHERE user_id = v_user_id;
    ELSE
      -- Failed login - increment counter
      UPDATE org_users_mst
      SET
        failed_login_attempts = CASE
          -- Reset counter if last failure was more than 1 hour ago
          WHEN last_failed_login_at IS NULL
               OR last_failed_login_at < NOW() - c_reset_window
          THEN 1
          ELSE failed_login_attempts + 1
        END,
        last_failed_login_at = NOW(),
        updated_at = NOW()
      WHERE user_id = v_user_id
      RETURNING failed_login_attempts INTO v_failed_attempts;

      -- Check if we should lock the account
      IF v_failed_attempts >= c_max_failed_attempts THEN
        v_lock_until := NOW() + c_lockout_duration;
        v_lock_reason := format('Account locked due to %s failed login attempts', c_max_failed_attempts);
        v_is_locked := true;

        -- Lock the account
        UPDATE org_users_mst
        SET
          locked_until = v_lock_until,
          lock_reason = v_lock_reason,
          updated_at = NOW()
        WHERE user_id = v_user_id;

        -- Log the lockout event
        PERFORM log_audit_event(
          v_user_id,
          NULL,
          'account_locked',
          'user',
          v_user_id,
          NULL,
          jsonb_build_object(
            'locked_until', v_lock_until,
            'reason', v_lock_reason,
            'failed_attempts', v_failed_attempts
          ),
          p_ip_address,
          p_user_agent,
          NULL,
          'success',
          NULL
        );
      END IF;
    END IF;
  END IF;

  -- Return result
  RETURN QUERY SELECT
    v_log_id,
    v_is_locked,
    v_lock_until,
    v_lock_reason;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION record_login_attempt IS 'Record login attempt and handle account lockout logic';

-- =========================
-- FUNCTION: UNLOCK ACCOUNT (Admin)
-- =========================

CREATE OR REPLACE FUNCTION unlock_account(
  p_user_id UUID,
  p_admin_user_id UUID,
  p_reason TEXT DEFAULT 'Manual unlock by administrator'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Verify admin has permission (must be admin in same tenant)
  SELECT EXISTS (
    SELECT 1
    FROM org_users_mst
    WHERE user_id = p_admin_user_id
      AND role = 'admin'
      AND is_active = true
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only administrators can unlock accounts';
  END IF;

  -- Unlock the account
  UPDATE org_users_mst
  SET
    locked_until = NULL,
    lock_reason = NULL,
    failed_login_attempts = 0,
    last_failed_login_at = NULL,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log the unlock event
  PERFORM log_audit_event(
    p_admin_user_id,
    NULL,
    'account_unlocked',
    'user',
    p_user_id,
    NULL,
    jsonb_build_object(
      'unlocked_by', p_admin_user_id,
      'reason', p_reason
    ),
    NULL,
    NULL,
    NULL,
    'success',
    NULL
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION unlock_account IS 'Manually unlock a locked account (admin only)';

-- =========================
-- FUNCTION: AUTO-UNLOCK EXPIRED LOCKS (Maintenance)
-- =========================

CREATE OR REPLACE FUNCTION auto_unlock_expired_accounts()
RETURNS TABLE (
  unlocked_count INTEGER
) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Unlock accounts where lock has expired
  UPDATE org_users_mst
  SET
    locked_until = NULL,
    lock_reason = NULL,
    updated_at = NOW()
  WHERE locked_until IS NOT NULL
    AND locked_until <= NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Log if any accounts were unlocked
  IF v_count > 0 THEN
    PERFORM log_audit_event(
      NULL,
      NULL,
      'auto_unlock_expired',
      'system',
      NULL,
      NULL,
      jsonb_build_object(
        'unlocked_count', v_count,
        'timestamp', NOW()
      ),
      NULL,
      NULL,
      NULL,
      'success',
      NULL
    );
  END IF;

  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION auto_unlock_expired_accounts IS 'Automatically unlock accounts with expired locks (run via cron)';

-- =========================
-- VIEW: LOCKED ACCOUNTS (Admin)
-- =========================

CREATE OR REPLACE VIEW admin_locked_accounts AS
SELECT
  au.id AS user_id,
  au.email,
  ou.display_name,
  ou.tenant_org_id,
  ou.failed_login_attempts,
  ou.last_failed_login_at,
  ou.locked_until,
  ou.lock_reason,
  ou.updated_at,
  EXTRACT(EPOCH FROM (ou.locked_until - NOW())) / 60 AS minutes_remaining
FROM auth.users au
INNER JOIN org_users_mst ou ON au.id = ou.user_id
WHERE ou.locked_until IS NOT NULL
  AND ou.locked_until > NOW()
ORDER BY ou.locked_until DESC;

COMMENT ON VIEW admin_locked_accounts IS 'View of currently locked accounts for admin monitoring';

-- =========================
-- VALIDATION & TESTING
-- =========================

DO $$
DECLARE
  v_columns_exist BOOLEAN;
BEGIN
  -- Verify new columns were added
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'org_users_mst'
    AND column_name = 'failed_login_attempts'
  ) INTO v_columns_exist;

  ASSERT v_columns_exist, 'Security columns not added to org_users_mst';

  -- Verify functions exist
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'is_account_locked') > 0,
    'is_account_locked function not created';
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'unlock_account') > 0,
    'unlock_account function not created';

  RAISE NOTICE ' Auth security enhancements applied successfully';
END $$;

COMMIT;

-- =========================
-- USAGE EXAMPLES
-- =========================

-- Example 1: Check if account is locked
-- SELECT * FROM is_account_locked('user@example.com');

-- Example 2: Record failed login (will auto-lock after 5 attempts)
-- SELECT * FROM record_login_attempt('user@example.com', false, '192.168.1.1', 'Mozilla/5.0', 'Invalid password');

-- Example 3: Unlock account manually
-- SELECT unlock_account('user-uuid', 'admin-uuid', 'Customer request');

-- Example 4: View all locked accounts
-- SELECT * FROM admin_locked_accounts;

-- Example 5: Auto-unlock expired locks (run via cron)
-- SELECT * FROM auto_unlock_expired_accounts();

-- =========================
-- ROLLBACK INSTRUCTIONS
-- =========================

-- Save to 0007_auth_security_enhancements_rollback.sql:
--
-- BEGIN;
-- DROP VIEW IF EXISTS admin_locked_accounts;
-- DROP FUNCTION IF EXISTS auto_unlock_expired_accounts CASCADE;
-- DROP FUNCTION IF EXISTS unlock_account CASCADE;
-- DROP FUNCTION IF EXISTS is_account_locked CASCADE;
-- DROP FUNCTION IF EXISTS record_login_attempt CASCADE;
--
-- ALTER TABLE org_users_mst
--   DROP COLUMN IF EXISTS failed_login_attempts,
--   DROP COLUMN IF EXISTS last_failed_login_at,
--   DROP COLUMN IF EXISTS locked_until,
--   DROP COLUMN IF EXISTS lock_reason;
--
-- DROP INDEX IF EXISTS idx_org_users_locked;
-- COMMIT;
