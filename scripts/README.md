# CleanMateX Scripts

Utility scripts for development and maintenance.

## Development Scripts

### Create Test User

**Purpose:** Create a demo admin user for development and testing

**⚠️ NOTE:** As of 2025-10-23, demo admin user is now created automatically by migration `0009_create_demo_admin_user.sql`. This script is kept as a fallback or for creating additional users.

**Usage:**
```bash
cd web-admin
node ../scripts/create-test-user.js
```

**What it does:**
- Creates user in Supabase Auth
- Auto-confirms email (dev only)
- Links user to demo tenant
- Sets admin role
- Provides login credentials

**Output:**
```
Email:    admin@demo-laundry.local
Password: Admin123
```

**Idempotent:** Safe to run multiple times - detects existing users

**Requirements:**
- Supabase must be running (`supabase start`)
- Environment variables set in `web-admin/.env.local`

**When to use:**
- Automatic migration creation failed
- Need to create additional test users
- Need to recreate users after database reset

---

## Database Scripts

### Reset Database

**Purpose:** Reset local database to clean state

**Usage:**
```bash
supabase db reset
```

**What it does:**
- Drops all tables
- Runs all migrations in order
- Seeds demo data
- **Note:** Does NOT create auth users (run `create-test-user.js` after)

### Push Database Changes

**Purpose:** Apply migrations to local database

**Usage:**
```bash
supabase db push
```

---

## Service Management Scripts (PowerShell)

Located in `scripts/dev/` for Windows development.

### Start All Services

**Usage:**
```powershell
.\scripts\dev\start-services.ps1
```

**Starts:**
- Supabase (PostgreSQL, API, Studio)
- Docker services (Redis, MinIO)

### Stop All Services

**Usage:**
```powershell
.\scripts\dev\stop-services.ps1
```

### Check Service Status

**Usage:**
```powershell
.\scripts\dev\status-services.ps1
```

---

## Planned Scripts

### Create Staff User
```bash
node scripts/create-staff-user.js
# Email: staff@demo-laundry.local
# Role: staff
```

### Create Manager User
```bash
node scripts/create-manager-user.js
# Email: manager@demo-laundry.local
# Role: manager
```

### Seed More Demo Data
```bash
node scripts/seed-demo-orders.js
# Creates 50 demo orders with various statuses
```

### Generate Test Report
```bash
node scripts/generate-test-report.js
# Outputs system status and verification checks
```

---

## Creating New Scripts

### Template

```javascript
#!/usr/bin/env node

/**
 * Script Name
 * Brief description of what it does
 */

// Your code here

async function main() {
  try {
    console.log('🚀 Starting...');
    // Implementation
    console.log('✅ Success!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
```

### Best Practices

1. **Make it executable:**
   ```bash
   chmod +x scripts/your-script.js
   ```

2. **Use clear output:**
   - ✅ Success indicators
   - ❌ Error messages
   - ℹ️  Informational messages
   - 🚀 Progress indicators

3. **Handle errors gracefully:**
   - Try-catch blocks
   - Meaningful error messages
   - Non-zero exit codes on failure

4. **Make it idempotent:**
   - Check if action already done
   - Don't fail if already in desired state
   - Safe to run multiple times

5. **Document it:**
   - Add to this README
   - Include usage examples
   - Explain what it does

---

## Environment Variables

Most scripts need these environment variables (from `web-admin/.env.local`):

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
SERVICE_ROLE_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

---

## Troubleshooting

### "Cannot find module '@supabase/supabase-js'"

Install dependencies:
```bash
cd web-admin
npm install
```

### "Connection refused"

Start Supabase:
```bash
supabase start
```

### "Invalid credentials"

Check environment variables in `web-admin/.env.local`

---

## See Also

- [Development Commands](../docs/dev/dev_commands.md)
- [Quick Start Guide](../docs/dev/QUICK_START.md)
- [Test Credentials](../docs/dev/TEST_CREDENTIALS.md)
