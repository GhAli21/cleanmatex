# Prisma Quick Start Guide

## Scope Note

This guide is for Prisma usage inside `web-admin` only.

- it is not the project-wide database authority
- Supabase SQL migrations under `../supabase/` remain the schema source of truth
- Prisma here is a module-local access and type-generation workflow

## Safe Current Commands

Run from `web-admin/`:

```bash
npm run prisma:pull
npm run prisma:generate
npm run prisma:studio
```

You can also use:

```bash
npx prisma db pull
npx prisma generate
npx prisma studio
```

## Database Change Workflow

1. Create or update the SQL migration in `../supabase/migrations/`.
2. Apply it using the approved local database workflow.
3. Re-sync Prisma in `web-admin/`:

```bash
npm run prisma:pull
npm run prisma:generate
```

## Current Guardrails

- do not use this file as approval to run destructive reset commands
- do not treat old Docker-based Prisma commands as required
- do not assume one universal tenant-middleware pattern for every module
- validate runtime behavior against `README.md`, `prisma/README.md`, and current code

## Basic Usage

```ts
import { prisma } from '@/lib/prisma'
```

Use Prisma only in server-side code paths inside `web-admin`.

## Related Documentation

- `PRISMA_SETUP.md`
- `prisma/README.md`
- `lib/db/PRISMA_SETUP.md`
- `README.md`
