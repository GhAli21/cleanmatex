# Migration 0121: DEFAULT_PHONE_COUNTRY_CODE Setting

## Summary

This migration creates a new **profile-based, non-overridable** setting for default phone country codes in the CleanMateX platform.

## Setting Details

### Basic Information
- **Setting Code**: `DEFAULT_PHONE_COUNTRY_CODE`
- **Category**: GENERAL
- **Scope**: TENANT
- **Data Type**: TEXT
- **Default Value**: `"+968"` (Oman - fallback)

### Behavior
- **Is Overridable**: `false` - Tenants CANNOT override (unless profile value is null)
- **Is Sensitive**: `false`
- **Requires Restart**: `false`
- **Is Required**: `true` - Must have a value
- **Allows Null**: `false`
- **Required Min Layer**: `SYSTEM_PROFILE` - Prefer profile value

### Validation
- **Regex**: `^\+\d{1,3}$`
- **Description**: Must be + followed by 1-3 digits

## Profile Values

The migration creates profile-specific country codes for GCC countries:

| Profile Code | Country | Country Code | Status |
|--------------|---------|--------------|--------|
| `GCC_MAIN_PROFILE` | GCC Default (Oman) | `+968` | ✅ Created |
| `GCC_OM_MAIN` | Oman | `+968` | ✅ Created |
| `GCC_KSA_MAIN` | Saudi Arabia | `+966` | ✅ Created |
| `GCC_UAE_MAIN` | UAE | `+971` | ✅ Created |
| `GCC_KWT_MAIN` | Kuwait | `+965` | 📝 Future (commented) |
| `GCC_BHR_MAIN` | Bahrain | `+973` | 📝 Future (commented) |
| `GCC_QAT_MAIN` | Qatar | `+974` | 📝 Future (commented) |

## GCC Country Codes Reference

Based on web search results, here are the official phone country codes for GCC countries:

- **+965** – Kuwait
- **+966** – Saudi Arabia (KSA)
- **+968** – Oman
- **+971** – United Arab Emirates (UAE)
- **+973** – Bahrain
- **+974** – Qatar

**Source**: [List of telephone country codes - Wikipedia](https://en.wikipedia.org/wiki/List_of_telephone_country_codes)

## Migration File

**Location**: `F:/jhapp/cleanmatex/supabase/migrations/0121_add_setting_general_phone_default_country_code.sql`

## How to Apply

### Option 1: Using Supabase CLI (Recommended)

```bash
# Navigate to cleanmatex project
cd F:/jhapp/cleanmatex

# Apply all pending migrations
supabase migration up

# OR apply specific migration
supabase migration up --db-url "postgresql://postgres:postgres@localhost:54322/postgres"
```

### Option 2: Using psql directly

```bash
# Navigate to cleanmatex project
cd F:/jhapp/cleanmatex

# Run the migration
psql "postgresql://postgres:postgres@localhost:54322/postgres" -f supabase/migrations/0121_add_setting_general_phone_default_country_code.sql
```

## Verification Steps

After applying the migration:

### 1. Verify Catalog Entry

```sql
SELECT
  setting_code,
  setting_name,
  stng_category_code,
  stng_scope,
  stng_data_type,
  stng_default_value_jsonb,
  stng_validation_jsonb,
  stng_is_overridable,
  stng_is_required,
  stng_required_min_layer
FROM sys_tenant_settings_cd
WHERE setting_code = 'DEFAULT_PHONE_COUNTRY_CODE';
```

**Expected**: 1 row with:
- `setting_code = 'DEFAULT_PHONE_COUNTRY_CODE'`
- `setting_name = 'Country Code'`
- `stng_is_overridable = false`
- `stng_is_required = true`
- `stng_required_min_layer = 'SYSTEM_PROFILE'`

### 2. Verify Profile Values

```sql
SELECT
  pv.stng_profile_code,
  p.stng_profile_name,
  pv.stng_value_jsonb as country_code,
  pv.stng_override_reason
FROM sys_stng_profile_values_dtl pv
JOIN sys_stng_profiles_mst p ON p.stng_profile_code = pv.stng_profile_code
WHERE pv.stng_code = 'DEFAULT_PHONE_COUNTRY_CODE'
ORDER BY pv.stng_profile_code;
```

**Expected**: 4 rows:
- `GCC_MAIN_PROFILE → "+968"`
- `GCC_OM_MAIN → "+968"`
- `GCC_KSA_MAIN → "+966"`
- `GCC_UAE_MAIN → "+971"`

### 3. Test Resolution with a Tenant

```sql
-- Get a test tenant first
SELECT id, tenant_name, stng_profile_code
FROM org_tenants_mst
WHERE is_active = true
LIMIT 1;

-- Test resolution (replace <tenant_id> with actual ID)
SELECT * FROM fn_stng_resolve_all_settings(
  p_tenant_id := '<tenant_id>',
  p_branch_id := NULL,
  p_user_id := NULL
) WHERE setting_code = 'DEFAULT_PHONE_COUNTRY_CODE';
```

**Expected**: Setting resolves to the country code matching the tenant's profile.

### 4. Explain Resolution

```sql
-- See full resolution trace
SELECT * FROM fn_stng_explain_setting(
  p_tenant_id := '<tenant_id>',
  p_setting_code := 'DEFAULT_PHONE_COUNTRY_CODE',
  p_branch_id := NULL,
  p_user_id := NULL
);
```

**Expected**: Shows resolution trace with profile value winning.

## Key Features

### 1. Non-Overridable by Tenants
- Tenants **CANNOT** change their country code via UI or API
- Value is strictly determined by their assigned profile
- Ensures consistency across regional deployments

### 2. Profile-Based Resolution
- Each region/country gets the appropriate country code
- Saudi tenants always get `+966`
- UAE tenants always get `+971`
- Oman tenants always get `+968`

### 3. Validation Enforced
- All country codes must match format: `^\+\d{1,3}$`
- Prevents invalid country codes
- Database-level constraint via JSONB validation

### 4. Fallback to Default
- If a tenant's profile has no value configured
- Falls back to `+968` (Oman default)
- Ensures setting always has a value

## Future Enhancements

When Kuwait, Bahrain, and Qatar profiles are created:

1. Uncomment the relevant sections in the migration file
2. Create the profiles in `sys_stng_profiles_mst`
3. Run the insert statements for those profiles
4. Verify the profile values are created

## Rollback Instructions

If you need to rollback this migration:

```sql
-- 1. Delete profile values
DELETE FROM sys_stng_profile_values_dtl
WHERE stng_code = 'DEFAULT_PHONE_COUNTRY_CODE';

-- 2. Delete catalog entry
DELETE FROM sys_tenant_settings_cd
WHERE setting_code = 'DEFAULT_PHONE_COUNTRY_CODE';

-- 3. Verify deletion
SELECT COUNT(*) as remaining_catalog
FROM sys_tenant_settings_cd
WHERE setting_code = 'DEFAULT_PHONE_COUNTRY_CODE';
-- Expected: 0

SELECT COUNT(*) as remaining_profiles
FROM sys_stng_profile_values_dtl
WHERE stng_code = 'DEFAULT_PHONE_COUNTRY_CODE';
-- Expected: 0
```

## Frontend Integration

### Display in UI
- Show as **read-only** field
- Cannot be edited by tenants
- Display format: `"+968"` or `"+966"`, etc.
- Label: "Country Code" / "رمز الدولة"

### API Access
```typescript
// Get effective settings (via HQ API)
const settings = await hqApiClient.getEffectiveSettings(tenantId);
const countryCode = settings.DEFAULT_PHONE_COUNTRY_CODE;

// Example: "+968" for Oman tenants
```

### Usage Example
```typescript
// When creating phone number input
const phoneInput = {
  countryCode: settings.DEFAULT_PHONE_COUNTRY_CODE, // From settings
  phoneNumber: userInput // User enters rest of number
};

// Full phone: "+968 91234567"
```

## Migration Execution Output

When you run the migration, you should see output similar to:

```
NOTICE:  ✅ Prerequisites validated successfully
NOTICE:  ✅ Catalog entry created: DEFAULT_PHONE_COUNTRY_CODE
NOTICE:  ✅ Profile values created: 4 profiles
NOTICE:
NOTICE:  ════════════════════════════════════════════════════════
NOTICE:  ✅ MIGRATION COMPLETED SUCCESSFULLY
NOTICE:  ════════════════════════════════════════════════════════
NOTICE:
NOTICE:  Setting Code: DEFAULT_PHONE_COUNTRY_CODE
NOTICE:  Setting Name: Country Code
NOTICE:  Category: GENERAL
NOTICE:  Scope: TENANT
NOTICE:  Data Type: TEXT
NOTICE:  Default Value: "+968"
NOTICE:  Validation: {"regex": "^\+\d{1,3}$", "description": "Must be + followed by 1-3 digits"}
NOTICE:  Is Overridable: f
NOTICE:  Is Required: t
NOTICE:  Required Min Layer: SYSTEM_PROFILE
...
```

## Questions or Issues?

If you encounter any issues:

1. Check that Supabase is running: `http://localhost:54323`
2. Verify database connection: `psql "postgresql://postgres:postgres@localhost:54322/postgres"`
3. Check existing settings: `SELECT * FROM sys_tenant_settings_cd;`
4. Check profiles exist: `SELECT * FROM sys_stng_profiles_mst;`

## Related Documentation

- Settings Architecture: `docs/dev/settings/architecture.md`
- 7-Layer Resolution System: `docs/dev/settings/resolution.md`
- Database Conventions: `.claude/docs/database_conventions.md`
- Skill Documentation: `.claude/skills/add-setting-db/`

---

**Created**: 2026-02-28
**Migration**: 0121_add_setting_default_phone_country_code.sql
**Status**: Ready for deployment
