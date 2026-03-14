# DROP CASCADE Migration Workflow

When a migration uses `DROP ... CASCADE` (e.g. `DROP FUNCTION get_user_tenants() CASCADE`), PostgreSQL drops all dependent objects (RLS policies, views, triggers, etc.) and does **not** recreate them. This can break tenant isolation and the application.

**Rule:** Before adding `DROP ... CASCADE` to a migration, you MUST:

1. Fetch the affected objects that will be dropped
2. Prepare recreate statements for each
3. Include those recreate statements in the same migration file, after the DROP and CREATE

---

## Step 1: Discover Affected Objects

Run these queries against your target database (e.g. Supabase
SQL Editor) **before** applying the migration.
**Use Supabase MCP** to run the discovery queries against the target database **before** writing the migration:

- **Local DB:** Use `supabase_local` MCP (or `project-0-cleanmatex-supabase_local` in Cursor)
- **Remote DB:** Use `supabase_remote` MCP (or `project-0-cleanmatex-supabase_remote` in Cursor)

Call the Supabase MCP tool `execute_sql` with each discovery query below. This ensures you get the **exact** policy definitions from the live database before they are dropped.

Alternatively, run these queries in Supabase SQL Editor if MCP is not available.

### Query 1: Policies that reference the function

```sql
-- Policies that reference get_user_tenants (or your function name) in their expression
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_expr,
  with_check
FROM pg_policies
WHERE qual::text LIKE '%get_user_tenants%'
   OR with_check::text LIKE '%get_user_tenants%'
ORDER BY schemaname, tablename;
```

Replace `get_user_tenants` with your function/object name.

### Query 2: All objects depending on the function

```sql
-- All objects depending on get_user_tenants (both overloads if applicable)
SELECT
  d.objid::regclass AS dependent_object,
  d.classid::regclass AS object_class,
  d.deptype
FROM pg_depend d
JOIN pg_proc pr ON pr.oid = d.refobjid
WHERE pr.proname IN ('get_user_tenants', 'get_user_tenants_u')
  AND d.refclassid = 'pg_proc'::regclass
  AND d.objid != d.refobjid;
```

### Query 3: Policy details for recreation

```sql
-- Full policy definitions (for COPY into migration)
SELECT
  schemaname,
  tablename,
  policyname,
  CASE WHEN permissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END AS permissive,
  roles::text,
  cmd,
  qual AS using_expr,
  with_check
FROM pg_policies
WHERE qual::text LIKE '%get_user_tenants%'
   OR with_check::text LIKE '%get_user_tenants%';
```

---

## Step 2: Prepare Recreate Statements

For each dropped policy, create a `CREATE POLICY` statement. Example:

```sql
-- Original (from pg_policies output):
-- tablename: org_orders_mst, policyname: tenant_isolation, cmd: ALL
-- using_expr: (tenant_org_id IN ( SELECT get_user_tenants.tenant_id FROM get_user_tenants() ))

CREATE POLICY tenant_isolation ON org_orders_mst
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));
```

For views or other object types, use `pg_get_viewdef()` or equivalent to capture the definition before dropping.

---

## Step 3: Migration File Structure

```sql
-- Migration: NNNN_description.sql
-- Purpose: Change get_user_tenants to add s_current_plan
-- WARNING: DROP CASCADE drops 8 policies - we recreate them below

BEGIN;

-- 1. Drop (CASCADE drops dependents - we will recreate them)
DROP FUNCTION IF EXISTS get_user_tenants() CASCADE;
DROP FUNCTION IF EXISTS get_user_tenants_u(UUID) CASCADE;

-- 2. Recreate the modified function(s)
CREATE FUNCTION get_user_tenants()
RETURNS TABLE (tenant_id UUID, tenant_name VARCHAR, ...)
AS $$ ... $$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE FUNCTION get_user_tenants_u(p_cur_user_id UUID DEFAULT NULL)
RETURNS TABLE (...) AS $$ ... $$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Recreate all dropped RLS policies (from Step 1 discovery)
CREATE POLICY tenant_isolation ON org_orders_mst
  FOR ALL USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

CREATE POLICY tenant_isolation ON org_customers_mst
  FOR ALL USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- ... (all other dropped policies)

COMMIT;
```

---

## Checklist

- [ ] Run discovery queries before writing the migration
- [ ] Use Supabase MCP (`execute_sql`) to run discovery queries before writing the migration
- [ ] Document how many objects will be dropped (e.g. "drop cascades to 8 other objects")
- [ ] Prepare recreate statements for every dropped object
- [ ] Place recreate statements in the same migration file, after the DROP/CREATE
- [ ] Test the migration locally before applying to staging/production
