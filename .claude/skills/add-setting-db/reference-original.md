# Skill: add-setting-db

**Purpose**: Add a new setting to the CleanMateX settings system via direct database insertion.

**Version**: 2.0.0

**Author**: CleanMateX Platform Team

**Last Updated**: 2026-03-12

---

## Overview

This skill guides you through creating a new setting by directly inserting into the database tables:
- `sys_tenant_settings_cd` - Settings catalog (REQUIRED)
- `sys_stng_profile_values_dtl` - Profile-specific values (OPTIONAL)
- `hq_ff_feature_flags_mst` - Feature flags (if dependencies needed)
- `sys_ff_pln_flag_mappings_dtl` - Plan-flag mappings (if plan-bound)

The skill ensures:
✅ Proper data validation before insertion
✅ Correct JSONB formatting
✅ Foreign key constraint validation
✅ Audit field population
✅ Verification after insertion
✅ **Migration file generation** (NEW!)

## Output

After gathering requirements and validation, this skill will:
1. **Generate a complete migration file** ready for deployment
2. **Save to**: `F:/jhapp/cleanmatex/supabase/migrations/`
3. **File naming**: `XXXX_add_setting_{setting_code_sanitized}.sql`
4. **Include**: All SQL for catalog, profiles, flags, plans, verification, and rollback

---

## Prerequisites

Before using this skill, ensure:
- [ ] Supabase is running locally (http://localhost:54323)
- [ ] You have database access credentials
- [ ] You understand the 7-layer settings resolution system
- [ ] You have reviewed existing settings to avoid duplicates

---

## Skill Workflow

### Step 1: Gather Requirements 🎯

Ask the user the following questions to gather all necessary information:

**Required Information**:
1. **Setting Code** (format: `SETTING_CODE` in capital letters)
   - Example: `MAX_CONCURRENT_ORDERS`
   - Must be unique, uppercase, snake_case (underscores allowed)

2. **Category Code** (must exist in `sys_stng_categories_cd`)
   - Options: GENERAL, WORKFLOW, FINANCE, RECEIPTS, NOTIFICATIONS, BRANDING, SECURITY, INTEGRATION
   - Or list available: `SELECT stng_category_code, stng_category_name FROM sys_stng_categories_cd;`

3. **Scope** (where the setting applies)
   - Options: SYSTEM, TENANT, BRANCH, USER
   - Most common: TENANT

4. **Data Type**
   - Options: BOOLEAN, TEXT, NUMBER, DATE, JSON, TEXT_ARRAY, NUMBER_ARRAY
   - This determines validation and UI rendering

5. **Default Value**
   - Must match the data type
   - Will be stored as JSONB
   - Examples:
     - NUMBER: `10`
     - BOOLEAN: `true`
     - TEXT: `"default text"`
     - JSON: `{"key": "value"}`
     - TEXT_ARRAY: `["item1", "item2"]`

6. **Validation Rules** (optional but recommended)
   - For NUMBER: `{"min": 1, "max": 100, "step": 5}`
   - For TEXT: `{"minLength": 1, "maxLength": 100, "regex": "^[A-Z]+$"}`
   - For TEXT with options: `{"enum": ["option1", "option2", "option3"]}`
   - For arrays: `{"minItems": 1, "maxItems": 10}`

7. **Behavior Flags**
   - Is Overridable? (Can tenants override this?) - Default: true
   - Is Sensitive? (Mask in UI like passwords?) - Default: false
   - Requires Restart? (Does changing this require app restart?) - Default: false

7b. **Required value and minimum layer** (optional)
   - **stng_is_required** (boolean, default false): When true, the final resolved value must be non-null; resolution fails with `SETTING_REQUIRED_VALUE_MISSING` if no layer has a value.
   - **stng_allows_null** (boolean, default true): When false and required, null is not allowed as the effective value (write validation and resolution enforce this).
   - **stng_required_min_layer** (text, nullable): Preferred layer for override. Allowed values: `SYSTEM_DEFAULT`, `SYSTEM_PROFILE`, `PLAN_CONSTRAINT`, `FEATURE_FLAG`, `TENANT_OVERRIDE`, `BRANCH_OVERRIDE`, `USER_OVERRIDE`. This is a hint only; the resolver may still use a lower layer if no non-null value exists at or above this layer.

8. **Feature Flag Dependencies** (optional)
   - Array of feature flags this setting depends on
   - Example: `["feature.advanced_workflows"]`
   - If flag is disabled, setting reverts to safe default

9. **Display Information** (for UI)
   - Name (English): Clear, user-friendly name
   - Name (Arabic): Arabic translation
   - Description (English): What this setting does
   - Description (Arabic): Arabic description
   - UI Component: `text-input`, `number-input`, `toggle`, `select`, `date-picker`
   - UI Group: Logical grouping for UI (e.g., "Order Processing")
   - Display Order: Sort order in UI (1-100)

10. **Profile Values**
    - ⚠️ **ALWAYS required**: A `GENERAL_MAIN_PROFILE` entry is MANDATORY for every setting (provides global fallback for all tenants).
    - The `GENERAL_MAIN_PROFILE` value **always uses the exact same value as the setting's Default Value** (Step 5) — no need to ask the user separately.
    - Ask: Does the default value differ for any specific region/segment beyond the global default?
    - Examples of additional profile overrides:
      - `GCC_MAIN_PROFILE: 10`
      - `GCC_OM_SME: 5`
      - `GCC_OM_ENTERPRISE: 20`

---

### Step 1.5: Detect Table Schema 🔍

**CRITICAL**: Before generating migration SQL, detect the actual column names from the database schema.

**Why**: The `sys_tenant_settings_cd` table uses different column names than expected:
- ✅ Actual: `setting_name`, `setting_name2`, `setting_desc`, `setting_desc2`
- ❌ Wrong: `stng_name`, `stng_name2`, `stng_description`, `stng_description2`

**Auto-Detection Query**:
```sql
-- Get actual column names for sys_tenant_settings_cd
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sys_tenant_settings_cd'
ORDER BY ordinal_position;
```

**Or check existing migrations**:
```bash
# Find an existing migration with INSERT into sys_tenant_settings_cd
cd F:/jhapp/cleanmatex/supabase/migrations
grep -A 20 "INSERT INTO sys_tenant_settings_cd" 0124_*.sql | head -30
```

**Expected Column Names** (validate these before generating SQL):
- ✅ `setting_code` (PRIMARY KEY)
- ✅ `stng_category_code`
- ✅ `stng_scope`
- ✅ `stng_data_type`
- ✅ `stng_default_value_jsonb`
- ✅ `stng_validation_jsonb`
- ✅ `stng_is_overridable`
- ✅ `stng_is_sensitive`
- ✅ `stng_requires_restart`
- ✅ `stng_is_required`
- ✅ `stng_allows_null`
- ✅ `stng_required_min_layer`
- ✅ `stng_depends_on_flags`
- ✅ `setting_name` ← **NOT** `stng_name`
- ✅ `setting_name2` ← **NOT** `stng_name2`
- ✅ `setting_desc` ← **NOT** `stng_description`
- ✅ `setting_desc2` ← **NOT** `stng_description2`
- ✅ `stng_ui_component`
- ✅ `stng_ui_group`
- ✅ `stng_display_order`
- ✅ `created_at`
- ✅ `created_by`
- ✅ `created_info`
- ✅ `rec_status`
- ✅ `is_active`

**Action**: Use these EXACT column names in all generated SQL.

---

### Step 2: Validate Prerequisites ✅

Run these validation queries before inserting:

```sql
-- Check if setting already exists (MUST BE UNIQUE)
SELECT setting_code, stng_name, stng_category_code
FROM sys_tenant_settings_cd
WHERE setting_code = '<SETTING_CODE>';
-- Expected: No rows (if setting doesn't exist)

-- Check if category exists (MUST EXIST)
SELECT stng_category_code, stng_category_name
FROM sys_stng_categories_cd
WHERE stng_category_code = '<CATEGORY_CODE>';
-- Expected: 1 row with category details

-- Check GENERAL_MAIN_PROFILE exists (mandatory for ALL settings)
SELECT stng_profile_code, stng_profile_name
FROM sys_stng_profiles_mst
WHERE stng_profile_code = 'GENERAL_MAIN_PROFILE';
-- Expected: 1 row — STOP if missing, report to user

-- Check if additional profiles exist (if extra profile values will be added)
SELECT stng_profile_code, stng_profile_name
FROM sys_stng_profiles_mst
WHERE stng_profile_code IN ('<PROFILE1>', '<PROFILE2>', '<PROFILE3>');
-- Expected: Rows for each profile

-- Check if feature flags exist (if dependencies specified)
SELECT flag_key, flag_name
FROM hq_ff_feature_flags_mst
WHERE flag_key IN ('<FLAG1>', '<FLAG2>');
-- Expected: Rows for each flag
```

**Decision Logic**:
- ❌ If setting exists → STOP and ask user if they want to update instead
- ❌ If category doesn't exist → STOP and offer to create category first
- ❌ If GENERAL_MAIN_PROFILE doesn't exist → STOP and report to user (critical prerequisite)
- ❌ If additional profiles don't exist → STOP and list available profiles
- ❌ If feature flags don't exist → WARN and suggest creating flags first or removing dependency

---

### Step 3: Insert Catalog Entry 📝

Use this SQL template to insert the setting:

```sql
-- ================================================================
-- ADD SETTING: <SETTING_CODE>
-- Purpose: <BRIEF_PURPOSE>
-- Created: <DATE>
-- Created by: <USER>
-- ================================================================

-- STEP 1: VALIDATE (wrap in transaction for safety)
BEGIN;

-- Check prerequisites
DO $$
BEGIN
  -- Check if setting exists
  IF EXISTS (
    SELECT 1 FROM sys_tenant_settings_cd
    WHERE setting_code = '<SETTING_CODE>'
  ) THEN
    RAISE EXCEPTION 'Setting already exists: <SETTING_CODE>';
  END IF;

  -- Check if category exists
  IF NOT EXISTS (
    SELECT 1 FROM sys_stng_categories_cd
    WHERE stng_category_code = '<CATEGORY_CODE>'
  ) THEN
    RAISE EXCEPTION 'Category does not exist: <CATEGORY_CODE>';
  END IF;

  RAISE NOTICE '✓ Prerequisites validated successfully';
END $$;

-- STEP 2: INSERT CATALOG ENTRY
-- ⚠️ CRITICAL: Use correct column names (setting_name NOT stng_name)
INSERT INTO sys_tenant_settings_cd (
  -- Primary Key
  setting_code,

  -- Classification
  stng_category_code,
  stng_scope,
  stng_data_type,

  -- Default Value & Validation (JSONB!)
  stng_default_value_jsonb,
  stng_validation_jsonb,

  -- Behavior Flags
  stng_is_overridable,
  stng_is_sensitive,
  stng_requires_restart,

  -- Required & Minimum Layer
  stng_is_required,
  stng_allows_null,
  stng_required_min_layer,

  -- Dependencies (JSONB array or NULL)
  stng_depends_on_flags,

  -- Metadata (Bilingual) - ⚠️ CORRECT COLUMN NAMES
  setting_name,        -- ✅ NOT stng_name
  setting_name2,       -- ✅ NOT stng_name2
  setting_desc,        -- ✅ NOT stng_description
  setting_desc2,       -- ✅ NOT stng_description2

  -- UI Hints
  stng_ui_component,
  stng_ui_group,
  stng_display_order,

  -- Audit Fields (ALWAYS INCLUDE!)
  created_at,
  created_by,
  created_info,
  rec_status,
  is_active
) VALUES (
  -- Primary Key
  '<SETTING_CODE>',

  -- Classification
  '<CATEGORY_CODE>',
  '<SCOPE>',              -- SYSTEM | TENANT | BRANCH | USER
  '<DATA_TYPE>',          -- BOOLEAN | TEXT | NUMBER | DATE | JSON | TEXT_ARRAY | NUMBER_ARRAY

  -- Default Value & Validation
  '<DEFAULT_VALUE>'::jsonb,     -- ⚠️ Must be valid JSONB!
  '<VALIDATION_RULES>'::jsonb,  -- ⚠️ Must be valid JSONB! (or NULL)

  -- Behavior Flags
  <IS_OVERRIDABLE>,      -- true | false
  <IS_SENSITIVE>,        -- true | false
  <REQUIRES_RESTART>,    -- true | false

  -- Required value and minimum layer
  <STNG_IS_REQUIRED>,    -- true | false (default false)
  <STNG_ALLOWS_NULL>,    -- true | false (default true)
  <STNG_REQUIRED_MIN_LAYER>,  -- NULL or 'SYSTEM_DEFAULT' | 'TENANT_OVERRIDE' | etc.

  -- Dependencies
  '<FEATURE_FLAGS>'::jsonb,  -- ⚠️ JSONB array like '["flag1", "flag2"]' or NULL

  -- Metadata (Bilingual) - ⚠️ USING CORRECT COLUMN NAMES
  '<NAME_EN>',           -- setting_name
  '<NAME_AR>',           -- setting_name2
  '<DESCRIPTION_EN>',    -- setting_desc
  '<DESCRIPTION_AR>',    -- setting_desc2

  -- UI Hints
  '<UI_COMPONENT>',
  '<UI_GROUP>',
  <DISPLAY_ORDER>,

  -- Audit Fields
  CURRENT_TIMESTAMP,
  '<CREATED_BY>',
  'Created via add-setting-db skill',
  1,      -- rec_status (1 = active)
  true    -- is_active
)
ON CONFLICT (setting_code) DO NOTHING;  -- ⚠️ Make migration idempotent

-- STEP 3: VERIFY INSERTION
SELECT
  setting_code,
  stng_name,
  stng_category_code,
  stng_scope,
  stng_data_type,
  stng_default_value_jsonb,
  stng_validation_jsonb,
  stng_is_overridable,
  stng_depends_on_flags,
  created_at
FROM sys_tenant_settings_cd
WHERE setting_code = '<SETTING_CODE>';

-- STEP 4: COMMIT
COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Setting catalog entry created successfully!';
  RAISE NOTICE 'Setting Code: <SETTING_CODE>';
  RAISE NOTICE 'Category: <CATEGORY_CODE>';
  RAISE NOTICE 'Default Value: <DEFAULT_VALUE>';
END $$;
```

**⚠️ CRITICAL: JSONB Formatting Rules**

```sql
-- ✅ CORRECT JSONB Formatting
stng_default_value_jsonb = '10'::jsonb                    -- NUMBER
stng_default_value_jsonb = 'true'::jsonb                  -- BOOLEAN
stng_default_value_jsonb = '"hello world"'::jsonb         -- TEXT (note quotes!)
stng_default_value_jsonb = '["a", "b", "c"]'::jsonb       -- TEXT_ARRAY
stng_default_value_jsonb = '[1, 2, 3]'::jsonb             -- NUMBER_ARRAY
stng_default_value_jsonb = '{"key": "value"}'::jsonb      -- JSON
stng_default_value_jsonb = '"2024-01-01"'::jsonb          -- DATE (as text)

-- Validation examples
stng_validation_jsonb = '{"min": 1, "max": 100}'::jsonb
stng_validation_jsonb = '{"enum": ["opt1", "opt2"]}'::jsonb
stng_validation_jsonb = '{"minLength": 1, "maxLength": 100}'::jsonb
stng_validation_jsonb = NULL   -- If no validation needed

-- Feature flags dependency
stng_depends_on_flags = '["feature.advanced_workflows"]'::jsonb
stng_depends_on_flags = '["flag1", "flag2", "flag3"]'::jsonb
stng_depends_on_flags = NULL   -- If no dependencies

-- ❌ WRONG - Will cause errors!
stng_default_value_jsonb = 10                    -- Missing ::jsonb cast
stng_default_value_jsonb = '10'                  -- Missing ::jsonb cast
stng_default_value_jsonb = hello                 -- Invalid JSON
stng_default_value_jsonb = 'hello'::jsonb        -- String must be quoted: '"hello"'
```

---

### Step 4: Insert Profile Values 🌍

**⚠️ ALWAYS insert at minimum a `GENERAL_MAIN_PROFILE` entry** — this provides the global fallback for all tenants. Its value is always the same as the setting's Default Value (from Step 1 item 5).
Additional regional/segment profiles are optional and added only when different defaults are needed.

```sql
-- Insert profile values
-- GENERAL_MAIN_PROFILE is MANDATORY for every setting!

BEGIN;

INSERT INTO sys_stng_profile_values_dtl (
  id,
  stng_profile_code,
  stng_code,
  stng_value_jsonb,
  stng_override_reason,
  created_at,
  created_by,
  created_info,
  rec_status,
  is_active
) VALUES
  -- ALWAYS: Global default profile (mandatory — same value as setting default)
  (
    gen_random_uuid(),
    'GENERAL_MAIN_PROFILE',
    '<SETTING_CODE>',
    '<DEFAULT_VALUE>'::jsonb,
    'Global default value for all tenants',
    CURRENT_TIMESTAMP,
    '<CREATED_BY>',
    'Created via add-setting-db skill',
    1,
    true
  )
  -- OPTIONAL: Additional regional/segment overrides (uncomment and fill if needed)
  -- ,
  -- (
  --   gen_random_uuid(),
  --   '<PROFILE_CODE_2>',
  --   '<SETTING_CODE>',
  --   '<VALUE_2>'::jsonb,
  --   '<REASON_2>',
  --   CURRENT_TIMESTAMP,
  --   '<CREATED_BY>',
  --   'Created via add-setting-db skill',
  --   1,
  --   true
  -- )
ON CONFLICT (stng_profile_code, stng_code)
DO UPDATE SET
  stng_value_jsonb = EXCLUDED.stng_value_jsonb,
  stng_override_reason = EXCLUDED.stng_override_reason,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = EXCLUDED.created_by;
  -- Add more profile values as needed

-- Verify insertion
SELECT
  pv.stng_profile_code,
  p.stng_profile_name,
  pv.stng_code,
  pv.stng_value_jsonb,
  pv.stng_override_reason,
  pv.created_at
FROM sys_stng_profile_values_dtl pv
JOIN sys_stng_profiles_mst p ON p.stng_profile_code = pv.stng_profile_code
WHERE pv.stng_code = '<SETTING_CODE>'
ORDER BY pv.stng_profile_code;

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Profile values created successfully!';
END $$;
```

**Common Profile Codes**:
- `GENERAL_MAIN_PROFILE` - Global default
- `GCC_MAIN_PROFILE` - GCC region
- `GCC_OM_MAIN` - Oman
- `GCC_OM_SME` - Oman SME
- `GCC_OM_ENTERPRISE` - Oman Enterprise
- `GCC_KSA_MAIN` - Saudi Arabia
- `GCC_KSA_SME` - Saudi SME
- `GCC_KSA_ENTERPRISE` - Saudi Enterprise
- `GCC_UAE_MAIN` - UAE
- `GCC_UAE_SME` - UAE SME
- `GCC_UAE_ENTERPRISE` - UAE Enterprise
- `FRANCHISE_BASE` - Franchise

**⚠️ Note**: Use `INSERT ... ON CONFLICT` if you might be updating:

```sql
INSERT INTO sys_stng_profile_values_dtl (...)
VALUES (...)
ON CONFLICT (stng_profile_code, stng_code)
DO UPDATE SET
  stng_value_jsonb = EXCLUDED.stng_value_jsonb,
  stng_override_reason = EXCLUDED.stng_override_reason,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = EXCLUDED.created_by;
```

---

### Step 5: Create Feature Flag (Optional) 🚩

If the setting depends on a new feature flag that doesn't exist:

```sql
-- Only create if the feature flag doesn't exist yet!
-- Check first: SELECT * FROM hq_ff_feature_flags_mst WHERE flag_key = '<FLAG_KEY>';

BEGIN;

INSERT INTO hq_ff_feature_flags_mst (
  id,
  flag_key,
  flag_name,
  flag_description,
  governance_category,
  is_billable,
  is_kill_switch,
  is_sensitive,
  data_type,
  default_value,
  validation_rules,
  plan_binding_type,
  enabled_plan_codes,
  allows_tenant_override,
  override_requires_approval,
  ui_group,
  created_at,
  created_by,
  created_info,
  rec_status,
  is_active
) VALUES (
  gen_random_uuid(),
  '<FLAG_KEY>',                    -- e.g., 'feature.advanced_workflows'
  '<FLAG_NAME>',                   -- e.g., 'Advanced Workflows'
  '<FLAG_DESCRIPTION>',
  '<GOVERNANCE_CATEGORY>',         -- tenant_feature | tenant_limit | hq_feature | experimental | beta
  <IS_BILLABLE>,                   -- true | false (tied to plan?)
  <IS_KILL_SWITCH>,                -- true | false (can HQ disable globally?)
  <IS_SENSITIVE>,                  -- true | false
  '<DATA_TYPE>',                   -- boolean | integer | float | string | date | datetime | object | array
  '<DEFAULT_VALUE>'::jsonb,        -- Default when flag is enabled
  '<VALIDATION_RULES>'::jsonb,     -- Validation rules or NULL
  '<PLAN_BINDING_TYPE>',           -- plan_bound | independent
  '<ENABLED_PLAN_CODES>'::jsonb,   -- e.g., '["starter", "growth", "pro", "enterprise"]'
  <ALLOWS_TENANT_OVERRIDE>,        -- true | false
  <OVERRIDE_REQUIRES_APPROVAL>,    -- true | false
  '<UI_GROUP>',
  CURRENT_TIMESTAMP,
  '<CREATED_BY>',
  'Created via add-setting-db skill',
  1,
  true
);

-- Verify insertion
SELECT
  flag_key,
  flag_name,
  governance_category,
  plan_binding_type,
  enabled_plan_codes,
  created_at
FROM hq_ff_feature_flags_mst
WHERE flag_key = '<FLAG_KEY>';

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Feature flag created successfully!';
END $$;
```

---

### Step 6: Create Plan Mappings (Optional) 💳

If the feature flag is plan-bound, create plan mappings:

```sql
-- Link feature flag to specific plans
-- Only needed if plan_binding_type = 'plan_bound'

BEGIN;

INSERT INTO sys_ff_pln_flag_mappings_dtl (
  id,
  plan_code,
  flag_key,
  plan_specific_value,
  is_enabled,
  created_at,
  created_by,
  created_info,
  rec_status,
  is_active
) VALUES
  -- Free plan
  (
    gen_random_uuid(),
    'free',
    '<FLAG_KEY>',
    NULL,              -- Disabled, so no value
    false,             -- Disabled
    CURRENT_TIMESTAMP,
    '<CREATED_BY>',
    'Created via add-setting-db skill',
    1,
    true
  ),
  -- Starter plan
  (
    gen_random_uuid(),
    'starter',
    '<FLAG_KEY>',
    '<VALUE_STARTER>'::jsonb,  -- Plan-specific value
    true,                      -- Enabled
    CURRENT_TIMESTAMP,
    '<CREATED_BY>',
    'Created via add-setting-db skill',
    1,
    true
  ),
  -- Growth plan
  (
    gen_random_uuid(),
    'growth',
    '<FLAG_KEY>',
    '<VALUE_GROWTH>'::jsonb,
    true,
    CURRENT_TIMESTAMP,
    '<CREATED_BY>',
    'Created via add-setting-db skill',
    1,
    true
  ),
  -- Pro plan
  (
    gen_random_uuid(),
    'pro',
    '<FLAG_KEY>',
    '<VALUE_PRO>'::jsonb,
    true,
    CURRENT_TIMESTAMP,
    '<CREATED_BY>',
    'Created via add-setting-db skill',
    1,
    true
  ),
  -- Enterprise plan
  (
    gen_random_uuid(),
    'enterprise',
    '<FLAG_KEY>',
    '<VALUE_ENTERPRISE>'::jsonb,  -- NULL for unlimited
    true,
    CURRENT_TIMESTAMP,
    '<CREATED_BY>',
    'Created via add-setting-db skill',
    1,
    true
  );

-- Verify insertion
SELECT
  m.plan_code,
  p.plan_name,
  m.flag_key,
  m.plan_specific_value,
  m.is_enabled
FROM sys_ff_pln_flag_mappings_dtl m
LEFT JOIN sys_pln_subscription_plans_mst p ON p.plan_code = m.plan_code
WHERE m.flag_key = '<FLAG_KEY>'
ORDER BY m.plan_code;

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Plan mappings created successfully!';
END $$;
```

---

### Step 7: Test Resolution 🧪

Test that the setting resolves correctly:

```sql
-- Test 1: Verify catalog entry
SELECT
  setting_code,
  stng_name,
  stng_category_code,
  stng_scope,
  stng_data_type,
  stng_default_value_jsonb,
  stng_validation_jsonb,
  stng_is_overridable,
  stng_depends_on_flags
FROM sys_tenant_settings_cd
WHERE setting_code = '<SETTING_CODE>';

-- Test 2: Verify profile values
SELECT
  pv.stng_profile_code,
  p.stng_profile_name,
  pv.stng_value_jsonb,
  pv.stng_override_reason
FROM sys_stng_profile_values_dtl pv
JOIN sys_stng_profiles_mst p ON p.stng_profile_code = pv.stng_profile_code
WHERE pv.stng_code = '<SETTING_CODE>'
ORDER BY pv.stng_profile_code;

-- Test 3: Test resolution for a tenant (requires tenant with assigned profile)
-- Get a test tenant first
SELECT id, tenant_name, stng_profile_code
FROM org_tenants_mst
WHERE is_active = true
LIMIT 1;

-- Then test resolution (replace with actual tenant ID)
SELECT * FROM fn_stng_resolve_all_settings(
  p_tenant_id := '<TEST_TENANT_ID>',
  p_branch_id := NULL,
  p_user_id := NULL
) WHERE setting_code = '<SETTING_CODE>';

-- Test 4: Explain resolution (see full trace)
SELECT * FROM fn_stng_explain_setting(
  p_tenant_id := '<TEST_TENANT_ID>',
  p_setting_code := '<SETTING_CODE>',
  p_branch_id := NULL,
  p_user_id := NULL
);

-- Test 5: Test via API (optional - requires platform-api running)
-- GET http://localhost:3002/api/hq/v1/settings/tenants/<TENANT_ID>/effective
-- GET http://localhost:3002/api/hq/v1/settings/tenants/<TENANT_ID>/explain/<SETTING_CODE>
```

**Expected Results**:
- Catalog entry should show your setting with correct metadata
- Profile values should show all profiles with their values
- Resolution should return the correct value based on 7-layer hierarchy
- Explain should show the full resolution trace with all layers

---

### Step 8: Generate Documentation 📚

Create documentation for the new setting: 
name the file {setting_code_sanitized}_README.md
create it inside this folder F:\jhapp\cleanmatexsaas\docs\Added_Settings_docs

```markdown
file name :
{setting_code_sanitized}_README.md

## Setting: `<SETTING_CODE>`

**Category**: <CATEGORY_CODE>
**Scope**: <SCOPE>
**Data Type**: <DATA_TYPE>
**Default**: <DEFAULT_VALUE>
**Created**: <DATE>
**Created by**: <USER>

### Description
<FULL_DESCRIPTION>

### Validation Rules
<VALIDATION_DETAILS>

### Profile Defaults
<LIST_PROFILE_VALUES>

### Plan Limits (if applicable)
<LIST_PLAN_LIMITS>

### Feature Flag Dependencies (if applicable)
<LIST_FEATURE_FLAGS>

### Override Behavior
- Can tenants override? <YES/NO>
- Is sensitive? <YES/NO>
- Requires restart? <YES/NO>

### Use Cases
<LIST_USE_CASES>

### Examples
<PROVIDE_EXAMPLES>

### Related Settings
<LIST_RELATED_SETTINGS>

### Changelog
- <DATE>: Created by <USER>
```

---

### Step 9: Generate Migration File 📄

Generate a complete, production-ready migration file:

**Migration File Structure**:
```
XXXX_add_setting_{setting_code_sanitized}.sql

Where:
- XXXX = Next migration number (auto-detected)
- {setting_code_sanitized} = Setting code with dots replaced by underscores
  Example: MAX_CONCURRENT_ORDERS → max_concurrent_orders
```

**Migration File Template**:

See the complete migration template at the end of this document.

**File Location**:
- **Development**: `F:/jhapp/cleanmatex/supabase/migrations/`
- **Sibling project**: Since cleanmatex owns migrations, save there
- **Platform project**: Reference only, never modify migrations directly

**Auto-Detection of Migration Number**:
```bash
# Get the latest migration number
ls -1 F:/jhapp/cleanmatex/supabase/migrations/ | grep -E '^[0-9]{4}_' | tail -1 | cut -d'_' -f1
# Add 1 to get next number
```

---

### Step 10: Generate Summary 📋

Output a complete summary of what was created:

```sql
DO $$
DECLARE
  v_setting_code TEXT := '<SETTING_CODE>';
  v_catalog_exists BOOLEAN;
  v_profile_count INTEGER;
  v_flag_exists BOOLEAN;
  v_plan_mapping_count INTEGER;
BEGIN
  -- Check what was created
  SELECT EXISTS(SELECT 1 FROM sys_tenant_settings_cd WHERE setting_code = v_setting_code)
  INTO v_catalog_exists;

  SELECT COUNT(*) FROM sys_stng_profile_values_dtl WHERE stng_code = v_setting_code
  INTO v_profile_count;

  SELECT EXISTS(SELECT 1 FROM hq_ff_feature_flags_mst WHERE flag_key = ANY(
    SELECT jsonb_array_elements_text(stng_depends_on_flags)
    FROM sys_tenant_settings_cd
    WHERE setting_code = v_setting_code
  )) INTO v_flag_exists;

  -- Output summary
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ SETTING CREATED SUCCESSFULLY!';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Setting Code: %', v_setting_code;
  RAISE NOTICE '';
  RAISE NOTICE '📋 Components Created:';
  RAISE NOTICE '  ✓ Catalog Entry: %', CASE WHEN v_catalog_exists THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE '  ✓ Profile Values: % profiles', v_profile_count;
  RAISE NOTICE '  ✓ Feature Flags: %', CASE WHEN v_flag_exists THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '  1. Test resolution with a real tenant';
  RAISE NOTICE '  2. Update frontend UI to display this setting';
  RAISE NOTICE '  3. Update documentation';
  RAISE NOTICE '  4. Test in staging environment';
  RAISE NOTICE '  5. Deploy to production';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
END $$;
```

---

## Common Examples

### Example 1: Simple Boolean Setting

```sql
-- Setting: Enable auto-invoicing
INSERT INTO sys_tenant_settings_cd (
  setting_code, stng_category_code, stng_scope, stng_data_type,
  stng_default_value_jsonb, stng_validation_jsonb,
  stng_is_overridable, stng_is_sensitive, stng_requires_restart, stng_depends_on_flags,
  stng_name, stng_name2, stng_description, stng_description2,
  stng_ui_component, stng_ui_group, stng_display_order,
  created_at, created_by, created_info, rec_status, is_active
) VALUES (
  'finance.invoicing.auto_send', 'FINANCE', 'TENANT', 'BOOLEAN',
  'false'::jsonb, NULL,
  true, false, false, NULL,
  'Auto-send Invoices', 'إرسال الفواتير تلقائياً',
  'Automatically send invoices to customers when generated',
  'إرسال الفواتير تلقائياً للعملاء عند إنشائها',
  'toggle', 'Invoicing', 10,
  CURRENT_TIMESTAMP, 'system_admin', 'Created via add-setting-db skill', 1, true
);
```

### Example 2: Number with Validation

```sql
-- Setting: Session timeout in minutes
INSERT INTO sys_tenant_settings_cd (
  setting_code, stng_category_code, stng_scope, stng_data_type,
  stng_default_value_jsonb, stng_validation_jsonb,
  stng_is_overridable, stng_is_sensitive, stng_requires_restart, stng_depends_on_flags,
  stng_name, stng_name2, stng_description, stng_description2,
  stng_ui_component, stng_ui_group, stng_display_order,
  created_at, created_by, created_info, rec_status, is_active
) VALUES (
  'security.auth.session_timeout', 'SECURITY', 'TENANT', 'NUMBER',
  '30'::jsonb, '{"min": 5, "max": 1440, "step": 5}'::jsonb,
  true, false, true, NULL,
  'Session Timeout (minutes)', 'مهلة الجلسة (بالدقائق)',
  'User session timeout in minutes',
  'مهلة جلسة المستخدم بالدقائق',
  'number-input', 'Authentication', 20,
  CURRENT_TIMESTAMP, 'system_admin', 'Created via add-setting-db skill', 1, true
);
```

### Example 3: Text with Enum

```sql
-- Setting: Default currency
INSERT INTO sys_tenant_settings_cd (
  setting_code, stng_category_code, stng_scope, stng_data_type,
  stng_default_value_jsonb, stng_validation_jsonb,
  stng_is_overridable, stng_is_sensitive, stng_requires_restart, stng_depends_on_flags,
  stng_name, stng_name2, stng_description, stng_description2,
  stng_ui_component, stng_ui_group, stng_display_order,
  created_at, created_by, created_info, rec_status, is_active
) VALUES (
  'finance.general.default_currency', 'FINANCE', 'TENANT', 'TEXT',
  '"OMR"'::jsonb, '{"enum": ["OMR", "SAR", "AED", "KWD", "BHD", "QAR", "USD"]}'::jsonb,
  true, false, false, NULL,
  'Default Currency', 'العملة الافتراضية',
  'Default currency for financial transactions',
  'العملة الافتراضية للمعاملات المالية',
  'select', 'General', 5,
  CURRENT_TIMESTAMP, 'system_admin', 'Created via add-setting-db skill', 1, true
);
```

### Example 4: JSON Object

```sql
-- Setting: Email notification preferences
INSERT INTO sys_tenant_settings_cd (
  setting_code, stng_category_code, stng_scope, stng_data_type,
  stng_default_value_jsonb, stng_validation_jsonb,
  stng_is_overridable, stng_is_sensitive, stng_requires_restart, stng_depends_on_flags,
  stng_name, stng_name2, stng_description, stng_description2,
  stng_ui_component, stng_ui_group, stng_display_order,
  created_at, created_by, created_info, rec_status, is_active
) VALUES (
  'notifications.email.preferences', 'NOTIFICATIONS', 'USER', 'JSON',
  '{"order_created": true, "order_completed": true, "payment_received": false}'::jsonb, NULL,
  true, false, false, NULL,
  'Email Notification Preferences', 'تفضيلات إشعارات البريد الإلكتروني',
  'Configure which email notifications to receive',
  'تكوين إشعارات البريد الإلكتروني المراد استلامها',
  'json-editor', 'Email Notifications', 15,
  CURRENT_TIMESTAMP, 'system_admin', 'Created via add-setting-db skill', 1, true
);
```

### Example 5: With Feature Flag Dependency

```sql
-- Setting: Max concurrent workflows (requires advanced workflows feature)
INSERT INTO sys_tenant_settings_cd (
  setting_code, stng_category_code, stng_scope, stng_data_type,
  stng_default_value_jsonb, stng_validation_jsonb,
  stng_is_overridable, stng_is_sensitive, stng_requires_restart, stng_depends_on_flags,
  stng_name, stng_name2, stng_description, stng_description2,
  stng_ui_component, stng_ui_group, stng_display_order,
  created_at, created_by, created_info, rec_status, is_active
) VALUES (
  'workflow.advanced.max_concurrent', 'WORKFLOW', 'TENANT', 'NUMBER',
  '5'::jsonb, '{"min": 1, "max": 50}'::jsonb,
  true, false, false, '["feature.advanced_workflows"]'::jsonb,
  'Max Concurrent Workflows', 'الحد الأقصى للمهام المتزامنة',
  'Maximum number of workflows that can run simultaneously',
  'الحد الأقصى لعدد سير العمل التي يمكن تشغيلها في وقت واحد',
  'number-input', 'Advanced Workflow', 25,
  CURRENT_TIMESTAMP, 'system_admin', 'Created via add-setting-db skill', 1, true
);

-- And add profile values for different regions/segments
INSERT INTO sys_stng_profile_values_dtl (
  id, stng_profile_code, stng_code, stng_value_jsonb, stng_override_reason,
  created_at, created_by, rec_status, is_active
) VALUES
  (gen_random_uuid(), 'GCC_OM_SME', 'workflow.advanced.max_concurrent',
   '3'::jsonb, 'Lower limit for SME', CURRENT_TIMESTAMP, 'system_admin', 1, true),
  (gen_random_uuid(), 'GCC_OM_ENTERPRISE', 'workflow.advanced.max_concurrent',
   '15'::jsonb, 'Higher limit for enterprise', CURRENT_TIMESTAMP, 'system_admin', 1, true);
```

---

## Troubleshooting

### Error: "duplicate key value violates unique constraint"

**Cause**: Setting code already exists
**Solution**: Check if setting exists first, or use different code

```sql
-- Check if setting exists
SELECT * FROM sys_tenant_settings_cd WHERE setting_code = 'your.setting.code';
```

### Error: "invalid input syntax for type jsonb"

**Cause**: Invalid JSONB formatting
**Solution**: Ensure proper JSONB formatting and ::jsonb cast

```sql
-- Wrong
stng_default_value_jsonb = 10
stng_default_value_jsonb = 'hello'::jsonb

-- Correct
stng_default_value_jsonb = '10'::jsonb
stng_default_value_jsonb = '"hello"'::jsonb
```

### Error: "violates foreign key constraint"

**Cause**: Referenced category/profile/flag doesn't exist
**Solution**: Create the referenced object first or use existing one

```sql
-- List available categories
SELECT stng_category_code, stng_category_name FROM sys_stng_categories_cd;

-- List available profiles
SELECT stng_profile_code, stng_profile_name FROM sys_stng_profiles_mst;
```

### Warning: Setting not resolving correctly

**Cause**: Multiple possible causes
**Solution**: Use explain function to debug

```sql
SELECT * FROM fn_stng_explain_setting(
  p_tenant_id := 'tenant-id',
  p_setting_code := 'your.setting.code',
  p_branch_id := NULL,
  p_user_id := NULL
);
```

---

## Common Errors & Troubleshooting

### Error 1: "column does not exist" (MOST COMMON)

**Error Message**:
```
ERROR: column "stng_name" of relation "sys_tenant_settings_cd" does not exist
```

**Cause**: Using wrong column names in INSERT statement

**Solution**: Use correct column names (detected in Step 1.5):
```sql
-- ❌ WRONG
stng_name,
stng_name2,
stng_description,
stng_description2,

-- ✅ CORRECT
setting_name,
setting_name2,
setting_desc,
setting_desc2,
```

**Prevention**: Always run Step 1.5 (Detect Table Schema) before generating SQL

---

### Error 2: "Setting already exists"

**Error Message**:
```
ERROR: One or more service preference settings already exist (SQLSTATE P0001)
```

**Cause**: Migration not idempotent - throws exception instead of skipping existing settings

**Solution**: Make migration idempotent by:

1. **Change validation from EXCEPTION to NOTICE**:
```sql
-- ❌ WRONG
IF EXISTS (...) THEN
  RAISE EXCEPTION 'Settings already exist';
END IF;

-- ✅ CORRECT
IF v_existing_count > 0 THEN
  RAISE NOTICE '⚠️ % settings already exist - will skip';
END IF;
```

2. **Add ON CONFLICT clause**:
```sql
INSERT INTO sys_tenant_settings_cd (...)
VALUES (...)
ON CONFLICT (setting_code) DO NOTHING;  -- ✅ Skip if exists
```

3. **Make verification flexible**:
```sql
-- ❌ WRONG
IF v_row_count != 8 THEN
  RAISE EXCEPTION 'Expected 8, got %';
END IF;

-- ✅ CORRECT
IF v_row_count = 0 THEN
  RAISE EXCEPTION 'None inserted - check prerequisites';
ELSIF v_row_count < 8 THEN
  RAISE NOTICE '⚠️ Partial: some already existed';
ELSE
  RAISE NOTICE '✅ All verified';
END IF;
```

**Prevention**: Use migration template from this skill (already includes idempotency)

---

### Error 3: "duplicate key value violates unique constraint"

**Error Message**:
```
ERROR: duplicate key value violates unique constraint "sys_tenant_settings_cd_pkey"
```

**Cause**: Setting code already exists and migration doesn't have ON CONFLICT

**Solution**: Add ON CONFLICT clause:
```sql
INSERT INTO sys_tenant_settings_cd (...)
VALUES (...)
ON CONFLICT (setting_code) DO NOTHING;
```

**Prevention**: Always include ON CONFLICT in migrations

---

### Error 4: "invalid input syntax for type jsonb"

**Error Message**:
```
ERROR: invalid input syntax for type jsonb
```

**Cause**: Invalid JSONB formatting

**Solution**: Follow JSONB formatting rules:
```sql
-- ✅ CORRECT JSONB Formatting
stng_default_value_jsonb = '10'::jsonb                    -- NUMBER
stng_default_value_jsonb = 'true'::jsonb                  -- BOOLEAN
stng_default_value_jsonb = '"hello"'::jsonb               -- TEXT (quotes!)
stng_default_value_jsonb = '["a", "b"]'::jsonb            -- ARRAY
stng_default_value_jsonb = '{"key": "value"}'::jsonb      -- OBJECT

-- ❌ WRONG
stng_default_value_jsonb = 10                    -- Missing ::jsonb
stng_default_value_jsonb = 'hello'::jsonb        -- Missing quotes for text
```

**Prevention**: Always use `::jsonb` cast and quote text values

---

### Error 5: "violates foreign key constraint"

**Error Message**:
```
ERROR: insert or update on table "sys_tenant_settings_cd" violates foreign key constraint
```

**Cause**: Referenced category/profile/flag doesn't exist

**Solution**: Check prerequisites exist:
```sql
-- Check category
SELECT stng_category_code FROM sys_stng_categories_cd
WHERE stng_category_code = 'SERVICE_PREF';

-- Check profile
SELECT stng_profile_code FROM sys_stng_profiles_mst
WHERE stng_profile_code = 'GENERAL_MAIN_PROFILE';
```

**Prevention**: Always run Step 2 (Validate Prerequisites) queries

---

### Error 6: "Setting not resolving correctly"

**Symptom**: Setting exists but doesn't return expected value

**Diagnosis**: Use explain function:
```sql
SELECT * FROM fn_stng_explain_setting(
  p_tenant_id := 'tenant-id',
  p_setting_code := 'SERVICE_PREF_DEFAULT_PACKING',
  p_branch_id := NULL,
  p_user_id := NULL
);
```

**Common Causes**:
1. Profile not assigned to tenant
2. Profile value missing
3. Override at higher layer
4. Feature flag disabled

**Solution**: Check resolution trace and fix the layer with wrong value

---

## Best Practices

### 1. Schema Detection (CRITICAL)
✅ **DO**: Always detect actual column names from existing migrations
✅ **DO**: Run Step 1.5 (Detect Table Schema) before generating SQL
✅ **DO**: Use `setting_name`, `setting_name2`, `setting_desc`, `setting_desc2`
❌ **DON'T**: Assume column names without checking
❌ **DON'T**: Use `stng_name`, `stng_name2`, `stng_description`, `stng_description2`

### 2. Migration Idempotency (CRITICAL)
✅ **DO**: Use `ON CONFLICT DO NOTHING` on all INSERT statements
✅ **DO**: Change validation from EXCEPTION to NOTICE for existing settings
✅ **DO**: Make verification flexible (warn if partial, fail only if none)
❌ **DON'T**: Throw exceptions when settings already exist
❌ **DON'T**: Use strict count checks (expected == actual)

### 3. Prerequisites Validation
✅ **DO**: Check if category exists (CRITICAL - must exist)
✅ **DO**: Check if profile exists (CRITICAL - must exist)
✅ **DO**: Verify feature flags exist if specified
❌ **DON'T**: Skip validation queries
❌ **DON'T**: Assume prerequisites exist

### 4. JSONB Formatting
✅ **DO**: Always use `::jsonb` cast
✅ **DO**: Quote text values: `'"text"'::jsonb`
✅ **DO**: Use proper JSON syntax for objects/arrays
❌ **DON'T**: Forget quotes for text values
❌ **DON'T**: Skip `::jsonb` cast

### 5. Naming Conventions
✅ **DO**: Use meaningful setting codes: `SERVICE_PREF_DEFAULT_PACKING`
✅ **DO**: Follow pattern: `{FEATURE}_{NOUN}_{ATTRIBUTE}`
✅ **DO**: Use uppercase with underscores
❌ **DON'T**: Use dots in setting codes (use underscores)
❌ **DON'T**: Use lowercase or mixed case

### 6. Bilingual Support
✅ **DO**: Include both English and Arabic names/descriptions
✅ **DO**: Provide meaningful translations, not just transliterations
✅ **DO**: Test with RTL UI to verify Arabic text displays correctly
❌ **DON'T**: Leave Arabic fields empty
❌ **DON'T**: Use English text in Arabic fields

### 7. Testing & Verification
✅ **DO**: Test resolution with real tenant after migration
✅ **DO**: Use explain function to verify resolution trace
✅ **DO**: Check all 8 settings exist after migration
❌ **DON'T**: Assume migration worked without verification
❌ **DON'T**: Skip testing in staging before production

### 8. Documentation
✅ **DO**: Create comprehensive README for each setting
✅ **DO**: Document use cases and examples
✅ **DO**: Include troubleshooting section
❌ **DON'T**: Skip documentation
❌ **DON'T**: Assume setting purpose is self-explanatory

### 9. Profile Values
✅ **MANDATORY**: Always insert a `GENERAL_MAIN_PROFILE` value — no exceptions (value = setting default value)
✅ **DO**: Override only when regional/segment needs differ from global default
✅ **DO**: Document reason for each profile override
❌ **DON'T**: Duplicate values across all profiles unnecessarily
❌ **DON'T**: Skip GENERAL_MAIN_PROFILE — it is required for every setting

### 10. Migration Files
✅ **DO**: Use descriptive migration names: `0143_add_service_preferences_settings.sql`
✅ **DO**: Include verification and rollback sections
✅ **DO**: Add helpful NOTICE messages for debugging
❌ **DON'T**: Use generic names like `add_settings.sql`
❌ **DON'T**: Omit rollback instructions

---

## Related Documentation

- [Settings Architecture Overview](../../docs/dev/settings/architecture.md)
- [7-Layer Resolution System](../../docs/dev/settings/resolution.md)
- [Feature Flags Integration](../../docs/dev/settings/feature-flags.md)
- [Database Conventions](../../.claude/docs/database_conventions.md)
- [API Reference](../../docs/dev/settings/api-reference.md)

---

---

## Migration File Template

This is the complete template for the generated migration file:

```sql
-- ================================================================
-- Migration: Add Setting - {SETTING_CODE}
-- ================================================================
-- Purpose: {BRIEF_PURPOSE}
-- Category: {CATEGORY_CODE}
-- Scope: {SCOPE}
-- Data Type: {DATA_TYPE}
--
-- Created: {CURRENT_DATE}
-- Created by: {CREATED_BY}
-- Migration: {MIGRATION_NUMBER}_add_setting_{setting_code_sanitized}.sql
--
-- Components:
--   [X] Catalog Entry (sys_tenant_settings_cd)
--   [X] Profile Values (sys_stng_profile_values_dtl) - GENERAL_MAIN_PROFILE (ALWAYS) + {ADDITIONAL_PROFILES: YES/NO}
--   [ ] Feature Flags (hq_ff_feature_flags_mst) - {YES/NO}
--   [ ] Plan Mappings (sys_ff_pln_flag_mappings_dtl) - {YES/NO}
-- ================================================================

-- ================================================================
-- SECTION 1: VALIDATION (IDEMPOTENT)
-- ================================================================

-- Check prerequisites before proceeding
DO $$
DECLARE
  v_existing_count INTEGER;
BEGIN
  -- Check how many settings already exist (NOTICE not EXCEPTION)
  SELECT COUNT(*) INTO v_existing_count
  FROM sys_tenant_settings_cd
  WHERE setting_code = '{SETTING_CODE}';

  IF v_existing_count > 0 THEN
    RAISE NOTICE '⚠️  Setting already exists: {SETTING_CODE} - migration will skip';
  END IF;

  -- Check if category exists (CRITICAL - must exist)
  IF NOT EXISTS (
    SELECT 1 FROM sys_stng_categories_cd
    WHERE stng_category_code = '{CATEGORY_CODE}'
  ) THEN
    RAISE EXCEPTION 'Category does not exist: {CATEGORY_CODE}. Available categories: %',
      (SELECT string_agg(stng_category_code, ', ') FROM sys_stng_categories_cd);
  END IF;

  -- Check if profiles exist (if profile values will be added)
  {PROFILE_VALIDATION_SQL}

  -- Check if feature flags exist (if dependencies specified)
  {FLAG_VALIDATION_SQL}

  RAISE NOTICE '✅ Prerequisites validated successfully';
END $$;

-- ================================================================
-- SECTION 2: CATALOG ENTRY (WITH CORRECT COLUMN NAMES)
-- ================================================================

-- Insert setting into catalog
-- ⚠️ CRITICAL: Using correct column names (setting_name NOT stng_name)
INSERT INTO sys_tenant_settings_cd (
  -- Primary Key
  setting_code,

  -- Classification
  stng_category_code,
  stng_scope,
  stng_data_type,

  -- Default Value & Validation (JSONB!)
  stng_default_value_jsonb,
  stng_validation_jsonb,

  -- Behavior Flags
  stng_is_overridable,
  stng_is_sensitive,
  stng_requires_restart,

  -- Required & Minimum Layer
  stng_is_required,
  stng_allows_null,
  stng_required_min_layer,

  -- Dependencies (JSONB array or NULL)
  stng_depends_on_flags,

  -- Metadata (Bilingual) - ⚠️ CORRECT COLUMN NAMES
  setting_name,        -- ✅ NOT stng_name
  setting_name2,       -- ✅ NOT stng_name2
  setting_desc,        -- ✅ NOT stng_description
  setting_desc2,       -- ✅ NOT stng_description2

  -- UI Hints
  stng_ui_component,
  stng_ui_group,
  stng_display_order,

  -- Audit Fields
  created_at,
  created_by,
  created_info,
  rec_status,
  is_active
) VALUES (
  -- Primary Key
  '{SETTING_CODE}',

  -- Classification
  '{CATEGORY_CODE}',
  '{SCOPE}',
  '{DATA_TYPE}',

  -- Default Value & Validation
  '{DEFAULT_VALUE}'::jsonb,
  {VALIDATION_RULES}::jsonb,

  -- Behavior Flags
  {IS_OVERRIDABLE},
  {IS_SENSITIVE},
  {REQUIRES_RESTART},

  -- Required & Minimum Layer
  {STNG_IS_REQUIRED},
  {STNG_ALLOWS_NULL},
  {STNG_REQUIRED_MIN_LAYER},

  -- Dependencies
  {FEATURE_FLAGS}::jsonb,

  -- Metadata (Bilingual)
  '{NAME_EN}',
  '{NAME_AR}',
  '{DESCRIPTION_EN}',
  '{DESCRIPTION_AR}',

  -- UI Hints
  '{UI_COMPONENT}',
  '{UI_GROUP}',
  {DISPLAY_ORDER},

  -- Audit Fields
  CURRENT_TIMESTAMP,
  '{CREATED_BY}',
  'Migration: {MIGRATION_NUMBER}_add_setting_{setting_code_sanitized}',
  1,
  true
)
ON CONFLICT (setting_code) DO NOTHING;  -- ⚠️ Make migration idempotent

-- Verify catalog insertion
DO $$
DECLARE
  v_row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_row_count
  FROM sys_tenant_settings_cd
  WHERE setting_code = '{SETTING_CODE}';

  IF v_row_count = 0 THEN
    RAISE EXCEPTION 'Failed to insert catalog entry for: {SETTING_CODE}';
  ELSE
    RAISE NOTICE '✅ Catalog entry verified: {SETTING_CODE}';
  END IF;
END $$;

-- ================================================================
-- SECTION 3: PROFILE VALUES (Optional)
-- ================================================================

{PROFILE_VALUES_SQL}

-- ================================================================
-- SECTION 4: FEATURE FLAGS (Optional)
-- ================================================================

{FEATURE_FLAGS_SQL}

-- ================================================================
-- SECTION 5: PLAN MAPPINGS (Optional)
-- ================================================================

{PLAN_MAPPINGS_SQL}

-- ================================================================
-- SECTION 6: VERIFICATION
-- ================================================================

-- Verify all components are in place
DO $$
DECLARE
  v_catalog_exists BOOLEAN;
  v_profile_count INTEGER := 0;
  v_flag_exists BOOLEAN := false;
  v_plan_mapping_count INTEGER := 0;
BEGIN
  -- Check catalog entry
  SELECT EXISTS(SELECT 1 FROM sys_tenant_settings_cd WHERE setting_code = '{SETTING_CODE}')
  INTO v_catalog_exists;

  -- Check profile values
  {PROFILE_COUNT_SQL}

  -- Check feature flags
  {FLAG_CHECK_SQL}

  -- Check plan mappings
  {PLAN_COUNT_SQL}

  -- Output verification summary
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION COMPLETED SUCCESSFULLY';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Setting Code: {SETTING_CODE}';
  RAISE NOTICE 'Migration: {MIGRATION_NUMBER}_add_setting_{setting_code_sanitized}.sql';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Components Created:';
  RAISE NOTICE '  ✓ Catalog Entry: %', CASE WHEN v_catalog_exists THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE '  ✓ Profile Values: % profiles', v_profile_count;
  RAISE NOTICE '  ✓ Feature Flags: %', CASE WHEN v_flag_exists THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE '  ✓ Plan Mappings: % plans', v_plan_mapping_count;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '  1. Test resolution with a real tenant';
  RAISE NOTICE '  2. Run migration in staging: supabase db push';
  RAISE NOTICE '  3. Verify in Supabase Studio';
  RAISE NOTICE '  4. Update frontend UI to display this setting';
  RAISE NOTICE '  5. Deploy to production';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';

  -- Fail if catalog entry not created
  IF NOT v_catalog_exists THEN
    RAISE EXCEPTION 'Migration failed: Catalog entry not created';
  END IF;
END $$;

-- ================================================================
-- SECTION 7: ROLLBACK (For reference - manual execution)
-- ================================================================

-- IMPORTANT: This is for documentation only. Do NOT execute during migration.
-- If you need to rollback this migration, run these commands manually:

/*
-- Rollback Instructions:
-- Run these commands in reverse order to undo this migration

-- 1. Delete plan mappings (if created)
{ROLLBACK_PLAN_MAPPINGS_SQL}

-- 2. Delete feature flags (if created)
{ROLLBACK_FEATURE_FLAGS_SQL}

-- 3. Delete profile values (if created)
{ROLLBACK_PROFILE_VALUES_SQL}

-- 4. Delete catalog entry
DELETE FROM sys_tenant_settings_cd
WHERE setting_code = '{SETTING_CODE}';

-- 5. Verify deletion
SELECT COUNT(*) as remaining_records
FROM sys_tenant_settings_cd
WHERE setting_code = '{SETTING_CODE}';
-- Expected: 0

-- Rollback complete
*/

-- ================================================================
-- END OF MIGRATION
-- ================================================================
```

---

## Migration Generation Workflow

### Step 1: Detect Next Migration Number

```bash
# Get latest migration file
cd F:/jhapp/cleanmatex/supabase/migrations/
ls -1 | grep -E '^[0-9]{4}_' | tail -1

# Extract number and increment
# Example: 0087_some_migration.sql → Next: 0088
```

### Step 2: Sanitize Setting Code for Filename

```javascript
// Example transformation
const settingCode = "MAX_CONCURRENT_ORDERS";
const sanitized = settingCode.replace(/\./g, '_');
// Result: workflow_orders_max_concurrent

const migrationNumber = "0088"; // From step 1
const filename = `${migrationNumber}_add_setting_${sanitized}.sql`;
// Result: 0088_add_setting_workflow_orders_max_concurrent.sql
```

### Step 3: Generate Migration Content

Replace all placeholders:

**Required Placeholders**:
- `{SETTING_CODE}` - Full setting code (e.g., `MAX_CONCURRENT_ORDERS`)
- `{setting_code_sanitized}` - Sanitized for filename (e.g., `workflow_orders_max_concurrent`)
- `{MIGRATION_NUMBER}` - Migration number (e.g., `0088`)
- `{CATEGORY_CODE}` - Category code (e.g., `WORKFLOW`)
- `{SCOPE}` - Scope (e.g., `TENANT`)
- `{DATA_TYPE}` - Data type (e.g., `NUMBER`)
- `{DEFAULT_VALUE}` - Default value as JSONB (e.g., `'10'`)
- `{VALIDATION_RULES}` - Validation rules as JSONB or `NULL`
- `{IS_OVERRIDABLE}` - Boolean (e.g., `true`)
- `{IS_SENSITIVE}` - Boolean (e.g., `false`)
- `{REQUIRES_RESTART}` - Boolean (e.g., `false`)
- `{STNG_IS_REQUIRED}` - Boolean (e.g., `false`)
- `{STNG_ALLOWS_NULL}` - Boolean (e.g., `true`)
- `{STNG_REQUIRED_MIN_LAYER}` - Layer or `NULL`
- `{FEATURE_FLAGS}` - JSONB array or `NULL`
- `{NAME_EN}` - English name
- `{NAME_AR}` - Arabic name
- `{DESCRIPTION_EN}` - English description
- `{DESCRIPTION_AR}` - Arabic description
- `{UI_COMPONENT}` - UI component (e.g., `number-input`)
- `{UI_GROUP}` - UI group (e.g., `Order Processing`)
- `{DISPLAY_ORDER}` - Display order (e.g., `10`)
- `{CREATED_BY}` - Creator (e.g., `system_admin`)
- `{CURRENT_DATE}` - Current date (e.g., `2026-02-28`)
- `{BRIEF_PURPOSE}` - Brief description of setting purpose

**Conditional Placeholders** (replace with actual SQL or empty string):
- `{PROFILE_VALIDATION_SQL}` - Profile validation SQL if profiles used
- `{FLAG_VALIDATION_SQL}` - Flag validation SQL if flags used
- `{PROFILE_VALUES_SQL}` - Profile values INSERT SQL or empty
- `{FEATURE_FLAGS_SQL}` - Feature flags INSERT SQL or empty
- `{PLAN_MAPPINGS_SQL}` - Plan mappings INSERT SQL or empty
- `{PROFILE_COUNT_SQL}` - Profile count check or empty
- `{FLAG_CHECK_SQL}` - Flag check SQL or empty
- `{PLAN_COUNT_SQL}` - Plan count SQL or empty
- `{ROLLBACK_PLAN_MAPPINGS_SQL}` - Rollback plan mappings or empty
- `{ROLLBACK_FEATURE_FLAGS_SQL}` - Rollback feature flags or empty
- `{ROLLBACK_PROFILE_VALUES_SQL}` - Rollback profile values or empty

### Step 4: Save Migration File

```bash
# Save to cleanmatex migrations folder
FILE_PATH="F:/jhapp/cleanmatex/supabase/migrations/${MIGRATION_NUMBER}_add_setting_${setting_code_sanitized}.sql"

# Write content to file
cat > "$FILE_PATH" <<'EOF'
[Generated SQL content here]
EOF

# Verify file created
ls -lh "$FILE_PATH"
```

### Step 5: Test Migration Locally

```bash
# Don't Apply migration Ask me to do it
Never do Full reset
cd F:/jhapp/cleanmatex
Never do Full reset supabase db reset  # Never do Full reset
# 
supabase migration up  # Just apply new migrations

# Verify in Supabase Studio
# Navigate to: http://localhost:54323
```

---

## Complete Example Migration File

Here's a complete example for reference:

**File**: `0088_add_setting_workflow_orders_max_concurrent.sql`

```sql
-- ================================================================
-- Migration: Add Setting - MAX_CONCURRENT_ORDERS
-- ================================================================
-- Purpose: Maximum number of orders that can be processed simultaneously
-- Category: WORKFLOW
-- Scope: TENANT
-- Data Type: NUMBER
--
-- Created: 2026-02-28
-- Created by: system_admin
-- Migration: 0088_add_setting_workflow_orders_max_concurrent.sql
--
-- Components:
--   [X] Catalog Entry (sys_tenant_settings_cd)
--   [X] Profile Values (sys_stng_profile_values_dtl) - YES (2 profiles)
--   [ ] Feature Flags (hq_ff_feature_flags_mst) - NO
--   [ ] Plan Mappings (sys_ff_pln_flag_mappings_dtl) - NO
-- ================================================================

-- ================================================================
-- SECTION 1: VALIDATION
-- ================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM sys_tenant_settings_cd
    WHERE setting_code = 'MAX_CONCURRENT_ORDERS'
  ) THEN
    RAISE EXCEPTION 'Setting already exists: workflow.orders.max_concurrent';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM sys_stng_categories_cd
    WHERE stng_category_code = 'WORKFLOW'
  ) THEN
    RAISE EXCEPTION 'Category does not exist: WORKFLOW';
  END IF;

  -- Check profiles exist
  IF NOT EXISTS (
    SELECT 1 FROM sys_stng_profiles_mst
    WHERE stng_profile_code IN ('GCC_OM_SME', 'GCC_OM_ENTERPRISE')
  ) THEN
    RAISE EXCEPTION 'One or more profiles do not exist';
  END IF;

  RAISE NOTICE '✅ Prerequisites validated successfully';
END $$;

-- ================================================================
-- SECTION 2: CATALOG ENTRY
-- ================================================================

INSERT INTO sys_tenant_settings_cd (
  setting_code,
  stng_category_code,
  stng_scope,
  stng_data_type,
  stng_default_value_jsonb,
  stng_validation_jsonb,
  stng_is_overridable,
  stng_is_sensitive,
  stng_requires_restart,
  stng_is_required,
  stng_allows_null,
  stng_required_min_layer,
  stng_depends_on_flags,
  stng_name,
  stng_name2,
  stng_description,
  stng_description2,
  stng_ui_component,
  stng_ui_group,
  stng_display_order,
  created_at,
  created_by,
  created_info,
  rec_status,
  is_active
) VALUES (
  'MAX_CONCURRENT_ORDERS',
  'WORKFLOW',
  'TENANT',
  'NUMBER',
  '10'::jsonb,
  '{"min": 1, "max": 50, "step": 1}'::jsonb,
  true,
  false,
  false,
  false,
  true,
  NULL,
  NULL,
  'Max Concurrent Orders',
  'الحد الأقصى للطلبات المتزامنة',
  'Maximum number of orders that can be processed simultaneously',
  'الحد الأقصى لعدد الطلبات التي يمكن معالجتها في وقت واحد',
  'number-input',
  'Order Processing',
  10,
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration: 0088_add_setting_workflow_orders_max_concurrent',
  1,
  true
);

DO $$
DECLARE
  v_row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_row_count
  FROM sys_tenant_settings_cd
  WHERE setting_code = 'MAX_CONCURRENT_ORDERS';

  IF v_row_count = 0 THEN
    RAISE EXCEPTION 'Failed to insert catalog entry';
  END IF;

  RAISE NOTICE '✅ Catalog entry created';
END $$;

-- ================================================================
-- SECTION 3: PROFILE VALUES
-- ================================================================

INSERT INTO sys_stng_profile_values_dtl (
  id,
  stng_profile_code,
  stng_code,
  stng_value_jsonb,
  stng_override_reason,
  created_at,
  created_by,
  created_info,
  rec_status,
  is_active
) VALUES
  (
    gen_random_uuid(),
    'GCC_OM_SME',
    'MAX_CONCURRENT_ORDERS',
    '5'::jsonb,
    'Lower limit for SME tenants to manage resources',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0088_add_setting_workflow_orders_max_concurrent',
    1,
    true
  ),
  (
    gen_random_uuid(),
    'GCC_OM_ENTERPRISE',
    'MAX_CONCURRENT_ORDERS',
    '20'::jsonb,
    'Higher limit for enterprise tenants with more capacity',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0088_add_setting_workflow_orders_max_concurrent',
    1,
    true
  );

DO $$
DECLARE
  v_profile_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_profile_count
  FROM sys_stng_profile_values_dtl
  WHERE stng_code = 'MAX_CONCURRENT_ORDERS';

  RAISE NOTICE '✅ Profile values created: % profiles', v_profile_count;
END $$;

-- ================================================================
-- SECTION 6: VERIFICATION
-- ================================================================

DO $$
DECLARE
  v_catalog_exists BOOLEAN;
  v_profile_count INTEGER := 0;
BEGIN
  SELECT EXISTS(SELECT 1 FROM sys_tenant_settings_cd WHERE setting_code = 'MAX_CONCURRENT_ORDERS')
  INTO v_catalog_exists;

  SELECT COUNT(*) INTO v_profile_count
  FROM sys_stng_profile_values_dtl
  WHERE stng_code = 'MAX_CONCURRENT_ORDERS';

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION COMPLETED SUCCESSFULLY';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Setting Code: workflow.orders.max_concurrent';
  RAISE NOTICE 'Migration: 0088_add_setting_workflow_orders_max_concurrent.sql';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Components Created:';
  RAISE NOTICE '  ✓ Catalog Entry: %', CASE WHEN v_catalog_exists THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE '  ✓ Profile Values: % profiles', v_profile_count;
  RAISE NOTICE '  ✓ Feature Flags: NO';
  RAISE NOTICE '  ✓ Plan Mappings: NO';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';

  IF NOT v_catalog_exists THEN
    RAISE EXCEPTION 'Migration failed: Catalog entry not created';
  END IF;
END $$;

-- ================================================================
-- SECTION 7: ROLLBACK (For reference - manual execution)
-- ================================================================

/*
-- Delete profile values
DELETE FROM sys_stng_profile_values_dtl
WHERE stng_code = 'MAX_CONCURRENT_ORDERS';

-- Delete catalog entry
DELETE FROM sys_tenant_settings_cd
WHERE setting_code = 'MAX_CONCURRENT_ORDERS';

-- Verify deletion
SELECT COUNT(*) FROM sys_tenant_settings_cd
WHERE setting_code = 'MAX_CONCURRENT_ORDERS';
-- Expected: 0
*/

-- ================================================================
-- END OF MIGRATION
-- ================================================================
```

---

## Skill Metadata

**Version**: 3.0.0
**Last Updated**: 2026-03-12
**Maintained by**: CleanMateX Platform Team
**Support**: See GitHub issues or contact platform team

**Changelog**:

### Version 3.0.0 (2026-03-12) - Critical Fixes & Enhancements
**Breaking Changes**:
- ✅ Fixed incorrect column names in migration template
  - Changed `stng_name` → `setting_name`
  - Changed `stng_name2` → `setting_name2`
  - Changed `stng_description` → `setting_desc`
  - Changed `stng_description2` → `setting_desc2`

**New Features**:
- ✅ Added Step 1.5: Schema Detection to verify actual column names
- ✅ Migration templates now idempotent by default (ON CONFLICT DO NOTHING)
- ✅ Validation changed from EXCEPTION to NOTICE for existing settings
- ✅ Added comprehensive troubleshooting section with 6 common errors
- ✅ Enhanced best practices with 10 categories
- ✅ Flexible verification (warn if partial, fail only if none inserted)

**Improvements**:
- ✅ Migration templates use correct column names from start
- ✅ Safe to run migrations multiple times (idempotent)
- ✅ Better error messages with solutions
- ✅ Column name detection workflow
- ✅ Auto-detection queries for schema validation

**Bug Fixes**:
- 🐛 Fixed: "column does not exist" errors due to wrong column names
- 🐛 Fixed: "Setting already exists" errors blocking migrations
- 🐛 Fixed: Strict count checks causing failures on re-run
- 🐛 Fixed: Missing ON CONFLICT causing duplicate key errors

### Version 2.0.0 (2026-02-28)
- ✅ Added migration file generation capability
- ✅ Auto-detection of next migration number
- ✅ Complete migration template with verification and rollback
- ✅ Documentation generation for each setting

### Version 1.0.0 (2026-01-31)
- ✅ Initial version with direct DB insertion workflow
- ✅ Basic validation and prerequisites checking
- ✅ Profile values support
- ✅ Feature flags integration
