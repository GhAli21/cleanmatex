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

```sql
Best approach:
CREATE POLICY org_ord_orders_tenant_isolation ON org_ord_orders_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

Second Option:
CREATE POLICY org_ord_orders_tenant_isolation ON org_ord_orders_mst
  FOR ALL USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));
```

### Migration File Naming (NEW Migrations)

```
Last file Seq+1 Not Timestamp 
--20251114103000 wrong
1111_sys_auth_create_users_table.sql
--20251114104500
1112_org_ord_create_orders_table.sql
--20251114110000
1113_org_stng_create_settings_table.sql
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
Best approach:
CREATE POLICY org_ord_orders_tenant_isolation ON org_ord_orders_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

Second Option:
CREATE POLICY tenant_isolation ON org_example_mst
  FOR ALL USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));
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

<!-- HFC-RULE:BEGIN (Human-Friendly Codes; keep in sync across .cursor/.claude/.codex and both repos) -->
## Human-Friendly Codes (document numbering)

Plan: `docs/features/Human_Friendly_Codes/IMPLEMENTATION_PLAN_Human_Friendly_Codes.md`. Engine guide: `docs/features/Human_Friendly_Codes/DEV_GUIDE_DOC_SEQ_ENGINE.md`.

1. Never expose UUIDs as business identifiers. UUIDs stay the PK/FK; nothing joins on codes.
2. Any table whose records people refer to has a human-friendly code column, unique per tenant (`UNIQUE (tenant_org_id, <code>)`), or per scope for SYS/HQ tables.
3. Every code type has exactly one row in `sys_doc_seq_type_cd`: prefix, parts, padding, reset policy, owner and `implement_description` (how it works) live there, not in app code. Its `type_prefix` (3-5 capital letters, unique across all types) is the stable key of the type.
4. Codes are generated only by the DB: the `fn_doc_seq_assign_code('<DOC_TYPE>', '<column>')` BEFORE INSERT trigger (GENERAL types), or the domain's registered function (DOMAIN types). Never compute `MAX()+1` in app code. Codes are immutable after insert (`fn_doc_seq_guard_immutable('<column>')` BEFORE UPDATE OF trigger).
5. Existing generators stay as they are and are registered with `manage_by_level` DOMAIN or MANUAL until a planned phase moves them to GENERAL (in the same migration that seeds the counters from existing data).
6. A new prefix / `type_prefix` is 3-5 capital letters, unique across all types (`uq_doc_seq_type_tprefix`), and approved by the user.
7. Date parts use the tenant's local time (`org_tenants_mst.timezone`, fallback `hq_general_config.timezone`); the fiscal year uses `org_tenants_mst.fiscal_year_start_month` (fallback `hq_general_config`). SYS/HQ types use `hq_general_config`.
8. UI shows codes, never raw UUIDs. Lookup/search routes accept codes; write routes keep UUIDs.
9. Printed/scanned codes: staff QR `CMX1:<type_prefix>:<code>`, CODE128 of the code; the tracking link only on customer copies.
10. Engine functions (`fn_doc_seq_next`, `fn_sys_doc_seq_next`, `fn_hq_doc_seq_next`) are service_role only; counters (`org_doc_seq_mst`, `sys_doc_seq_mst`, `hq_doc_seq_mst`) are never written by app code and never reset by tenant cleanup. Take a number in the same transaction as the document insert (a rollback then gives it back).
11. **New-table checklist** (tables with a code people use):
    - [ ] code column `NOT NULL` + `UNIQUE (tenant_org_id, <code>)` (or the scope's unique key)
    - [ ] one `sys_doc_seq_type_cd` row (unique `type_prefix`, `implement_description` filled)
    - [ ] assign trigger `trg_<x>_no_assign` + guard trigger `trg_<x>_no_guard`
    - [ ] backfill of existing rows and counter seed in the same migration
    - [ ] `SELECT * FROM vw_doc_seq_consistency WHERE severity = 'ERROR'` returns 0 rows
12. Reuse the shared helpers; never write a new code regex. web-admin: `lib/validations/code-format-schemas.ts` (code formats, scan input, external-tag rules: a tag may not look like one of our codes) and `lib/services/scan-resolve/cmx-code-payload.ts` (`CMX1:` payload); scans go through `POST /api/v1/scan/resolve`. Mobile: `mobile_core` `human_codes.dart` (1:1 copy). Show codes with `CmxCodeChip` (web-admin and platform-web `src/ui/data-display`) and search with `CmxCodeSearchInput` (web-admin), always left-to-right (`dir="ltr"`; mobile `ltrCode()`), also in Arabic screens.
13. Messages and notifications carry the code, never the UUID (template variable `order_number` = `org_orders_mst.order_no`).
<!-- HFC-RULE:END -->
