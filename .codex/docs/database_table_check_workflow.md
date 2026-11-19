# Database Table Check Workflow

## ⚠️ CRITICAL: Always Check Before Creating Tables

**Before creating ANY new table, you MUST follow this workflow:**

## Step 1: Query Existing Tables

```sql
-- Check if table exists (exact name)
SELECT table_name, table_schema
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'your_table_name';

-- Search for similar table names (pattern match)
SELECT table_name, table_schema
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%keyword%';
```

## Step 2: Check Table Structure

```sql
-- Get columns for existing table
SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'existing_table_name'
ORDER BY ordinal_position;
```

## Step 3: Check Existing Migrations

```bash
# Check migration files in sibling project
dir "F:\jhapp\cleanmatex\supabase\migrations" /b

# Search migration content for table names
findstr /s /i "CREATE TABLE" "F:\jhapp\cleanmatex\supabase\migrations\*.sql"
```

## Step 4: Check Documentation

- **Schema Reference**: `docs/database/schema_06.sql`
- **Sibling Project Schema**: `F:/jhapp/cleanmatex/docs/Database_Design/schema_06.sql`
- **Migration History**: `F:/jhapp/cleanmatex/supabase/migrations/`

## Decision Tree

```
Need to create a table for [feature]?
  ↓
Does a table exist with this exact name?
  YES → Use existing table, enhance if needed
  NO → Continue ↓

Does a table exist with similar name/purpose?
  YES → Analyze differences:
    - Same purpose? → Use existing, enhance if needed
    - Different purpose but overlap? → Consider merging or referencing
    - Truly different? → Create new with distinct name
  NO → Continue ↓

Check naming convention:
  - NEW object? → Use feature grouping: {scope}_{feature}_{name}_{suffix}
  - Related to existing? → Check the real table in the live DB (remote MCP, read-only) or `web-admin/prisma/schema.prisma`

Create table with proper naming and document decision
```

## Common Duplicate Scenarios

### 1. Orders/Transactions
❌ Creating `org_transactions_mst` when `org_orders_mst` exists
✅ Check if orders table handles your use case first

### 2. Users/Members
❌ Creating `org_members_mst` when `org_auth_users_mst` exists
✅ Check authentication and user tables first

### 3. Settings/Configuration
❌ Creating `org_settings_cf` when `org_stng_tenant_cf` exists
✅ Check existing settings tables with different abbreviations

### 4. Lookup/Code Tables
❌ Creating `sys_status_cd` when `sys_ord_order_status_cd` exists
✅ Check feature-specific lookup tables first

## Practical Commands to Run

### Option 1: Via Supabase Studio
1. Open http://localhost:54323
2. Go to Table Editor
3. Search for table name or browse schema
4. Check Structure and Relationships tabs

### Option 2: Via psql (Command Line)
```bash
psql -h localhost -p 54322 -U postgres -d postgres -c "\dt public.*"
psql -h localhost -p 54322 -U postgres -d postgres -c "\d+ table_name"
```

### Option 3: Via Database Query Tool
```sql
-- List all tables with row counts
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

## Enhancement vs New Table Decision Matrix

| Scenario | Action |
|----------|--------|
| Table exists with exact purpose | ✅ Use existing, add columns if needed |
| Table exists with 80%+ overlap | ✅ Enhance existing table |
| Table exists with 50-80% overlap | ⚠️ Consider: Enhance or add related table |
| Table exists with <50% overlap | ✅ Create new table with clear distinction |
| No similar table exists | ✅ Create new table following conventions |

## Example Workflow

**Scenario**: Need to track order payments

```sql
-- Step 1: Check if payments table exists
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE '%pay%' OR table_name LIKE '%payment%';

-- Found: org_pay_payments_tr
-- Step 2: Check structure
\d+ org_pay_payments_tr

-- Step 3: Decision
-- If structure fits → Use existing
-- If needs enhancement → Alter table or add related table
-- If completely different → Create new with distinct name
```

## Red Flags (Stop and Check!)

🚨 **STOP if you're about to:**
- Create a table for "orders" (check org_orders_mst)
- Create a table for "users" (check org_auth_users_mst, sys_auth_users_mst)
- Create a table for "settings" (check org_stng_*, sys_stng_*)
- Create a table for "tenants" (check org_tenants_mst)
- Create a table for "plans" (check sys_pln_plans_mst)
- Create a table for "customers" (check org_cust_customers_mst)
- Create any table with _mst, _dtl, _tr, _cd, _cf suffix without checking

## Documentation After Decision

After deciding to use existing or create new:

1. **If using existing**: Document why and what enhancements made
2. **If creating new**: Document why existing tables didn't fit
3. Update relevant documentation in `docs/database/`

## Related Documents

- [Database Conventions](./database_conventions.md) - Naming rules
- [Feature Abbreviations](./database_feature_abbreviations.md) - Feature prefixes
