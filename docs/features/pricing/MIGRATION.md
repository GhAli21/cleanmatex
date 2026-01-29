# Pricing Feature Migration Guide

## Overview

This guide provides step-by-step instructions for migrating to the new pricing feature, including database migrations, data migration, and configuration.

## Prerequisites

- Supabase CLI installed and configured
- Access to the database (local or remote)
- Backup of existing data
- Admin access to the application

## Migration Steps

### Step 1: Backup Database

```bash
# Using Supabase CLI
supabase db dump -f backup_$(date +%Y%m%d_%H%M%S).sql

# Or using pg_dump directly
pg_dump -h localhost -p 54322 -U postgres -d postgres > backup.sql
```

### Step 2: Review Migration Files

Review the following migration files in `supabase/migrations/`:

1. **0083_add_tax_rate_setting.sql**
   - Adds TAX_RATE setting
   - Seeds default tax rate for existing tenants

2. **0084_enhance_get_product_price_with_tax.sql**
   - Creates enhanced pricing function
   - Returns full pricing breakdown

3. **0085_add_price_history_audit.sql**
   - Creates price history audit table
   - Sets up automatic triggers

4. **0086_add_price_override_fields.sql**
   - Adds price override fields to order items
   - Adds tax rate to orders

### Step 3: Run Migrations

#### Option A: Using Supabase CLI (Recommended)

```bash
# Navigate to project root
cd /path/to/cleanmatex

# Apply all pending migrations
supabase migration up

# Or apply specific migration
supabase migration up --version 0083
```

#### Option B: Using Supabase MCP (Local)

If using Supabase MCP for local development:

```bash
# Migrations are automatically applied when using MCP
# Verify migrations are in supabase/migrations/ directory
```

#### Option C: Manual Application

```bash
# Connect to database
psql -h localhost -p 54322 -U postgres -d postgres

# Run each migration file
\i supabase/migrations/0083_add_tax_rate_setting.sql
\i supabase/migrations/0084_enhance_get_product_price_with_tax.sql
\i supabase/migrations/0085_add_price_history_audit.sql
\i supabase/migrations/0086_add_price_override_fields.sql
```

### Step 4: Verify Migrations

```sql
-- Check TAX_RATE setting exists
SELECT * FROM sys_tenant_settings_cd WHERE setting_code = 'TAX_RATE';

-- Check function exists
SELECT proname FROM pg_proc WHERE proname = 'get_product_price_with_tax';

-- Check price history table exists
SELECT * FROM org_price_history_audit LIMIT 1;

-- Check order items have override fields
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'org_order_items_dtl' 
  AND column_name IN ('price_override', 'override_reason', 'override_by');
```

### Step 5: Configure Tax Rates

For each tenant, configure the tax rate:

#### Via UI (Recommended)

1. Navigate to Settings > Finance
2. Set tax rate (e.g., 0.05 for 5%)
3. Select tax type (VAT, Sales Tax, GST, etc.)
4. Save

#### Via SQL

```sql
-- Set tax rate for a specific tenant
INSERT INTO org_tenant_settings_cf (
  tenant_org_id,
  setting_code,
  setting_value,
  value_jsonb,
  is_active,
  rec_status,
  created_at,
  created_by
) VALUES (
  'your-tenant-id'::uuid,
  'TAX_RATE',
  '0.05',
  '0.05'::jsonb,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (tenant_org_id, setting_code, branch_id, user_id) 
DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  value_jsonb = EXCLUDED.value_jsonb,
  updated_at = CURRENT_TIMESTAMP;
```

### Step 6: Migrate Existing Price Data (If Applicable)

If you have existing price data in a different format:

```sql
-- Example: Migrate prices from old table to new price lists
-- Adjust based on your existing schema

INSERT INTO org_price_lists_mst (
  tenant_org_id,
  name,
  name2,
  price_list_type,
  priority,
  is_active,
  created_at,
  created_by
)
SELECT DISTINCT
  tenant_org_id,
  'Standard Pricing' as name,
  'التسعير القياسي' as name2,
  'standard' as price_list_type,
  1 as priority,
  true as is_active,
  CURRENT_TIMESTAMP as created_at,
  'system_admin' as created_by
FROM org_product_data_mst
WHERE tenant_org_id = 'your-tenant-id'::uuid;

-- Then migrate product prices
INSERT INTO org_price_list_items_dtl (
  tenant_org_id,
  price_list_id,
  product_id,
  price,
  discount_percent,
  min_quantity,
  is_active,
  created_at,
  created_by
)
SELECT
  pd.tenant_org_id,
  pl.id as price_list_id,
  pd.id as product_id,
  pd.default_sell_price as price,
  0 as discount_percent,
  1 as min_quantity,
  true as is_active,
  CURRENT_TIMESTAMP as created_at,
  'system_admin' as created_by
FROM org_product_data_mst pd
CROSS JOIN org_price_lists_mst pl
WHERE pd.tenant_org_id = 'your-tenant-id'::uuid
  AND pl.tenant_org_id = pd.tenant_org_id
  AND pl.price_list_type = 'standard'
  AND pd.default_sell_price IS NOT NULL;
```

### Step 7: Set Permissions

Grant pricing override permission to authorized users:

```sql
-- Grant permission to a role
INSERT INTO sys_rbac_role_permissions (
  role_code,
  permission_code,
  is_active,
  created_at,
  created_by
) VALUES (
  'manager',
  'pricing:override',
  true,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;
```

Or via UI:
1. Navigate to Settings > Roles & Permissions
2. Select role
3. Add `pricing:override` permission
4. Save

### Step 8: Test Migration

1. **Test Price Calculation**
   ```typescript
   // In browser console or API test
   const response = await fetch('/api/v1/pricing/calculate', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       productId: 'test-product-id',
       quantity: 1,
       priceListType: 'standard',
     }),
   })
   ```

2. **Test Price List Creation**
   - Navigate to Catalog > Pricing
   - Create a test price list
   - Add a product
   - Verify price appears correctly

3. **Test Order Creation**
   - Create a new order
   - Add items
   - Verify prices calculate correctly
   - Test price override (if permission granted)

4. **Test Price History**
   - Change a price in a price list
   - Navigate to History tab
   - Verify change appears in timeline

### Step 9: Rollback Plan (If Needed)

If you need to rollback:

```sql
-- Remove price override fields (data will be lost)
ALTER TABLE org_order_items_dtl
  DROP COLUMN IF EXISTS price_override,
  DROP COLUMN IF EXISTS override_reason,
  DROP COLUMN IF EXISTS override_by;

-- Remove tax rate from orders
ALTER TABLE org_orders_mst
  DROP COLUMN IF EXISTS tax_rate;

-- Drop price history table (data will be lost)
DROP TABLE IF EXISTS org_price_history_audit CASCADE;

-- Drop function
DROP FUNCTION IF EXISTS get_product_price_with_tax;

-- Remove tax rate setting (keep data, just deactivate)
UPDATE sys_tenant_settings_cd
SET is_active = false
WHERE setting_code = 'TAX_RATE';
```

## Post-Migration Checklist

- [ ] All migrations applied successfully
- [ ] Tax rates configured for all tenants
- [ ] Price lists created (standard, express, B2B, VIP as needed)
- [ ] Products added to price lists
- [ ] Permissions granted for price override
- [ ] Price calculation tested
- [ ] Order creation tested
- [ ] Price override tested
- [ ] Price history working
- [ ] Bulk import/export tested
- [ ] Documentation updated

## Troubleshooting

### Migration Fails

**Error:** `column already exists`
- **Solution:** Migration may have been partially applied. Check current schema and skip already-applied parts.

**Error:** `function already exists`
- **Solution:** Drop existing function first:
  ```sql
  DROP FUNCTION IF EXISTS get_product_price_with_tax CASCADE;
  ```

**Error:** `permission denied`
- **Solution:** Ensure you're using a user with sufficient privileges (postgres superuser or database owner).

### Data Issues

**Prices not showing:**
- Verify price lists are active
- Check effective date ranges
- Ensure products are in price lists

**Tax not calculating:**
- Verify TAX_RATE setting exists
- Check tenant has tax rate configured
- Ensure tax rate is valid (0-1 range)

## Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section
2. Review [README.md](./README.md) for usage examples
3. Check database logs for detailed error messages
4. Contact development team

