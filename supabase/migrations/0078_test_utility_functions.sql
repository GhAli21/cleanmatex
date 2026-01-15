-- ==================================================================
-- 0078_test_utility_functions.sql
-- Purpose: Test utility functions for SQL testing
-- Author: CleanMateX Development Team
-- Created: 2026-01-14
-- ==================================================================
-- This migration creates utility functions for testing database functions
-- and validating results in SQL test scripts.
-- ==================================================================

BEGIN;

-- ==================================================================
-- FUNCTION: test_assert
-- Purpose: Assert a condition and raise an exception if false
-- Usage: SELECT test_assert(condition, message);
-- ==================================================================

CREATE OR REPLACE FUNCTION test_assert(
  condition BOOLEAN,
  message TEXT DEFAULT 'Assertion failed'
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT condition THEN
    RAISE EXCEPTION 'ASSERTION_FAILED: %', message;
  END IF;
END;
$$;

COMMENT ON FUNCTION test_assert(BOOLEAN, TEXT) IS 'Assert a condition in SQL tests. Raises exception if condition is false.';

-- ==================================================================
-- FUNCTION: test_assert_jsonb_has_key
-- Purpose: Assert that a JSONB object has a specific key
-- Usage: SELECT test_assert_jsonb_has_key(jsonb_value, 'key', 'message');
-- ==================================================================

CREATE OR REPLACE FUNCTION test_assert_jsonb_has_key(
  jsonb_value JSONB,
  key_name TEXT,
  message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_message TEXT;
BEGIN
  v_message := COALESCE(message, format('JSONB should have key: %s', key_name));
  
  IF NOT (jsonb_value ? key_name) THEN
    RAISE EXCEPTION 'ASSERTION_FAILED: %', v_message;
  END IF;
END;
$$;

COMMENT ON FUNCTION test_assert_jsonb_has_key(JSONB, TEXT, TEXT) IS 'Assert that a JSONB object contains a specific key.';

-- ==================================================================
-- FUNCTION: test_assert_jsonb_equals
-- Purpose: Assert that two JSONB values are equal
-- Usage: SELECT test_assert_jsonb_equals(actual, expected, 'message');
-- ==================================================================

CREATE OR REPLACE FUNCTION test_assert_jsonb_equals(
  actual JSONB,
  expected JSONB,
  message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_message TEXT;
BEGIN
  v_message := COALESCE(message, 'JSONB values should be equal');
  
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'ASSERTION_FAILED: %. Actual: %, Expected: %', 
      v_message, actual, expected;
  END IF;
END;
$$;

COMMENT ON FUNCTION test_assert_jsonb_equals(JSONB, JSONB, TEXT) IS 'Assert that two JSONB values are equal.';

-- ==================================================================
-- FUNCTION: test_assert_not_null
-- Purpose: Assert that a value is not NULL
-- Usage: SELECT test_assert_not_null(value, 'message');
-- ==================================================================

CREATE OR REPLACE FUNCTION test_assert_not_null(
  value ANYELEMENT,
  message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_message TEXT;
BEGIN
  v_message := COALESCE(message, 'Value should not be NULL');
  
  IF value IS NULL THEN
    RAISE EXCEPTION 'ASSERTION_FAILED: %', v_message;
  END IF;
END;
$$;

COMMENT ON FUNCTION test_assert_not_null(ANYELEMENT, TEXT) IS 'Assert that a value is not NULL.';

-- ==================================================================
-- FUNCTION: test_assert_equals
-- Purpose: Assert that two values are equal
-- Usage: SELECT test_assert_equals(actual, expected, 'message');
-- ==================================================================

CREATE OR REPLACE FUNCTION test_assert_equals(
  actual ANYELEMENT,
  expected ANYELEMENT,
  message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_message TEXT;
BEGIN
  v_message := COALESCE(message, 'Values should be equal');
  
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'ASSERTION_FAILED: %. Actual: %, Expected: %', 
      v_message, actual, expected;
  END IF;
END;
$$;

COMMENT ON FUNCTION test_assert_equals(ANYELEMENT, ANYELEMENT, TEXT) IS 'Assert that two values are equal.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION test_assert(BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION test_assert(BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION test_assert_jsonb_has_key(JSONB, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION test_assert_jsonb_has_key(JSONB, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION test_assert_jsonb_equals(JSONB, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION test_assert_jsonb_equals(JSONB, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION test_assert_not_null(ANYELEMENT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION test_assert_not_null(ANYELEMENT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION test_assert_equals(ANYELEMENT, ANYELEMENT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION test_assert_equals(ANYELEMENT, ANYELEMENT, TEXT) TO service_role;

COMMIT;

-- ==================================================================
-- POST-MIGRATION NOTES
-- ==================================================================
-- These functions can be used in SQL test scripts:
--
-- Example 1: Basic assertion
-- SELECT test_assert(
--   cmx_ord_screen_pre_conditions('preparation')->>'statuses' IS NOT NULL,
--   'Screen contract should return statuses'
-- );
--
-- Example 2: JSONB key check
-- SELECT test_assert_jsonb_has_key(
--   cmx_ord_screen_pre_conditions('preparation'),
--   'statuses',
--   'Screen contract should have statuses key'
-- );
--
-- Example 3: Value equality
-- SELECT test_assert_equals(
--   jsonb_array_length(cmx_ord_screen_pre_conditions('unknown')->'statuses'),
--   0,
--   'Unknown screen should return empty statuses array'
-- );
-- ==================================================================

