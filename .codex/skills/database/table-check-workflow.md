# Database Table Check Workflow

## CRITICAL: Always Check Before Creating Tables

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
# Check migration files
dir "F:\jhapp\cleanmatex\supabase\migrations" /b

# Search migration content for table names
findstr /s /i "CREATE TABLE" "F:\jhapp\cleanmatex\supabase\migrations\*.sql"
```

## Decision Tree

```
Need to create a table for [feature]?
  |
Does a table exist with this exact name?
  YES -> Use existing table, enhance if needed
  NO -> Continue
        |
Does a table exist with similar name/purpose?
  YES -> Analyze differences:
    - Same purpose? -> Use existing, enhance if needed
    - Different purpose but overlap? -> Consider merging or referencing
    - Truly different? -> Create new with distinct name
  NO -> Continue
        |
Check naming convention:
  - NEW object? -> Use feature grouping: {scope}_{feature}_{name}_{suffix}
  - Related to existing? -> Check grandfathered objects registry
        |
Create table with proper naming and document decision
```

## Common Duplicate Scenarios

### Orders/Transactions
- WRONG: Creating `org_transactions_mst` when `org_orders_mst` exists
- RIGHT: Check if orders table handles your use case first

### Users/Members
- WRONG: Creating `org_members_mst` when `org_auth_users_mst` exists
- RIGHT: Check authentication and user tables first

### Settings/Configuration
- WRONG: Creating `org_settings_cf` when `org_stng_tenant_cf` exists
- RIGHT: Check existing settings tables with different abbreviations

### Lookup/Code Tables
- WRONG: Creating `sys_status_cd` when `sys_ord_order_status_cd` exists
- RIGHT: Check feature-specific lookup tables first

## Enhancement vs New Table Decision Matrix

| Scenario | Action |
|----------|--------|
| Table exists with exact purpose | Use existing, add columns if needed |
| Table exists with 80%+ overlap | Enhance existing table |
| Table exists with 50-80% overlap | Consider: Enhance or add related table |
| Table exists with <50% overlap | Create new table with clear distinction |
| No similar table exists | Create new table following conventions |

## Red Flags (Stop and Check!)

**STOP if you're about to:**
- Create a table for "orders" (check `org_orders_mst`)
- Create a table for "users" (check `org_auth_users_mst`, `sys_auth_users_mst`)
- Create a table for "settings" (check `org_stng_*`, `sys_stng_*`)
- Create a table for "tenants" (check `org_tenants_mst`)
- Create a table for "plans" (check `sys_pln_plans_mst`)
- Create a table for "customers" (check `org_cust_customers_mst`)
- Create any table with `_mst`, `_dtl`, `_tr`, `_cd`, `_cf` suffix without checking

## Practical Commands

### Via Supabase Studio
1. Open http://localhost:54323
2. Go to Table Editor
3. Search for table name or browse schema
4. Check Structure and Relationships tabs

### Via psql
```bash
psql -h localhost -p 54322 -U postgres -d postgres -c "\dt public.*"
psql -h localhost -p 54322 -U postgres -d postgres -c "\d+ table_name"
```

### Via SQL Query
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
