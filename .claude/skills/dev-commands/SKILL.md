---
name: dev-commands
description: Development commands for Supabase, Prisma, Next.js, Docker, and scripts. Use when you need to run development commands or understand tooling.
user-invocable: true
---

# Development Commands

## Quick Start

```powershell
# From project root - starts all services
.\scripts\dev\start-services.ps1
```

## Supabase Local

```bash
# Start Supabase local
supabase start

# Stop Supabase
supabase stop

# Database reset (ASK USER FIRST - NEVER DO AUTOMATICALLY)
# User will run: supabase db reset

# Generate TypeScript types
supabase gen types typescript --local > web-admin/types/database.ts

# Run migrations
supabase migration up

# Create new migration
supabase migration new migration_name

# Supabase Studio (UI)
open http://localhost:54323
```

**PostgreSQL Connection:**
- Host: localhost
- Port: 54322
- Database: postgres
- User: postgres

## Prisma

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database (dev only)
npx prisma db push

# Create migration from schema
npx prisma migrate dev --name migration_name

# Studio (Database UI)
npx prisma studio

# Format schema file
npx prisma format
```

## Next.js (Web Admin)

```bash
cd web-admin

# Development server
npm run dev

# Production build (ALWAYS run after changes)
npm run build

# Start production server
npm start

# Lint
npm run lint

# Type check
npx tsc --noEmit
```

## Docker

```bash
# Not used - Supabase provides PostgreSQL
# Only use Docker for future services
```

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/feature-name

# Commit changes
git add .
git commit -m "feat: description"

# Push to remote
git push -u origin feature/feature-name

# Create PR
gh pr create --title "Feature: Title" --body "Description"
```

## Testing

```bash
# Run tests (when available)
npm test

# Run specific test
npm test -- path/to/test.ts

# Coverage
npm test -- --coverage
```

## Environment

```bash
# Copy env example
cp .env.example .env.local

# Check environment
echo $NODE_ENV
```

## Troubleshooting Commands

```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Next.js cache
rm -rf .next

# Check PostgreSQL connection
psql -h localhost -p 54322 -U postgres -d postgres -c "\dt public.*"

# Check Supabase status
supabase status
```

## Service Management Scripts

```powershell
# Start all services
.\scripts\dev\start-services.ps1

# Check service status
.\scripts\dev\status-services.ps1

# Stop all services
.\scripts\dev\stop-services.ps1
```

## Additional Resources

- See [reference.md](./reference.md) for complete command reference and environment setup
