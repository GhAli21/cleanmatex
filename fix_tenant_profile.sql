-- Solution: Assign GCC_OM_MAIN profile to the tenant

-- Update tenant to use GCC_OM_MAIN profile
UPDATE org_tenants_mst
SET 
    stng_profile_code = 'GCC_OM_MAIN',
    updated_at = CURRENT_TIMESTAMP,
    updated_by = 'system_admin'
WHERE id = '11111111-1111-1111-1111-111111111111';

-- Verify the update
SELECT 
    id,
    stng_profile_code,
    updated_at
FROM org_tenants_mst
WHERE id = '11111111-1111-1111-1111-111111111111';

-- Now test resolution again
SELECT 
    stng_code,
    stng_value_jsonb,
    stng_source_layer,
    stng_source_id
FROM fn_stng_resolve_all_settings(
    p_tenant_id := '11111111-1111-1111-1111-111111111111',
    p_branch_id := NULL,
    p_user_id := NULL
) 
WHERE stng_code = 'DEFAULT_PHONE_COUNTRY_CODE';

-- Explain the resolution to see all layers
SELECT * FROM fn_stng_explain_setting(
    p_tenant_id := '11111111-1111-1111-1111-111111111111',
    p_setting_code := 'DEFAULT_PHONE_COUNTRY_CODE',
    p_branch_id := NULL,
    p_user_id := NULL
);
