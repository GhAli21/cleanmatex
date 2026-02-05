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

CREATE POLICY tenant_isolation ON org_example_mst
  FOR ALL
  USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));
```

## Database Migrations – Version (Last Seq)

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
