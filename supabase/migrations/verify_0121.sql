-- ================================================================
-- Verification Script for Migration 0121
-- ================================================================
-- Purpose: Verify that DEFAULT_PHONE_COUNTRY_CODE setting was created correctly
-- Usage: Run this after applying migration 0121
-- ================================================================
/*
You can run the verification script using psql. Here are the different ways to execute it:

Option 1: Direct psql Execution (Recommended)

cd F:/jhapp/cleanmatex

psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -f supabase/migrations/verify_0121.sql
Option 2: Using psql with input redirection

cd F:/jhapp/cleanmatex

psql "postgresql://postgres:postgres@localhost:54322/postgres" < supabase/migrations/verify_0121.sql
Option 3: PowerShell (if on Windows)

cd F:\jhapp\cleanmatex

psql "postgresql://postgres:postgres@localhost:54322/postgres" -f supabase/migrations/verify_0121.sql
Option 4: Interactive psql session

# Connect to database
psql "postgresql://postgres:postgres@localhost:54322/postgres"

# Then inside psql, run:
\i supabase/migrations/verify_0121.sql
Option 5: Using Supabase CLI (alternative)

cd F:/jhapp/cleanmatex

# This will show query results in a more formatted way
supabase db execute --file supabase/migrations/verify_0121.sql
What the Script Does
The verification script will:

✅ Check if stng_override_reason column was added
✅ Verify the catalog entry exists
✅ Show all profile values (GCC_MAIN, GCC_OM, GCC_KSA, GCC_UAE)
✅ Count profile values by country code
✅ Test setting resolution with a real tenant
✅ Show the full resolution trace
Expected Output
You should see output like:


════════════════════════════════════════════════════════
🔍 VERIFICATION: Migration 0121
════════════════════════════════════════════════════════

1️⃣ Checking if stng_override_reason column was added...
✅ Column exists: sys_stng_profile_values_dtl.stng_override_reason

2️⃣ Checking catalog entry...
 setting_code            | DEFAULT_PHONE_COUNTRY_CODE
 setting_name            | Country Code
 setting_name2           | رمز الدولة
 stng_category_code      | GENERAL
 stng_scope              | TENANT
 stng_data_type          | TEXT
 default_value           | "+1"
 stng_is_overridable     | f
 stng_is_required        | t
 stng_required_min_layer | SYSTEM_PROFILE

3️⃣ Checking profile values...
 stng_profile_code | stng_profile_name         | country_code | stng_override_reason
-------------------+---------------------------+--------------+----------------------
 GCC_MAIN_PROFILE  | GCC Main Profile          | "+1"         | Default GCC region...
 GCC_KSA_MAIN      | Saudi Arabia Main Profile | "+966"       | Saudi Arabia country...
 GCC_OM_MAIN       | Oman Main Profile         | "+968"       | Oman country code
 GCC_UAE_MAIN      | UAE Main Profile          | "+971"       | UAE country code

4️⃣ Profile value count...
 total_profile_values | usa_count | oman_count | ksa_count | uae_count
----------------------+-----------+------------+-----------+-----------
                    4 |         1 |          1 |         1 |         1

5️⃣ Testing setting resolution...
📝 Test Tenant: [tenant details]
✅ Setting resolved successfully
   Resolved Value: "+968"

════════════════════════════════════════════════════════
✅ VERIFICATION COMPLETE
════════════════════════════════════════════════════════
Just choose the method that works best for your environment! The first option is usually the most straightforward.
*/

\echo ''
\echo '════════════════════════════════════════════════════════'
\echo '🔍 VERIFICATION: Migration 0121'
\echo '════════════════════════════════════════════════════════'
\echo ''
psql "postgresql://postgres:postgres@localhost:54322/postgres" -f supabase/migrations/verify_0121.sql
-- ================================================================
-- 1. Verify Column Exists
-- ================================================================
\echo '1️⃣ Checking if stng_override_reason column was added...'

SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'sys_stng_profile_values_dtl'
      AND column_name = 'stng_override_reason'
    )
    THEN '✅ Column exists: sys_stng_profile_values_dtl.stng_override_reason'
    ELSE '❌ Column missing: sys_stng_profile_values_dtl.stng_override_reason'
  END as column_check;

\echo ''

-- ================================================================
-- 2. Verify Catalog Entry
-- ================================================================
\echo '2️⃣ Checking catalog entry...'

SELECT
  setting_code,
  setting_name,
  setting_name2,
  stng_category_code,
  stng_scope,
  stng_data_type,
  stng_default_value_jsonb as default_value,
  stng_is_overridable,
  stng_is_required,
  stng_required_min_layer,
  created_at
FROM sys_tenant_settings_cd
WHERE setting_code = 'DEFAULT_PHONE_COUNTRY_CODE';

\echo ''
\echo 'Expected: 1 row with setting_code = DEFAULT_PHONE_COUNTRY_CODE'
\echo ''

-- ================================================================
-- 3. Verify Profile Values
-- ================================================================
\echo '3️⃣ Checking profile values...'

SELECT
  pv.stng_profile_code,
  p.stng_profile_name,
  pv.stng_value_jsonb as country_code,
  pv.stng_override_reason,
  pv.created_at
FROM sys_stng_profile_values_dtl pv
JOIN sys_stng_profiles_mst p ON p.stng_profile_code = pv.stng_profile_code
WHERE pv.stng_code = 'DEFAULT_PHONE_COUNTRY_CODE'
ORDER BY pv.stng_profile_code;

\echo ''
\echo 'Expected: 4 rows (GCC_MAIN_PROFILE, GCC_OM_MAIN, GCC_KSA_MAIN, GCC_UAE_MAIN)'
\echo ''

-- ================================================================
-- 4. Count Profile Values
-- ================================================================
\echo '4️⃣ Profile value count...'

SELECT
  COUNT(*) as total_profile_values,
  COUNT(CASE WHEN stng_value_jsonb = '"+1"'::jsonb THEN 1 END) as usa_count,
  COUNT(CASE WHEN stng_value_jsonb = '"+968"'::jsonb THEN 1 END) as oman_count,
  COUNT(CASE WHEN stng_value_jsonb = '"+966"'::jsonb THEN 1 END) as ksa_count,
  COUNT(CASE WHEN stng_value_jsonb = '"+971"'::jsonb THEN 1 END) as uae_count
FROM sys_stng_profile_values_dtl
WHERE stng_code = 'DEFAULT_PHONE_COUNTRY_CODE';

\echo ''
\echo 'Expected: total_profile_values = 4'
\echo ''

-- ================================================================
-- 5. Test Resolution (if tenant exists)
-- ================================================================
\echo '5️⃣ Testing setting resolution with a sample tenant...'

-- Get first active tenant
DO $$
DECLARE
  v_tenant_id UUID;
  v_tenant_name TEXT;
  v_profile_code TEXT;
  v_resolved_value JSONB;
BEGIN
  -- Get a test tenant
  SELECT id, tenant_name, stng_profile_code
  INTO v_tenant_id, v_tenant_name, v_profile_code
  FROM org_tenants_mst
  WHERE is_active = true
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE NOTICE '⚠️  No active tenants found. Skipping resolution test.';
    RETURN;
  END IF;

  RAISE NOTICE '📝 Test Tenant:';
  RAISE NOTICE '   ID: %', v_tenant_id;
  RAISE NOTICE '   Name: %', v_tenant_name;
  RAISE NOTICE '   Profile: %', v_profile_code;
  RAISE NOTICE '';

  -- Test resolution
  SELECT setting_value_jsonb
  INTO v_resolved_value
  FROM fn_stng_resolve_all_settings(
    p_tenant_id := v_tenant_id,
    p_branch_id := NULL,
    p_user_id := NULL
  )
  WHERE setting_code = 'DEFAULT_PHONE_COUNTRY_CODE';

  IF v_resolved_value IS NOT NULL THEN
    RAISE NOTICE '✅ Setting resolved successfully';
    RAISE NOTICE '   Resolved Value: %', v_resolved_value;
    RAISE NOTICE '   Resolution Layer: SYSTEM_PROFILE (expected)';
  ELSE
    RAISE NOTICE '❌ Setting resolution failed';
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Resolution test failed: %', SQLERRM;
END $$;

\echo ''

-- ================================================================
-- 6. Explain Resolution (if tenant exists)
-- ================================================================
\echo '6️⃣ Showing resolution trace...'

WITH first_tenant AS (
  SELECT id
  FROM org_tenants_mst
  WHERE is_active = true
  LIMIT 1
)
SELECT * FROM fn_stng_explain_setting(
  p_tenant_id := (SELECT id FROM first_tenant),
  p_setting_code := 'DEFAULT_PHONE_COUNTRY_CODE',
  p_branch_id := NULL,
  p_user_id := NULL
)
WHERE (SELECT id FROM first_tenant) IS NOT NULL;

\echo ''

-- ================================================================
-- 7. Summary
-- ================================================================
\echo '════════════════════════════════════════════════════════'
\echo '✅ VERIFICATION COMPLETE'
\echo '════════════════════════════════════════════════════════'
\echo ''
\echo 'If all checks passed:'
\echo '  ✓ Column added successfully'
\echo '  ✓ Catalog entry created'
\echo '  ✓ Profile values inserted (4 profiles)'
\echo '  ✓ Setting resolves correctly'
\echo ''
\echo 'Next steps:'
\echo '  1. Update frontend UI to display this setting'
\echo '  2. Test with different tenant profiles'
\echo '  3. Create Kuwait, Bahrain, Qatar profiles (future)'
\echo '  4. Deploy to staging/production'
\echo ''
\echo '════════════════════════════════════════════════════════'
\echo ''
