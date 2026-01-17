# How the Database Trigger Runs Automatically on Login

This document explains the mechanism behind how PostgreSQL triggers automatically execute when a user logs in via Supabase Auth.

## Overview

When a user logs in, Supabase Auth performs database operations on the `auth.users` table. PostgreSQL automatically fires our trigger **before** the record is saved, allowing us to inject tenant context into `user_metadata` before the JWT is generated.

---

## The Complete Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Login Flow with Trigger                      │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────────────┐
    │ 1. Client Code    │
    │    signInWithPassword() │
    └────────┬──────────┘
             │
             ▼
    ┌──────────────────────────────────────┐
    │ 2. Supabase Auth Service             │
    │    (Running on Supabase Server)      │
    │    - Validates email/password        │
    │    - Checks user exists              │
    │    - Verifies password hash          │
    └────────┬─────────────────────────────┘
             │
             ▼
    ┌──────────────────────────────────────┐
    │ 3. PostgreSQL Database Operation     │
    │    INSERT INTO auth.users (...)       │
    │    OR                                 │
    │    UPDATE auth.users SET ...         │
    │    WHERE id = user_id                 │
    └────────┬─────────────────────────────┘
             │
             ▼
    ┌──────────────────────────────────────┐
    │ 4. PostgreSQL Trigger Fires          │
    │    BEFORE INSERT OR UPDATE            │
    │    ┌──────────────────────────────┐   │
    │    │ ensure_jwt_tenant_context() │   │
    │    │ - Queries org_users_mst      │   │
    │    │ - Gets tenant_org_id         │   │
    │    │ - Modifies NEW.raw_user_meta_data│
    │    └──────────────────────────────┘   │
    └────────┬─────────────────────────────┘
             │
             ▼
    ┌──────────────────────────────────────┐
    │ 5. Modified Record Saved              │
    │    auth.users now contains:           │
    │    raw_user_meta_data = {             │
    │      tenant_org_id: "uuid",           │
    │      org_user_id: "uuid"              │
    │    }                                  │
    └────────┬─────────────────────────────┘
             │
             ▼
    ┌──────────────────────────────────────┐
    │ 6. Supabase Auth Reads Record         │
    │    - Reads auth.users                 │
    │    - Includes user_metadata in JWT    │
    └────────┬─────────────────────────────┘
             │
             ▼
    ┌──────────────────────────────────────┐
    │ 7. JWT Generated                     │
    │    {                                  │
    │      user_metadata: {                │
    │        tenant_org_id: "uuid"         │
    │      }                                │
    │    }                                  │
    └────────┬─────────────────────────────┘
             │
             ▼
    ┌──────────────────────────────────────┐
    │ 8. Client Receives JWT               │
    │    - Contains tenant context          │
    │    - Ready for API requests           │
    └──────────────────────────────────────┘
```

---

## Step-by-Step Explanation

### Step 1: Client Initiates Login

```typescript
// Client code (web-admin/lib/auth/auth-context.tsx)
const { data, error } = await supabase.auth.signInWithPassword({
  email: "user@example.com",
  password: "password123"
})
```

**What happens:**
- Client sends HTTP POST request to Supabase Auth API
- Request includes email and password
- Supabase client library handles the request

---

### Step 2: Supabase Auth Service Validates Credentials

**Location:** Supabase Auth Service (server-side, not in our codebase)

**What happens:**
1. Supabase Auth receives the login request
2. Validates email format
3. Looks up user in `auth.users` table
4. Verifies password hash matches stored hash
5. Checks if account is locked/disabled
6. If valid, proceeds to update/create session

**Key Point:** Supabase Auth is a separate service that manages authentication. It has direct access to the PostgreSQL database.

---

### Step 3: Database Operation Initiated

**What Supabase Auth does:**

```sql
-- For existing user (most common case):
UPDATE auth.users
SET 
  last_sign_in_at = NOW(),
  updated_at = NOW(),
  -- May also update other fields
WHERE email = 'user@example.com';

-- OR for new user (first login):
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  created_at,
  updated_at,
  raw_user_meta_data
) VALUES (
  gen_random_uuid(),
  'user@example.com',
  'hashed_password',
  NOW(),
  NOW(),
  '{}'::jsonb
);
```

**Key Point:** Supabase Auth performs standard SQL INSERT/UPDATE operations on `auth.users` table.

---

### Step 4: PostgreSQL Trigger Automatically Fires

**Location:** `supabase/migrations/0080_jwt_tenant_sync_enhancements.sql`

**The Trigger Definition:**

```sql:72:78:supabase/migrations/0080_jwt_tenant_sync_enhancements.sql
CREATE TRIGGER trg_ensure_jwt_tenant_context
  BEFORE INSERT OR UPDATE OF raw_user_meta_data
  ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_jwt_tenant_context_on_auth_user();
```

**What "BEFORE INSERT OR UPDATE" means:**
- PostgreSQL fires the trigger **before** the INSERT/UPDATE completes
- The trigger function can modify the `NEW` record
- Changes made to `NEW` are saved instead of the original values

**The Trigger Function:**

```sql:14:66:supabase/migrations/0080_jwt_tenant_sync_enhancements.sql
CREATE OR REPLACE FUNCTION ensure_jwt_tenant_context_on_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_user_metadata JSONB;
  v_org_user_id UUID;
BEGIN
  -- Only process if user_metadata doesn't have tenant_org_id
  -- or it's being updated
  IF NEW.raw_user_meta_data IS NULL 
     OR NOT (NEW.raw_user_meta_data ? 'tenant_org_id')
     OR (OLD.raw_user_meta_data IS NOT NULL 
         AND OLD.raw_user_meta_data->>'tenant_org_id' 
         IS DISTINCT FROM NEW.raw_user_meta_data->>'tenant_org_id') THEN
    
    -- Get the most recently accessed tenant for this user
    SELECT tenant_org_id, id
    INTO v_tenant_id, v_org_user_id
    FROM org_users_mst
    WHERE user_id = NEW.id
      AND is_active = true
    ORDER BY last_login_at DESC NULLS LAST, created_at DESC
    LIMIT 1;
    
    -- If user has a tenant, ensure it's in metadata
    IF v_tenant_id IS NOT NULL THEN
      -- Get current user_metadata or initialize empty object
      v_user_metadata := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
      
      -- Update tenant_org_id in metadata if missing or different
      IF NOT (v_user_metadata ? 'tenant_org_id') 
         OR v_user_metadata->>'tenant_org_id' 
         IS DISTINCT FROM v_tenant_id::text THEN
        v_user_metadata := jsonb_set(
          v_user_metadata,
          '{tenant_org_id}',
          to_jsonb(v_tenant_id::text),
          true -- Create if doesn't exist
        );
        v_user_metadata := jsonb_set(
          v_user_metadata,
          '{org_user_id}',
          to_jsonb(v_org_user_id::text),
          true
        );
        
        -- Update the user record
        NEW.raw_user_meta_data := v_user_metadata;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;  -- Return modified record
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**What happens in the trigger:**

1. **Checks if processing needed:**
   - If `raw_user_meta_data` is NULL
   - OR if `tenant_org_id` is missing
   - OR if `tenant_org_id` changed

2. **Queries `org_users_mst`:**
   ```sql
   SELECT tenant_org_id, id
   FROM org_users_mst
   WHERE user_id = NEW.id  -- NEW.id is the user ID from auth.users
     AND is_active = true
   ORDER BY last_login_at DESC NULLS LAST
   LIMIT 1;
   ```

3. **Modifies `NEW.raw_user_meta_data`:**
   - Adds `tenant_org_id` if missing
   - Adds `org_user_id` if missing
   - Uses `jsonb_set()` to update JSONB field

4. **Returns modified record:**
   - `RETURN NEW;` tells PostgreSQL to save the modified record

**Key Point:** The trigger runs **automatically** - no application code needed. PostgreSQL handles it.

---

### Step 5: Modified Record Saved

After the trigger completes, PostgreSQL saves the modified record:

```sql
-- What actually gets saved:
UPDATE auth.users
SET 
  raw_user_meta_data = '{
    "tenant_org_id": "abc-123-def",
    "org_user_id": "xyz-789-uvw"
  }'::jsonb,
  last_sign_in_at = NOW(),
  updated_at = NOW()
WHERE id = 'user-uuid';
```

**Key Point:** The `raw_user_meta_data` now contains tenant context, even though Supabase Auth didn't explicitly set it.

---

### Step 6: Supabase Auth Reads Record

After the database operation completes, Supabase Auth:

1. Reads the updated `auth.users` record
2. Includes `raw_user_meta_data` in the user object
3. Uses this data to generate the JWT token

**What Supabase Auth sees:**

```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "raw_user_meta_data": {
    "tenant_org_id": "abc-123-def",
    "org_user_id": "xyz-789-uvw"
  }
}
```

**Key Point:** Supabase Auth doesn't know the trigger modified the data - it just reads what's in the database.

---

### Step 7: JWT Generated

Supabase Auth generates a JWT token that includes `user_metadata`:

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "user_metadata": {
    "tenant_org_id": "abc-123-def",
    "org_user_id": "xyz-789-uvw"
  },
  "exp": 1234567890,
  "iat": 1234567890
}
```

**Key Point:** The JWT contains tenant context because the trigger added it to `user_metadata` before the JWT was generated.

---

### Step 8: Client Receives JWT

The client receives the JWT token with tenant context:

```typescript
// Client code receives:
{
  user: {
    id: "user-uuid",
    email: "user@example.com",
    user_metadata: {
      tenant_org_id: "abc-123-def",
      org_user_id: "xyz-789-uvw"
    }
  },
  session: {
    access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", // JWT
    refresh_token: "...",
    expires_at: 1234567890
  }
}
```

---

## Why This Works Automatically

### PostgreSQL Trigger Mechanism

PostgreSQL triggers are **database-level** mechanisms that run automatically when certain events occur:

1. **BEFORE triggers** run before the operation completes
2. **AFTER triggers** run after the operation completes
3. **INSTEAD OF triggers** replace the operation entirely

Our trigger is a **BEFORE trigger**, which means:
- It runs automatically when Supabase Auth performs INSERT/UPDATE
- It can modify the data before it's saved
- No application code needs to call it explicitly

### SECURITY DEFINER

The trigger function uses `SECURITY DEFINER`, which means:
- It runs with the privileges of the function creator (usually a superuser)
- It can access `org_users_mst` even if the current user doesn't have direct access
- This is necessary because Supabase Auth operations might run with limited privileges

### Trigger Timing

The trigger fires on:
- `BEFORE INSERT` - When a new user is created
- `BEFORE UPDATE OF raw_user_meta_data` - When user metadata is updated

This ensures tenant context is always present when:
- User logs in for the first time
- User metadata is updated
- Session is refreshed (which may update metadata)

---

## Example: First-Time Login

Let's trace through a first-time login:

```typescript
// 1. Client calls
await supabase.auth.signInWithPassword({ email, password })

// 2. Supabase Auth validates credentials
//    User exists, password correct

// 3. Supabase Auth performs:
UPDATE auth.users
SET last_sign_in_at = NOW()
WHERE email = 'user@example.com'

// 4. PostgreSQL trigger fires BEFORE UPDATE:
//    - Checks NEW.raw_user_meta_data
//    - Finds tenant_org_id is missing
//    - Queries org_users_mst:
SELECT tenant_org_id, id
FROM org_users_mst
WHERE user_id = NEW.id AND is_active = true
ORDER BY last_login_at DESC
LIMIT 1;
//    - Gets: tenant_org_id = 'abc-123'
//    - Modifies NEW.raw_user_meta_data:
NEW.raw_user_meta_data := jsonb_set(
  NEW.raw_user_meta_data,
  '{tenant_org_id}',
  '"abc-123"'
)
//    - Returns modified NEW

// 5. PostgreSQL saves:
UPDATE auth.users
SET 
  raw_user_meta_data = '{"tenant_org_id": "abc-123"}'::jsonb,
  last_sign_in_at = NOW()
WHERE email = 'user@example.com'

// 6. Supabase Auth reads record, sees tenant_org_id

// 7. JWT generated with tenant_org_id

// 8. Client receives JWT with tenant context
```

---

## Example: Subsequent Login

For subsequent logins, the flow is similar:

```typescript
// 1. Client calls
await supabase.auth.signInWithPassword({ email, password })

// 2. Supabase Auth validates credentials

// 3. Supabase Auth performs:
UPDATE auth.users
SET last_sign_in_at = NOW()
WHERE email = 'user@example.com'

// 4. PostgreSQL trigger fires:
//    - Checks NEW.raw_user_meta_data
//    - Finds tenant_org_id already exists: 'abc-123'
//    - Queries org_users_mst to verify it's still valid
//    - If tenant changed, updates it
//    - If same, leaves it as-is

// 5. Record saved with tenant context

// 6. JWT generated with tenant context

// 7. Client receives JWT
```

---

## Key Takeaways

1. **Automatic Execution**: The trigger runs automatically - no application code calls it
2. **Database-Level**: It's a PostgreSQL feature, not application code
3. **BEFORE Trigger**: Runs before data is saved, allowing modification
4. **Transparent**: Supabase Auth doesn't know the trigger modified the data
5. **Reliable**: Always runs when `auth.users` is modified
6. **Secure**: Uses `SECURITY DEFINER` to access tenant data

---

## Verification

You can verify the trigger is working by:

1. **Check trigger exists:**
   ```sql
   SELECT * FROM pg_trigger 
   WHERE tgname = 'trg_ensure_jwt_tenant_context';
   ```

2. **Check trigger function:**
   ```sql
   SELECT * FROM pg_proc 
   WHERE proname = 'ensure_jwt_tenant_context_on_auth_user';
   ```

3. **Test login and check metadata:**
   ```sql
   SELECT id, email, raw_user_meta_data
   FROM auth.users
   WHERE email = 'test@example.com';
   ```
   Should show `tenant_org_id` in `raw_user_meta_data`.

4. **Monitor trigger execution:**
   ```sql
   -- Enable logging (if needed)
   SET log_statement = 'all';
   -- Then check logs for trigger execution
   ```

---

## Related Files

- `supabase/migrations/0080_jwt_tenant_sync_enhancements.sql` - Trigger definition
- `web-admin/lib/auth/auth-context.tsx` - Client login code
- `docs/security/JWT_LIFECYCLE_EVENTS.md` - Complete JWT lifecycle documentation

---

## Summary

The trigger runs automatically because:

1. **PostgreSQL triggers** are database-level mechanisms that fire on INSERT/UPDATE
2. **Supabase Auth** performs standard SQL operations on `auth.users`
3. **Our trigger** is registered to fire BEFORE these operations
4. **PostgreSQL** automatically executes the trigger function
5. **The trigger** modifies the data before it's saved
6. **Supabase Auth** reads the modified data and includes it in the JWT

**No application code is needed** - PostgreSQL handles everything automatically!

