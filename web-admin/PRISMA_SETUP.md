# Prisma Setup Guide for CleanMateX

## 🎯 Overview

This guide describes the **web-admin-local Prisma workflow**.

- Prisma here is used inside `web-admin`
- it is not the project-wide backend or schema authority
- the shared database workspace for the repo is `../supabase`

Use this guide only when you need Prisma specifically for `web-admin`.

---

## ✅ Installation Status

✅ Prisma CLI installed (`prisma@^6.17.1`)
✅ Prisma Client installed (`@prisma/client@^6.17.1`)
✅ Schema initialized (`prisma/schema.prisma`)
✅ Client singleton created (`lib/prisma.ts`)
Historical notes in this file may reference tenant middleware and older patterns that should be validated against the current codebase before reuse.
✅ Test script created (`scripts/test-prisma-connection.ts`)

---

## 🔧 Required: Get Your DATABASE_URL

### Option 1: Supabase Hosted (Production)

1. **Go to your Supabase Dashboard:**
   - URL: https://supabase.com/dashboard/project/ndjjycdgtponhosvztdg

2. **Navigate to Database Settings:**
   - Click **⚙️ Project Settings** (left sidebar)
   - Click **Database** in the submenu

3. **Copy Connection Pooling String:**
   - Scroll to **Connection Pooling** section
   - **Mode:** Transaction (recommended for Prisma)
   - Copy the connection string

4. **Update `.env.local`:**
   ```env
   DATABASE_URL="postgresql://postgres.ndjjycdgtponhosvztdg:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
   ```
   Replace `[YOUR-PASSWORD]` with your actual database password.

### Option 2: Local Supabase (Development)

If running Supabase locally:

```bash
# Start Supabase
supabase start

# Get connection string
supabase status
```

Update `.env.local`:
```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
```

---

## 📥 Step 1: Introspect Your Database

Once `DATABASE_URL` is configured, run:

```bash
cd web-admin
npx prisma db pull
```

**What this does:**
- Connects to your Supabase database
- Reads all existing tables from migrations
- Generates `prisma/schema.prisma` with Prisma models
- Maps your `sys_*` and `org_*` tables to TypeScript types

**Expected output:**
```
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "postgres"

Introspecting based on datasource defined in prisma/schema.prisma …

✔ Introspected 25 models and wrote them into prisma/schema.prisma in 2.5s
```

---

## 🔨 Step 2: Generate Prisma Client

```bash
npx prisma generate
```

**What this does:**
- Generates TypeScript types from your schema
- Creates the Prisma Client in `node_modules/@prisma/client`
- Enables full IntelliSense and type safety

**Expected output:**
```
✔ Generated Prisma Client (v6.17.1) to ./node_modules/@prisma/client
```

---

## 🧪 Step 3: Test Connection

```bash
npx tsx scripts/test-prisma-connection.ts
```

**Expected output:**
```
🔍 Testing Prisma connection to Supabase...

✅ Test 1: Basic connection
   Connected successfully!

✅ Test 2: Query global sys_* tables
   Found sys_order_type_cd records: 5

✅ Test 3: Query org_* tables
   Sample tenants: [...]

✅ Test 4: Verify key tables exist
   Sample tables: [...]

✨ All tests passed! Prisma is configured correctly.
```

---

## 🚀 Step 4: Start Using Prisma

### Basic Query Example

Create a new file: `app/api/orders/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Query orders with automatic tenant filtering
    const orders = await prisma.org_orders_mst.findMany({
      take: 10,
      orderBy: { created_at: 'desc' },
      include: {
        customer: true, // Join with customer
      },
    })

    return NextResponse.json({ orders })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}
```

### Historical Tenant Middleware Note

The example below reflects an older documented pattern and should not be treated as universal project guidance.

```typescript
import { prisma } from './prisma'
import { applyTenantMiddleware, getTenantIdFromSession } from './prisma-middleware'

// Apply tenant filtering middleware
applyTenantMiddleware(prisma, getTenantIdFromSession)

export { prisma }
```

Do not assume this alone is the canonical tenant-isolation strategy for the whole project.

---

## 🔄 Typical Workflow

### When you change database schema:

```bash
# 1. Create Supabase migration
# supabase/migrations/0005_new_feature.sql

# 2. Apply the required shared schema changes using the currently approved workflow

# 3. Sync Prisma schema
cd web-admin
npx prisma db pull
npx prisma generate

# 4. Use new types in your code!
```

---

## 🐛 Troubleshooting

### Error: "Can't reach database server"

**Cause:** DATABASE_URL not configured or incorrect

**Fix:**
1. Check `.env.local` exists and has `DATABASE_URL`
2. Verify you replaced `[YOUR-PASSWORD]`
3. Test connection: `psql $DATABASE_URL -c "SELECT 1"`

### Error: "Authentication failed"

**Cause:** Wrong password

**Fix:**
1. Get password from Supabase Dashboard > Settings > Database
2. For local: default is `postgres:postgres`

### Error: "Schema is out of sync"

**Cause:** Database changed but Prisma schema not updated

**Fix:**
```bash
npx prisma db pull     # Re-introspect
npx prisma generate    # Re-generate client
```

### Warning: "More than X instances of Prisma Client"

**Cause:** Next.js hot reload creating multiple clients

**Fix:** Already handled in `lib/prisma.ts` singleton pattern. Restart dev server.

---

## 📁 File Structure

```
web-admin/
├── prisma/
│   ├── schema.prisma          # Auto-generated from DB ✅
│   └── README.md              # Prisma-specific docs
├── lib/
│   ├── prisma.ts              # Client singleton
│   ├── prisma-middleware.ts   # Historical/local pattern if present
│   └── supabase.ts            # Supabase client (existing)
├── scripts/
│   └── test-prisma-connection.ts  # Connection test ✅
├── .env.local                 # DATABASE_URL (you need to add)
└── .gitignore                 # Ignore .env*, prisma/migrations
```

---

## 🔒 Security Checklist

- [ ] DATABASE_URL not committed to git (in `.gitignore`)
- [ ] Using connection pooling (`?pgbouncer=true`)
- [ ] Tenant handling verified against the current project rules and implementation
- [ ] RLS policies still active (defense in depth)
- [ ] Service role key only used server-side

---

## 📚 Learn More

- [Prisma Docs](https://www.prisma.io/docs)
- [Supabase + Prisma](https://supabase.com/docs/guides/integrations/prisma)
- [Next.js Best Practices](https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices)
- [CleanMateX Architecture](.claude/docs/architecture.md)

---

## 🎉 Next Steps

Once setup is complete:

1. ✅ DATABASE_URL configured in `.env.local`
2. ✅ Run `npx prisma db pull`
3. ✅ Run `npx prisma generate`
4. ✅ Run test script
5. ✅ Verify current tenant-handling approach before extending local Prisma usage
6. ✅ Use Prisma only where it fits the current `web-admin` implementation

**Need help?** Check `prisma/README.md`, `../README.md`, or `../CLAUDE.md`

## Documentation Note

If this guide conflicts with `CLAUDE.md`, `README.md`, `supabase/README.md`, or current module code, update this guide before treating it as authoritative.
