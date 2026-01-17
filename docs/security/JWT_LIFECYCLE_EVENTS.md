# JWT Lifecycle Events - Complete Guide

This document explains how JWTs are managed throughout their lifecycle in CleanMateX, including tenant context synchronization, validation, repair, and refresh mechanisms.

## Table of Contents

1. [JWT Structure](#jwt-structure)
2. [Lifecycle Events Overview](#lifecycle-events-overview)
3. [Event 1: User Login](#event-1-user-login)
4. [Event 2: Tenant Switching](#event-2-tenant-switching)
5. [Event 3: Session Refresh](#event-3-session-refresh)
6. [Event 4: API Request Validation](#event-4-api-request-validation)
7. [Event 5: Auto-Repair](#event-5-auto-repair)
8. [Database Trigger Mechanism](#database-trigger-mechanism)
9. [Flow Diagrams](#flow-diagrams)

---

## JWT Structure

Every JWT token contains tenant context in the `user_metadata` field:

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "user_metadata": {
    "tenant_org_id": "tenant-uuid",
    "org_user_id": "org-user-record-uuid"
  },
  "exp": 1234567890,
  "iat": 1234567890
}
```

**Key Fields:**

- `tenant_org_id`: Current active tenant ID
- `org_user_id`: Reference to `org_users_mst` record
- These fields are automatically synced by database triggers

---

## Lifecycle Events Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    JWT Lifecycle Events                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. LOGIN          → JWT Created with tenant context          │
│  2. TENANT SWITCH  → JWT Updated with new tenant            │
│  3. REFRESH        → JWT Renewed (keeps tenant context)      │
│  4. API REQUEST    → JWT Validated (auto-repair if needed)  │
│  5. AUTO-REPAIR    → JWT Fixed if tenant context missing    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Event 1: User Login

**Location:** `web-admin/lib/auth/auth-context.tsx` (lines 220-265)

### Flow Diagram

```
┌──────────────┐
│ User Login   │
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────┐
│ 1. signInWithPassword()              │
│    - Email + Password                │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ 2. Database Trigger Fires            │
│    (ensure_jwt_tenant_context)      │
│    - Checks org_users_mst            │
│    - Gets most recent tenant         │
│    - Adds tenant_org_id to metadata │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ 3. JWT Issued                       │
│    - Contains tenant_org_id          │
│    - Contains org_user_id            │
│    - Valid for 1 hour                │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ 4. Client Receives JWT              │
│    - Stored in localStorage         │
│    - Used for all API requests      │
└─────────────────────────────────────┘
```

### Code Example

```typescript:220:265:web-admin/lib/auth/auth-context.tsx
// User logs in
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
})

// Database trigger automatically fires:
// - Checks org_users_mst for user's active tenant
// - Adds tenant_org_id to user_metadata if missing
// - JWT is issued with tenant context included

// Client receives JWT with tenant context
setSession({
  user: data.user as AuthUser,
  access_token: data.session.access_token,  // JWT token
  refresh_token: data.session.refresh_token,
  expires_at: data.session.expires_at,
})

// JWT now contains:
// {
//   user_metadata: {
//     tenant_org_id: "uuid-of-tenant",
//     org_user_id: "uuid-of-org-user"
//   }
// }
```

### What Happens Behind the Scenes

1. **Supabase Auth** validates credentials
2. **Database Trigger** (`trg_ensure_jwt_tenant_context`) fires automatically:

   ```sql
   -- Trigger function runs BEFORE INSERT on auth.users
   -- Queries org_users_mst for user's most recent tenant
   SELECT tenant_org_id, id
   FROM org_users_mst
   WHERE user_id = NEW.id
     AND is_active = true
   ORDER BY last_login_at DESC NULLS LAST
   LIMIT 1;

   -- Adds to user_metadata if missing
   NEW.raw_user_meta_data := jsonb_set(
     NEW.raw_user_meta_data,
     '{tenant_org_id}',
     to_jsonb(v_tenant_id::text)
   );
   ```

3. **JWT is issued** with tenant context in `user_metadata`
4. **Client stores** JWT in localStorage/sessionStorage

---

## Event 2: Tenant Switching

**Location:** `web-admin/lib/auth/auth-context.tsx` (lines 444-519)

### Flow Diagram

```
┌─────────────────┐
│ User Clicks     │
│ "Switch Tenant" │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 1. Validate Access                  │
│    switch_tenant_context() RPC       │
│    - Checks org_users_mst            │
│    - Updates last_login_at          │
│    - Logs audit event                │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ 2. Update user_metadata              │
│    supabase.auth.updateUser()       │
│    - Sets new tenant_org_id          │
│    - BEFORE refresh (important!)    │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ 3. Refresh Session                   │
│    supabase.auth.refreshSession()    │
│    - Gets new JWT                    │
│    - Contains new tenant_org_id       │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ 4. Verify JWT                        │
│    - Checks tenant_org_id matches    │
│    - Retries if mismatch             │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ 5. Reload Page                       │
│    window.location.reload()          │
│    - Ensures all queries use         │
│      new tenant context              │
└─────────────────────────────────────┘
```

### Code Example

```typescript:444:519:web-admin/lib/auth/auth-context.tsx
const switchTenant = async (tenantId: string) => {
  // Step 1: Validate user has access to tenant
  const { data, error } = await supabase.rpc('switch_tenant_context', {
    p_tenant_id: tenantId,
  })

  // Database function:
  // - Checks org_users_mst for access
  // - Updates last_login_at
  // - Logs audit event

  // Step 2: Update user_metadata BEFORE refresh
  // This is critical - must update metadata first!
  const { error: updateError } = await supabase.auth.updateUser({
    data: {
      tenant_org_id: tenantId,  // New tenant ID
    },
  })

  // Step 3: Refresh session to get new JWT
  const { data: refreshData, error: refreshError } =
    await supabase.auth.refreshSession()

  // New JWT now contains:
  // {
  //   user_metadata: {
  //     tenant_org_id: "new-tenant-uuid"  // Updated!
  //   }
  // }

  // Step 4: Verify JWT contains correct tenant
  if (refreshData.session?.user.user_metadata?.tenant_org_id !== tenantId) {
    // Retry logic...
  }

  // Step 5: Reload page to ensure all queries use new tenant
  window.location.reload()
}
```

### Database Function: `switch_tenant_context`

```sql:285:357:supabase/migrations/0004_auth_rls.sql
CREATE OR REPLACE FUNCTION switch_tenant_context(p_tenant_id UUID)
RETURNS TABLE (...) AS $$
DECLARE
  v_has_access BOOLEAN;
BEGIN
  -- Check if user has access to this tenant
  SELECT EXISTS (
    SELECT 1
    FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = p_tenant_id
      AND is_active = true
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    -- Return error
    RETURN;
  END IF;

  -- Update last login timestamp
  UPDATE org_users_mst
  SET
    last_login_at = NOW(),
    login_count = COALESCE(login_count, 0) + 1,
    updated_at = NOW()
  WHERE user_id = auth.uid()
    AND tenant_org_id = p_tenant_id;

  -- Log audit event
  PERFORM log_audit_event(...);

  -- Return tenant info
  RETURN QUERY SELECT ...;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Important Notes

1. **Update metadata BEFORE refresh**: Must call `updateUser()` before `refreshSession()` so the new JWT contains the updated tenant
2. **Verification**: Always verify the JWT contains the correct tenant after refresh
3. **Page reload**: Reloads the page to ensure all React queries use the new tenant context

---

## Event 3: Session Refresh

**When:** JWT expires (typically after 1 hour) or manually triggered

### Flow Diagram

```
┌─────────────────┐
│ JWT Expires     │
│ or Manual       │
│ Refresh         │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 1. Client Calls refreshSession()    │
│    - Uses refresh_token              │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ 2. Supabase Reads auth.users        │
│    - Gets user_metadata              │
│    - Database trigger ensures         │
│      tenant_org_id is present        │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ 3. New JWT Issued                   │
│    - Contains same tenant_org_id    │
│    - New expiration time             │
│    - Same user_metadata              │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ 4. Client Updates Session           │
│    - Stores new access_token         │
│    - Continues using tenant context  │
└─────────────────────────────────────┘
```

### Code Example

```typescript
// Automatic refresh (handled by Supabase client)
// OR manual refresh:
const { data, error } = await supabase.auth.refreshSession();

// Database trigger ensures tenant_org_id is in user_metadata
// New JWT contains:
// {
//   user_metadata: {
//     tenant_org_id: "same-tenant-uuid",  // Preserved!
//     org_user_id: "same-org-user-uuid"
//   },
//   exp: new_expiration_time
// }
```

### Automatic Refresh

Supabase client automatically refreshes JWTs when they expire:

- Uses `refresh_token` to get new `access_token`
- Database trigger ensures tenant context is preserved
- No action needed from application code

---

## Event 4: API Request Validation

**Location:** `web-admin/lib/middleware/jwt-tenant-validator.ts` (lines 30-158)

### Flow Diagram

```
┌─────────────────┐
│ API Request     │
│ Arrives         │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 1. Extract JWT                      │
│    supabase.auth.getUser()          │
│    - Gets user from JWT              │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ 2. Validate Tenant Context          │
│    validateJWTTenantContext()        │
│    - Checks user_metadata           │
│    - Verifies tenant exists          │
│    - Checks user has access          │
└──────┬──────────────────────────────┘
       │
       ├─── Valid ────► Continue
       │
       └─── Invalid ────► Event 5: Auto-Repair
```

### Code Example

```typescript:30:158:web-admin/lib/middleware/jwt-tenant-validator.ts
export async function validateJWTWithTenant(request: NextRequest) {
  // Step 1: Extract user from JWT
  const { data: { user }, error: authError } =
    await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 2: Validate tenant context
  const validation = await validateJWTTenantContext(user);

  // Log health event
  await logJWTHealthEvent({
    userId: user.id,
    eventType: 'validation',
    tenantId: validation.tenantId || undefined,
    hadTenantContext: validation.isValid,
  });

  if (!validation.isValid) {
    // Missing tenant context - attempt repair (Event 5)
    if (validation.needsRepair && validation.tenantId) {
      // ... repair logic ...
    }

    // Reject request if repair fails
    return NextResponse.json({
      error: validation.error || 'Invalid tenant context',
      code: 'TENANT_CONTEXT_MISSING',
    }, { status: 403 });
  }

  // JWT is valid with tenant context
  return {
    user,
    tenantId: validation.tenantId!,
    userId: user.id,
    isValid: true,
  };
}
```

### Validation Logic

```typescript
// From jwt-tenant-manager.ts
async function validateJWTTenantContext(user: any) {
  // Check if tenant_org_id exists in user_metadata
  const tenantId = user.user_metadata?.tenant_org_id;

  if (!tenantId) {
    // Missing - try to get from database
    const activeTenant = await getUserActiveTenant(user.id);

    return {
      isValid: false,
      tenantId: activeTenant,
      needsRepair: !!activeTenant, // Can repair if tenant found
      error: "JWT missing tenant context",
    };
  }

  // Validate user has access to this tenant
  const { data } = await supabase
    .from("org_users_mst")
    .select("tenant_org_id, is_active")
    .eq("user_id", user.id)
    .eq("tenant_org_id", tenantId)
    .eq("is_active", true)
    .single();

  if (!data) {
    // Invalid tenant - user doesn't have access
    return {
      isValid: false,
      tenantId: null,
      needsRepair: false,
      error: "User does not have access to tenant in JWT",
    };
  }

  return {
    isValid: true,
    tenantId,
    needsRepair: false,
  };
}
```

---

## Event 5: Auto-Repair

**Location:** `web-admin/lib/middleware/jwt-tenant-validator.ts` (lines 60-120)

### Flow Diagram

```
┌─────────────────────────────────────┐
│ JWT Missing Tenant Context           │
│ (from Event 4)                       │
└────────┬─────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 1. Get Tenant from Database         │
│    getUserActiveTenant()             │
│    - Queries org_users_mst           │
│    - Gets most recent tenant         │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ 2. Update user_metadata             │
│    repairJWTTenantContext()          │
│    - Updates auth.users               │
│    - Sets tenant_org_id               │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ 3. Refresh Session                   │
│    supabase.auth.refreshSession()    │
│    - Gets new JWT                    │
│    - Contains tenant context         │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ 4. Re-validate                      │
│    validateJWTTenantContext()       │
│    - Confirms tenant present         │
└──────┬──────────────────────────────┘
       │
       ├─── Success ────► Continue Request
       │
       └─── Failure ────► Reject Request (403)
```

### Code Example

```typescript:60:120:web-admin/lib/middleware/jwt-tenant-validator.ts
if (!validation.isValid) {
  // If repair is possible, attempt it
  if (validation.needsRepair && validation.tenantId) {
    logger.info('Repairing JWT tenant context', {
      userId: user.id,
      tenantId: validation.tenantId,
    });

    // Step 1: Repair JWT by updating user_metadata
    const repairResult = await repairJWTTenantContext(
      user.id,
      validation.tenantId
    );

    // Log repair event
    await logJWTHealthEvent({
      userId: user.id,
      eventType: 'repair',
      tenantId: validation.tenantId,
      hadTenantContext: false,
      repairAttempted: true,
      repairSuccessful: repairResult.success,
      errorMessage: repairResult.error,
    });

    if (repairResult.success) {
      // Step 2: Refresh session to get new JWT
      const { error: refreshError } =
        await supabase.auth.refreshSession();

      if (!refreshError) {
        // Step 3: Re-validate after repair
        const { data: { user: refreshedUser } } =
          await supabase.auth.getUser();

        if (refreshedUser) {
          const revalidation =
            await validateJWTTenantContext(refreshedUser);

          if (revalidation.isValid && revalidation.tenantId) {
            // Success! Return validated context
            return {
              user: refreshedUser,
              tenantId: revalidation.tenantId,
              userId: refreshedUser.id,
              isValid: true,
            };
          }
        }
      }
    }
  }

  // If repair failed, reject request
  return NextResponse.json({
    error: validation.error || 'Invalid tenant context',
    code: 'TENANT_CONTEXT_MISSING',
  }, { status: 403 });
}
```

### Repair Function

```typescript
// From jwt-tenant-manager.ts
export async function repairJWTTenantContext(
  userId: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  // Verify we're updating the current user's metadata
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== userId) {
    return { success: false, error: "User mismatch" };
  }

  // Update user metadata with tenant context
  const { error: updateError } = await supabase.auth.updateUser({
    data: {
      tenant_org_id: tenantId,
    },
  });

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return { success: true };
}
```

---

## Database Trigger Mechanism

**Location:** `supabase/migrations/0080_jwt_tenant_sync_enhancements.sql` (lines 13-78)

### How It Works

```sql:13:78:supabase/migrations/0080_jwt_tenant_sync_enhancements.sql
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger fires BEFORE INSERT OR UPDATE on auth.users
CREATE TRIGGER trg_ensure_jwt_tenant_context
  BEFORE INSERT OR UPDATE OF raw_user_meta_data
  ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_jwt_tenant_context_on_auth_user();
```

### When Trigger Fires

1. **User Login**: `INSERT` on `auth.users` → Trigger adds tenant context
2. **User Update**: `UPDATE` on `auth.users.raw_user_meta_data` → Trigger ensures tenant context
3. **Session Refresh**: Supabase reads `auth.users` → Trigger ensures tenant context is present

### Benefits

- **Automatic**: No application code needed
- **Reliable**: Always runs before JWT is issued
- **Consistent**: Ensures all JWTs have tenant context
- **Fallback**: Gets tenant from `org_users_mst` if missing

---

## Flow Diagrams

### Complete JWT Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    JWT Lifecycle Flow                        │
└─────────────────────────────────────────────────────────────┘

    ┌──────────┐
    │  LOGIN   │
    └────┬─────┘
         │
         ▼
    ┌─────────────────┐
    │ Database        │
    │ Trigger         │──┐
    │ Adds tenant     │  │
    └────┬────────────┘  │
         │               │
         ▼               │
    ┌──────────────┐     │
    │ JWT Issued   │     │
    │ with tenant  │     │
    └────┬─────────┘     │
         │               │
         │               │
    ┌────▼───────────────┴──┐
    │  API Request          │
    │  (with JWT)           │
    └────┬──────────────────┘
         │
         ▼
    ┌─────────────────┐
    │ Validate JWT    │
    │ tenant context  │
    └────┬────────────┘
         │
         ├─── Valid ────► Process Request
         │
         └─── Invalid ────┐
                           │
                           ▼
                    ┌──────────────┐
                    │ Auto-Repair  │
                    │ - Get tenant │
                    │ - Update JWT  │
                    │ - Refresh    │
                    └──────┬───────┘
                           │
                           ├─── Success ────► Process Request
                           │
                           └─── Failure ────► Reject (403)
```

### Tenant Switch Flow

```
┌─────────────────────────────────────────────────────────────┐
│              Tenant Switch Flow                              │
└─────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │ User Clicks  │
    │ Switch       │
    └──────┬───────┘
           │
           ▼
    ┌──────────────────┐
    │ Validate Access  │
    │ (RPC Function)   │
    └──────┬───────────┘
           │
           ├─── No Access ────► Error
           │
           └─── Has Access ────┐
                               │
                               ▼
                        ┌──────────────┐
                        │ Update       │
                        │ user_metadata│
                        │ (new tenant) │
                        └──────┬───────┘
                               │
                               ▼
                        ┌──────────────┐
                        │ Refresh       │
                        │ Session       │
                        │ (get new JWT) │
                        └──────┬───────┘
                               │
                               ▼
                        ┌──────────────┐
                        │ Verify JWT    │
                        │ (has tenant)  │
                        └──────┬───────┘
                               │
                               ├─── Match ────► Reload Page
                               │
                               └─── Mismatch ────► Retry
```

---

## Summary

### Key Points

1. **Database Trigger**: Automatically ensures tenant context is in `user_metadata` before JWT is issued
2. **Validation**: Every API request validates JWT has tenant context
3. **Auto-Repair**: Missing tenant context is automatically repaired from database
4. **Tenant Switch**: Explicitly updates `user_metadata` before refreshing session
5. **Session Refresh**: Preserves tenant context when JWT expires

### Best Practices

- ✅ Always validate JWT tenant context in API routes
- ✅ Update `user_metadata` BEFORE refreshing session when switching tenants
- ✅ Verify JWT contains correct tenant after refresh
- ✅ Use `requireTenantAuth()` middleware for standardized protection
- ✅ Monitor JWT health metrics to detect issues early

### Monitoring

All JWT lifecycle events are logged to `sys_jwt_tenant_health_log`:

- Validation events
- Repair attempts
- Session refreshes
- Tenant switches

Query metrics:

```sql
SELECT * FROM get_jwt_health_metrics(
  p_start_time := NOW() - INTERVAL '24 hours',
  p_end_time := NOW()
);
```

---

**Related Files:**

- `web-admin/lib/auth/jwt-tenant-manager.ts` - Core JWT management functions
- `web-admin/lib/middleware/jwt-tenant-validator.ts` - API request validation
- `web-admin/lib/auth/auth-context.tsx` - Client-side auth context
- `supabase/migrations/0080_jwt_tenant_sync_enhancements.sql` - Database trigger
- `supabase/migrations/0004_auth_rls.sql` - Tenant switch function
