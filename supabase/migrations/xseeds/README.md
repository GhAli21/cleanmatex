# Seed Data

This directory contains **development and testing seed data** for CleanMateX.

## Purpose

These files populate the database with demo data for local development and testing. They should **NEVER** be run in production environments.

## Seed Files

| File | Description | Purpose |
|------|-------------|---------|
| `0001_seed_lookup_tables.sql` | Populate sys_* code tables | Required for app to function |
| `0002_seed_tenant_demo1.sql` | Demo Laundry LLC (Tenant #1) | Testing and development |
| `0003_seed_tenant_demo2.sql` | BlueWave Laundry Co. (Tenant #2) | Multi-tenant testing |

## Demo Tenants

### Tenant 1: Demo Laundry LLC
- **ID**: `11111111-1111-1111-1111-111111111111`
- **Email**: `owner@demo-laundry.example`
- **Slug**: `demo-laundry`
- **Admin User**: `admin@demo-laundry.example` / `Admin123!`
- **Purpose**: Primary demo tenant for development

### Tenant 2: BlueWave Laundry Co.
- **ID**: `20000002-2222-2222-2222-222222222221`
- **Email**: `hq@bluewave.example`
- **Slug**: `bluewave-laundry`
- **Admin User**: `admin@bluewave.example` / `Admin123!`
- **Purpose**: Multi-tenant isolation testing

## Running Seeds

### Recommended: Automated Setup (One Command)

The easiest way to setup a complete development environment:

```powershell
# Complete automated setup (recommended!)
.\scripts\db\reset-with-seeds.ps1

# This automatically:
# 1. Resets database
# 2. Runs production migrations
# 3. Loads all seeds
# 4. Creates admin users
# Ready to use in ~30 seconds!
```

### Manual: Load Seeds Only

If database already exists and you just want to add demo data:

```powershell
# Load all seeds
.\scripts\db\load-seeds.ps1

# Load all seeds + auto-create admin users
.\scripts\db\load-seeds.ps1 -AutoCreateAdmins

# Load only tenant 1
.\scripts\db\load-seeds.ps1 -Tenant1Only

# Load only tenant 2
.\scripts\db\load-seeds.ps1 -Tenant2Only
```

### Direct SQL (Advanced)

Run seeds manually via `psql` (for debugging):

```bash
# From project root
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/migrations/seeds/0001_seed_lookup_tables.sql
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/migrations/seeds/0002_seed_tenant_demo1.sql
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/migrations/seeds/0003_seed_tenant_demo2.sql
```

## Admin User Creation

### Automated (Recommended)

Admin users are created automatically when using the integrated scripts:

```powershell
# Option 1: Complete setup (auto-creates users)
.\scripts\db\reset-with-seeds.ps1

# Option 2: Add flag to load-seeds
.\scripts\db\load-seeds.ps1 -AutoCreateAdmins

# Option 3: Run standalone script
node scripts/db/create-demo-admins.js
```

**What gets created:**

For each demo tenant, the script creates 3 users:
- **Admin** - Full access to all features
- **Operator** - Can manage orders and customers
- **Viewer** - Read-only access

**Demo Tenant #1 Credentials:**
```
admin@demo-laundry.example / Admin123
operator@demo-laundry.example / Operator123
viewer@demo-laundry.example / Viewer123
```

**Demo Tenant #2 Credentials:**
```
admin@bluewave.example / Admin123
operator@bluewave.example / Operator123
viewer@bluewave.example / Viewer123
```

### Manual Creation (Alternative)

If you prefer to create users manually via Supabase Studio:

1. Go to `http://localhost:54323` (Supabase Studio)
2. Navigate to **Authentication > Users**
3. Click **"Add User"**
4. Fill in details:
   - Email: `admin@demo-laundry.example`
   - Password: `Admin123`
   - Auto-confirm email: **YES** ✅
5. After user is created, link to tenant:

```sql
INSERT INTO org_users_mst (user_id, tenant_org_id, display_name, role, is_active)
VALUES (
  '<user_id_from_auth_users>',  -- Get from Supabase Studio
  '11111111-1111-1111-1111-111111111111',  -- Tenant ID
  'Demo Admin',
  'admin',
  true
);
```

### Troubleshooting

**"User already exists" error:**
- This is expected behavior - script is idempotent
- Existing user will be linked to tenant if not already linked
- Safe to run multiple times

**"Tenant not found" error:**
- Run seeds first: `.\scripts\db\load-seeds.ps1`
- Then create users: `node scripts/db/create-demo-admins.js`

**"Cannot connect to Supabase" error:**
- Check Supabase is running: `supabase status`
- Start if needed: `supabase start`

## Guidelines

### When Creating New Seed Files

1. **Naming Convention**: `NNNN_seed_descriptive_name.sql`
   - Use sequential numbering
   - Start with `seed_` prefix
   - Be descriptive

2. **Idempotency**: Always use `ON CONFLICT` clauses
```sql
INSERT INTO org_tenants_mst (id, name, slug, email)
VALUES ('uuid-here', 'Name', 'slug', 'email@example.com')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  updated_at = NOW();
```

3. **Fixed UUIDs**: Use predictable UUIDs for testing
```sql
-- Good: Predictable for testing
'11111111-1111-1111-1111-111111111111'
'22222222-2222-2222-2222-222222222222'

-- Bad: Random UUIDs
gen_random_uuid()  -- Don't use in seeds!
```

4. **Demo Credentials**:
   - Always use `.example` domain for emails
   - Use predictable passwords (for development only!)
   - Document credentials in this README

5. **Completeness**: Each tenant seed should include:
   - Tenant record
   - Subscription
   - At least one branch
   - Service category enablement
   - Admin user
   - Sample products (optional)
   - Sample orders (optional)

## Security Warning

⚠️ **IMPORTANT**: These files contain:
- Hardcoded credentials
- Predictable UUIDs
- Demo/test data

**NEVER** run these in production!

## Cleanup

To remove all seed data and start fresh:

```bash
# Reset database (removes all data)
supabase db reset

# Then reload seeds
.\scripts\db\load-seeds.ps1
```

## Adding a New Demo Tenant

1. Choose a unique UUID pattern (e.g., `30000003-3333-...`)
2. Create `000N_seed_tenant_demoN.sql`
3. Follow the structure of existing tenant seeds
4. Update this README with tenant details
5. Add to load-seeds script

## See Also

- [Production Migrations](../production/README.md) - Schema and RLS
- [Archived Migrations](../archive/README.md) - Historical reference
- [Multi-Tenancy Guide](../../../.claude/docs/multitenancy.md) - Tenant isolation rules
