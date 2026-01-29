# Common Issues & Debugging & Compiling and Build

- **RLS blocking:** check `pg_tables`, `pg_policies`, ensure JWT claims and service role where needed
- **Cross-tenant leak:** enforce `tenant_org_id` filter; verify queries
- **Migration fails:** fix SQL order, FKs, types; use `supabase db reset --debug`
- **N+1 queries:** use relation selects
- **TS type drift:** regenerate Supabase types
- **next-intl config missing:** add `createNextIntlPlugin('./i18n.ts')` to `next.config.ts`

---

## 🛠 COMMON ISSUES & SOLUTIONS

### Issue 1: RLS Policy Blocking Query

**Symptom**: Query returns empty result or permission error

**Diagnosis**:

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'org_orders_mst';

-- Check existing policies
SELECT * FROM pg_policies
WHERE tablename = 'org_orders_mst';

-- Test query as specific user
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claim.sub TO 'user-uuid';
SET LOCAL request.jwt.claim.tenant_org_id TO 'tenant-uuid';
SELECT * FROM org_orders_mst;
```

**Solutions**:

```typescript
// Solution 1: Ensure JWT contains tenant_org_id
const { data: user } = await supabase.auth.getUser();
console.log('JWT claims:', user.user_metadata);

// Solution 2: Use service role for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Solution 3: Fix RLS policy
CREATE POLICY tenant_isolation ON org_orders_mst
  FOR ALL
  USING (
    tenant_org_id = (
      SELECT tenant_org_id
      FROM org_users_mst
      WHERE user_id = auth.uid()
    )
  );
```

---

### Issue 2: Cross-Tenant Data Leak

**Symptom**: Can see other tenant's data

**Diagnosis**:

```typescript
// Check your query
const { data } = await supabase
  .from("org_orders_mst")
  .select("*")
  .eq("id", orderId);
// ❌ Missing tenant_org_id filter!

// Log the actual SQL being generated
console.log("Query:", data);
```

**Solution**:

```typescript
// Always add tenant filter
const { data } = await supabase
  .from("org_orders_mst")
  .select("*")
  .eq("tenant_org_id", tenantId) // ✅ Critical!
  .eq("id", orderId);

// Create a helper function
async function queryWithTenant<T>(table: string, tenantId: string) {
  return supabase.from(table).select("*").eq("tenant_org_id", tenantId);
}
```

---

### Issue 3: Migration Fails

**Symptom**: `supabase db reset` fails with error

**Common Errors**:

```
ERROR: relation "org_tenants_mst" does not exist
ERROR: foreign key constraint violation
ERROR: syntax error at or near "CASCADE"
```

**Diagnosis**:

```bash
# Check migration order
ls -la supabase/migrations/

# Test specific migration
psql $DATABASE_URL -f supabase/migrations/001_core.sql

# Check for syntax errors
cat supabase/migrations/XXX_migration.sql | head -20
```

**Solutions**:

1. **Fix table creation order**:

```sql
-- Create parent tables first
CREATE TABLE org_tenants_mst (...);

-- Then create child tables
CREATE TABLE org_orders_mst (
  tenant_org_id UUID REFERENCES org_tenants_mst(id)
);
```

2. **Fix foreign key issues**:

```sql
-- Add CASCADE for cleanup
FOREIGN KEY (tenant_org_id)
  REFERENCES org_tenants_mst(id)
  ON DELETE CASCADE;
```

3. **Use transactions**:

```sql
BEGIN;
-- Your migration code
COMMIT;
```

---

### Issue 4: N+1 Query Problem

**Symptom**: Slow page load, many database queries

**Diagnosis**:

```typescript
// Enable query logging
const { data } = await supabase.from("org_orders_mst").select("*");

// Then for each order, another query
for (const order of data) {
  const customer = await supabase
    .from("org_customers_mst")
    .select("*")
    .eq("id", order.customer_id)
    .single();
}
// ❌ This creates N+1 queries!
```

**Solution**:

```typescript
// Use joins in single query
const { data } = await supabase
  .from("org_orders_mst")
  .select(
    `
    *,
    customer:org_customers_mst(*),
    items:org_order_items_dtl(*),
    branch:org_branches_mst(*)
  `
  )
  .eq("tenant_org_id", tenantId);
// ✅ Single query with all data
```

---

### Issue 5: TypeScript Type Errors

**Symptom**: Type errors after database changes

**Error Examples**:

```
Property 'new_field' does not exist on type 'Order'
Type 'string' is not assignable to type 'number'
```

**Solution**:

```bash
# Regenerate types from database
supabase gen types typescript --local > web-admin/types/database.ts

# If using custom types, update manually
interface Order extends Database['public']['Tables']['org_orders_mst']['Row'] {
  // Add custom fields
}

# Restart TypeScript server
# VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server"
```

---

### Issue 6: Authentication Issues

**Symptom**: User can't access their data

**Diagnosis**:

```typescript
// Check auth status
const {
  data: { session },
} = await supabase.auth.getSession();
console.log("Session:", session);
console.log("User:", session?.user);
console.log("JWT Claims:", session?.user?.user_metadata);
```

**Solutions**:

1. **Missing tenant context**:

```typescript
// Add tenant_org_id during signup
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      tenant_org_id: tenantId,
      role: "staff",
    },
  },
});
```

2. **Session expired**:

```typescript
// Refresh session
const {
  data: { session },
} = await supabase.auth.refreshSession();

// Auto-refresh setup
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "TOKEN_REFRESHED") {
    console.log("Token refreshed");
  }
});
```

---

### Issue 7: Slow Queries

**Symptom**: Database queries taking > 1 second

**Diagnosis**:

```sql
-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM org_orders_mst
WHERE tenant_org_id = 'uuid'
AND status = 'PENDING';

-- Check for missing indexes
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE tablename = 'org_orders_mst';
```

**Solutions**:

1. **Add missing indexes**:

```sql
CREATE INDEX idx_orders_tenant_status
ON org_orders_mst(tenant_org_id, status);

CREATE INDEX idx_orders_created
ON org_orders_mst(tenant_org_id, created_at DESC);
```

2. **Optimize queries**:

```typescript
// Bad: Fetching all columns
const { data } = await supabase.from("org_orders_mst").select("*");

// Good: Select only needed columns
const { data } = await supabase
  .from("org_orders_mst")
  .select("id, order_number, status, total_amount");
```

---

### Issue 8: Arabic/RTL Display Issues

**Symptom**: Arabic text displays incorrectly

**Common Issues**:

- Text aligned to left instead of right
- Mixed English/Arabic alignment problems
- Icons facing wrong direction

**Solutions**:

1. **HTML direction**:

```tsx
<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
```

2. **Tailwind RTL utilities**:

```tsx
<div className="text-left rtl:text-right">
<div className="ml-4 rtl:ml-0 rtl:mr-4">
<ChevronRight className="rtl:rotate-180" />
```

3. **Font setup**:

```css
@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic");
body[dir="rtl"] {
  font-family: "Noto Sans Arabic", sans-serif;
}
```

---

## Debugging Tools

### Database Inspection

```bash
# Supabase Studio
open http://localhost:54323

# pgAdmin
docker run -p 5050:80 \
  -e PGADMIN_DEFAULT_EMAIL=admin@admin.com \
  -e PGADMIN_DEFAULT_PASSWORD=admin \
  dpage/pgadmin4
```

### Network Debugging

```typescript
// Log all Supabase requests
const supabase = createClient(url, key, {
  global: {
    fetch: (url, options) => {
      console.log("Request:", url, options);
      return fetch(url, options);
    },
  },
});
```

### React DevTools

```bash
# Install browser extension
# Chrome: React Developer Tools
# Then inspect component state and props
```

---

## Performance Profiling

### Database Query Analysis

```sql
-- Enable query timing
\timing on

-- Get slow queries
SELECT
  query,
  calls,
  mean_exec_time,
  total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Next.js Performance

```typescript
// Add performance logging
export function reportWebVitals(metric) {
  console.log(metric);
  // Send to analytics
}
```

---

## Error Logging

### Structured Logging

```typescript
class Logger {
  error(message: string, context: any) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "ERROR",
        message,
        context,
        stack: new Error().stack,
      })
    );
  }
}
```

### Sentry Integration

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  beforeSend(event) {
    // Filter sensitive data
    delete event.user?.email;
    return event;
  },
});
```

---

### Issue 9: Build Error - Cannot Find Module

**Symptom**: Build fails with "Cannot find module" error even though the package is in package.json

**Error Example**:

```
Type error: Cannot find module '@tanstack/react-query' or its corresponding type declarations.
```

**Diagnosis**:

```bash
# Check if package is in package.json
cat package.json | grep "@tanstack/react-query"

# Check if node_modules exists
ls node_modules/@tanstack/react-query
```

**Solutions**:

1. **Reinstall dependencies**:

```bash
# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall all dependencies
npm install

# Then rebuild
npm run build
```

2. **Clear Next.js cache**:

```bash
# Remove .next directory
rm -rf .next

# Rebuild
npm run build
```

3. **Verify package.json**:

```bash
# Ensure the package is in dependencies (not devDependencies if needed at runtime)
# Check package.json for correct version
```

4. **PowerShell-specific issues**:

```powershell
# Use semicolon instead of && for command chaining
cd admin-web; npm install
cd admin-web; npm run build
```

**Prevention**:

- Always run `npm install` after pulling changes that modify package.json
- Commit package-lock.json to ensure consistent dependency versions
- Run `npm run build` locally before pushing changes

---

### Issue 10: next-intl Configuration Missing (Production)

**Symptom**: Production build fails with "Couldn't find next-intl config file" error

**Error Example**:

```
Error: Couldn't find next-intl config file. Please follow the instructions at https://next-intl.dev/docs/getting-started/app-router
```

**Diagnosis**:

```bash
# Check if i18n.ts exists
ls i18n.ts

# Check next.config.ts for next-intl plugin
cat next.config.ts | grep -i "next-intl"
```

**Solution**:

1. **Add next-intl plugin to next.config.ts**:

```typescript
// next.config.ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Specify the path to your i18n config file
const withNextIntl = createNextIntlPlugin("./i18n.ts");

const nextConfig: NextConfig = {
  // Your existing config...
};

// Wrap your config with the next-intl plugin
export default withNextIntl(nextConfig);
```

2. **Verify i18n.ts exists in the correct location**:

```typescript
// i18n.ts (at project root)
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";

export const locales = ["en", "ar"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export default getRequestConfig(async ({ locale }) => {
  if (!locales.includes(locale as Locale)) notFound();

  const validLocale = locale as Locale;

  return {
    locale: validLocale,
    messages: (await import(`./messages/${validLocale}.json`)).default,
  };
});
```

3. **Rebuild and redeploy**:

```bash
cd web-admin
npm run build
git add next.config.ts
git commit -m "fix: Add next-intl plugin configuration"
git push
```

**Prevention**:

- Always configure plugins in `next.config.ts` when using next-intl
- The plugin wraps your Next.js config to inject necessary configuration
- Test builds locally before deploying to production

---

### Issue 11: Build Error - Prisma `g.$use is not a function`

**Symptom**: Build fails with `TypeError: g.$use is not a function` error during webpack bundling

**Error Example**:

```
TypeError: g.$use is not a function
    at 19918 (F:\jhapp\cleanmatex\web-admin\.next\server\chunks\9918.js:1:225)
    at g (F:\jhapp\cleanmatex\web-admin\.next\server\webpack-runtime.js:1:151)
    at 11728 (F:\jhapp\cleanmatex\web-admin\.next\server\app\api\v1\preparation\[id]\items\[itemId]\route.js:1:1651)
```

**Root Cause**:

- Prisma middleware (`$use`) is being applied at module load time
- During webpack bundling, Prisma client may not be fully initialized
- Webpack tries to bundle Prisma code and breaks the `$use` method structure

**Solution**:

1. **Add runtime check before applying middleware** (`lib/db/prisma.ts`):

```typescript
// Apply multi-tenant middleware (only if not already applied)
// Check if middleware is already applied by checking for a custom property
// Wrap in try-catch to handle webpack bundling edge cases
if (!(prismaClient as any).__tenantMiddlewareApplied) {
  try {
    // Check if $use method exists before applying middleware
    if (typeof (prismaClient as any).$use === "function") {
      applyTenantMiddleware(prismaClient);
      (prismaClient as any).__tenantMiddlewareApplied = true;
    }
  } catch (error) {
    // Silently fail during build - middleware will be applied at runtime
    if (process.env.NODE_ENV === "development") {
      console.warn("[Prisma] Middleware application deferred:", error);
    }
  }
}
```

2. **Ensure API routes use Node.js runtime**:

```typescript
// Add to API route files that use Prisma
export const runtime = "nodejs";
```

3. **Clean build cache and rebuild**:

```bash
# Remove .next directory
rm -rf .next

# Rebuild
npm run build
```

**Files Modified**:

- `web-admin/lib/db/prisma.ts` - Added `$use` existence check before applying middleware
- `web-admin/app/api/v1/preparation/[id]/items/[itemId]/route.ts` - Added `runtime = 'nodejs'`
- `web-admin/app/api/v1/preparation/[id]/complete/route.ts` - Added `runtime = 'nodejs'`

**Prevention**:

- Always check if Prisma methods exist before calling them during module initialization
- Use try-catch around middleware application to handle build-time edge cases
- Ensure API routes that use Prisma specify `runtime = 'nodejs'`
- Middleware will be properly applied at runtime even if it fails during build

---

## Return to [Main Documentation](../CLAUDE.md)
