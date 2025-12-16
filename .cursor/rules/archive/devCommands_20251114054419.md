# Dev Commands & Tooling Rules

## Overview
Essential commands for development workflow.

## Rules

### Supabase Local
- Start: `supabase start`
- Stop: `supabase stop`
- Status: `supabase status`
- Reset database: `supabase db reset`
- Push migrations: `supabase db push`
- Generate TypeScript types: `supabase gen types typescript --local > web-admin/types/database.ts`

### Prisma Commands
- Introspect database: `npx prisma db pull`
- Generate client: `npx prisma generate`
- Open Studio: `npx prisma studio`
- Format schema: `npx prisma format`
- Validate schema: `npx prisma validate`

### Web Admin
- Install dependencies: `npm install`
- Development server: `npm run dev`
- Build: `npm run build`
- Start production: `npm start`
- Lint: `npm run lint`
- Type check: `npm run type-check`
- Format: `npm run format`

### Docker Services
- Start all: `docker-compose up -d`
- Start specific: `docker-compose up -d redis minio`
- Stop all: `docker-compose down`
- View logs: `docker-compose logs -f`
- Restart service: `docker-compose restart redis`

### PowerShell Scripts (Windows)
- Start all services: `.\scripts\dev\start-services.ps1`
- Stop all services: `.\scripts\dev\stop-services.ps1`
- Check status: `.\scripts\dev\status-services.ps1`

### Database Migrations
- Create migration: `supabase migration new descriptive_name`
- Apply migrations: `supabase db reset`
- Push to remote: `supabase db push`

### Git Workflow
- Create feature branch: `git checkout -b feature/feature-name`
- Commit format: `type(scope): description`
- Types: feat, fix, docs, style, refactor, test, chore

### Testing
- Run tests: `npm test`
- Watch mode: `npm test:watch`
- Coverage: `npm test:coverage`
- E2E tests: `npm run test:e2e`

## Conventions
- Always use migrations for schema changes
- Always regenerate types after database changes
- Always test locally before committing
- Always use proper commit message format
