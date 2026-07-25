# Migration 0121 Changes

## Issue Found

During migration execution, the following error occurred:

```
ERROR: column "stng_override_reason" of relation "sys_stng_profile_values_dtl" does not exist (SQLSTATE 42703)
```

## Root Cause

The `sys_stng_profile_values_dtl` table was missing the `stng_override_reason` column, which was referenced in the INSERT statements for profile values.

## Fix Applied

Added **Section 2B** to the migration file to create the missing column before inserting profile values:

```sql
-- ================================================================
-- SECTION 2B: ADD MISSING COLUMN TO PROFILE VALUES TABLE
-- ================================================================

-- Add stng_override_reason column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'sys_stng_profile_values_dtl'
    AND column_name = 'stng_override_reason'
  ) THEN
    ALTER TABLE sys_stng_profile_values_dtl
    ADD COLUMN stng_override_reason TEXT;

    RAISE NOTICE '✅ Added stng_override_reason column to sys_stng_profile_values_dtl';
  ELSE
    RAISE NOTICE '✓ stng_override_reason column already exists';
  END IF;
END $$;

-- Add comment to the new column
COMMENT ON COLUMN sys_stng_profile_values_dtl.stng_override_reason IS
'Reason why this profile has a different value than the default. Used for documentation and audit purposes.';
```

## Column Purpose

The `stng_override_reason` column is used to:
- Document why a specific profile has a different value than the default
- Provide audit trail for profile value changes
- Help administrators understand profile configuration decisions

## Impact

- **Schema Change**: Adds new `TEXT` column to `sys_stng_profile_values_dtl` table
- **Backward Compatible**: Column is nullable, so existing rows won't be affected
- **Future-Proof**: The check ensures the column is only added if it doesn't exist
- **All Profile Values**: The column is now available for ALL settings, not just this one

## Migration Status

✅ **Fixed and Ready to Apply**

The migration file has been updated and is now ready to be executed without errors.

## How to Apply

```bash
cd F:/jhapp/cleanmatex

# Option 1: Using Supabase CLI
supabase migration up

# Option 2: Using psql directly
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -f supabase/migrations/0121_add_setting_general_phone_default_country_code.sql
```

## Expected Output

When you run the migration, you should now see:

```
NOTICE: ✅ Prerequisites validated successfully
NOTICE: ✅ Catalog entry created: DEFAULT_PHONE_COUNTRY_CODE
NOTICE: ✅ Added stng_override_reason column to sys_stng_profile_values_dtl
NOTICE: ✅ Profile values created: 4 profiles
NOTICE: ✅ MIGRATION COMPLETED SUCCESSFULLY
...
```

## Rollback Instructions

If you need to rollback this migration:

```sql
-- 1. Delete profile values
DELETE FROM sys_stng_profile_values_dtl
WHERE stng_code = 'DEFAULT_PHONE_COUNTRY_CODE';

-- 2. Delete catalog entry
DELETE FROM sys_tenant_settings_cd
WHERE setting_code = 'DEFAULT_PHONE_COUNTRY_CODE';

-- 3. (Optional) Remove the column if not used elsewhere
-- WARNING: This affects ALL profile values, not just this setting
-- ALTER TABLE sys_stng_profile_values_dtl DROP COLUMN IF EXISTS stng_override_reason;
```

## Related Files

- **Migration File**: [0121_add_setting_general_phone_default_country_code.sql](./0121_add_setting_general_phone_default_country_code.sql)
- **Documentation**: [0121_README.md](./0121_README.md)

---

**Fixed**: 2026-02-28
**Issue**: Missing column `stng_override_reason`
**Resolution**: Added ALTER TABLE to create column before INSERT
**Status**: ✅ Ready to apply
