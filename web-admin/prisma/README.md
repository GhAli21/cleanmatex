# Prisma Configuration for CleanMateX

## 🔧 Setup Instructions

### Step 1: Get Your Database Connection String

You need to get your database password from Supabase to complete the setup:

1. **Go to Supabase Dashboard:**
   - Visit: https://supabase.com/dashboard/project/ndjjycdgtponhosvztdg

2. **Navigate to Database Settings:**
   - Click on **Project Settings** (gear icon in sidebar)
   - Click on **Database** in the left menu

3. **Find Connection Pooling String:**
   - Scroll to **Connection Pooling** section
   - Mode: **Transaction**
   - Copy the connection string (it looks like):
   ```
   postgresql://postgres.ndjjycdgtponhosvztdg:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```

4. **Update `.env.local`:**
   - Replace `[YOUR-DB-PASSWORD]` in the `DATABASE_URL` with your actual password
   ```env
   DATABASE_URL="postgresql://postgres.ndjjycdgtponhosvztdg:your-actual-password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
   ```

### Step 2: Introspect Your Database

Once DATABASE_URL is configured, run:

```bash
npx prisma db pull
```

This will:
- Read your existing Supabase database schema
- Generate the `schema.prisma` file with all your tables
- Create TypeScript models for all `sys_*` and `org_*` tables

### Step 3: Generate Prisma Client

```bash
npx prisma generate
```

This creates the TypeScript client with full type safety.

## 📚 Common Commands

```bash
# Introspect database and update schema
npx prisma db pull

# Generate TypeScript client
npx prisma generate

# Open Prisma Studio (visual database browser)
npx prisma studio

# Format schema file
npx prisma format

# Validate schema
npx prisma validate
```

## ��️ Architecture

### Dual ORM Strategy

**Prisma (Server-side):**
- Used in: API routes, Server Actions, Server Components
- Purpose: Type-safe queries, complex joins, business logic
- Connection: Direct PostgreSQL via connection pooling

**Supabase Client (Client-side):**
- Used in: React Client Components
- Purpose: Authentication, Real-time, Storage, RLS enforcement
- Connection: Via Supabase PostgREST API

### Multi-Tenancy Enforcement

All queries on `org_*` tables automatically filter by `tenant_org_id` through middleware in `lib/prisma-middleware.ts`.

## 📁 Project Structure

```
web-admin/
├── prisma/
│   ├── schema.prisma          # Database schema (auto-generated)
│   └── README.md             # This file
├── lib/
│   ├── prisma.ts             # Prisma client singleton
│   └── prisma-middleware.ts  # Tenant filtering middleware
└── .env.local                # DATABASE_URL configuration
```

## 🔒 Security Notes

1. **Never commit `.env.local`** - Contains sensitive credentials
2. **Use connection pooling** - PgBouncer mode for serverless
3. **RLS policies still active** - Defense in depth
4. **Tenant middleware required** - Enforces `tenant_org_id` filtering

## 🐛 Troubleshooting

### Error: "Can't reach database server"
- Verify DATABASE_URL is correct
- Check if you replaced `[YOUR-DB-PASSWORD]`
- Ensure Supabase project is active

### Error: "Invalid connection string"
- Format: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?pgbouncer=true`
- Make sure no spaces in the connection string
- Verify port is 6543 (pooler) not 5432 (direct)

### Schema out of sync
```bash
npx prisma db pull    # Re-introspect from database
npx prisma generate   # Re-generate client
```

## 📖 Learn More

- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase + Prisma Guide](https://supabase.com/docs/guides/integrations/prisma)
- [Next.js + Prisma Best Practices](https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices)
