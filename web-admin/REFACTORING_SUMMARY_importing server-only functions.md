# Refactoring Summary: Client/Server Separation

## Overview

Successfully refactored role management pages to follow Next.js 13+ best practices by separating client and server code using API routes.

## Problem

Client components were directly importing server-only functions, causing build errors:
```
Error: You're importing a component that needs "server-only"
```

## Solution

Implemented proper client/server separation using API routes as the boundary between client components and server-side logic.

---

## Architecture Pattern

### Before (❌ Problematic)
```
Client Component
  └─> Server Service Functions
       └─> Redis/Server-Only Code (ERROR!)
```

### After (✅ Correct)
```
Client Component
  └─> API Client (lib/api/*)
       └─> API Routes (app/api/*)
            └─> Server Service Functions
                 └─> Redis/Server-Only Code ✓
```

---

## Files Created

### 1. Roles Management

**API Routes:**
- `app/api/roles/route.ts` - GET (list all roles), POST (create role)
- `app/api/roles/[id]/route.ts` - GET (role details), PATCH (update), DELETE

**Client Wrapper:**
- `lib/api/roles.ts` - Client-safe API wrapper with TypeScript types

**Updated Page:**
- `app/dashboard/settings/roles/page.tsx` - Now uses API client

### 2. Workflow Roles Management

**API Routes:**
- `app/api/workflow-roles/route.ts` - GET (user assignments), POST (assign role)
- `app/api/workflow-roles/[id]/route.ts` - DELETE (remove assignment)
- `app/api/workflow-roles/users/route.ts` - GET (all users with roles)

**Client Wrapper:**
- `lib/api/workflow-roles.ts` - Client-safe API wrapper with TypeScript types

**Updated Page:**
- `app/dashboard/settings/workflow-roles/page.tsx` - Now uses API client

### 3. Permission Services Separation

**Server-Only:**
- `lib/services/permission-service-server.ts` - Server-only functions with Redis cache

**Client-Safe:**
- `lib/services/permission-service-client.ts` - Client-safe permission checks

**Renamed:**
- `lib/services/permission-service.ts` → `lib/services/permission-service.ts.old`

---

## Benefits

### ✅ 1. Proper Separation of Concerns
- Client code only imports client-safe modules
- Server code properly marked with `'server-only'`
- No more import violations

### ✅ 2. RESTful API Architecture
- Clean, testable API endpoints
- Can be consumed by multiple clients (web, mobile, etc.)
- Easy to add authentication/rate limiting

### ✅ 3. Type Safety
- Full TypeScript support throughout
- Shared types between client and server
- IntelliSense support in IDE

### ✅ 4. Better Error Handling
- Centralized error handling in API routes
- Consistent error response format
- User-friendly error messages

### ✅ 5. Improved Security
- Server-side authentication verification
- Tenant isolation enforced at API level
- No exposure of server implementation details

---

## API Endpoints Reference

### Roles Management

```typescript
// Get all roles
GET /api/roles
Response: { success: true, data: Role[] }

// Create custom role
POST /api/roles
Body: { code, name, name2?, description? }
Response: { success: true, data: Role }

// Get role details
GET /api/roles/[id]
Response: { success: true, data: { permissions: string[] } }

// Update role
PATCH /api/roles/[id]
Body: { code?, name?, name2?, description? }
Response: { success: true, data: Role }

// Delete role
DELETE /api/roles/[id]
Response: { success: true, message: string }
```

### Workflow Roles Management

```typescript
// Get all users with workflow roles
GET /api/workflow-roles/users
Response: { success: true, data: UserWithWorkflowRoles[] }

// Get user's workflow role assignments
GET /api/workflow-roles?userId={userId}
Response: { success: true, data: WorkflowRoleAssignment[] }

// Assign workflow role
POST /api/workflow-roles
Body: { user_id, workflow_role }
Response: { success: true, data: WorkflowRoleAssignment }

// Remove workflow role
DELETE /api/workflow-roles/[id]
Response: { success: true, message: string }
```

---

## Usage Examples

### Client-Side Usage (React Components)

```typescript
import { getAllRoles, createCustomRole } from '@/lib/api/roles'

// In your component
const loadRoles = async () => {
  try {
    const roles = await getAllRoles()
    setRoles(roles)
  } catch (error) {
    console.error('Error loading roles:', error)
  }
}

const handleCreate = async () => {
  try {
    await createCustomRole({
      code: 'CUSTOM_ROLE',
      name: 'Custom Role',
      name2: 'دور مخصص',
      description: 'A custom role',
    })
    await loadRoles() // Refresh list
  } catch (error) {
    console.error('Error creating role:', error)
  }
}
```

### Server-Side Usage (API Routes)

```typescript
import { getAllRoles } from '@/lib/services/role-service'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  // Verify authentication
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use server service functions
  const roles = await getAllRoles()

  return NextResponse.json({ success: true, data: roles })
}
```

---

## Error Response Format

All API endpoints return consistent error responses:

```typescript
{
  success: false,
  error: "Error message here"
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (no tenant access)
- `500` - Internal Server Error

---

## Migration Checklist

When refactoring other pages, follow this pattern:

- [ ] Create API routes in `app/api/{feature}/`
- [ ] Create client wrapper in `lib/api/{feature}.ts`
- [ ] Update page to use API client instead of direct service imports
- [ ] Add proper error handling
- [ ] Test with authentication
- [ ] Test error scenarios

---

## Testing

### Manual Testing

1. **Start dev server:**
   ```bash
   cd web-admin
   npm run dev
   ```

2. **Test roles page:**
   - Navigate to `/dashboard/settings/roles`
   - Verify roles list loads
   - Test creating a custom role
   - Test editing a role
   - Test deleting a role

3. **Test workflow roles page:**
   - Navigate to `/dashboard/settings/workflow-roles`
   - Verify users list loads with their roles
   - Test assigning workflow roles
   - Test removing workflow roles

### API Testing (with curl)

```bash
# Get all roles (requires authentication cookie)
curl -X GET http://localhost:3000/api/roles \
  -H "Cookie: sb-access-token=..."

# Create role
curl -X POST http://localhost:3000/api/roles \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=..." \
  -d '{"code":"TEST","name":"Test Role"}'
```

---

## Future Improvements

1. **Add request validation** using Zod schemas
2. **Implement rate limiting** on API routes
3. **Add API versioning** (e.g., `/api/v1/roles`)
4. **Add request logging** for debugging
5. **Implement caching** for frequently accessed data
6. **Add batch operations** (e.g., assign multiple roles at once)
7. **Generate OpenAPI/Swagger** documentation

---

## Related Documentation

- Next.js App Router: https://nextjs.org/docs/app
- Route Handlers: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Server Components: https://nextjs.org/docs/app/building-your-application/rendering/server-components
- TypeScript: https://www.typescriptlang.org/docs/

---

**Date:** 2025-11-14
**Author:** CleanMateX Development Team
**Version:** 1.0
