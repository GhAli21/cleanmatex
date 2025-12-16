# Tenant Initialization System

**Created:** 2025-10-23
**Status:** Active
**Migrations:** 0009, 0010

---

## Overview

CleanMateX uses an automated tenant initialization system that creates all required data structures when a new tenant is created. This includes subscription setup, branch creation, service category enablement, and optional admin user creation.

---

## Architecture

### Components

1. **Migration 0009:** `0009_create_demo_admin_user.sql`
   - Creates helper functions for auth user creation
   - Auto-creates demo admin user for development
   - Provides fallback for manual user creation

2. **Migration 0010:** `0010_tenant_auto_initialization.sql`
   - Defines `initialize_new_tenant()` function
   - Creates trigger for automatic initialization
   - Sets up complete tenant environment

3. **Trigger:** `trg_after_tenant_insert`
   - Fires after INSERT on `org_tenants_mst`
   - Auto-initializes all required tenant data
   - Skips known demo/test tenants

---

## What Gets Auto-Created

When a new tenant is created, the system automatically sets up:

### 1. Subscription Record
```sql
INSERT INTO org_subscriptions_mst (
  tenant_org_id,
  plan,           -- 'free'
  status,         -- 'trial'
  orders_limit,   -- 50
  orders_used,    -- 0
  branch_limit,   -- 1
  user_limit,     -- 2
  start_date,     -- NOW()
  end_date,       -- NOW() + 14 days
  trial_ends      -- NOW() + 14 days
)
```

### 2. Main Branch
```sql
INSERT INTO org_branches_mst (
  tenant_org_id,
  branch_name,    -- 'Main Branch'
  address,        -- Inherited from tenant
  city,           -- Inherited from tenant
  phone,          -- Inherited from tenant
  email,          -- Inherited from tenant
  is_active       -- true
)
```

### 3. Service Categories
```sql
INSERT INTO org_service_category_cf (tenant_org_id, service_category_code)
SELECT tenant_id, service_category_code
FROM sys_service_category_cd
WHERE is_active = true
```

Enables all active service categories:
- WASH_AND_IRON
- DRY_CLEAN
- IRON_ONLY
- (Plus any future categories)

### 4. Admin User (Optional)
If email and password are provided:
- Creates user in Supabase Auth
- Auto-confirms email (development)
- Links to tenant with admin role

### 5. Audit Log Entry
Logs the initialization with:
- Tenant ID and name
- Created resource IDs
- Timestamp
- Status (success/error)

---

## Usage

### Automatic (Recommended)

Simply create a new tenant - initialization happens automatically:

```sql
INSERT INTO org_tenants_mst (
  name,
  slug,
  email,
  phone,
  country,
  currency,
  timezone,
  language
)
VALUES (
  'My Laundry Business',
  'my-laundry',
  'owner@my-laundry.com',
  '+96899999999',
  'OM',
  'OMR',
  'Asia/Muscat',
  'en'
)
RETURNING id;
```

The trigger automatically creates:
- ✅ Subscription (14-day free trial)
- ✅ Main branch
- ✅ Service categories enabled
- ✅ Audit log entry

### Manual (Advanced)

Call the function directly with custom options:

```sql
SELECT initialize_new_tenant(
  '<tenant_id>'::UUID,
  'admin@business.com',     -- Admin email
  'SecurePassword123',      -- Admin password
  'Business Owner'          -- Admin display name
);
```

Returns JSONB result:
```json
{
  "success": true,
  "tenant_id": "uuid",
  "tenant_name": "My Laundry Business",
  "resources_created": {
    "subscription_id": "uuid",
    "branch_id": "uuid",
    "admin_user_id": "uuid",
    "service_categories_count": 3
  },
  "errors": [],
  "initialized_at": "2025-10-23T12:00:00Z"
}
```

---

## Admin User Creation

### Automatic (via Migration)

For the demo tenant, migration 0009 automatically creates:
```
Email:    admin@demo-laundry.local
Password: Admin123
Role:     admin
Tenant:   11111111-1111-1111-1111-111111111111
```

### Manual (via Script)

If automatic creation fails or for additional users:

```bash
cd web-admin
node ../scripts/create-test-user.js
```

### Via Function

Create admin for any tenant:

```sql
SELECT create_and_link_auth_user(
  'admin@tenant.com',
  'Password123',
  '<tenant_id>',
  'Admin Name',
  'admin'
);
```

---

## Checking Initialization Status

### Query Initialization Results

```sql
-- Check if tenant is initialized
SELECT
  t.id,
  t.name,
  EXISTS(SELECT 1 FROM org_subscriptions_mst WHERE tenant_org_id = t.id) as has_subscription,
  EXISTS(SELECT 1 FROM org_branches_mst WHERE tenant_org_id = t.id) as has_branch,
  (SELECT COUNT(*) FROM org_service_category_cf WHERE tenant_org_id = t.id) as service_count,
  (SELECT COUNT(*) FROM org_users_mst WHERE tenant_org_id = t.id AND role = 'admin') as admin_count
FROM org_tenants_mst t
WHERE t.id = '<tenant_id>';
```

### Check Audit Log

```sql
SELECT *
FROM sys_audit_log
WHERE action = 'tenant_initialized'
AND tenant_org_id = '<tenant_id>'
ORDER BY created_at DESC;
```

---

## Error Handling

The system is designed to be resilient:

### Idempotent Operations
- Safe to run initialization multiple times
- Skips resources that already exist
- Returns warnings instead of errors

### Partial Success
If some operations fail:
- System continues with remaining operations
- Errors are collected in result object
- Audit log records partial success

### Manual Recovery

If initialization fails completely:

1. **Check what's missing:**
   ```sql
   SELECT * FROM check_tenant_initialization('<tenant_id>');
   ```

2. **Manually create missing resources:**
   ```sql
   -- Create subscription
   INSERT INTO org_subscriptions_mst ...

   -- Create branch
   INSERT INTO org_branches_mst ...

   -- Enable services
   INSERT INTO org_service_category_cf ...
   ```

3. **Or re-run initialization:**
   ```sql
   SELECT initialize_new_tenant('<tenant_id>');
   ```

---

## Configuration

### Skipping Demo Tenants

The trigger skips these known UUIDs:
- `11111111-1111-1111-1111-111111111111` (Demo tenant)
- `22222222-2222-2222-2222-222222222222` (Test tenant 2)

To add more skip UUIDs, modify the trigger:

```sql
CREATE OR REPLACE FUNCTION trg_auto_initialize_tenant()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'your-uuid-here'  -- Add new skip UUID
  ) THEN
    RAISE NOTICE 'Skipping auto-initialization for demo/test tenant';
    RETURN NEW;
  END IF;
  -- ...
END;
$$ LANGUAGE plpgsql;
```

### Default Plan Limits

Modify in `initialize_new_tenant()` function:

```sql
INSERT INTO org_subscriptions_mst (
  orders_limit,   -- Change from 50
  branch_limit,   -- Change from 1
  user_limit      -- Change from 2
)
```

---

## Testing

### Test Auto-Initialization

```sql
-- Create test tenant
INSERT INTO org_tenants_mst (
  name,
  slug,
  email,
  phone
)
VALUES (
  'Test Laundry',
  'test-laundry-' || gen_random_uuid()::text,
  'test@example.com',
  '+96800000000'
)
RETURNING id;

-- Verify initialization (wait a moment for trigger)
SELECT * FROM check_tenant_initialization('<tenant_id_from_above>');

-- Check audit log
SELECT *
FROM sys_audit_log
WHERE action = 'tenant_initialized'
ORDER BY created_at DESC
LIMIT 1;
```

### Test Manual Initialization

```sql
-- Call function directly
SELECT initialize_new_tenant(
  '<existing_tenant_id>',
  'test@tenant.com',
  'TestPassword123',
  'Test Admin'
);

-- Should return success with created resource IDs
```

---

## Troubleshooting

### Issue: Trigger Not Firing

**Symptoms:** New tenant created but no subscription/branch

**Check:**
```sql
-- Verify trigger exists
SELECT * FROM information_schema.triggers
WHERE trigger_name = 'trg_after_tenant_insert';

-- Check PostgreSQL logs
-- Look for RAISE NOTICE messages
```

**Fix:**
```sql
-- Manually initialize
SELECT initialize_new_tenant('<tenant_id>');
```

### Issue: Admin User Not Created

**Symptoms:** Tenant initialized but no admin user

**Causes:**
1. pg_net extension not available
2. Auth API call failed
3. No email provided

**Solutions:**
```bash
# Option 1: Use script
cd web-admin
node ../scripts/create-test-user.js

# Option 2: Use Supabase Studio
# Navigate to Authentication > Users > Add User

# Option 3: Call function directly
SELECT create_and_link_auth_user(
  'admin@tenant.com',
  'Password123',
  '<tenant_id>',
  'Admin Name'
);
```

### Issue: Duplicate Resource Errors

**Symptoms:** Initialization fails with "already exists" errors

**Expected Behavior:** Function should handle this gracefully

**Check:**
```sql
-- Review initialization result
SELECT initialize_new_tenant('<tenant_id>');
-- Look at "errors" array in result
```

**Action:** If errors are present but resources exist, system is working correctly

---

## Migration Rollback

If you need to undo these migrations:

```sql
BEGIN;

-- Remove trigger
DROP TRIGGER IF EXISTS trg_after_tenant_insert ON org_tenants_mst;

-- Remove functions
DROP FUNCTION IF EXISTS trg_auto_initialize_tenant CASCADE;
DROP FUNCTION IF EXISTS initialize_new_tenant CASCADE;
DROP FUNCTION IF EXISTS create_and_link_auth_user CASCADE;
DROP FUNCTION IF EXISTS generate_manual_auth_user_commands CASCADE;
DROP FUNCTION IF EXISTS create_auth_user_via_http CASCADE;

-- Remove extension (if not used elsewhere)
DROP EXTENSION IF EXISTS pg_net;

COMMIT;
```

**⚠️ Warning:** This only removes the automation. It does NOT delete tenant data.

---

## Best Practices

### For Production

1. **Don't include admin credentials in migrations**
   - Create admin users separately
   - Use secure password management
   - Implement email verification

2. **Customize default limits**
   - Adjust based on business model
   - Consider different trial periods
   - Set appropriate resource limits

3. **Monitor initialization success**
   - Review audit logs regularly
   - Alert on initialization failures
   - Track initialization metrics

### For Development

1. **Use migrations for demo data**
   - Keep demo credentials simple
   - Document clearly
   - Separate from production

2. **Test initialization regularly**
   - Include in integration tests
   - Verify all resources created
   - Test error scenarios

3. **Keep initialization fast**
   - Minimize external API calls
   - Use batch operations where possible
   - Log progress for debugging

---

## See Also

- [Creating Tenants Guide](./CREATING_TENANTS.md)
- [Test Credentials](./TEST_CREDENTIALS.md)
- [Database Conventions](../../.claude/docs/database_conventions.md)
- [Multi-Tenancy Rules](../../.claude/docs/multitenancy.md)

---

**Last Updated:** 2025-10-23
**Maintainer:** CleanMateX Development Team
