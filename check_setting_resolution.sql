-- Check the setting resolution for DEFAULT_PHONE_COUNTRY_CODE

-- 1. Check tenant's profile assignment
SELECT 
    t.id as tenant_id,
    t.tenant_name,
    t.stng_profile_code,
    t.stng_profile_code_inherited
FROM org_tenants_mst t
WHERE t.id = '11111111-1111-1111-1111-111111111111';

-- 2. Check if setting exists in catalog
SELECT 
    stng_code,
    stng_name,
    default_value,
    is_locked,
    is_required
FROM sys_stng_catalog_mst
WHERE stng_code = 'DEFAULT_PHONE_COUNTRY_CODE';

-- 3. Check GCC_OM_MAIN profile values
SELECT 
    pv.stng_profile_code,
    pv.stng_code,
    pv.stng_value,
    pv.is_locked,
    pv.is_null
FROM sys_stng_profile_values_dtl pv
WHERE pv.stng_profile_code = 'GCC_OM_MAIN'
AND pv.stng_code = 'DEFAULT_PHONE_COUNTRY_CODE';

-- 4. Check profile inheritance chain
WITH RECURSIVE profile_chain AS (
    -- Base case: starting profile
    SELECT 
        stng_profile_code,
        inherit_from_profile_code,
        1 as level
    FROM sys_stng_profiles_mst
    WHERE stng_profile_code = 'GCC_OM_MAIN'
    
    UNION ALL
    
    -- Recursive case: parent profiles
    SELECT 
        p.stng_profile_code,
        p.inherit_from_profile_code,
        pc.level + 1
    FROM sys_stng_profiles_mst p
    INNER JOIN profile_chain pc ON p.stng_profile_code = pc.inherit_from_profile_code
    WHERE pc.level < 10  -- Prevent infinite loops
)
SELECT * FROM profile_chain ORDER BY level;

-- 5. Check all profile values in the inheritance chain
WITH RECURSIVE profile_chain AS (
    SELECT 
        stng_profile_code,
        inherit_from_profile_code,
        1 as level
    FROM sys_stng_profiles_mst
    WHERE stng_profile_code = 'GCC_OM_MAIN'
    
    UNION ALL
    
    SELECT 
        p.stng_profile_code,
        p.inherit_from_profile_code,
        pc.level + 1
    FROM sys_stng_profiles_mst p
    INNER JOIN profile_chain pc ON p.stng_profile_code = pc.inherit_from_profile_code
    WHERE pc.level < 10
)
SELECT 
    pc.level,
    pc.stng_profile_code,
    pv.stng_code,
    pv.stng_value,
    pv.is_locked,
    pv.is_null
FROM profile_chain pc
LEFT JOIN sys_stng_profile_values_dtl pv 
    ON pv.stng_profile_code = pc.stng_profile_code
    AND pv.stng_code = 'DEFAULT_PHONE_COUNTRY_CODE'
ORDER BY pc.level;

-- 6. Test the resolution function directly
SELECT * FROM fn_stng_resolve_all_settings(
    p_tenant_id := '11111111-1111-1111-1111-111111111111',
    p_branch_id := NULL,
    p_user_id := NULL
) 
WHERE stng_code = 'DEFAULT_PHONE_COUNTRY_CODE';
