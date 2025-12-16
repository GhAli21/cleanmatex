# Production Migrations

This directory contains **production-ready** database migrations for CleanMateX.

## Purpose

These migrations define the core database schema, security policies, and system functions that should be deployed to production environments. They contain **NO demo or seed data**.

## Migration Files

| File | Description | Dependencies |
|------|-------------|--------------|
| `0001_core_schema.sql` | Core tables (sys_*, org_*) | None |
| `0002_core_rls.sql` | Row-Level Security policies for core tables | 0001 |
| `0003_auth_tables.sql` | Authentication and user management tables | 0001 |
| `0004_auth_rls.sql` | RLS policies and helper functions for auth | 0002, 0003 |
| `0005_auth_security.sql` | Account lockout and security enhancements | 0003, 0004 |
| `0006_tenant_enhancements.sql` | Tenant branding and feature flags | 0001 |
| `0007_tenant_auto_init.sql` | Auto-initialization triggers for new tenants | 0001, 0003 |

## Running Migrations

### Development (Local)
```bash
# From project root
supabase db reset

# This will:
# 1. Drop and recreate the database
# 2. Run all migrations in order
# 3. NOT run seed data (see ../seeds/)
```

### Production
```bash
# Deploy to production (remote)
supabase db push

# Always test in staging first!
```

## Guidelines

### When Creating New Production Migrations

1. **Naming Convention**: `NNNN_descriptive_name.sql`
   - Use sequential numbering (0008, 0009, etc.)
   - Use snake_case for names
   - Be descriptive but concise

2. **File Structure**:
```sql
-- ==================================================================
-- NNNN_migration_name.sql
-- Purpose: Brief description of what this migration does
-- Author: Your Name
-- Created: YYYY-MM-DD
-- Dependencies: List prerequisite migrations
-- ==================================================================

BEGIN;

-- Your migration code here

COMMIT;
```

3. **Best Practices**:
   - ✅ Use transactions (BEGIN/COMMIT)
   - ✅ Make migrations idempotent where possible
   - ✅ Add comments explaining complex logic
   - ✅ Include DROP IF EXISTS for safety
   - ✅ Test rollback scenarios
   - ❌ Never include demo/seed data
   - ❌ Never hardcode tenant-specific data
   - ❌ Avoid breaking changes when possible

4. **Multi-Tenancy Rules**:
   - Always add `tenant_org_id` to org_* tables
   - Always create RLS policies for tenant isolation
   - Always use composite foreign keys for tenant tables
   - Test that tenant A cannot see tenant B's data

## Rollback Strategy

If a migration fails in production:

1. **Check logs**: `supabase logs --db`
2. **Manual rollback** (if needed):
```sql
-- Connect to production
psql $DATABASE_URL

-- Manually undo changes
-- (This is why comments are important!)
```

3. **Fix and redeploy**:
   - Fix the migration locally
   - Test with `supabase db reset`
   - Deploy fixed version

## Testing Checklist

Before deploying a new migration:

- [ ] Migration runs successfully with `supabase db reset`
- [ ] RLS policies are created and enabled
- [ ] Multi-tenant isolation is verified
- [ ] Indexes are added for foreign keys
- [ ] No demo/test data is included
- [ ] Migration is idempotent (can run multiple times safely)
- [ ] Comments and documentation are clear
- [ ] Tested on a staging environment

## See Also

- [Seed Data](../seeds/README.md) - Demo and test data
- [Archived Migrations](../archive/README.md) - Historical reference
- [Database Conventions](../../../.claude/docs/database_conventions.md) - Schema standards
