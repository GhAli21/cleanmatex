# How to Run sync_missing_permissions.sql

This guide provides multiple methods to execute the `sync_missing_permissions.sql` script.

## Prerequisites

- Supabase Local must be running
- Database connection available on port `54322`

## Method 1: Using psql (Command Line) - Recommended

### Step 1: Get Database Connection String

```bash
# Get the connection string from Supabase status
supabase status
```

Look for the `DB URL` line, which should be:

```

postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

### Step 2: Run the Script

**PowerShell:**

```powershell
# From project root
cd supabase
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f sync_missing_permissions.sql
```

**Bash/Linux/Mac:**

```bash
# From project root
cd supabase
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f sync_missing_permissions.sql
```

**Windows Command Prompt:**

```cmd
cd supabase
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f sync_missing_permissions.sql
```

### Expected Output

You should see output like:

```
NOTICE:  ========================================
NOTICE:  ✅ Permissions Sync Completed
NOTICE:  ========================================
NOTICE:  Missing permissions found: 0
NOTICE:  Permissions inserted: 12
NOTICE:  Role-permission mappings inserted: 24
NOTICE:  Total permissions linked to components: 15
NOTICE:  Total role-permission mappings: 30
NOTICE:  ========================================
COMMIT
```

---

## Method 2: Using Supabase Studio (Web UI) - Easiest

### Step 1: Open Supabase Studio

```bash
# Make sure Supabase is running
supabase status

# Open Studio in your browser
# URL: http://localhost:54323
```

Or click: [http://localhost:54323](http://localhost:54323)

### Step 2: Navigate to SQL Editor

1. Click on **"SQL Editor"** in the left sidebar
2. Click **"New query"**

### Step 3: Copy and Paste Script

1. Open `supabase/sync_missing_permissions.sql` in your editor
2. Copy the entire contents
3. Paste into the SQL Editor in Supabase Studio
4. Click **"Run"** (or press `Ctrl+Enter` / `Cmd+Enter`)

### Step 4: View Results

The results will appear in the output panel below the editor, showing the NOTICE messages.

---

## Method 3: Using psql Interactive Mode

### Step 1: Connect to Database

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
```

### Step 2: Run Script Commands

Once connected, you can either:

**Option A: Use `\i` command**

```sql
\i sync_missing_permissions.sql
```

**Option B: Copy-paste the script content**

```sql
-- Paste the entire script content here
BEGIN;
-- ... (rest of script)
COMMIT;
```

### Step 3: Exit psql

```sql
\q
```

---

## Method 4: Convert to Migration (For Version Control)

If you want this script to run automatically with migrations:

### Step 1: Create Migration File

```bash
cd supabase
supabase migration new sync_missing_permissions
```

This creates a file like: `supabase/migrations/YYYYMMDDHHMMSS_sync_missing_permissions.sql`

### Step 2: Copy Script Content

Copy the contents of `sync_missing_permissions.sql` into the new migration file.

### Step 3: Apply Migration

```bash
# Apply the migration
supabase db push

# Or reset database (applies all migrations)
supabase db reset
```

---

## Method 5: Using Database Client Tools

### DBeaver / pgAdmin / TablePlus

1. **Connect to database:**

   - Host: `127.0.0.1` or `localhost`
   - Port: `54322`
   - Database: `postgres`
   - Username: `postgres`
   - Password: `postgres`

2. **Open SQL Editor** and paste the script content

3. **Execute** the script

---

## Verification

After running the script, verify the results:

```sql
-- Check inserted permissions
SELECT code, name, category_main, created_at
FROM sys_auth_permissions
WHERE code IN (
  SELECT DISTINCT main_permission_code
  FROM sys_components_cd
  WHERE main_permission_code IS NOT NULL
)
ORDER BY created_at DESC;

-- Check role-permission mappings
SELECT role_code, permission_code, created_at
FROM sys_auth_role_default_permissions
WHERE role_code IN ('super_admin', 'tenant_admin')
  AND permission_code IN (
    SELECT DISTINCT main_permission_code
    FROM sys_components_cd
    WHERE main_permission_code IS NOT NULL
  )
ORDER BY created_at DESC;
```

---

## Troubleshooting

### Error: "relation does not exist"

**Solution:** Make sure all migrations have been applied:

```bash
supabase db reset
```

### Error: "permission denied"

**Solution:** Ensure you're using the correct connection string with `postgres` user.

### Error: "connection refused"

**Solution:** Make sure Supabase is running:

```bash
supabase status
# If not running:
supabase start
```

### Script runs but shows 0 permissions inserted

**Solution:** This means all permissions already exist. The script is idempotent and safe to run multiple times.

---

## Notes

- ✅ The script is **idempotent** - safe to run multiple times
- ✅ Uses `ON CONFLICT DO NOTHING` to prevent duplicates
- ✅ Wrapped in a transaction (`BEGIN`/`COMMIT`) for safety
- ✅ Provides detailed reporting via `RAISE NOTICE`

---

## Quick Reference

**Fastest method (one command):**

```powershell
cd supabase
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f sync_missing_permissions.sql
```

**Easiest method (GUI):**

1. Open http://localhost:54323
2. Go to SQL Editor
3. Paste script and run
