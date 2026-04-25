# Database Conventions

**Quick Links**:

- [Feature Placement Guide](./Dev/FEATURE_PLACEMENT_GUIDE.md) - Decide where features should be implemented
- [Feature Abbreviations](./database_feature_abbreviations.md) - Complete list of module prefixes
- [Grandfathered Objects Registry](./database_grandfathered_objects.md) - Existing objects using old naming

---

## Naming

- Suffixes: `_mst` master, `_dtl` detail, `_tr` transactions, `_cd` codes, `_cf` config
- Prefixes: `sys_` global system and HQ SAAS Platform, `org_` tenant

## Audit Fields

Include for every table:

```
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
created_by TEXT,
created_info TEXT,
updated_at TIMESTAMP,
updated_by TEXT,
updated_info TEXT,
rec_status SMALLINT DEFAULT 1,
rec_order INTEGER,
rec_notes TEXT,
is_active BOOLEAN NOT NULL DEFAULT true
```

## Bilingual Fields

```
name, name2
description, description2
```

## Money, Price Fields Size

```
DECIMAL(19, 4)
```

## Branding/UI

```
{entity}_color1, {entity}_color2, {entity}_color3, {entity}_icon, {entity}_image
```

## Composite FKs

Tenant isolation via composite references on `(tenant_org_id, ...)`.

**cleanmatex note:** ALL queries in this project MUST filter by `tenant_org_id` to enforce RLS and tenant isolation. See multitenancy skill for details.

---

## Universal Catalog Pattern (sys*\* → org*\*)

**Pattern**: System-wide catalog (sys*\*) copied to tenant-specific catalog (org*\*) on tenant initialization.

### Anatomy

1. **System Catalog (sys\_\*)** - Global baseline maintained by platform admins (in cleanmatexsaas)
   - No `tenant_org_id` column
   - Managed by platform admins (service role key)
   - Defines what options EXIST platform-wide
   - Examples: sys_service_preference_cd, sys_gl_chart_template, sys_pch_vendor_types_cd

2. **Tenant Catalog (org\_\*)** - Per-tenant customizable copy (managed HERE in cleanmatex)
   - Has `tenant_org_id` column
   - FK to sys\_\* table (e.g., preference_code → sys_service_preference_cd.code)
   - Managed by tenants via cleanmatex (anon key + RLS)
   - UNIQUE constraint: `(tenant_org_id, code)` - one entry per tenant per code
   - Tenants can customize: pricing, names, availability, display order

### Real Example: Service Preferences

**System Catalog**: `sys_service_preference_cd` (managed by platform admins)

- Columns: code (PK), name/name2, preference_category, default_extra_price, extra_turnaround_minutes, workflow_impact
- Seeded data: STARCH_LIGHT, STARCH_HEAVY, PERFUME, SEPARATE_WASH, DELICATE, STEAM_PRESS, etc.
- No tenant_org_id - this is global
- Migration: `0139_order_service_preferences_schema.sql`

**Tenant Catalog**: `org_service_preference_cf` (managed HERE by tenants)

- Columns: id (UUID), tenant_org_id, preference_code (FK to sys_service_preference_cd), name/name2, extra_price, is_active, display_order
- UNIQUE(tenant_org_id, preference_code)
- RLS policy: tenant_isolation_org_service_preference_cf (enforced in cleanmatex)
- Migration: `0139_order_service_preferences_schema.sql`

**Workflow**:

1. **Platform admins** (cleanmatexsaas) maintain sys_service_preference_cd
2. **On tenant creation**: Copy sys_service_preference_cd → org_service_preference_cf for new tenant
3. **Tenant customization** (cleanmatex - THIS PROJECT): Override extra_price, rename, toggle is_active, reorder
4. **Order usage**: org_order_preferences_dtl references org_service_preference_cf (tenant's configured preferences)

**Tenant Side** (cleanmatex - THIS PROJECT):

- Backend: web-admin/lib/services/preference-catalog.service.ts - Merge sys + org catalogs
- Frontend: web-admin/app/dashboard/catalog/preferences/ - View + customize tenant catalog
- Access: Anon key + RLS (tenant-scoped)
- **CRITICAL**: Always filter by tenant_org_id, RLS enforced

**Platform Admin Side** (cleanmatexsaas):

- Backend: platform-api/src/modules/catalog/ - CRUD on sys_service_preference_cd (service role key)
- Frontend: platform-web/app/catalog/service-preferences/ - Manage global catalog
- Access: Service role key (bypasses RLS)

### Same Pattern Applies To

- **Chart of Accounts**: sys_gl_chart_template → org_gl_accounts_mst
- **Vendor Types**: sys_pch_vendor_types_cd → org_pch_vendor_types_cd
- **Pay Item Types**: sys_hrm_pay_item_types_cd → org_hrm_pay_items_dtl
- **Product Categories**: sys_product_types_cd → org_product_types_cf
- **Packing Preferences**: sys_packing_preference_cd → org_packing_preference_cf

### Key Decisions

**When to use this pattern**:

- Feature needs platform-wide baseline definitions
- Tenants need to customize/extend the baseline
- Platform admins manage what options exist (cleanmatexsaas)
- Tenants manage how options work for them (cleanmatex - THIS PROJECT)

**See Also**: [Feature Placement Guide](./Dev/FEATURE_PLACEMENT_GUIDE.md) - Decision framework for catalog features

## Indexing

- `tenant_org_id`, `tenant_org_id, rec_status`
- Full-text search GIN on name
- Date indexes: `(tenant_org_id, created_at DESC)`

---

## 🗄️ DATABASE SCHEMA CONVENTIONS

### Naming Patterns

**CRITICAL**: Always follow these naming conventions when creating ANY database object (tables, functions, procedures, packages, views, triggers, sequences, etc.)

#### ⚠️ IMPORTANT: New Objects Only Rule

**For NEW database objects created from 2025-11-14 onwards:**

**Always Check Before Creating Tables this database table check workflow**, refer to the [Database table check workflow] (,/database_table_check_workflow.md)

- ✅ **MUST** use feature/module grouping with prefixes
- ✅ **MUST** follow the complete naming pattern: `{scope}_{feature}_{object_name}_{suffix}`

**For EXISTING database objects:**

- ⚠️ **MAY** remain as-is (grandfathered)
- ⚠️ **WILL** be migrated gradually per migration plan
- ✅ **MUST** use new naming when creating related objects

**⚠️ IMPORTANT: Existing Objects Reference**

**For EXISTING database objects**, refer to the [Grandfathered Objects Registry](./database_grandfathered_objects.md) for exact names.

**Key Points:**

- ✅ Existing objects use old naming (without feature grouping)
- ✅ Use exact names from the registry when referencing existing objects
- ✅ Do NOT use feature-grouped names for existing objects (they don't exist)
- ✅ When creating NEW related objects, use new naming convention

**Example:**

```sql
-- ✅ Existing object (use exact name from registry)
SELECT * FROM org_orders_mst;  -- Correct: org_orders_mst exists

-- ✅ New related object (use new naming)
CREATE TABLE org_ord_order_status_history (...);  -- New: uses org_ord_

-- ❌ Wrong: Using new name for existing object
SELECT * FROM org_ord_orders_mst;  -- Wrong: This doesn't exist yet!
```

#### Prefix Rules (Apply to ALL Database Objects)

**CRITICAL**: The `sys_` and `org_` prefixes apply to ALL database objects, not just tables.

- **`sys_`** - System/global objects (no tenant_org_id)
  - Applies to: Tables, Functions, Procedures, Packages, Views, Triggers, Sequences, Types, etc.
  - Examples: `sys_auth_users_mst`, `sys_auth_validate_token()`, `sys_pln_plans_mst`, `sys_pln_get_plan()`

- **`org_`** - Organization/tenant objects (requires tenant_org_id)
  - Applies to: Tables, Functions, Procedures, Packages, Views, Triggers, Sequences, Types, etc.
  - Examples: `org_auth_users_mst`, `org_auth_validate_user()`, `org_ord_orders_mst`, `org_ord_calculate_total()`

#### Feature/Module Grouping (NEW Objects Only)

**CRITICAL**: Group all related database objects by feature/module using feature prefixes.

**Feature Prefix Patterns:**

- Use abbreviated feature names (3-4 characters) after `sys_` or `org_`
- Format: `{scope}_{feature}_{object_type}_{suffix}`
- **See [Feature Abbreviations](./database_feature_abbreviations.md) for complete list**

**Common Feature Abbreviations:**

- **`auth`** - Authentication & Authorization (e.g., `sys_auth_`, `org_auth_`)
- **`pln`** - Plans & Subscriptions (e.g., `sys_pln_`, `org_pln_`)
- **`ord`** - Orders (e.g., `org_ord_`)
- **`cust`** - Customers (e.g., `sys_cust_`, `org_cust_`)
- **`stng`** - Settings (e.g., `sys_stng_`, `org_stng_`)
- **`pay`** - Payments (e.g., `org_pay_`)
- **`inv`** - Invoices (e.g., `org_inv_`)
- **`cat`** - Catalog/Products (e.g., `org_cat_`)
- **`rpt`** - Reports (e.g., `org_rpt_`)
- **`usr`** - Users (e.g., `sys_usr_`, `org_usr_`)

**Lite ERP Module Abbreviations:**

- **`pch`** - Purchasing (e.g., `org_pch_purchase_orders_mst`, `org_pch_vendors_mst`)
- **`hrm`** - Human Resources Management (e.g., `org_hrm_employees_mst`, `org_hrm_payroll_tr`)
- **`gl`** - General Ledger (e.g., `org_gl_accounts_mst`, `org_gl_journal_entries_tr`)
- **`ap`** - Accounts Payable (e.g., `org_ap_vendor_invoices_mst`, `org_ap_payments_tr`)
- **`ar`** - Accounts Receivable (e.g., `org_ar_customer_invoices_mst`, `org_ar_receipts_tr`)
- **`inv`** - Inventory Management (e.g., `org_inv_stock_items_mst`, `org_inv_movements_tr`)

**⚠️ IMPORTANT**: Always check [Feature Abbreviations](./database_feature_abbreviations.md) before creating new objects to ensure consistent abbreviations.

#### Complete Naming Pattern (NEW Objects)

**Format**: `{scope}_{feature}_{object_name}_{suffix}`

Where:

- `{scope}` = `sys_` (global) or `org_` (tenant)
- `{feature}` = Feature abbreviation (see [Feature Abbreviations](./database_feature_abbreviations.md))
- `{object_name}` = Descriptive name
- `{suffix}` = Object type suffix (for tables: `_mst`, `_dtl`, `_tr`, `_cd`, `_cf`)

#### Table Suffixes

- **`*_mst`** - Master tables (main entities)
  - Examples: `org_ord_orders_mst`, `sys_auth_users_mst`, `org_cust_customers_mst`
  - Purpose: Core business entities

- **`*_dtl`** - Detail tables (line items, related records)
  - Examples: `org_ord_order_items_dtl`, `org_inv_invoice_items_dtl`
  - Purpose: Child records with 1-to-many relationships

- **`*_tr`** - Transaction tables
  - Examples: `org_pay_payments_tr`, `org_ord_status_changes_tr`
  - Purpose: Financial or state-changing transactions

- **`*_cd`** - Code/lookup tables
  - Examples: `sys_ord_order_status_cd`, `sys_pay_payment_method_cd`
  - Purpose: Enumerated values, reference data

- **`*_cf`** - Configuration tables
  - Examples: `org_stng_settings_cf`, `org_cat_service_categories_cf`
  - Purpose: Tenant-specific configuration

#### Table Naming Examples (NEW Objects)

```sql
-- ✅ NEW: Authentication tables
CREATE TABLE sys_auth_users_mst (...);          -- System users
CREATE TABLE org_auth_users_mst (...);          -- Tenant users
CREATE TABLE sys_auth_roles_cd (...);           -- System roles lookup
CREATE TABLE org_auth_permissions_cf (...);     -- Tenant permissions config

-- ✅ NEW: Plans & Subscriptions
CREATE TABLE sys_pln_plans_mst (...);           -- System plans
CREATE TABLE org_pln_subscriptions_mst (...);   -- Tenant subscriptions
CREATE TABLE sys_pln_features_cd (...);         -- System features lookup

-- ✅ NEW: Orders
CREATE TABLE org_ord_orders_mst (...);         -- Tenant orders
CREATE TABLE org_ord_order_items_dtl (...);     -- Order line items
CREATE TABLE org_ord_order_status_tr (...);     -- Order status transactions

-- ✅ NEW: Settings
CREATE TABLE sys_stng_global_cf (...);          -- Global system settings
CREATE TABLE org_stng_tenant_cf (...);         -- Tenant-specific settings
CREATE TABLE org_stng_business_hours_cf (...); -- Business hours settings
```

#### Function Naming Examples (NEW Objects)

```sql
-- ✅ NEW: Feature-grouped functions
CREATE FUNCTION sys_auth_validate_token(token VARCHAR) ...
CREATE FUNCTION org_auth_validate_user(user_id UUID, tenant_id UUID) ...
CREATE FUNCTION sys_pln_get_plan_features(plan_id UUID) ...
CREATE FUNCTION org_ord_calculate_total(order_id UUID) ...
CREATE FUNCTION org_stng_get_business_hours(tenant_id UUID) ...

-- ❌ BAD: No feature grouping (for new objects)
CREATE FUNCTION sys_validate_token() ...        -- Should be sys_auth_validate_token()
CREATE FUNCTION org_calculate() ...             -- Should be org_ord_calculate_total()
CREATE FUNCTION get_settings() ...              -- Should be org_stng_get_business_hours()
```

#### View Naming Examples (NEW Objects)

```sql
-- ✅ NEW: Feature-grouped views
CREATE VIEW sys_auth_active_users_vw AS ...     -- System view
CREATE VIEW org_auth_user_permissions_vw AS ... -- Tenant view
CREATE VIEW org_ord_pending_orders_vw AS ...    -- Tenant view
CREATE VIEW org_rpt_sales_summary_vw AS ...     -- Tenant view
```

#### Trigger Naming Examples (NEW Objects)

```sql
-- ✅ NEW: Feature-grouped triggers
CREATE TRIGGER sys_auth_users_audit_trg ...     -- System trigger
CREATE TRIGGER org_ord_orders_audit_trg ...     -- Tenant trigger
CREATE TRIGGER org_stng_settings_audit_trg ...  -- Tenant trigger
```

#### Sequence Naming Examples (NEW Objects)

```sql
-- ✅ NEW: Feature-grouped sequences
CREATE SEQUENCE sys_auth_user_id_seq;
CREATE SEQUENCE org_ord_order_number_seq;
CREATE SEQUENCE org_inv_invoice_number_seq;
```

#### Index Naming (NEW Objects)

```sql
-- ✅ NEW: Feature-grouped indexes
CREATE INDEX idx_org_ord_orders_tenant ON org_ord_orders_mst(tenant_org_id);
CREATE INDEX idx_org_ord_orders_status ON org_ord_orders_mst(tenant_org_id, status);
CREATE INDEX idx_sys_auth_users_email ON sys_auth_users_mst(email);
```

#### RLS Policy Naming (NEW Objects)

```sql
-- ✅ NEW: Feature-grouped policies
CREATE POLICY org_ord_orders_tenant_isolation ON org_ord_orders_mst
  FOR ALL USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));

CREATE POLICY org_auth_users_tenant_isolation ON org_auth_users_mst
  FOR ALL USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));
```

#### Migration File Naming (NEW Migrations)

```
-- ✅ NEW: Feature-grouped migrations
20251114103000_sys_auth_create_users_table.sql
20251114104500_org_ord_create_orders_table.sql
20251114110000_org_stng_create_settings_table.sql
20251114111500_org_ord_add_order_status_index.sql
```

---

## Standard Fields

### Audit Fields (ALWAYS Include)

```sql
-- Audit fields (standard pattern)
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
created_by      VARCHAR(120), -- current user or system_admin
created_info    TEXT,
updated_at      TIMESTAMP,
updated_by      VARCHAR(120),
updated_info    TEXT,

-- Soft delete & status
rec_status      SMALLINT DEFAULT 1, -- record status 0=deleted, then depend on each case
rec_order       INTEGER,
rec_notes       VARCHAR(200),
is_active       BOOLEAN NOT NULL DEFAULT true
```

### Bilingual Support Pattern

```sql
-- Bilingual fields pattern
name            VARCHAR(250),      -- English
name2           VARCHAR(250),      -- Arabic
description     TEXT,              -- English
description2    TEXT               -- Arabic
```

### Branding & UI Metadata

```sql
-- Branding fields
{entity}_color1  VARCHAR(60),      -- Primary color
{entity}_color2  VARCHAR(60),      -- Secondary color
{entity}_color3  VARCHAR(60),      -- Accent color
{entity}_icon    VARCHAR(120),     -- Icon reference
{entity}_image   VARCHAR(120)      -- Image URL/path
```

---

## Composite Foreign Keys

**CRITICAL for tenant isolation**:

```sql
-- Example: Order references customer
FOREIGN KEY (tenant_org_id, customer_id)
  REFERENCES org_customers_mst(tenant_org_id, customer_id)
  ON DELETE CASCADE

-- Example: Order item references product
FOREIGN KEY (tenant_org_id, service_category_code)
  REFERENCES org_service_category_cf(tenant_org_id, service_category_code)
```

**Why composite keys?**

- Database-level enforcement of tenant boundaries
- Prevents accidental cross-tenant references
- Complements RLS policies

---

## Indexes

**ALWAYS add these indexes**:

```sql
-- On tenant tables
CREATE INDEX idx_{table}_tenant ON {table}(tenant_org_id);
CREATE INDEX idx_{table}_tenant_status ON {table}(tenant_org_id, rec_status);

-- On frequently searched fields
CREATE INDEX idx_{table}_search ON {table} USING gin(to_tsvector('english', name));

-- On date ranges
CREATE INDEX idx_{table}_dates ON {table}(tenant_org_id, created_at DESC);
```

---

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

  -- Metadata
  example_color1 VARCHAR(60),
  example_icon VARCHAR(120),

  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  rec_status SMALLINT DEFAULT 1,
  is_active BOOLEAN DEFAULT true
);

-- Add indexes
CREATE INDEX idx_example_tenant ON org_example_mst(tenant_org_id);
CREATE INDEX idx_example_active ON org_example_mst(tenant_org_id, is_active);

-- Enable RLS
ALTER TABLE org_example_mst ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY tenant_isolation ON org_example_mst
  FOR ALL USING (tenant_org_id = auth.jwt() ->> 'tenant_org_id'::text);
```

---

---

## Code Reuse Patterns

### 1. Extract Common Table Templates

```sql
-- ✅ Good: Create reusable table template function
CREATE OR REPLACE FUNCTION create_tenant_table(
  table_name TEXT,
  columns TEXT
) RETURNS void AS $$
BEGIN
  EXECUTE format('
    CREATE TABLE %I (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id),
      %s,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by VARCHAR(120),
      updated_at TIMESTAMP,
      updated_by VARCHAR(120),
      rec_status SMALLINT DEFAULT 1,
      is_active BOOLEAN NOT NULL DEFAULT true
    );
  ', table_name, columns);
END;
$$ LANGUAGE plpgsql;

-- Or use a standard template in comments
-- Template for tenant tables:
-- CREATE TABLE org_{entity}_mst (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id),
--   -- Business columns here
--   -- Standard audit fields below
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   created_by VARCHAR(120),
--   updated_at TIMESTAMP,
--   updated_by VARCHAR(120),
--   rec_status SMALLINT DEFAULT 1,
--   is_active BOOLEAN NOT NULL DEFAULT true
-- );
```

### 2. Extract Common Index Patterns

```sql
-- ✅ Good: Create reusable index creation function
CREATE OR REPLACE FUNCTION create_tenant_indexes(table_name TEXT) RETURNS void AS $$
BEGIN
  EXECUTE format('CREATE INDEX idx_%s_tenant ON %I(tenant_org_id)', table_name, table_name);
  EXECUTE format('CREATE INDEX idx_%s_tenant_status ON %I(tenant_org_id, rec_status)', table_name, table_name);
  EXECUTE format('CREATE INDEX idx_%s_tenant_active ON %I(tenant_org_id, is_active)', table_name, table_name);
  EXECUTE format('CREATE INDEX idx_%s_created ON %I(tenant_org_id, created_at DESC)', table_name, table_name);
END;
$$ LANGUAGE plpgsql;

-- Usage
SELECT create_tenant_indexes('org_orders_mst');

-- Or document standard index pattern
-- Standard indexes for tenant tables:
-- CREATE INDEX idx_{table}_tenant ON {table}(tenant_org_id);
-- CREATE INDEX idx_{table}_tenant_status ON {table}(tenant_org_id, rec_status);
-- CREATE INDEX idx_{table}_tenant_active ON {table}(tenant_org_id, is_active);
-- CREATE INDEX idx_{table}_created ON {table}(tenant_org_id, created_at DESC);
```

### 3. Extract Common RLS Policy Patterns

```sql
-- ✅ Good: Create reusable RLS policy function
CREATE OR REPLACE FUNCTION create_tenant_rls_policy(table_name TEXT) RETURNS void AS $$
BEGIN
  EXECUTE format('
    ALTER TABLE %I ENABLE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON %I
      FOR ALL
      USING (
        tenant_org_id::text = (auth.jwt() ->> ''tenant_org_id'')
      );
  ', table_name, table_name);
END;
$$ LANGUAGE plpgsql;

-- Usage
SELECT create_tenant_rls_policy('org_orders_mst');

-- Or document standard RLS pattern
-- Standard RLS policy for tenant tables:
-- ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_isolation ON {table}
--   FOR ALL
--   USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));
```

### 4. Extract Common Audit Triggers

```sql
-- ✅ Good: Reusable audit trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to multiple tables
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON org_orders_mst
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON org_customers_mst
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ❌ Bad: Duplicate trigger logic
-- CREATE FUNCTION update_orders_updated_at() ... -- Repeated for each table
```

### 5. Extract Common Query Patterns

```sql
-- ✅ Good: Reusable query functions
CREATE OR REPLACE FUNCTION get_active_records(
  table_name TEXT,
  tenant_id UUID
) RETURNS TABLE(id UUID, name VARCHAR) AS $$
BEGIN
  RETURN QUERY EXECUTE format('
    SELECT id, name
    FROM %I
    WHERE tenant_org_id = $1
    AND is_active = true
    AND rec_status = 1
  ', table_name) USING tenant_id;
END;
$$ LANGUAGE plpgsql;

-- Usage
SELECT * FROM get_active_records('org_orders_mst', 'tenant-uuid');

-- Or document standard query pattern
-- Standard query pattern for tenant tables:
-- SELECT * FROM {table}
-- WHERE tenant_org_id = $1
-- AND is_active = true
-- AND rec_status = 1
-- ORDER BY created_at DESC;
```

### 6. Extract Common Validation Functions

```sql
-- ✅ Good: Reusable validation functions
CREATE OR REPLACE FUNCTION validate_phone_number(phone VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN phone ~ '^\+?[0-9]{8,15}$';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_email(email VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN email ~ '^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$';
END;
$$ LANGUAGE plpgsql;

-- Usage in constraints
ALTER TABLE org_customers_mst
  ADD CONSTRAINT check_phone_format
  CHECK (validate_phone_number(phone));

-- ❌ Bad: Duplicate validation logic
-- CHECK (phone ~ '^\+?[0-9]{8,15}$') -- Repeated in multiple tables
```

### 7. Extract Common Migration Helpers

```sql
-- ✅ Good: Reusable migration helper functions
CREATE OR REPLACE FUNCTION add_audit_fields(table_name TEXT) RETURNS void AS $$
BEGIN
  EXECUTE format('
    ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_by VARCHAR(120);
    ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
    ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_by VARCHAR(120);
    ALTER TABLE %I ADD COLUMN IF NOT EXISTS rec_status SMALLINT DEFAULT 1;
    ALTER TABLE %I ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
  ', table_name, table_name, table_name, table_name, table_name, table_name);
END;
$$ LANGUAGE plpgsql;

-- Usage in migrations
SELECT add_audit_fields('org_new_table_mst');
```

### 8. Extract Common Soft Delete Pattern

```sql
-- ✅ Good: Reusable soft delete function
CREATE OR REPLACE FUNCTION soft_delete_record(
  table_name TEXT,
  record_id UUID,
  tenant_id UUID,
  deleted_by VARCHAR(120)
) RETURNS void AS $$
BEGIN
  EXECUTE format('
    UPDATE %I
    SET is_active = false,
        rec_status = 0,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = $1
    WHERE id = $2
    AND tenant_org_id = $3
  ', table_name) USING deleted_by, record_id, tenant_id;
END;
$$ LANGUAGE plpgsql;

-- Usage
SELECT soft_delete_record('org_orders_mst', 'order-uuid', 'tenant-uuid', 'user-id');

-- ❌ Bad: Duplicate soft delete logic
-- UPDATE org_orders_mst SET is_active = false ... -- Repeated everywhere
```

---

## Related Documentation

- [Database table check workflow](./database_table_check_workflow.md
- [Feature Abbreviations](./database_feature_abbreviations.md) - Complete list of feature abbreviations for new objects
- [Grandfathered Objects Registry](./database_grandfathered_objects.md) - List of existing objects using old naming
- [Migration Plan](./database_migration_plan.md) - Strategy for migrating existing objects to new naming

---

## Return to [Main Documentation](../CLAUDE.md)
