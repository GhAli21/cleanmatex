# Apply Auth Migrations - Quick Fix

## Issue
The error `Error checking account lock status` occurs because the database migration for account lockout hasn't been applied yet.

## Solution

Run this command from the project root:

```bash
# Apply the security enhancement migration
supabase db push
```

Or if you're using Supabase local:

```bash
# Reset database with all migrations
supabase db reset

# OR apply specific migration
supabase migration up
```

## Alternative: Apply Migration Manually

If the above doesn't work, apply the migration directly:

```bash
# Connect to your database
psql postgresql://postgres:postgres@localhost:54322/postgres

# Or use Supabase Studio SQL Editor at http://localhost:54323
```

Then run the migration file: `supabase/migrations/0007_auth_security_enhancements.sql`

## Verify Migration Applied

Check if the function exists:

```sql
SELECT proname FROM pg_proc WHERE proname = 'is_account_locked';
```

Should return:
```
     proname
------------------
 is_account_locked
```

Check if new columns exist:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'org_users_mst'
AND column_name IN ('failed_login_attempts', 'locked_until');
```

Should return:
```
      column_name
------------------------
 failed_login_attempts
 locked_until
```

## After Migration

1. Refresh the page
2. Try logging in again
3. The error should be gone

## Note

The code has been updated to gracefully handle the case where the migration hasn't been applied yet, so the system will continue to work but without the account lockout security feature until the migration is applied.
