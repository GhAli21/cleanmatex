# Quick Start: `/add-setting-db` Skill

**Version**: 2.0.0
**Last Updated**: 2026-02-28

---

## What is this skill?

A guided workflow to add new settings to the CleanMateX settings system by **generating a production-ready migration file** that can be applied to the database.

## ✨ New Feature: Migration File Generation

This skill now **automatically generates a complete migration file** with:
- ✅ All SQL for catalog, profiles, flags, and plans
- ✅ Pre-flight validation checks
- ✅ Verification queries
- ✅ Rollback instructions
- ✅ Proper file naming and numbering
- ✅ Ready to commit and deploy

**Output**: `F:/jhapp/cleanmatex/supabase/migrations/XXXX_add_setting_{setting_code}.sql`

---

## How to Use

### 1. Invoke the Skill

```
/add-setting-db
```

That's it! The skill will guide you through the entire process.

---

## What You Need to Provide

The skill will ask you for the following information:

### ✅ Required Information

| Field | Example | Notes |
|-------|---------|-------|
| **Setting Code** | `MAX_CONCURRENT_ORDERS` | Format: `SETTING_CODE` in capital letters - must be unique |
| **Category** | `WORKFLOW` | Must exist in database (WORKFLOW, FINANCE, SECURITY, etc.) |
| **Scope** | `TENANT` | Where setting applies: SYSTEM, TENANT, BRANCH, or USER |
| **Data Type** | `NUMBER` | BOOLEAN, TEXT, NUMBER, DATE, JSON, TEXT_ARRAY, NUMBER_ARRAY |
| **Default Value** | `10` | Default value when not overridden |
| **Validation Rules** | `{"min": 1, "max": 100}` | Optional constraints (can be NULL) |
| **Is Overridable?** | `true` | Can tenants/branches/users override this? |
| **Is Sensitive?** | `false` | Should value be masked in UI (like passwords)? |
| **Requires Restart?** | `false` | Does changing this require app restart? |
| **Name (English)** | `Max Concurrent Orders` | User-friendly name |
| **Name (Arabic)** | `الحد الأقصى للطلبات المتزامنة` | Arabic translation |
| **Description (EN)** | `Maximum orders processed simultaneously` | What this setting does |
| **Description (AR)** | `الحد الأقصى للطلبات المعالجة في آن واحد` | Arabic description |
| **UI Component** | `number-input` | How to render: `toggle`, `text-input`, `number-input`, `select`, etc. |
| **UI Group** | `Order Processing` | Logical grouping for UI |
| **Display Order** | `10` | Sort order in UI (1-100) |

### 🔧 Optional Information

| Field | Example | When to Use |
|-------|---------|-------------|
| **Profile Values** | `GCC_OM_SME: 5, GCC_OM_ENTERPRISE: 20` | Different defaults for regions/segments |
| **Feature Flag Dependencies** | `["feature.advanced_workflows"]` | Setting depends on feature flags |
| **Plan Mappings** | `starter: 3, pro: 10, enterprise: NULL` | Plan-specific limits |

---

## Workflow Steps

The skill will guide you through:

```
Step 1: Gather Requirements 🎯
  ↓ (You provide the information above)

Step 2: Validate Prerequisites ✅
  ↓ (Skill checks database for conflicts/missing data)

Step 3: Generate Migration File 📄
  ↓ (Creates complete SQL migration file)
  ↓ (File: XXXX_add_setting_{setting_code}.sql)

Step 4: Save Migration File 💾
  ↓ (Saves to F:/jhapp/cleanmatex/supabase/migrations/)

Step 5: Generate Documentation 📚
  ↓ (Creates markdown docs)

Step 6: Generate Summary 📋
  ✓ (Shows what was created and next steps)
```

**What Changed**:
- ✅ Now generates a **single migration file** instead of manual SQL execution
- ✅ Migration file includes **all components** (catalog, profiles, flags, plans)
- ✅ Includes **validation**, **verification**, and **rollback** sections
- ✅ Ready for **git commit** and **deployment**
- ✅ Follows **Supabase migration naming convention**

---

## How to Check if It's Done

### ✅ Success Indicators

At the end, you'll see:

```
════════════════════════════════════════════════════════
✅ MIGRATION FILE GENERATED SUCCESSFULLY!
════════════════════════════════════════════════════════

Setting Code: workflow.orders.max_concurrent
Migration File: 0088_add_setting_workflow_orders_max_concurrent.sql
Location: F:/jhapp/cleanmatex/supabase/migrations/

📋 Components Included:
  ✓ Catalog Entry: YES
  ✓ Profile Values: 2 profiles
  ✓ Feature Flags: YES
  ✓ Plan Mappings: 4 plans

📄 Migration File Sections:
  ✓ Section 1: Validation (prerequisite checks)
  ✓ Section 2: Catalog Entry (main setting)
  ✓ Section 3: Profile Values (regional defaults)
  ✓ Section 4: Feature Flags (conditional features)
  ✓ Section 5: Plan Mappings (plan-specific limits)
  ✓ Section 6: Verification (post-insert checks)
  ✓ Section 7: Rollback (undo instructions)

🎯 Next Steps:
  1. Review the generated migration file
  2. Commit to git: git add supabase/migrations/0088_*.sql
  3. Apply migration: supabase migration up
  4. Test resolution with a real tenant
  5. Update frontend UI to display this setting
  6. Deploy to staging, then production
════════════════════════════════════════════════════════
```

### 📄 Check Migration File

```bash
# Check if file was created
ls -lh F:/jhapp/cleanmatex/supabase/migrations/0088_add_setting_*.sql

# View the file
cat F:/jhapp/cleanmatex/supabase/migrations/0088_add_setting_*.sql

# Check migration file structure
grep -E "^-- ===" F:/jhapp/cleanmatex/supabase/migrations/0088_add_setting_*.sql
```

**Expected Output**:
```
-- ================================================================
-- Migration: Add Setting - workflow.orders.max_concurrent
-- ================================================================
-- SECTION 1: VALIDATION
-- ================================================================
-- SECTION 2: CATALOG ENTRY
-- ================================================================
-- SECTION 3: PROFILE VALUES (Optional)
-- ================================================================
-- SECTION 6: VERIFICATION
-- ================================================================
-- SECTION 7: ROLLBACK
-- ================================================================
```

### 🔍 Apply and Verify Migration

#### Step 1: Apply the Migration

```bash
# Navigate to cleanmatex project
cd F:/jhapp/cleanmatex

# Apply the migration
supabase migration up

# OR reset database (includes all migrations)
supabase db reset
```

**Expected Output**:
```
Applying migration 0088_add_setting_workflow_orders_max_concurrent...
✅ Prerequisites validated successfully
✅ Catalog entry created: workflow.orders.max_concurrent
✅ Profile values created: 2 profiles
✅ MIGRATION COMPLETED SUCCESSFULLY
```

#### Step 2: Verify in Database

```sql
-- 1. Check catalog entry
SELECT
  setting_code,
  stng_name,
  stng_category_code,
  stng_scope,
  stng_data_type,
  stng_default_value_jsonb,
  stng_validation_jsonb,
  stng_is_overridable
FROM sys_tenant_settings_cd
WHERE setting_code = 'MAX_CONCURRENT_ORDERS';
```

**Expected**: 1 row with your setting details

```sql
-- 2. Check profile values (if added)
SELECT
  pv.stng_profile_code,
  p.stng_profile_name,
  pv.stng_value_jsonb,
  pv.stng_override_reason
FROM sys_stng_profile_values_dtl pv
JOIN sys_stng_profiles_mst p ON p.stng_profile_code = pv.stng_profile_code
WHERE pv.stng_code = 'MAX_CONCURRENT_ORDERS'
ORDER BY pv.stng_profile_code;
```

**Expected**: Rows for each profile you configured

#### Step 3: Test Resolution with Real Tenant

```sql
-- Get a test tenant first
SELECT id, tenant_name, stng_profile_code
FROM org_tenants_mst
WHERE is_active = true
LIMIT 1;

-- Test resolution
SELECT * FROM fn_stng_resolve_all_settings(
  p_tenant_id := '<TENANT_ID>',
  p_branch_id := NULL,
  p_user_id := NULL
) WHERE setting_code = 'MAX_CONCURRENT_ORDERS';
```

**Expected**: Your setting with resolved value

#### Step 4: Explain Resolution (Full Trace)

```sql
SELECT * FROM fn_stng_explain_setting(
  p_tenant_id := '<TENANT_ID>',
  p_setting_code := 'MAX_CONCURRENT_ORDERS',
  p_branch_id := NULL,
  p_user_id := NULL
);
```

**Expected**: JSON trace showing all 7 layers and which one was chosen

#### Step 5: Commit to Git

```bash
cd F:/jhapp/cleanmatex

# Add migration file
git add supabase/migrations/0088_add_setting_*.sql

# Commit
git commit -m "feat(settings): Add workflow.orders.max_concurrent setting

- Added setting to control max concurrent order processing
- Profile values: GCC_OM_SME (5), GCC_OM_ENTERPRISE (20)
- Category: WORKFLOW, Scope: TENANT, Type: NUMBER"

# Push
git push origin main
```

---

## Common Issues & Solutions

### ❌ Error: "Setting already exists"

**Problem**: Setting code is not unique
**Solution**: Choose a different code or update existing setting

```sql
-- Check if setting exists
SELECT * FROM sys_tenant_settings_cd WHERE setting_code = 'your.code';
```

### ❌ Error: "Category does not exist"

**Problem**: Invalid category code
**Solution**: Use existing category or create new one first

```sql
-- List available categories
SELECT stng_category_code, stng_category_name
FROM sys_stng_categories_cd
ORDER BY stng_category_name;
```

### ❌ Error: "Invalid JSONB syntax"

**Problem**: Incorrect JSONB formatting
**Solution**: Use proper JSONB format

```sql
-- ✅ Correct
'10'::jsonb                    -- NUMBER
'true'::jsonb                  -- BOOLEAN
'"hello"'::jsonb               -- TEXT (note the quotes!)
'["a", "b"]'::jsonb            -- ARRAY
'{"key": "value"}'::jsonb      -- JSON

-- ❌ Wrong
10                             -- Missing ::jsonb
'hello'::jsonb                 -- String not quoted
```

### ⚠️ Warning: "Setting not resolving correctly"

**Problem**: Resolution not returning expected value
**Solution**: Use explain function to debug

```sql
SELECT * FROM fn_stng_explain_setting(
  p_tenant_id := '<TENANT_ID>',
  p_setting_code := 'your.setting.code'
);
-- Shows full resolution trace with all layers
```

---

## Quick Examples

### Example 1: Simple Boolean Toggle

```
Setting Code: AUTO_SEND_INVOICES
Category: FINANCE
Scope: TENANT
Data Type: BOOLEAN
Default Value: false
Validation: NULL
Is Overridable: true
Is Sensitive: false
Requires Restart: false
Name (EN): Auto-send Invoices
Name (AR): إرسال الفواتير تلقائياً
Description (EN): Automatically send invoices to customers
Description (AR): إرسال الفواتير تلقائياً للعملاء
UI Component: toggle
UI Group: Invoicing
Display Order: 10
```

### Example 2: Number with Min/Max

```
Setting Code: SESSION_TIMEOUT_MINUTES
Category: SECURITY
Scope: TENANT
Data Type: NUMBER
Default Value: 30
Validation: {"min": 5, "max": 1440, "step": 5}
Is Overridable: true
Is Sensitive: false
Requires Restart: true
Name (EN): Session Timeout (minutes)
Name (AR): مهلة الجلسة (بالدقائق)
Description (EN): User session timeout in minutes
Description (AR): مهلة جلسة المستخدم بالدقائق
UI Component: number-input
UI Group: Authentication
Display Order: 20
```

### Example 3: Dropdown Selection

```
Setting Code: DEFAULT_CURRENCY
Category: FINANCE
Scope: TENANT
Data Type: TEXT
Default Value: "OMR"
Validation: {"enum": ["OMR", "SAR", "AED", "KWD", "BHD", "QAR", "USD"]}
Is Overridable: true
Is Sensitive: false
Requires Restart: false
Name (EN): Default Currency
Name (AR): العملة الافتراضية
Description (EN): Default currency for transactions
Description (AR): العملة الافتراضية للمعاملات
UI Component: select
UI Group: General
Display Order: 5
```

### Example 4: With Profile Values

```
Setting Code: MAX_CONCURRENT_ORDERS
Category: WORKFLOW
Scope: TENANT
Data Type: NUMBER
Default Value: 10
Validation: {"min": 1, "max": 50}
Is Overridable: true
Is Sensitive: false
Requires Restart: false

Profile Values:
  - GCC_OM_SME: 5 (reason: "Lower limit for SME")
  - GCC_OM_ENTERPRISE: 20 (reason: "Higher limit for enterprise")
  - GCC_KSA_SME: 5 (reason: "Lower limit for KSA SME")
  - GCC_KSA_ENTERPRISE: 20 (reason: "Higher limit for KSA enterprise")

Name (EN): Max Concurrent Orders
Name (AR): الحد الأقصى للطلبات المتزامنة
Description (EN): Maximum orders processed simultaneously
Description (AR): الحد الأقصى للطلبات المعالجة في آن واحد
UI Component: number-input
UI Group: Order Processing
Display Order: 15
```

---

## Best Practices

### ✅ DO

- **Use meaningful codes**: Follow `SETTING_CODE` pattern in capital letters
- **Include Arabic translations**: Support bilingual interface
- **Add validation rules**: Prevent invalid values
- **Document the purpose**: Clear description helps users understand
- **Test resolution**: Verify with real tenants before deploying
- **Use transactions**: Skill wraps inserts in BEGIN/COMMIT for safety
- **Set profile values**: Configure regional/segment defaults if needed

### ❌ DON'T

- **Don't skip validation**: Always let skill validate prerequisites
- **Don't hardcode IDs**: Use codes instead (profiles, categories, flags)
- **Don't use duplicate codes**: Check if setting exists first
- **Don't skip testing**: Always verify resolution works correctly
- **Don't forget audit fields**: Skill handles this automatically
- **Don't use invalid JSONB**: Follow the correct format templates

---

## What Happens After Creation?

### Immediate Next Steps

1. **Test Resolution**: Verify setting resolves correctly for test tenants
2. **Update Frontend UI**: Add setting to appropriate UI screen
3. **Update Documentation**: Add to user guide and API docs
4. **Test in Staging**: Deploy to staging and test thoroughly
5. **Deploy to Production**: Roll out to production environment

### Where the Setting Appears

- **Settings Catalog Screen**: Platform HQ → Settings → Catalog
- **Profile Values Screen**: Platform HQ → Settings → Profile Values
- **Feature Flags Screen**: Platform HQ → Feature Flags (if flag dependency)
- **Tenant Settings UI**: Tenant Console → Settings (if overridable)
- **API Endpoints**:
  - `GET /api/hq/v1/settings/tenants/{tenantId}/effective`
  - `GET /api/hq/v1/settings/tenants/{tenantId}/explain/{settingCode}`

---

## API Usage After Creation

Once created, the setting is available via API:

### Get Effective Settings

```bash
curl -X GET \
  "http://localhost:3002/api/hq/v1/settings/tenants/{tenantId}/effective" \
  -H "Authorization: Bearer <token>"
```

**Response**:
```json
{
  "data": {
    "workflow.orders.max_concurrent": {
      "value": 15,
      "layer": "SYSTEM_PROFILE",
      "dataType": "NUMBER"
    }
  }
}
```

### Explain Setting Resolution

```bash
curl -X GET \
  "http://localhost:3002/api/hq/v1/settings/tenants/{tenantId}/explain/workflow.orders.max_concurrent" \
  -H "Authorization: Bearer <token>"
```

**Response**:
```json
{
  "data": {
    "settingCode": "workflow.orders.max_concurrent",
    "effectiveValue": 15,
    "effectiveLayer": "SYSTEM_PROFILE",
    "resolutionTrace": {
      "SYSTEM_DEFAULT": { "value": 10, "skipped": true },
      "SYSTEM_PROFILE": {
        "value": 15,
        "chosen": true,
        "profileCode": "GCC_OM_ENTERPRISE"
      },
      "TENANT_OVERRIDE": { "value": null }
    }
  }
}
```

---

## Benefits of Migration File Approach

### ✅ Version Control
- Migration files are tracked in git
- Full history of when settings were added
- Easy to review changes in pull requests
- Rollback is documented in the migration file

### ✅ Deployment Safety
- Migrations run in transactions (atomic)
- Validation checks prevent errors
- Verification ensures success
- Clear error messages if something fails

### ✅ Team Collaboration
- Other developers can see what settings exist
- Migration files serve as documentation
- No manual SQL copy-paste errors
- Consistent format across all settings

### ✅ Environment Consistency
- Same migration file runs in dev, staging, and production
- Guaranteed identical schema across environments
- No drift between environments
- Automated deployment pipelines

### ✅ Auditability
- Clear audit trail of when/who/why
- Migration number provides chronological order
- Git blame shows who created each setting
- Comments explain business purpose

---

## Summary Checklist

After running `/add-setting-db`, verify:

- [ ] ✅ Migration file generated in `F:/jhapp/cleanmatex/supabase/migrations/`
- [ ] ✅ Migration file includes all sections (validation, catalog, profiles, flags, verification, rollback)
- [ ] ✅ Migration file committed to git
- [ ] ✅ Migration applied: `supabase migration up`
- [ ] ✅ Setting appears in `sys_tenant_settings_cd`
- [ ] ✅ Profile values added (if configured)
- [ ] ✅ Feature flag created (if needed)
- [ ] ✅ Plan mappings created (if plan-bound)
- [ ] ✅ Resolution works for test tenant
- [ ] ✅ Explain shows correct resolution trace
- [ ] ✅ Setting appears in API responses
- [ ] ✅ Documentation generated
- [ ] ✅ Frontend UI updated (manual step)
- [ ] ✅ Deployed to staging/production (manual step)

---

## Need Help?

- **Documentation**: See full skill guide in `add-setting-db/skill.md`
- **Settings Architecture**: See `docs/dev/settings/architecture.md`
- **Resolution System**: See `docs/dev/settings/resolution.md`
- **Feature Flags**: See `docs/dev/settings/feature-flags.md`
- **GitHub Issues**: Report problems or request features
- **Platform Team**: Contact for complex scenarios

---

**Skill Version**: 1.0.0
**Maintained by**: CleanMateX Platform Team
**Last Updated**: 2026-02-28
