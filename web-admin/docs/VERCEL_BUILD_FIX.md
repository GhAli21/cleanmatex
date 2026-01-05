# Vercel Build Fix - Swagger Documentation

## Issue

Vercel deployment was failing with:

```
Error: ENOENT: no such file or directory, lstat '/vercel/path1/.next/export-detail.json'
```

## Root Cause

The `next-swagger-doc` package was trying to scan API route files during the build process, which caused issues on Vercel's build environment.

## Solution

### 1. Lazy Loading

Changed the Swagger spec generation to use lazy imports, preventing build-time file scanning:

```typescript
// Before: Direct import (executes at build time)
import { createSwaggerSpec } from "next-swagger-doc";

// After: Lazy import (executes at runtime only)
let createSwaggerSpec: any = null;
if (!createSwaggerSpec) {
  const swaggerDoc = await import("next-swagger-doc");
  createSwaggerSpec = swaggerDoc.createSwaggerSpec;
}
```

### 2. Error Handling

Added comprehensive error handling to return a minimal spec if file scanning fails:

```typescript
try {
  const spec = createSwaggerSpec({...});
  return spec;
} catch (error) {
  // Return minimal spec instead of failing
  return { openapi: '3.0.0', info: {...}, paths: {} };
}
```

### 3. Runtime Configuration

Marked the API docs route as dynamic to prevent static generation:

```typescript
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

### 4. Webpack Configuration

Excluded Swagger packages from client bundles in `next.config.ts`:

```typescript
config.externals.push("next-swagger-doc");
config.externals.push("swagger-jsdoc");
```

## Files Modified

1. `web-admin/lib/swagger/swagger.config.ts` - Added lazy loading and error handling
2. `web-admin/app/api/docs/route.ts` - Added runtime configuration
3. `web-admin/next.config.ts` - Added webpack externals for Swagger packages

## Testing

After deployment:

1. The build should complete successfully
2. Visit `/api-docs` to verify Swagger UI loads
3. Visit `/api/docs` to verify OpenAPI spec is generated

## Notes

- The Swagger documentation is now generated at runtime, not build time
- If file scanning fails, a minimal spec is returned (won't break the app)
- The API docs route is marked as dynamic, so it won't be pre-rendered
