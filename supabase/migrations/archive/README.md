# Archive - Original Migrations

This directory contains the **original, unorganized migration files** from before the October 2025 reorganization.

## Purpose

These files are kept for **historical reference only**. They should not be used or modified.

## Why Archive?

On 2025-10-24, we reorganized the migration structure to:
1. Separate production migrations from seed data
2. Consolidate duplicate tenant demo files
3. Establish clear numbering and naming conventions
4. Improve maintainability and onboarding

## Original Structure (Before Reorganization)

The original flat structure had several issues:

### Issues
- ❌ Mixed production schema and demo data in same files
- ❌ Inconsistent numbering with gaps (0003, 0006, 0009-0013)
- ❌ Duplicate files for each demo tenant (*_02 pattern)
- ❌ No clear separation between production-ready and development-only
- ❌ Difficult to understand what runs in production vs development

### Original Files

| Original File | Purpose | Reorganized To |
|---------------|---------|----------------|
| `0001_core.sql` | Core schema + some seeds | `production/0001_core_schema.sql` (cleaned) |
| `0002_rls_core.sql` | RLS policies | `production/0002_core_rls.sql` |
| `0003_seed_core.sql` | Seed data for tenant 1 | `seeds/0002_seed_tenant_demo1.sql` (part 1) |
| `0004_auth_tables.sql` | Auth tables | `production/0003_auth_tables.sql` |
| `0005_auth_rls.sql` | Auth RLS + helpers | `production/0004_auth_rls.sql` |
| `0006_seed_auth_demo.sql` | Auth seed for tenant 1 | `seeds/0002_seed_tenant_demo1.sql` (part 2) |
| `0007_auth_security_enhancements.sql` | Account lockout | `production/0005_auth_security.sql` |
| `0008_tenant_enhancements.sql` | Tenant features | `production/0006_tenant_enhancements.sql` |
| `0009_create_demo_admin_user.sql` | Admin user for tenant 1 | `seeds/0002_seed_tenant_demo1.sql` (part 3) |
| `0010_tenant_auto_initialization.sql` | Auto-init triggers | `production/0007_tenant_auto_init.sql` |
| `0011_seed_core_02.sql` | Seed data for tenant 2 | `seeds/0003_seed_tenant_demo2.sql` (part 1) |
| `0012_seed_auth_demo_02.sql` | Auth seed for tenant 2 | `seeds/0003_seed_tenant_demo2.sql` (part 2) |
| `0013_create_demo_admin_user_02.sql` | Admin user for tenant 2 | `seeds/0003_seed_tenant_demo2.sql` (part 3) |

## New Structure (After Reorganization)

```
supabase/migrations/
├── production/              # Clean, sequential, production-ready
│   ├── 0001_core_schema.sql
│   ├── 0002_core_rls.sql
│   ├── 0003_auth_tables.sql
│   ├── 0004_auth_rls.sql
│   ├── 0005_auth_security.sql
│   ├── 0006_tenant_enhancements.sql
│   └── 0007_tenant_auto_init.sql
│
├── seeds/                   # Consolidated demo data
│   ├── 0001_seed_lookup_tables.sql
│   ├── 0002_seed_tenant_demo1.sql  # Consolidates 0003, 0006, 0009
│   └── 0003_seed_tenant_demo2.sql  # Consolidates 0011, 0012, 0013
│
└── archive/                 # This directory
    └── [Original files preserved here]
```

## Benefits of New Structure

✅ **Clear Separation**: Production vs development data
✅ **Sequential Numbering**: No gaps, easier to follow
✅ **Consolidated Seeds**: One file per tenant (was 3+ files)
✅ **Production Safety**: No risk of running demo data in production
✅ **Better Documentation**: Each directory has clear README
✅ **Easier Onboarding**: Developers can immediately understand structure

## Accessing Archived Files

These files are preserved in Git history at commit: `[COMMIT_HASH]`

To view original file:
```bash
# View file as it was
git show HEAD:supabase/migrations/0003_seed_core.sql

# Restore specific file (if needed)
git checkout HEAD -- supabase/migrations/archive/0003_seed_core.sql
```

## Do NOT

- ❌ Run these archived migrations
- ❌ Modify files in this directory
- ❌ Reference these files in new code
- ❌ Copy-paste from here without understanding the reorganization

## See Also

- [Production Migrations](../production/README.md) - Current production migrations
- [Seed Data](../seeds/README.md) - Current seed data structure
- [Migration Reorganization Plan](../../../docs/dev/migration-reorganization-plan.md) - Full details

---

**Archive Date**: 2025-10-24
**Reorganization Author**: CleanMateX Development Team
**Reason**: Improve maintainability and separate concerns
