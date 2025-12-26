-- ============================================================================
-- RBAC Migration Repair Script
-- ============================================================================
-- Description: Repair script to clean up remaining ID-based foreign keys
--              that weren't dropped during the initial migration
-- Author: Claude Code
-- Date: 2025-12-12
-- Purpose: Run this if migration was partially applied
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Drop All Remaining ID-Based Foreign Keys
-- ============================================================================

DO $$
DECLARE
  fk_record RECORD;
  dropped_count INTEGER := 0;
BEGIN
  -- Find and drop all foreign keys matching TEST 3 pattern exactly
  -- Only check public schema, exclude auth schema (Supabase system tables)
  FOR fk_record IN
    SELECT 
      table_schema,
      table_name,
      constraint_name
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%_id_fkey'
      AND table_schema = 'public'
      AND table_name LIKE '%auth%'
    ORDER BY table_name, constraint_name
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I CASCADE',
        fk_record.table_schema,
        fk_record.table_name,
        fk_record.constraint_name
      );
      dropped_count := dropped_count + 1;
      RAISE NOTICE '✓ Dropped FK: %.% (%)', fk_record.table_schema, fk_record.table_name, fk_record.constraint_name;
    EXCEPTION
      WHEN undefined_object THEN
        -- Already dropped, skip
        NULL;
      WHEN OTHERS THEN
        RAISE WARNING '✗ Failed to drop FK %.% (%): %', 
          fk_record.table_schema, fk_record.table_name, fk_record.constraint_name, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Repair complete: Dropped % remaining ID-based foreign key constraints', dropped_count;
END $$;

-- ============================================================================
-- STEP 2: Verify No Remaining ID-Based FKs
-- ============================================================================

DO $$
DECLARE
  remaining_fk_count INTEGER;
BEGIN
  -- Use same query as TEST 3
  -- Only check public schema, exclude auth schema (Supabase system tables)
  SELECT COUNT(*) INTO remaining_fk_count
  FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%_id_fkey'
    AND table_schema = 'public'
    AND table_name LIKE '%auth%';

  IF remaining_fk_count > 0 THEN
    RAISE WARNING '⚠️ Still found % remaining ID-based foreign keys. Manual cleanup may be required.', remaining_fk_count;
  ELSE
    RAISE NOTICE '✅ Verification passed: No remaining ID-based foreign keys found';
  END IF;
END $$;

COMMIT;

