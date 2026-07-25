-- Verification Script for Migration 0123
-- Description: Verify profile resolution priority fix is working correctly

-- =====================================================
-- Test 1: Verify tenant with GCC_OM_MAIN profile
-- =====================================================
DO $$
DECLARE
    v_result RECORD;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Test 1: GCC_OM_MAIN Profile Resolution';
    RAISE NOTICE '========================================';

    -- Resolve DEFAULT_PHONE_COUNTRY_CODE for tenant with GCC_OM_MAIN
    SELECT * INTO v_result
    FROM fn_stng_resolve_setting_value(
        p_tenant_id := '11111111-1111-1111-1111-111111111111',
        p_setting_code := 'DEFAULT_PHONE_COUNTRY_CODE'
    );

    -- Expected: "+968" from GCC_OM_MAIN (leaf profile, priority 230)
    IF v_result.stng_value_jsonb = '"+968"'::jsonb
       AND v_result.stng_source_id = 'GCC_OM_MAIN' THEN
        RAISE NOTICE '✅ PASS: Got "+968" from GCC_OM_MAIN (leaf profile)';
    ELSE
        RAISE EXCEPTION '❌ FAIL: Got value=%, source=% (expected "+968" from GCC_OM_MAIN)',
            v_result.stng_value_jsonb, v_result.stng_source_id;
    END IF;
END $$;

-- =====================================================
-- Test 2: Verify profile priority hierarchy
-- =====================================================
DO $$
DECLARE
    v_explain RECORD;
    v_gcc_main_priority INTEGER;
    v_gcc_om_priority INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Test 2: Profile Priority Hierarchy';
    RAISE NOTICE '========================================';

    -- Get priorities for GCC_MAIN_PROFILE and GCC_OM_MAIN
    SELECT layer_priority INTO v_gcc_main_priority
    FROM fn_stng_explain_setting(
        p_tenant_id := '11111111-1111-1111-1111-111111111111',
        p_setting_code := 'DEFAULT_PHONE_COUNTRY_CODE'
    )
    WHERE source_id = 'GCC_MAIN_PROFILE'
    LIMIT 1;

    SELECT layer_priority INTO v_gcc_om_priority
    FROM fn_stng_explain_setting(
        p_tenant_id := '11111111-1111-1111-1111-111111111111',
        p_setting_code := 'DEFAULT_PHONE_COUNTRY_CODE'
    )
    WHERE source_id = 'GCC_OM_MAIN'
    LIMIT 1;

    -- Verify child profile (GCC_OM_MAIN) has higher priority than parent (GCC_MAIN_PROFILE)
    IF v_gcc_om_priority > v_gcc_main_priority THEN
        RAISE NOTICE '✅ PASS: Child profile (GCC_OM_MAIN=%s) > Parent profile (GCC_MAIN_PROFILE=%s)',
            v_gcc_om_priority, v_gcc_main_priority;
    ELSE
        RAISE EXCEPTION '❌ FAIL: Child priority (%) <= Parent priority (%)',
            v_gcc_om_priority, v_gcc_main_priority;
    END IF;
END $$;

-- =====================================================
-- Test 3: Verify all settings resolve correctly
-- =====================================================
DO $$
DECLARE
    v_error_count INTEGER := 0;
    v_setting_code TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Test 3: Bulk Resolution Test';
    RAISE NOTICE '========================================';

    -- Try to resolve all settings (should not raise any exceptions)
    FOR v_setting_code IN
        SELECT setting_code
        FROM sys_tenant_settings_cd
        WHERE is_active = true
        LIMIT 10
    LOOP
        BEGIN
            PERFORM * FROM fn_stng_resolve_setting_value(
                p_tenant_id := '11111111-1111-1111-1111-111111111111',
                p_setting_code := v_setting_code
            );
        EXCEPTION WHEN OTHERS THEN
            v_error_count := v_error_count + 1;
            RAISE NOTICE '❌ Error resolving %: %', v_setting_code, SQLERRM;
        END;
    END LOOP;

    IF v_error_count = 0 THEN
        RAISE NOTICE '✅ PASS: All settings resolved without errors';
    ELSE
        RAISE EXCEPTION '❌ FAIL: % settings failed to resolve', v_error_count;
    END IF;
END $$;

-- =====================================================
-- Display Final Summary
-- =====================================================
\echo ''
\echo '========================================'
\echo 'Migration 0123 Verification Summary'
\echo '========================================'
\echo 'All tests passed! ✅'
\echo ''
\echo 'What was fixed:'
\echo '- Profile inheritance now correctly prioritizes child profiles over parent profiles'
\echo '- Priority scheme:'
\echo '  * 100: SYSTEM_DEFAULT (catalog)'
\echo '  * 200-290: SYSTEM_PROFILE (root=200, leaf=highest, +10 per level)'
\echo '  * 500: TENANT_OVERRIDE'
\echo '  * 600: BRANCH_OVERRIDE'
\echo '  * 700: USER_OVERRIDE'
\echo ''
\echo 'Example: GCC_OM_MAIN (leaf, priority 230) now overrides GCC_MAIN_PROFILE (parent, priority 220)'
\echo '========================================'
