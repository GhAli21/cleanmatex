---
name: database
description: Database schema conventions, naming patterns, PostgreSQL rules, Prisma ORM. Use when creating tables, migrations, indexes, or database queries.
user-invocable: true
---

# Database Conventions

## CRITICAL: Name Length Limit
**Maximum 30 characters for ALL database objects** (tables, columns, functions, triggers, indexes, etc.)

## Naming Patterns

### Prefixes
- `sys_*` - Global system/HQ tables (no tenant_org_id)
- `org_*` - Tenant tables (requires tenant_org_id)

### Suffixes
| Suffix | Purpose | Example |
|--------|---------|---------|
| `_mst` | Master tables (main entities) | `org_orders_mst` |
| `_dtl` | Detail tables (line items) | `org_order_items_dtl` |
| `_tr` | Transaction tables | `org_payments_tr` |
| `_cd` | Code/lookup tables | `sys_order_status_cd` |
| `_cf` | Configuration tables | `org_tenant_settings_cf` |

### Feature Grouping (NEW objects from 2025-11-14)
Format: `{scope}_{feature}_{object_name}_{suffix}`

**Common Feature Abbreviations:**
- `auth` - Authentication
- `ord` - Orders
- `cust` - Customers
- `pay` - Payments
- `inv` - Invoices
- `cat` - Catalog/Products
- `stng` - Settings
- `brn` - Branches

See `feature-abbreviations.md` for complete list.

## Required Audit Fields

Every table MUST include:

```sql
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
created_by VARCHAR(120),
created_info TEXT,
updated_at TIMESTAMP,
updated_by VARCHAR(120),
updated_info TEXT,
rec_status SMALLINT DEFAULT 1,  -- 0=deleted
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

## Money/Price Fields

```sql
DECIMAL(19, 4)  -- Use for all money/price fields
```

## Composite Foreign Keys (CRITICAL)

For tenant isolation:

```sql
FOREIGN KEY (tenant_org_id, customer_id)
  REFERENCES org_customers_mst(tenant_org_id, customer_id)
  ON DELETE CASCADE
```

## Standard Indexes

```sql
-- Tenant tables
CREATE INDEX idx_{table}_tenant ON {table}(tenant_org_id);
CREATE INDEX idx_{table}_tenant_status ON {table}(tenant_org_id, rec_status);
CREATE INDEX idx_{table}_tenant_active ON {table}(tenant_org_id, is_active);
CREATE INDEX idx_{table}_created ON {table}(tenant_org_id, created_at DESC);

-- Full-text search
CREATE INDEX idx_{table}_search ON {table} USING gin(to_tsvector('english', name));
```

## RLS Policy Pattern

```sql
ALTER TABLE org_example_mst ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON org_example_mst
  FOR ALL USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));
```

## Before Creating Tables

**ALWAYS check if table exists first!**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE '%keyword%';
```

See `table-check-workflow.md` for complete workflow.
See `grandfathered-objects.md` for existing object names.
See `conventions.md` for detailed patterns and examples.
