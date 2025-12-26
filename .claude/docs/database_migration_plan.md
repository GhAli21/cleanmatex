---
version: v1.0.0
last_updated: 2025-11-14
author: CleanMateX Team
---

# Database Object Migration Plan

**Purpose**: Gradual migration of existing database objects to new feature-grouped naming convention.

**Status**: Planning Phase  
**Start Date**: TBD  
**Target Completion**: TBD

---

## Migration Strategy

### Phase-Based Approach

**Phase 1**: Preparation & Tooling (Week 1)
- Create migration scripts
- Document all existing objects
- Test scripts on development database

**Phase 2**: Low-Risk Objects (Week 2-3)
- Migrate views, sequences, indexes
- Migrate standalone functions

**Phase 3**: Medium-Risk Objects (Week 4-5)
- Migrate tables with no dependencies
- Migrate functions with minimal dependencies

**Phase 4**: High-Risk Objects (Week 6-7)
- Migrate core tables (orders, customers)
- Migrate complex functions
- Update all foreign keys

**Phase 5**: Cleanup & Validation (Week 8)
- Remove old objects
- Validate all references
- Update documentation

---

## Migration Rules

### Objects to Migrate

✅ **MUST Migrate:**
- All tables (30+ tables)
- All functions (20+ functions)
- All views
- All sequences
- All triggers
- All indexes
- All RLS policies

⚠️ **MAY Skip (if low value):**
- Very old/unused objects
- Objects scheduled for removal

### Migration Order

1. **Dependencies First**: Migrate objects with no dependencies first
2. **Views Before Tables**: Migrate views that reference tables
3. **Functions Before Tables**: Migrate functions used in triggers/constraints
4. **Tables Last**: Migrate tables after all dependencies

---

## Migration Scripts

### Script 1: Inventory Existing Objects

```sql
-- scripts/migration/01_inventory_objects.sql
-- Purpose: List all existing objects that need migration

-- Tables
SELECT 
    'TABLE' as object_type,
    schemaname,
    tablename as object_name,
    'org_' as current_prefix,
    CASE 
        WHEN tablename LIKE 'org_orders%' THEN 'org_ord_'
        WHEN tablename LIKE 'org_customers%' THEN 'org_cust_'
        WHEN tablename LIKE 'org_payments%' THEN 'org_pay_'
        WHEN tablename LIKE 'org_invoice%' THEN 'org_inv_'
        WHEN tablename LIKE 'org_product%' THEN 'org_cat_'
        WHEN tablename LIKE 'org_users%' THEN 'org_auth_'
        WHEN tablename LIKE 'org_tenant%' THEN 'org_tnt_'
        WHEN tablename LIKE 'org_branches%' THEN 'org_brn_'
        WHEN tablename LIKE 'org_subscriptions%' THEN 'org_pln_'
        WHEN tablename LIKE 'org_workflow%' THEN 'org_wf_'
        WHEN tablename LIKE 'org_settings%' THEN 'org_stng_'
        WHEN tablename LIKE 'org_discount%' THEN 'org_dsc_'
        WHEN tablename LIKE 'org_gift%' THEN 'org_gft_'
        WHEN tablename LIKE 'org_usage%' THEN 'org_usg_'
        WHEN tablename LIKE 'sys_customers%' THEN 'sys_cust_'
        WHEN tablename LIKE 'sys_order%' THEN 'sys_ord_'
        WHEN tablename LIKE 'sys_payment%' THEN 'sys_pay_'
        WHEN tablename LIKE 'sys_service%' THEN 'sys_cat_'
        WHEN tablename LIKE 'sys_plan%' THEN 'sys_pln_'
        WHEN tablename LIKE 'sys_workflow%' THEN 'sys_wf_'
        WHEN tablename LIKE 'sys_tenant%' THEN 'sys_tnt_'
        WHEN tablename LIKE 'sys_audit%' THEN 'sys_aud_'
        WHEN tablename LIKE 'sys_otp%' THEN 'sys_otp_'
        ELSE 'org_xxx_' -- Needs manual review
    END as new_prefix,
    tablename as suggested_new_name
FROM pg_tables
WHERE schemaname = 'public'
AND (tablename LIKE 'org_%' OR tablename LIKE 'sys_%')
ORDER BY tablename;

-- Functions
SELECT 
    'FUNCTION' as object_type,
    n.nspname as schema_name,
    p.proname as object_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    CASE 
        WHEN p.proname LIKE '%order%' THEN 'org_ord_'
        WHEN p.proname LIKE '%customer%' THEN 'org_cust_'
        WHEN p.proname LIKE '%payment%' THEN 'org_pay_'
        WHEN p.proname LIKE '%invoice%' THEN 'org_inv_'
        WHEN p.proname LIKE '%auth%' OR p.proname LIKE '%user%' THEN 'org_auth_'
        WHEN p.proname LIKE '%tenant%' THEN 'org_tnt_'
        WHEN p.proname LIKE '%workflow%' THEN 'org_wf_'
        WHEN p.proname LIKE '%setting%' THEN 'org_stng_'
        WHEN p.proname LIKE '%audit%' THEN 'sys_aud_'
        WHEN p.proname LIKE '%otp%' THEN 'sys_otp_'
        WHEN p.proname LIKE 'cmx_%' THEN 'org_ord_' -- cmx = CleanMateX orders
        WHEN p.proname LIKE 'fn_%' THEN 'org_stng_' -- fn_ = functions (settings)
        ELSE 'org_xxx_' -- Needs manual review
    END as new_prefix,
    p.proname as suggested_new_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND (p.proname LIKE 'org_%' OR p.proname LIKE 'sys_%' OR p.proname LIKE 'cmx_%' OR p.proname LIKE 'fn_%')
ORDER BY p.proname;

-- Views
SELECT 
    'VIEW' as object_type,
    schemaname,
    viewname as object_name,
    'org_' as current_prefix,
    'org_xxx_' as new_prefix, -- Needs manual review
    viewname as suggested_new_name
FROM pg_views
WHERE schemaname = 'public'
AND (viewname LIKE 'org_%' OR viewname LIKE 'sys_%')
ORDER BY viewname;

-- Sequences
SELECT 
    'SEQUENCE' as object_type,
    sequence_schema,
    sequence_name as object_name,
    'org_' as current_prefix,
    'org_xxx_' as new_prefix, -- Needs manual review
    sequence_name as suggested_new_name
FROM information_schema.sequences
WHERE sequence_schema = 'public'
AND (sequence_name LIKE 'org_%' OR sequence_name LIKE 'sys_%')
ORDER BY sequence_name;
```

### Script 2: Generate Rename Statements

```sql
-- scripts/migration/02_generate_rename_statements.sql
-- Purpose: Generate ALTER statements for renaming objects

-- Example: Rename tables
DO $$
DECLARE
    rec RECORD;
    new_name TEXT;
BEGIN
    FOR rec IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'org_orders_mst' -- Example
    LOOP
        new_name := 'org_ord_orders_mst'; -- Calculate based on feature
        
        RAISE NOTICE 'ALTER TABLE % RENAME TO %;', rec.tablename, new_name;
        -- Uncomment to execute:
        -- EXECUTE format('ALTER TABLE %I RENAME TO %I', rec.tablename, new_name);
    END LOOP;
END $$;

-- Example: Rename functions
DO $$
DECLARE
    rec RECORD;
    new_name TEXT;
BEGIN
    FOR rec IN 
        SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'cmx_order_transition' -- Example
    LOOP
        new_name := 'org_ord_transition_status'; -- Calculate based on feature
        
        RAISE NOTICE 'ALTER FUNCTION %(%s) RENAME TO %;', rec.proname, rec.args, new_name;
        -- Uncomment to execute:
        -- EXECUTE format('ALTER FUNCTION %I(%s) RENAME TO %I', rec.proname, rec.args, new_name);
    END LOOP;
END $$;
```

### Script 3: Update Foreign Key References

```sql
-- scripts/migration/03_update_foreign_keys.sql
-- Purpose: Update foreign key constraints after table renames

-- Find all foreign keys referencing renamed tables
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND ccu.table_name IN (
    'org_orders_mst', -- Old name
    'org_order_items_dtl' -- Old name
    -- Add all renamed tables
)
ORDER BY tc.table_name, tc.constraint_name;

-- Generate ALTER statements to drop and recreate FKs
-- (Execute after table rename)
```

### Script 4: Update Index Names

```sql
-- scripts/migration/04_update_indexes.sql
-- Purpose: Rename indexes to match new table names

SELECT
    schemaname,
    tablename,
    indexname,
    'idx_' || REPLACE(REPLACE(tablename, 'org_', 'org_ord_'), 'sys_', 'sys_auth_') || '_' || 
    SUBSTRING(indexname FROM 'idx_[^_]+_(.+)$') as new_indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND (tablename LIKE 'org_%' OR tablename LIKE 'sys_%')
ORDER BY tablename, indexname;

-- Generate rename statements
-- ALTER INDEX idx_orders_tenant RENAME TO idx_org_ord_orders_tenant;
```

### Script 5: Update RLS Policy Names

```sql
-- scripts/migration/05_update_rls_policies.sql
-- Purpose: Rename RLS policies to match new table names

SELECT
    schemaname,
    tablename,
    policyname,
    tablename || '_' || SUBSTRING(policyname FROM '[^_]+$') as new_policyname
FROM pg_policies
WHERE schemaname = 'public'
AND (tablename LIKE 'org_%' OR tablename LIKE 'sys_%')
ORDER BY tablename, policyname;

-- Generate rename statements
-- ALTER POLICY tenant_isolation ON org_orders_mst RENAME TO org_ord_orders_tenant_isolation;
```

### Script 6: Update Trigger Names

```sql
-- scripts/migration/06_update_triggers.sql
-- Purpose: Rename triggers to match new table names

SELECT
    trigger_schema,
    event_object_table,
    trigger_name,
    event_object_table || '_' || SUBSTRING(trigger_name FROM '[^_]+$') as new_trigger_name
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND (event_object_table LIKE 'org_%' OR event_object_table LIKE 'sys_%')
ORDER BY event_object_table, trigger_name;

-- Generate rename statements
-- ALTER TRIGGER trg_orders_updated_at ON org_orders_mst RENAME TO org_ord_orders_updated_at_trg;
```

### Script 7: Update Code References

```bash
# scripts/migration/07_update_code_references.sh
# Purpose: Find and update references in application code

#!/bin/bash

# Find all references to old table names
echo "Finding references to org_orders_mst..."
grep -r "org_orders_mst" web-admin/ backend/ supabase/migrations/ --exclude-dir=node_modules

echo "Finding references to cmx_order_transition..."
grep -r "cmx_order_transition" web-admin/ backend/ supabase/migrations/ --exclude-dir=node_modules

# Generate sed commands for bulk replacement
# sed -i 's/org_orders_mst/org_ord_orders_mst/g' **/*.ts **/*.tsx **/*.sql
```

---

## Migration Checklist

### Pre-Migration

- [ ] Backup production database
- [ ] Test all scripts on development database
- [ ] Document all existing objects
- [ ] Create rollback scripts
- [ ] Notify team of migration schedule
- [ ] Schedule maintenance window

### Phase 1: Low-Risk Objects

- [ ] Migrate sequences
- [ ] Migrate standalone views
- [ ] Migrate indexes (non-critical)
- [ ] Verify no breaking changes

### Phase 2: Functions

- [ ] Migrate utility functions
- [ ] Migrate validation functions
- [ ] Update function references in code
- [ ] Test all function calls

### Phase 3: Tables (Low Dependencies)

- [ ] Migrate lookup tables (`*_cd`)
- [ ] Migrate configuration tables (`*_cf`)
- [ ] Update foreign key references
- [ ] Test queries

### Phase 4: Core Tables

- [ ] Migrate `org_orders_mst` → `org_ord_orders_mst`
- [ ] Migrate `org_order_items_dtl` → `org_ord_order_items_dtl`
- [ ] Migrate `org_customers_mst` → `org_cust_customers_mst`
- [ ] Update all foreign keys
- [ ] Update all application code
- [ ] Test thoroughly

### Phase 5: Cleanup

- [ ] Remove old objects (if safe)
- [ ] Update documentation
- [ ] Update migration scripts
- [ ] Verify all references updated

---

## Rollback Plan

### If Migration Fails

1. **Stop migration immediately**
2. **Restore from backup** (if needed)
3. **Revert code changes**
4. **Document issues**
5. **Fix scripts and retry**

### Rollback Scripts

```sql
-- Rollback: Rename tables back
ALTER TABLE org_ord_orders_mst RENAME TO org_orders_mst;
ALTER TABLE org_ord_order_items_dtl RENAME TO org_order_items_dtl;
-- ... etc

-- Rollback: Rename functions back
ALTER FUNCTION org_ord_transition_status(...) RENAME TO cmx_order_transition;
-- ... etc
```

---

## Testing Strategy

### Unit Tests

- Test all renamed functions
- Test all queries using renamed tables
- Test all foreign key relationships

### Integration Tests

- Test complete workflows
- Test multi-tenant isolation
- Test RLS policies

### Performance Tests

- Compare query performance before/after
- Verify indexes are still effective
- Check for N+1 query issues

---

## Risk Assessment

### Low Risk
- Sequences
- Standalone views
- Utility functions

### Medium Risk
- Lookup tables
- Configuration tables
- Functions with dependencies

### High Risk
- Core business tables (orders, customers)
- Functions used in triggers
- Tables with many foreign keys

---

## Timeline Estimate

- **Phase 1**: 1 week (preparation)
- **Phase 2**: 1 week (low-risk objects)
- **Phase 3**: 1 week (functions)
- **Phase 4**: 2 weeks (tables)
- **Phase 5**: 1 week (cleanup)

**Total**: 6-8 weeks

---

## Related Documentation

- [Database Conventions](./database_conventions.md) - Naming rules
- [Feature Abbreviations](./database_feature_abbreviations.md) - Abbreviation list
- [Grandfathered Objects](./database_grandfathered_objects.md) - Existing objects registry

---

## Return to [Main Documentation](../CLAUDE.md)

