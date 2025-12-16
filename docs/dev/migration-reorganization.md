# Migration Reorganization Guide

**Date**: 2025-10-24
**Status**: Completed
**Author**: CleanMateX Development Team

## Overview

On 2025-10-24, we reorganized the Supabase migration structure to improve clarity, maintainability, and separate production schema from development seed data.

## Problem Statement

The original migration structure had several issues:

### Issues with Old Structure
1. ❌ **Mixed Concerns**: Production schema and demo data in same files
2. ❌ **Inconsistent Numbering**: Gaps (0003, 0006, 0009-0013) made it confusing
3. ❌ **Duplicate Files**: Separate files for each demo tenant (*_02 pattern)
4. ❌ **No Clear Separation**: Unclear what runs in production vs development
5. ❌ **Difficult Onboarding**: Hard for new developers to understand

### Example of Old Confusion
```
0003_seed_core.sql        # Seed data for tenant 1
0006_seed_auth_demo.sql   # More seed for tenant 1
0009_create_demo_admin_user.sql  # Even more for tenant 1
0011_seed_core_02.sql     # Seed for tenant 2
0012_seed_auth_demo_02.sql  # More seed for tenant 2
0013_create_demo_admin_user_02.sql  # Even more for tenant 2
```

## New Structure

### Directory Organization

```
supabase/migrations/
├── production/              # PRODUCTION-READY MIGRATIONS ONLY
│   ├── README.md
│   ├── 0001_core_schema.sql
│   ├── 0002_core_rls.sql
│   ├── 0003_auth_tables.sql
│   ├── 0004_auth_rls.sql
│   ├── 0005_auth_security.sql
│   ├── 0006_tenant_enhancements.sql
│   └── 0007_tenant_auto_init.sql
│
├── seeds/                   # SEED DATA (Development only)
│   ├── README.md
│   ├── 0001_seed_lookup_tables.sql
│   ├── 0002_seed_tenant_demo1.sql   # Consolidated from 3 files
│   └── 0003_seed_tenant_demo2.sql   # Consolidated from 3 files
│
└── archive/                 # ORIGINAL FILES (Reference only)
    ├── README.md
    └── [All original migration files]
```

### Benefits

✅ **Clear Separation**: Production vs development data
✅ **Sequential Numbering**: No gaps, easier to follow
✅ **Consolidated Seeds**: One file per tenant (was 3+ files)
✅ **Production Safety**: No risk of running demo data in production
✅ **Better Documentation**: Each directory has clear README
✅ **Easier Onboarding**: Developers can immediately understand structure

## Migration Mapping

### Production Migrations

| New File | Original File(s) | Description |
|----------|------------------|-------------|
| `0001_core_schema.sql` | `0001_core.sql` | Core tables (cleaned, no seed data) |
| `0002_core_rls.sql` | `0002_rls_core.sql` | Core RLS policies |
| `0003_auth_tables.sql` | `0004_auth_tables.sql` | Auth tables |
| `0004_auth_rls.sql` | `0005_auth_rls.sql` | Auth RLS + helpers |
| `0005_auth_security.sql` | `0007_auth_security_enhancements.sql` | Account lockout |
| `0006_tenant_enhancements.sql` | `0008_tenant_enhancements.sql` | Tenant branding |
| `0007_tenant_auto_init.sql` | `0010_tenant_auto_initialization.sql` | Auto-init triggers |

### Seed Data Files

| New File | Original Files | Description |
|----------|----------------|-------------|
| `0001_seed_lookup_tables.sql` | Extracted from `0003_seed_core.sql` | Order types, service categories |
| `0002_seed_tenant_demo1.sql` | `0003 + 0006 + 0009` | Demo Laundry LLC (complete) |
| `0003_seed_tenant_demo2.sql` | `0011 + 0012 + 0013` | BlueWave Laundry Co. (complete) |

## Helper Scripts

We created PowerShell scripts to manage the new structure:

### 1. Reset Production Only
```powershell
.\scripts\db\reset-production.ps1
```
- Resets database
- Runs ONLY production migrations
- No seed data loaded
- Use for: Testing production schema

### 2. Load Seeds Only
```powershell
.\scripts\db\load-seeds.ps1 [options]
```
Options:
- `-Tenant1Only`: Load only Demo Tenant #1
- `-Tenant2Only`: Load only Demo Tenant #2
- `-SkipLookups`: Skip lookup tables
- `-AutoCreateAdmins`: Automatically create admin users after loading

Use for: Adding demo data to existing database

### 3. Reset with Seeds (Most Common) ⭐
```powershell
.\scripts\db\reset-with-seeds.ps1
```
- Resets database
- Runs production migrations
- Loads all seed data
- **Automatically creates admin users** 🎉
- Use for: Fresh development environment

### 4. Create Admin Users
```bash
node scripts/db/create-demo-admins.js
```
- Creates admin, operator, and viewer users for all demo tenants
- Links users to their respective tenants
- Idempotent (safe to run multiple times)
- Use for: Standalone admin user creation

## Demo Tenants

### Tenant #1: Demo Laundry LLC
- **UUID**: `11111111-1111-1111-1111-111111111111`
- **Slug**: `demo-laundry`
- **Email**: `owner@demo-laundry.example`
- **Users** (auto-created):
  - Admin: `admin@demo-laundry.example` / `Admin123`
  - Operator: `operator@demo-laundry.example` / `Operator123`
  - Viewer: `viewer@demo-laundry.example` / `Viewer123`
- **Purpose**: Primary demo tenant

### Tenant #2: BlueWave Laundry Co.
- **UUID**: `20000002-2222-2222-2222-222222222221`
- **Slug**: `bluewave-laundry`
- **Email**: `hq@bluewave.example`
- **Users** (auto-created):
  - Admin: `admin@bluewave.example` / `Admin123`
  - Operator: `operator@bluewave.example` / `Operator123`
  - Viewer: `viewer@bluewave.example` / `Viewer123`
- **Purpose**: Multi-tenant isolation testing

## How Supabase Migrations Work

Supabase's `supabase db reset` command:
1. Drops and recreates the database
2. Runs ALL `.sql` files in `supabase/migrations/`
3. Files are run in alphabetical order
4. Skips subdirectories (production/, seeds/, archive/)

### Why We Need Helper Scripts

Since Supabase only runs files in the root `migrations/` directory:
- Helper scripts **temporarily copy** production files to root
- Run `supabase db reset`
- Then **restore** original structure

This gives us:
- Clean directory organization
- Selective migration running (production vs seeds)
- Safe separation of concerns

## Usage Examples

### Fresh Development Setup (Recommended) ⭐
```powershell
# Complete fresh start - FULLY AUTOMATED!
.\scripts\db\reset-with-seeds.ps1

# Creates:
# - Clean production schema
# - Lookup tables
# - 2 demo tenants with sample data
# - 6 admin users (3 per tenant: admin, operator, viewer)
# Ready to login immediately!
```

### Production Schema Testing
```powershell
# Test production migrations only
.\scripts\db\reset-production.ps1

# Then manually create tenants via API
```

### Add More Demo Data
```powershell
# Database already exists, just add tenant 2 with admin
.\scripts\db\load-seeds.ps1 -Tenant2Only -AutoCreateAdmins

# Or add both tenants without admin users
.\scripts\db\load-seeds.ps1
node scripts/db/create-demo-admins.js
```

### Test Multi-Tenant Isolation
```powershell
# Setup with both tenants
.\scripts\db\reset-with-seeds.ps1

# Login as Tenant 1 admin (admin@demo-laundry.example)
# Verify: Cannot see Tenant 2 data

# Login as Tenant 2 admin (admin@bluewave.example)
# Verify: Cannot see Tenant 1 data
```

## Automated Admin User Creation 🎉

**No manual steps required!** Admin users are created automatically.

### How It Works

When you run `.\scripts\db\reset-with-seeds.ps1`, the script:
1. Resets database and runs production migrations
2. Loads seed data (tenants, products, orders)
3. **Automatically creates users** via `create-demo-admins.js`
4. Links users to their respective tenants

### What Gets Created

For each demo tenant, **3 users are created**:

**Demo Laundry LLC:**
- `admin@demo-laundry.example` / `Admin123` (admin role)
- `operator@demo-laundry.example` / `Operator123` (operator role)
- `viewer@demo-laundry.example` / `Viewer123` (viewer role)

**BlueWave Laundry Co.:**
- `admin@bluewave.example` / `Admin123` (admin role)
- `operator@bluewave.example` / `Operator123` (operator role)
- `viewer@bluewave.example` / `Viewer123` (viewer role)

### Manual Creation (If Needed)

If automatic creation fails or you prefer manual control:

**Via Supabase Studio:**
1. Go to `http://localhost:54323`
2. Authentication > Users > Add User
3. Email: `admin@demo-laundry.example`
4. Password: `Admin123`
5. Auto-confirm: YES ✅

**Via Node.js Script:**
```bash
# Create all demo admins
node scripts/db/create-demo-admins.js
```

**Via SQL:** (after auth user exists)
```sql
INSERT INTO org_users_mst (user_id, tenant_org_id, display_name, role, is_active)
VALUES (
  '<user_id_from_auth>',
  '11111111-1111-1111-1111-111111111111',
  'Demo Admin',
  'admin',
  true
);
```

### Troubleshooting

**"User already exists"**
- This is expected - script is idempotent
- User will be linked to tenant if not already
- Safe to run multiple times

**"Tenant not found"**
- Run seeds first: `.\scripts\db\load-seeds.ps1`
- Then: `node scripts/db/create-demo-admins.js`

See `scripts/db/README.md` for complete documentation.

## Migration Guidelines

### Creating New Production Migrations

1. **Naming**: `NNNN_descriptive_name.sql`
```
0008_add_inventory_tables.sql  ✅ Good
add_inventory.sql              ❌ Bad (no number)
008_inventory.sql              ❌ Bad (too few digits)
```

2. **Header Template**:
```sql
-- ==================================================================
-- 0008_migration_name.sql
-- Purpose: Brief description
-- Author: Your Name
-- Created: YYYY-MM-DD
-- Dependencies: 0001, 0002 (if any)
-- ==================================================================

BEGIN;

-- Your migration code here

COMMIT;
```

3. **Checklist**:
- [ ] Sequential numbering (next available number)
- [ ] Transaction wrapper (BEGIN/COMMIT)
- [ ] Comments explaining complex logic
- [ ] Idempotent where possible (CREATE IF NOT EXISTS, etc.)
- [ ] RLS policies for org_* tables
- [ ] Indexes for foreign keys
- [ ] No seed/demo data

### Creating New Seed Files

1. **Naming**: `NNNN_seed_descriptive_name.sql`
```
0004_seed_tenant_demo3.sql  ✅ Good
```

2. **Idempotency**: Always use `ON CONFLICT`
```sql
INSERT INTO org_tenants_mst (id, name, slug, email)
VALUES ('uuid', 'Name', 'slug', 'email@example.com')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = NOW();
```

3. **Fixed UUIDs**: Use predictable patterns
```
Tenant 1:  1111111-1111-1111-1111-11111111111X
Tenant 2:  2000002-2222-2222-2222-22222222222X
Tenant 3:  3000003-3333-3333-3333-33333333333X  (if needed)
```

## Testing Checklist

After reorganization:
- [x] Production migrations run successfully
- [x] RLS policies created and enabled
- [x] Seed scripts load without errors
- [x] Helper scripts work correctly
- [x] Documentation updated
- [x] Original files archived

## Troubleshooting

### Supabase db reset fails
```powershell
# Check Supabase is running
supabase status

# If not running
supabase start

# View detailed logs
supabase logs --db
```

### Seed loading fails
```powershell
# Check database connection
psql postgresql://postgres:postgres@localhost:54322/postgres -c "SELECT 1;"

# View specific seed file errors
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/migrations/seeds/0001_seed_lookup_tables.sql
```

### Helper scripts fail
```powershell
# Run with verbose output
powershell -ExecutionPolicy Bypass -File .\scripts\db\reset-production.ps1 -Verbose

# Check PowerShell execution policy
Get-ExecutionPolicy

# If restricted, run with bypass
powershell -ExecutionPolicy Bypass -File <script>
```

## Future Improvements

Potential enhancements:
1. Create bash versions of PowerShell scripts for Linux/Mac
2. Add migration validator script
3. Create migration generator template
4. Add seed data validator
5. Automated testing for migrations

## See Also

- [Production Migrations README](../../supabase/migrations/production/README.md)
- [Seeds README](../../supabase/migrations/seeds/README.md)
- [Archive README](../../supabase/migrations/archive/README.md)
- [Database Conventions](../../.claude/docs/database_conventions.md)
- [Development Commands](../../.claude/docs/dev_commands.md)

---

**Last Updated**: 2025-10-24
**Status**: ✅ Complete and Tested
