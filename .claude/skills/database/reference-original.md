---
name: database
description: Database schema conventions, naming patterns, PostgreSQL rules, Prisma ORM. Use when creating tables, migrations, indexes, or database queries.
user-invocable: true
---

# Database Conventions

## CRITICAL: Name Length Limit

**Maximum 30 characters** for ALL database objects (tables, functions, views, indexes, etc.)

## Naming Patterns

### Prefixes

- `sys_*` - Global system (no tenant_org_id)
- `org_*` - Tenant tables (requires tenant_org_id)

### Suffixes

- `_mst` - Master tables (main entities)
- `_dtl` - Detail tables (line items)
- `_tr` - Transaction tables
- `_cd` - Code/lookup tables
- `_cf` - Configuration tables

### Feature Grouping (NEW objects from 2025-11-14)

Format: `{scope}_{feature}_{object_name}_{suffix}`

Examples:

- `org_ord_orders_mst` - Orders master table
- `org_ord_order_items_dtl` - Order items detail
- `sys_auth_users_mst` - System auth users
- `org_cust_customers_mst` - Tenant customers

See [feature-abbreviations.md](./feature-abbreviations.md) for complete feature prefix list.

**IMPORTANT:** For existing objects, see [grandfathered-objects.md](./grandfathered-objects.md) for exact names.

## Required Audit Fields

Include in EVERY table:

```sql
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
created_by VARCHAR(120),
created_info TEXT,
updated_at TIMESTAMP,
updated_by VARCHAR(120),
updated_info TEXT,
rec_status SMALLINT DEFAULT 1,
rec_order INTEGER,
rec_notes VARCHAR(200),
is_active BOOLEAN NOT NULL DEFAULT true
```

## Bilingual Fields

```sql
name VARCHAR(250),       -- English
name2 VARCHAR(250),      -- Arabic
description TEXT,        -- English
description2 TEXT        -- Arabic
```

## Money/Price Fields and Datatype and size

```sql
DECIMAL(19, 4)
price DECIMAL(19, 4)
total_amount DECIMAL(19, 4)
```

## Composite Foreign Keys (CRITICAL for tenant isolation)

```sql
FOREIGN KEY (tenant_org_id, customer_id)
  REFERENCES org_customers_mst(tenant_org_id, customer_id)
  ON DELETE CASCADE
```

**Why?** Database-level enforcement of tenant boundaries prevents cross-tenant data leaks.

## Standard Indexes

Always add these indexes on `org_*` tables:

```sql
CREATE INDEX idx_{table}_tenant ON {table}(tenant_org_id);
CREATE INDEX idx_{table}_tenant_status ON {table}(tenant_org_id, rec_status);
CREATE INDEX idx_{table}_tenant_active ON {table}(tenant_org_id, is_active);
CREATE INDEX idx_{table}_created ON {table}(tenant_org_id, created_at DESC);
```

## RLS (Row Level Security)

Enable on ALL `org_*` tables:

```sql
ALTER TABLE org_example_mst ENABLE ROW LEVEL SECURITY;

Best approach:
CREATE POLICY tenant_isolation_org_customers ON org_customers_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

Second Option:
CREATE POLICY tenant_isolation ON org_example_mst
  FOR ALL
  USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));
```

## Database Migrations – CRITICAL Rules

### Never Modify Existing Migrations

**Do NOT edit existing migration files.** Migrations are immutable once created or applied. Always create a NEW migration for any fix, change, or addition.

- ❌ Editing `0160_*.sql` to fix a bug
- ✅ Creating `0164_fix_description.sql` with the fix

This rule is **always active** — no exceptions.

### Version (Last Seq)

**Always create new migration files with the next sequential version.**

Before adding a migration:

1. **List existing migrations** in `supabase/migrations/` (excluding `archive/`, `seeds/`, and `x_*` / `xproduction/`).
2. **Determine the latest version** from filenames: either numeric `NNNN` (e.g. `0082`) or timestamp `YYYYMMDDHHMMSS` (e.g. `20260127090030`).
3. **Use the next version:**
   - If the latest is **numeric** (e.g. `0082_svc_cat_proc_steps.sql`), use the next integer zero-padded to 4 digits: **`0083`**.
   - If the latest is **timestamp**, use current date-time in that format: **`YYYYMMDDHHMMSS`**.
4. **Name the file:** `{version}_{descriptive_snake_case_name}.sql`  
   Example: `0083_payments_nullable_invoice_id.sql`.

Never reuse or skip version numbers. When in doubt, list the migrations directory and take max(version) + 1.

## DROP ... CASCADE in Migrations — BANNED BY DEFAULT

**`DROP ... CASCADE` is banned by default.**

**The default for every DROP statement in a migration MUST be `RESTRICT`:**

```sql
DROP FUNCTION IF EXISTS my_function() RESTRICT;
DROP TABLE IF EXISTS my_table RESTRICT;
DROP VIEW IF EXISTS my_view RESTRICT;
```

`RESTRICT` causes PostgreSQL to raise an error if any dependent objects exist, which is the safe default — it forces you to know about and handle every dependency explicitly.

### When CASCADE Is Allowed

`DROP ... CASCADE` is only permitted when **all three** conditions are met:

1. **No safer alternative exists** — you cannot drop dependents individually first, or replace the object without dropping
2. **Complete dependency manifest** — you have run the discovery queries and documented every object that will be dropped
3. **Full recreate plan + rollback strategy** — the same migration file contains `CREATE` statements to restore every dropped dependent, and the transaction is wrapped in `BEGIN;`/`COMMIT;` so a failure rolls back atomically

**STOP and get explicit user confirmation before writing any migration that uses CASCADE.**

### Mandatory CASCADE Workflow (when approved)

1. **Run discovery queries first** — use **Supabase MCP** (`supabase_local` / `supabase_remote`) to execute the discovery queries against the live DB and capture every dependent object. See [drop-cascade-migration-workflow.md](../../../docs/dev/drop-cascade-migration-workflow.md).
2. **Document the manifest** — add a comment at the top of the migration listing every object that CASCADE will drop (e.g. `-- WARNING: CASCADE drops 8 RLS policies — all recreated below`).
3. **Prepare recreate statements** — for each dropped object (RLS policies, views, triggers) write the exact restore statement from the live DB definition.
4. **Include in the same migration** — recreate statements go **after** the DROP/CREATE of the modified object, inside the same `BEGIN;`/`COMMIT;` block.
5. **Order** — Drop → Recreate modified object → Recreate all dropped dependents.

```sql
BEGIN;

-- WARNING: CASCADE drops 2 RLS policies — recreated below
-- Dependency manifest: tenant_isolation ON org_orders_mst, tenant_isolation ON org_customers_mst

-- 1. Drop (CASCADE; only because dependents are fully recreated below)
DROP FUNCTION IF EXISTS get_user_tenants() CASCADE;

-- 2. Recreate the modified object
CREATE FUNCTION get_user_tenants() RETURNS TABLE (...) AS $$ ... $$;

-- 3. Recreate every dropped dependent
CREATE POLICY tenant_isolation ON org_orders_mst FOR ALL USING (...);
CREATE POLICY tenant_isolation ON org_customers_mst FOR ALL USING (...);

COMMIT;
```

See [drop-cascade-migration-workflow.md](../../../docs/dev/drop-cascade-migration-workflow.md) for discovery queries and full workflow.

## Before Creating Any Table

**MUST follow this workflow:**

1. Query existing tables for similar names
2. Check table structure if exists
3. Check existing migrations
4. Decide: Use existing OR create new with distinct name

See [table-check-workflow.md](./table-check-workflow.md) for complete workflow.

### Red Flags - STOP and Check!

🚨 Before creating tables for:

- "orders" → check `org_orders_mst`
- "users" → check `org_auth_users_mst`, `sys_auth_users_mst`
- "settings" → check `org_stng_*`, `sys_stng_*`
- "customers" → check `org_cust_customers_mst`
- "tenants" → check `org_tenants_mst`

## Example Table Creation

```sql
CREATE TABLE org_example_mst (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id),

  -- Business fields
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),           -- Arabic name
  description TEXT,
  description2 TEXT,             -- Arabic description

  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Indexes
CREATE INDEX idx_example_tenant ON org_example_mst(tenant_org_id);
CREATE INDEX idx_example_active ON org_example_mst(tenant_org_id, is_active);

-- Enable RLS
ALTER TABLE org_example_mst ENABLE ROW LEVEL SECURITY;

-- RLS policy
Best approach:
CREATE POLICY tenant_isolation_org_customers ON org_customers_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

Second Option:
CREATE POLICY tenant_isolation ON org_example_mst
  FOR ALL USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));
```

## Additional Resources

- [conventions.md](./conventions.md) - Complete naming patterns and examples
- [feature-abbreviations.md](./feature-abbreviations.md) - Feature prefix list
- [grandfathered-objects.md](./grandfathered-objects.md) - Existing object names
- [table-check-workflow.md](./table-check-workflow.md) - Before creating tables
- [postgresql-prisma.md](./postgresql-prisma.md) - PostgreSQL and Prisma rules
- [migration-plan.md](./migration-plan.md) - Migration strategy
