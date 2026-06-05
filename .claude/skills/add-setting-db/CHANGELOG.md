# Changelog: `/add-setting-db` Skill

## [3.0.0] - 2026-03-12

### 🚨 Critical Fixes & Major Enhancements

This release fixes critical bugs discovered during real-world usage and adds essential safeguards for production migrations.

**Breaking Changes**:
- ✅ Fixed incorrect column names in all templates
- ✅ Migration templates now idempotent by default

**New Features**:
- ✅ Schema detection workflow (Step 1.5)
- ✅ Comprehensive troubleshooting section
- ✅ Enhanced best practices (10 categories)
- ✅ Flexible migration verification

See [Version 3.0.0 Details](#version-300-details) below for full changelog.

---

## [2.0.0] - 2026-02-28

### 🎉 Major Enhancement: Migration File Generation

The `/add-setting-db` skill now automatically generates production-ready migration files instead of requiring manual SQL execution.

---

## What's New

### ✨ Migration File Generation

**Old Workflow** (v1.0.0):
```
1. Gather requirements
2. Validate prerequisites
3. Manually execute SQL in database
4. Manually verify insertion
5. Manually document what was done
```

**New Workflow** (v2.0.0):
```
1. Gather requirements
2. Validate prerequisites
3. Generate complete migration file ← NEW!
4. Save to supabase/migrations/ ← NEW!
5. Commit to git ← NEW!
6. Apply migration: supabase migration up ← NEW!
```

---

## Key Features

### 📄 Complete Migration Files

Generated migration files include:

#### Section 1: Validation
- Pre-flight checks for prerequisites
- Setting existence check
- Category validation
- Profile validation
- Feature flag validation

#### Section 2: Catalog Entry
- Main setting definition
- All metadata (bilingual)
- Behavior flags
- Validation rules
- UI hints

#### Section 3: Profile Values (Optional)
- Regional/segment defaults
- Override reasons
- Multiple profile support

#### Section 4: Feature Flags (Optional)
- Feature flag creation
- Dependency configuration
- Plan binding setup

#### Section 5: Plan Mappings (Optional)
- Plan-specific values
- Plan enablement flags
- Limit configuration

#### Section 6: Verification
- Post-insert validation
- Component counting
- Success/failure reporting
- Detailed migration summary

#### Section 7: Rollback
- Commented-out rollback SQL
- Reverse operation instructions
- Verification queries

---

## Migration File Example

### File Naming Convention

```
XXXX_add_setting_{setting_code_sanitized}.sql

Examples:
- 0088_add_setting_workflow_orders_max_concurrent.sql
- 0089_add_setting_finance_invoicing_auto_send.sql
- 0090_add_setting_security_auth_session_timeout.sql
```

### Auto-Detected Migration Number

The skill automatically detects the next migration number by:
1. Listing all files in `F:/jhapp/cleanmatex/supabase/migrations/`
2. Finding the highest numbered migration
3. Incrementing by 1

Example:
```bash
# Latest migration: 0087_some_migration.sql
# Next migration: 0088_add_setting_*.sql
```

---

## Benefits

### ✅ Version Control
- ✅ Migration files tracked in git
- ✅ Full change history
- ✅ Easy to review in PRs
- ✅ Rollback documented

### ✅ Deployment Safety
- ✅ Transactional execution
- ✅ Validation before insert
- ✅ Verification after insert
- ✅ Clear error messages

### ✅ Team Collaboration
- ✅ No manual SQL copy-paste
- ✅ Consistent format
- ✅ Self-documenting
- ✅ Shareable via git

### ✅ Environment Consistency
- ✅ Same file for all environments
- ✅ No schema drift
- ✅ Automated deployment
- ✅ Repeatable process

### ✅ Auditability
- ✅ Clear audit trail
- ✅ Chronological order
- ✅ Git blame shows creator
- ✅ Business purpose documented

---

## Usage Changes

### Before (v1.0.0)

```bash
# Run skill
/add-setting-db

# Skill would output SQL snippets
# Developer would copy-paste and execute manually in DB
# No version control
# No rollback plan
# Hard to track changes
```

### After (v2.0.0)

```bash
# Run skill
/add-setting-db

# Skill generates migration file
# File saved to: F:/jhapp/cleanmatex/supabase/migrations/

# Apply migration
cd F:/jhapp/cleanmatex
supabase migration up

# Commit to git
git add supabase/migrations/0088_*.sql
git commit -m "feat(settings): Add new setting"
git push
```

---

## Migration File Structure

```sql
-- ================================================================
-- Migration: Add Setting - {SETTING_CODE}
-- ================================================================
-- Purpose: {DESCRIPTION}
-- Created: {DATE}
-- Created by: {USER}
--
-- Components:
--   [X] Catalog Entry
--   [X] Profile Values (if applicable)
--   [ ] Feature Flags (if applicable)
--   [ ] Plan Mappings (if applicable)
-- ================================================================

-- SECTION 1: VALIDATION
-- (Pre-flight checks)

-- SECTION 2: CATALOG ENTRY
-- (Main setting definition)

-- SECTION 3: PROFILE VALUES
-- (Optional - regional defaults)

-- SECTION 4: FEATURE FLAGS
-- (Optional - conditional features)

-- SECTION 5: PLAN MAPPINGS
-- (Optional - plan-specific limits)

-- SECTION 6: VERIFICATION
-- (Post-insert validation)
-- (Success/failure reporting)

-- SECTION 7: ROLLBACK
-- (Commented rollback instructions)

-- ================================================================
-- END OF MIGRATION
-- ================================================================
```

---

## Documentation Updates

### Updated Files

1. **skill.md** (Enhanced)
   - Added Step 9: Generate Migration File
   - Added migration file template
   - Added migration generation workflow
   - Added complete example migration
   - Updated metadata to v2.0.0

2. **QUICK_START.md** (Enhanced)
   - Added migration file generation intro
   - Updated workflow steps
   - Updated success indicators
   - Added migration file verification steps
   - Added git commit instructions
   - Added benefits of migration approach

3. **CHANGELOG.md** (New)
   - Complete changelog
   - Migration examples
   - Before/after comparison
   - Benefits documentation

---

## Backward Compatibility

The v1.0.0 workflow (manual SQL execution) is still documented in `skill.md` for reference, but the default and recommended approach is now migration file generation (v2.0.0).

---

## Next Steps After Using This Skill

1. **Review Generated Migration**
   ```bash
   cat F:/jhapp/cleanmatex/supabase/migrations/0088_*.sql
   ```

2. **Apply Migration Locally**
   ```bash
   cd F:/jhapp/cleanmatex
   supabase migration up
   ```

3. **Test Resolution**
   ```sql
   SELECT * FROM fn_stng_resolve_all_settings(
     p_tenant_id := 'test-tenant-id'
   ) WHERE setting_code = 'your.setting.code';
   ```

4. **Commit to Git**
   ```bash
   git add supabase/migrations/0088_*.sql
   git commit -m "feat(settings): Add new setting"
   ```

5. **Deploy to Staging**
   ```bash
   # Via CI/CD or manual deployment
   supabase db push --project-ref staging-ref
   ```

6. **Deploy to Production**
   ```bash
   # Via CI/CD or manual deployment
   supabase db push --project-ref prod-ref
   ```

---

## Migration File Best Practices

### ✅ DO

- ✅ Review generated file before committing
- ✅ Test migration locally first
- ✅ Include descriptive purpose in header
- ✅ Commit migration file to git
- ✅ Apply migrations in order (don't skip)
- ✅ Test rollback in non-production first
- ✅ Document any manual steps needed

### ❌ DON'T

- ❌ Manually edit generated migration files (unless fixing bugs)
- ❌ Skip validation sections
- ❌ Remove verification sections
- ❌ Apply migrations out of order
- ❌ Execute rollback in production without testing
- ❌ Commit broken migrations

---

## Troubleshooting

### Issue: Migration Number Already Exists

**Problem**: Generated migration number conflicts with existing file

**Solution**:
```bash
# Manually check latest migration
ls -1 F:/jhapp/cleanmatex/supabase/migrations/ | tail -5

# Skill should auto-detect, but if conflict:
# Rename generated file with next available number
```

### Issue: Migration Fails on Validation

**Problem**: Prerequisite validation fails

**Solution**:
```sql
-- Check what's missing
SELECT * FROM sys_stng_categories_cd WHERE stng_category_code = 'YOUR_CATEGORY';
SELECT * FROM sys_stng_profiles_mst WHERE stng_profile_code = 'YOUR_PROFILE';

-- Fix by creating missing prerequisites first
-- Or adjust migration to use existing values
```

### Issue: Rollback Needed

**Problem**: Need to undo migration

**Solution**:
```sql
-- Copy rollback section from migration file
-- Execute manually in database
-- Or create down migration:
-- XXXX_rollback_add_setting_*.sql
```

---

## Related Documentation

- [Settings Architecture](../../docs/dev/settings/architecture.md)
- [7-Layer Resolution System](../../docs/dev/settings/resolution.md)
- [Feature Flags Integration](../../docs/dev/settings/feature-flags.md)
- [Supabase Migrations Guide](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [Database Conventions](../../.claude/docs/database_conventions.md)

---

## Skill Metadata

**Current Version**: 2.0.0
**Previous Version**: 1.0.0
**Last Updated**: 2026-02-28
**Maintained by**: CleanMateX Platform Team
**Support**: GitHub issues or contact platform team

---

## Contributors

- **Version 2.0.0**: Added migration file generation capability
- **Version 1.0.0**: Initial direct database insertion workflow

---

**🎉 Enjoy the enhanced workflow!**

---

---

## Version 3.0.0 Details

### 🚨 Critical Bug Fixes

#### Bug #1: Column Name Errors
**Issue**: Migration files failed with:
```
ERROR: column "stng_name" of relation "sys_tenant_settings_cd" does not exist
```

**Root Cause**: Templates used assumed column names instead of actual schema names

**Fix**:
- Changed `stng_name` → `setting_name`
- Changed `stng_name2` → `setting_name2`
- Changed `stng_description` → `setting_desc`
- Changed `stng_description2` → `setting_desc2`

**Impact**: All migration templates now use correct column names

---

#### Bug #2: Non-Idempotent Migrations
**Issue**: Re-running migrations failed with:
```
ERROR: One or more service preference settings already exist (SQLSTATE P0001)
```

**Root Cause**: Migrations threw EXCEPTION when settings existed

**Fix**:
- Changed validation from EXCEPTION to NOTICE
- Added `ON CONFLICT DO NOTHING` to all INSERTs
- Made verification flexible (warn if partial, fail only if none)

**Impact**: Migrations now safe to run multiple times

---

### 🎯 New Features

#### Feature #1: Schema Detection (Step 1.5)
**Purpose**: Prevent column name errors by detecting actual schema

**How it works**:
```sql
-- Query to get actual column names
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'sys_tenant_settings_cd'
ORDER BY ordinal_position;
```

**Benefits**:
- Prevents column name errors
- Works even if schema changes
- Self-documenting

---

#### Feature #2: Comprehensive Troubleshooting
**Purpose**: Help users fix common errors without support

**Coverage**: 6 common errors
1. Column does not exist
2. Setting already exists
3. Duplicate key violation
4. Invalid JSONB
5. Foreign key violation
6. Setting not resolving

**Each error includes**:
- Exact error message
- Root cause explanation
- Step-by-step solution
- Prevention strategy

---

#### Feature #3: Enhanced Best Practices
**Purpose**: Provide clear guidelines for all aspects

**10 Categories**:
1. Schema Detection (CRITICAL)
2. Migration Idempotency (CRITICAL)
3. Prerequisites Validation
4. JSONB Formatting
5. Naming Conventions
6. Bilingual Support
7. Testing & Verification
8. Documentation
9. Profile Values
10. Migration Files

**Each category includes**:
- ✅ DO examples
- ❌ DON'T examples
- Explanations

---

### 🔧 Technical Changes

#### Migration Template Updates

**Validation Section**:
```sql
-- Before v3.0.0
IF EXISTS (...) THEN
  RAISE EXCEPTION 'Setting already exists';
END IF;

-- After v3.0.0
DECLARE
  v_existing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_existing_count...
  IF v_existing_count > 0 THEN
    RAISE NOTICE '⚠️ % settings exist - will skip';
  END IF;
```

**Catalog Insert**:
```sql
-- Before v3.0.0
INSERT INTO sys_tenant_settings_cd (
  stng_name,           -- ❌ WRONG
  stng_name2,          -- ❌ WRONG
  stng_description,    -- ❌ WRONG
  stng_description2    -- ❌ WRONG
) VALUES (...);

-- After v3.0.0
INSERT INTO sys_tenant_settings_cd (
  setting_name,        -- ✅ CORRECT
  setting_name2,       -- ✅ CORRECT
  setting_desc,        -- ✅ CORRECT
  setting_desc2        -- ✅ CORRECT
) VALUES (...)
ON CONFLICT (setting_code) DO NOTHING;
```

**Verification Logic**:
```sql
-- Before v3.0.0 (strict)
IF v_row_count != 8 THEN
  RAISE EXCEPTION 'Expected 8, got %';
END IF;

-- After v3.0.0 (flexible)
IF v_row_count = 0 THEN
  RAISE EXCEPTION 'None inserted';
ELSIF v_row_count < 8 THEN
  RAISE NOTICE '⚠️ Partial: some existed';
ELSE
  RAISE NOTICE '✅ All verified';
END IF;
```

---

### 📚 Documentation Updates

#### Updated Files
1. **skill.md** (Major update)
   - Added Step 1.5: Schema Detection
   - Added Common Errors & Troubleshooting section
   - Enhanced Best Practices to 10 categories
   - Updated all migration templates
   - Fixed all column name references

2. **CHANGELOG.md** (This file)
   - Added v3.0.0 section
   - Documented all bug fixes
   - Documented all new features
   - Added migration guide

3. **skill.md metadata**
   - Version: 2.0.0 → 3.0.0
   - Last Updated: 2026-02-28 → 2026-03-12
   - Enhanced changelog section

---

### 📊 Impact Comparison

| Aspect | v2.0.0 | v3.0.0 |
|--------|--------|--------|
| **Column Names** | ❌ Wrong | ✅ Correct |
| **Idempotency** | ❌ No | ✅ Yes |
| **Schema Detection** | ❌ No | ✅ Yes |
| **Troubleshooting** | ⚠️ Basic | ✅ Comprehensive |
| **Error Prevention** | ⚠️ Limited | ✅ Extensive |
| **Production Ready** | ⚠️ Issues | ✅ Tested |

---

### 🎓 Lessons Learned

This version addresses real issues from migration `0143_add_service_preferences_settings.sql`:

1. **Never assume column names** - Always detect from schema
2. **Always make migrations idempotent** - Safe to re-run
3. **Provide troubleshooting** - Users can self-solve
4. **Flexible validation** - Partial success is OK
5. **Test with real data** - Catches issues early

---

### 🚀 Upgrade Guide

#### If You Have Existing Migrations (v2.0.0)

**Step 1: Fix Column Names**
```bash
# In your migration file, replace:
stng_name → setting_name
stng_name2 → setting_name2
stng_description → setting_desc
stng_description2 → setting_desc2
```

**Step 2: Add Idempotency**
```sql
-- After VALUES (...), add:
ON CONFLICT (setting_code) DO NOTHING;
```

**Step 3: Update Validation**
```sql
-- Change from:
IF EXISTS (...) THEN
  RAISE EXCEPTION 'exists';
END IF;

-- To:
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count...
  IF v_count > 0 THEN
    RAISE NOTICE '⚠️ exists';
  END IF;
```

**Step 4: Test Migration**
```bash
cd F:/jhapp/cleanmatex
supabase migration up
```

#### For New Migrations
Just use `/add-setting-db` - templates are already fixed!

---

### ✅ Verification Checklist

Before considering v3.0.0 complete:
- ✅ All templates use correct column names
- ✅ All INSERTs have ON CONFLICT
- ✅ All validations use NOTICE not EXCEPTION
- ✅ Schema detection documented
- ✅ Troubleshooting section complete
- ✅ Best practices enhanced
- ✅ Migration guide provided
- ✅ Tested with real migration

---

## Version Comparison Table

| Feature | v1.0.0 | v2.0.0 | v3.0.0 |
|---------|--------|--------|--------|
| **Direct SQL** | ✅ Manual | ✅ Manual | ✅ Manual |
| **Migration Files** | ❌ | ✅ Generated | ✅ Generated |
| **Column Names** | ❌ Unknown | ❌ Wrong | ✅ Correct |
| **Idempotent** | ❌ | ❌ | ✅ |
| **Schema Detection** | ❌ | ❌ | ✅ |
| **Troubleshooting** | ⚠️ Basic | ⚠️ Basic | ✅ Comprehensive |
| **Best Practices** | ✅ 10 items | ✅ 10 items | ✅ 10 categories |
| **Production Ready** | ⚠️ Issues | ⚠️ Issues | ✅ Yes |

---

**Skill Version**: 3.0.0
**Last Updated**: 2026-03-12
**Maintained by**: CleanMateX Platform Team
