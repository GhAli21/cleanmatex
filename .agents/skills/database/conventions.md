# Database Conventions - Full Reference

## Naming Patterns

### Prefix Rules (Apply to ALL Database Objects)

**CRITICAL**: The `sys_` and `org_` prefixes apply to ALL database objects, not just tables.

- **`sys_`** - System/global objects (no tenant_org_id)
  - Applies to: Tables, Functions, Procedures, Packages, Views, Triggers, Sequences, Types, etc.
  - Examples: `sys_auth_users_mst`, `sys_auth_validate_token()`, `sys_pln_plans_mst`

- **`org_`** - Organization/tenant objects (requires tenant_org_id)
  - Applies to: Tables, Functions, Procedures, Packages, Views, Triggers, Sequences, Types, etc.
  - Examples: `org_auth_users_mst`, `org_ord_orders_mst`, `org_ord_calculate_total()`

### ERP Lite Module Marker (`erplt`)

**CRITICAL — for NEW database objects only (not retroactive on existing applied objects):** any object belonging to the ERP Lite module (`docs/features/ERP_Lite/`) MUST carry the literal token `erplt` immediately after the `sys_`/`org_` scope prefix, before the sub-feature abbreviation. This disambiguates ERP Lite's own finance/expense/bank/AP/cost objects from unrelated same-named abbreviations elsewhere in the schema (e.g. Order Fin's `fin` usage).

- Pattern: `{scope}_erplt_{sub_feature}_{object_name}_{suffix}`
- Examples:
  - `org_erplt_fin_acct_mst` (chart of accounts)
  - `org_erplt_fin_journals_tr` (journals)
  - `org_erplt_exp_petty_cash_mst` (petty cash)
  - `org_erplt_bank_recon_tr` (bank reconciliation)
  - `org_erplt_ap_supplier_mst` (AP supplier master)
  - `org_erplt_fin_calculate_total()` (function)
  - `org_erplt_fin_active_journals_vw` (view)
- Existing ERP Lite objects created before this rule (e.g. `org_fin_acct_mst`) are grandfathered — do not rename them in a bulk migration; only rename if already touching that object for another reason, as its own reviewed migration.
- This marker requirement also applies outside the database to anything ERP Lite owns: permission codes (`erplt_fin:read`, not bare `fin_vouchers:create`), feature flag keys, route segments/folders, i18n namespaces, and TypeScript constant files — see CLAUDE.md Database/Code Quick Rules.

### New Objects Only Rule

**For NEW database objects created from 2025-11-14 onwards:**

- MUST use feature/module grouping with prefixes
- MUST follow the complete naming pattern: `{scope}_{feature}_{object_name}_{suffix}`

**For EXISTING database objects:**

- MAY remain as-is (grandfathered)
- WILL be migrated gradually per migration plan
- MUST use new naming when creating related objects

## Complete Naming Examples

### Table Naming (NEW Objects)

```sql
-- Authentication tables
CREATE TABLE sys_auth_users_mst (...);
CREATE TABLE org_auth_users_mst (...);
CREATE TABLE sys_auth_roles_cd (...);
CREATE TABLE org_auth_permissions_cf (...);

-- Orders
CREATE TABLE org_ord_orders_mst (...);
CREATE TABLE org_ord_order_items_dtl (...);
CREATE TABLE org_ord_order_status_tr (...);

-- Settings
CREATE TABLE sys_stng_global_cf (...);
CREATE TABLE org_stng_tenant_cf (...);
```

### Function Naming (NEW Objects)

```sql
CREATE FUNCTION sys_auth_validate_token(token VARCHAR) ...
CREATE FUNCTION org_auth_validate_user(user_id UUID, tenant_id UUID) ...
CREATE FUNCTION sys_pln_get_plan_features(plan_id UUID) ...
CREATE FUNCTION org_ord_calculate_total(order_id UUID) ...
```

### View Naming (NEW Objects)

```sql
CREATE VIEW sys_auth_active_users_vw AS ...
CREATE VIEW org_auth_user_permissions_vw AS ...
CREATE VIEW org_ord_pending_orders_vw AS ...
```

### Trigger Naming (NEW Objects)

```sql
CREATE TRIGGER sys_auth_users_audit_trg ...
CREATE TRIGGER org_ord_orders_audit_trg ...
```

### Index Naming (NEW Objects)

```sql
CREATE INDEX idx_org_ord_orders_tenant ON org_ord_orders_mst(tenant_org_id);
CREATE INDEX idx_org_ord_orders_status ON org_ord_orders_mst(tenant_org_id, status);
```

### RLS Policy Naming (NEW Objects)

Policy name must be `tenant_isolation_<table_name>` (include the table name). Always include both `USING` and `WITH CHECK` so INSERT/UPDATE are permitted:

```sql
CREATE POLICY tenant_isolation_org_ord_orders_mst ON org_ord_orders_mst
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());
```

### Migration File Naming (NEW Migrations)

```
Last file Seq+1 xxxx
--20251114103000
xxxx_sys_auth_create_users_table.sql
--20251114104500
xxxx_org_ord_create_orders_table.sql
--20251114110000
xxxx_org_stng_create_settings_table.sql
```

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
  created_by TEXT,
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by TEXT,
  updated_info TEXT,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT,
  is_active BOOLEAN DEFAULT true
);

-- Add indexes
CREATE INDEX idx_example_tenant ON org_example_mst(tenant_org_id);
CREATE INDEX idx_example_active ON org_example_mst(tenant_org_id, is_active);

-- Enable RLS
ALTER TABLE org_example_mst ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY tenant_isolation_org_example_mst ON org_example_mst
  FOR ALL USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());
```

## Code Reuse Patterns

### Reusable Table Template Function

```sql
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
```

### Reusable Index Creation Function

```sql
CREATE OR REPLACE FUNCTION create_tenant_indexes(table_name TEXT) RETURNS void AS $$
BEGIN
  EXECUTE format('CREATE INDEX idx_%s_tenant ON %I(tenant_org_id)', table_name, table_name);
  EXECUTE format('CREATE INDEX idx_%s_tenant_status ON %I(tenant_org_id, rec_status)', table_name, table_name);
  EXECUTE format('CREATE INDEX idx_%s_tenant_active ON %I(tenant_org_id, is_active)', table_name, table_name);
  EXECUTE format('CREATE INDEX idx_%s_created ON %I(tenant_org_id, created_at DESC)', table_name, table_name);
END;
$$ LANGUAGE plpgsql;
```

### Reusable RLS Policy Function

```sql
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
```

### Reusable Audit Trigger Function

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Reusable Soft Delete Function

```sql
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
```
