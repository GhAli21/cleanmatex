# PostgreSQL & Prisma ORM Rules

## Overview
Rules for using PostgreSQL with Prisma ORM in CleanMateX.

## Rules

### Prisma Schema Structure
- Schema file: `prisma/schema.prisma`
- Migrations: `prisma/migrations/` (auto-generated)
- Seeds: `prisma/seeds/` for test data

### Schema Syntax
- Use models to represent database tables
- Field types: String, Int, Float, Boolean, DateTime, Json
- Use modifiers: `?` (optional), `[]` (array), `@default`, `@unique`
- Use `@map` for custom column names
- Use `@@map` for custom table names

### Relationships
- One-to-Many: Use array on one side, relation on many side
- One-to-One: Use optional relation with `@unique`
- Many-to-Many: Use implicit join table or explicit relation table

### Multi-Tenancy
- Include `tenantId` field in all tenant tables
- Use Prisma middleware to auto-inject tenant filter
- Set tenant context before queries
- Test tenant isolation

### Migrations
- Create migration: `npx prisma migrate dev --name migration_name`
- Deploy migrations: `npx prisma migrate deploy`
- Reset database: `npx prisma migrate reset` (development only)
- Use Supabase migrations primarily, sync Prisma schema with `npx prisma db pull`

### Prisma Client Usage
- Generate client: `npx prisma generate`
- Use transactions for multiple operations
- Use include for related data (avoid N+1)
- Use select to limit returned fields
- Use where for filtering
- Use orderBy for sorting
- Use take/skip for pagination

### Performance Optimization
- Use include instead of separate queries (avoid N+1)
- Select only needed fields
- Use appropriate indexes
- Use connection pooling
- Use cursor-based pagination for large datasets

### Common Patterns
- Soft delete: Use `deletedAt` field, filter in middleware
- Audit trail: Use `createdAt`, `updatedAt` with `@updatedAt`
- Use enums for status fields
- Use Decimal for money fields

### Essential Commands
- Initialize: `npx prisma init`
- Generate client: `npx prisma generate`
- Create migration: `npx prisma migrate dev --name name`
- Deploy migrations: `npx prisma migrate deploy`
- Open Studio: `npx prisma studio`
- Format schema: `npx prisma format`
- Validate schema: `npx prisma validate`
- Pull schema: `npx prisma db pull`

## Conventions
- Always use Prisma for server-side database access
- Always generate client after schema changes
- Always use migrations for schema changes
- Always test tenant isolation
- Always optimize queries to avoid N+1 problems
