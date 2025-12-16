# Database Helper Scripts

This directory contains PowerShell and Node.js scripts for managing the CleanMateX database during development.

## Quick Reference

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `reset-with-seeds.ps1` | Complete fresh setup | **Most common** - Fresh dev environment |
| `reset-production.ps1` | Production schema only | Testing schema without demo data |
| `load-seeds.ps1` | Add demo data | Database exists, need demo tenants |
| `create-demo-admins.js` | Create admin users | After seeds, create/update users |

## Scripts Overview

### 1. reset-with-seeds.ps1 ⭐ (Recommended for Development)

**Complete automated development setup** - runs production migrations + loads seeds + creates admin users.

```powershell
# Full automated setup (most common use case)
.\scripts\db\reset-with-seeds.ps1

# Skip confirmation prompt
.\scripts\db\reset-with-seeds.ps1 -SkipConfirm

# Load only tenant 1
.\scripts\db\reset-with-seeds.ps1 -Tenant1Only

# Load only tenant 2
.\scripts\db\reset-with-seeds.ps1 -Tenant2Only
```

**What it does:**
1. ✅ Resets database (destroys all data)
2. ✅ Runs production migrations (clean schema)
3. ✅ Loads lookup tables
4. ✅ Loads demo tenant(s)
5. ✅ Creates admin users automatically

**After running:**
- Database fully seeded and ready for development
- 2 demo tenants with sample data
- 6 demo users (3 per tenant: admin, operator, viewer)
- Can immediately login to web admin

**Output:**
```
=================================================
  CleanMateX - Reset Database with Seeds
=================================================

[Step 1/3] Resetting production database...
✓ Production migrations applied

[Step 2/3] Loading seed data...
✓ Lookup tables seeded
✓ Demo Tenant #1 seeded
✓ Demo Tenant #2 seeded

[Step 3/3] Creating admin users...
✓ 6 users created successfully

Complete Setup Finished!
```

---

### 2. reset-production.ps1

**Production schema only** - resets database and runs production migrations WITHOUT demo data.

```powershell
# Reset with production schema only
.\scripts\db\reset-production.ps1

# Skip confirmation
.\scripts\db\reset-production.ps1 -SkipConfirm
```

**What it does:**
1. ✅ Resets database (destroys all data)
2. ✅ Runs production migrations from `production/`
3. ❌ Does NOT load seeds
4. ❌ Does NOT create users

**Use when:**
- Testing production schema changes
- Want clean database without demo data
- Creating tenants manually via API

**After running:**
- Clean database with schema only
- No tenants, no demo data
- Use `load-seeds.ps1` to add demo data if needed

---

### 3. load-seeds.ps1

**Load demo data** into existing database.

```powershell
# Load all seeds
.\scripts\db\load-seeds.ps1

# Load all seeds + create admin users
.\scripts\db\load-seeds.ps1 -AutoCreateAdmins

# Load only tenant 1
.\scripts\db\load-seeds.ps1 -Tenant1Only

# Load only tenant 2
.\scripts\db\load-seeds.ps1 -Tenant2Only

# Skip lookup tables (if already loaded)
.\scripts\db\load-seeds.ps1 -SkipLookups

# Combine flags
.\scripts\db\load-seeds.ps1 -Tenant1Only -AutoCreateAdmins
```

**Parameters:**
- `-AutoCreateAdmins` - Create admin users after loading seeds
- `-Tenant1Only` - Load only Demo Laundry LLC
- `-Tenant2Only` - Load only BlueWave Laundry Co.
- `-SkipLookups` - Skip loading lookup tables

**What it does:**
1. Loads lookup tables (order types, service categories)
2. Loads selected demo tenant(s)
3. Optionally creates admin users

**Use when:**
- Database already exists
- Want to add demo data
- Testing with specific tenants only

**Important:**
- Does NOT reset database
- Assumes production schema already loaded
- Safe to run multiple times (idempotent)

---

### 4. create-demo-admins.js

**Node.js script** to create/update admin users for demo tenants.

```bash
# Create all demo admin users
node scripts/db/create-demo-admins.js

# Or via npm
npm run db:create-admins
```

**What it does:**
1. Creates admin, operator, and viewer users for each tenant
2. Links users to tenants via `org_users_mst`
3. Handles existing users gracefully (idempotent)
4. Validates tenants exist before creating users

**Creates 6 users total:**

**Demo Laundry LLC:**
- admin@demo-laundry.example / Admin123 (admin)
- operator@demo-laundry.example / Operator123 (operator)
- viewer@demo-laundry.example / Viewer123 (viewer)

**BlueWave Laundry Co.:**
- admin@bluewave.example / Admin123 (admin)
- operator@bluewave.example / Operator123 (operator)
- viewer@bluewave.example / Viewer123 (viewer)

**Requirements:**
- Supabase must be running
- Demo tenants must exist in database
- `@supabase/supabase-js` installed

**Use when:**
- After loading seeds manually
- Need to recreate admin users
- Testing authentication flows

**Features:**
- ✅ Idempotent (safe to run multiple times)
- ✅ Validates tenant exists
- ✅ Fail-fast error handling
- ✅ Clear console output with emojis

---

## Common Workflows

### Fresh Development Setup (Recommended)
```powershell
# One command - everything automated!
.\scripts\db\reset-with-seeds.ps1
```

Result: Full dev environment ready in ~30 seconds.

### Testing Production Schema
```powershell
# Schema only, no demo data
.\scripts\db\reset-production.ps1

# Then create tenants via API/admin interface
```

### Adding Demo Data to Existing Database
```powershell
# Add both tenants
.\scripts\db\load-seeds.ps1

# Create admin users
node scripts/db/create-demo-admins.js
```

### Testing Multi-Tenant Isolation
```powershell
# Load both tenants with auto-admin creation
.\scripts\db\reset-with-seeds.ps1

# Login as Tenant 1 admin
# Verify cannot see Tenant 2 data
```

### Quick Tenant Switching
```powershell
# Reset and load only tenant 1
.\scripts\db\reset-with-seeds.ps1 -Tenant1Only

# Switch to tenant 2
.\scripts\db\reset-production.ps1 -SkipConfirm
.\scripts\db\load-seeds.ps1 -Tenant2Only -AutoCreateAdmins
```

---

## Troubleshooting

### "Cannot connect to PostgreSQL"
```powershell
# Check Supabase status
supabase status

# If not running
supabase start
```

### "Tenant not found"
You tried to create admin users before loading seeds:
```powershell
# Load seeds first
.\scripts\db\load-seeds.ps1

# Then create admins
node scripts/db/create-demo-admins.js
```

### "Script execution policy" error
```powershell
# Run with bypass
powershell -ExecutionPolicy Bypass -File .\scripts\db\reset-with-seeds.ps1
```

### "User already exists" (not an error)
This is expected behavior - scripts are idempotent. The existing user will be linked to tenant if not already linked.

### Migration fails
```powershell
# View detailed logs
supabase logs --db

# Check migration files exist
ls supabase/migrations/production/

# Try manual reset
supabase db reset
```

### Node script fails
```bash
# Check Node version (needs >=20)
node --version

# Reinstall dependencies
cd web-admin
npm install

# Check if Supabase running
curl http://127.0.0.1:54321
```

---

## Environment Variables

Scripts use these environment variables (with defaults for local development):

| Variable | Default (Local) | Purpose |
|----------|-----------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:54321` | Supabase API URL |
| `SERVICE_ROLE_KEY` | Local key | Supabase admin key |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:54322/postgres` | Direct DB access |

**For local development:** Defaults work automatically - no configuration needed!

**For CI/CD:** Set these variables in your pipeline environment.

---

## Script Dependencies

### PowerShell Scripts
- PowerShell 5.1+ (Windows)
- Supabase CLI (`supabase` command)
- PostgreSQL client (`psql` command)

### Node.js Scripts
- Node.js >=20.0.0
- `@supabase/supabase-js` (in web-admin workspace)
- Supabase running locally

---

## Development Tips

### Speed Up Reset
```powershell
# Skip confirmation prompts
.\scripts\db\reset-with-seeds.ps1 -SkipConfirm
```

### Test Single Tenant
```powershell
# Faster when you only need one tenant
.\scripts\db\reset-with-seeds.ps1 -Tenant1Only
```

### Verify Tenants
```bash
# Check tenants exist
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -c "SELECT id, name, slug FROM org_tenants_mst;"
```

### Verify Users
```bash
# Check auth users
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -c "SELECT email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 10;"
```

### Manual User Creation (Alternative)
Via Supabase Studio:
1. Go to http://localhost:54323
2. Authentication > Users
3. Add User
4. Email: admin@demo-laundry.example
5. Password: Admin123
6. Auto-confirm: YES

Then link manually:
```sql
INSERT INTO org_users_mst (user_id, tenant_org_id, display_name, role)
VALUES ('<user_id>', '11111111-1111-1111-1111-111111111111', 'Demo Admin', 'admin');
```

---

## Adding New Demo Tenants

To add a new demo tenant:

1. **Create seed file**: `seeds/0004_seed_tenant_demo3.sql`
2. **Update `create-demo-admins.js`**: Add to `DEMO_TENANTS` array
3. **Update seed scripts**: Add to `load-seeds.ps1`
4. **Document**: Update this README

Example:
```javascript
// In create-demo-admins.js
{
  tenantId: '30000003-3333-3333-3333-333333333331',
  tenantName: 'Ocean Clean Services',
  slug: 'ocean-clean',
  users: [
    {
      email: 'admin@ocean-clean.example',
      password: 'Admin123',
      displayName: 'Ocean Admin',
      role: 'admin'
    }
  ]
}
```

---

## Performance Notes

**Typical execution times** (on modern development machine):

| Script | Duration |
|--------|----------|
| `reset-production.ps1` | ~15-20 seconds |
| `load-seeds.ps1` (all) | ~5-10 seconds |
| `create-demo-admins.js` | ~3-5 seconds |
| `reset-with-seeds.ps1` (complete) | ~25-35 seconds |

**Database size after full seed:**
- Tables: ~20
- Rows: ~100-200
- Disk space: <5MB

---

## CI/CD Integration

For automated testing:

```yaml
# Example GitHub Actions
- name: Setup Database
  run: |
    supabase start
    powershell -ExecutionPolicy Bypass -File .\scripts\db\reset-with-seeds.ps1 -SkipConfirm

- name: Verify Setup
  run: node scripts/db/create-demo-admins.js
```

---

## See Also

- [Migration Reorganization Guide](../../docs/dev/migration-reorganization.md)
- [Production Migrations README](../../supabase/migrations/production/README.md)
- [Seeds README](../../supabase/migrations/seeds/README.md)
- [Database Conventions](../../.claude/docs/database_conventions.md)

---

**Last Updated**: 2025-10-24
**Maintainer**: CleanMateX Development Team
