# CleanMateX

Multi-tenant SaaS for laundry and dry-cleaning operations, with shared Supabase infrastructure, a web admin surface, a NestJS API, and planned mobile applications.

## Overview

CleanMateX is organized as a multi-module monorepo:

- `web-admin/`: Next.js 16 admin application
- `cmx-api/`: NestJS 10 client API
- `supabase/`: shared database, auth, RLS, migrations, and seed-related assets
- `docs/`: project, feature, planning, operational, and historical documentation
- `scripts/`: local development and maintenance scripts
- `cmx_mobile_apps/`: reserved area for Flutter mobile applications
- `packages/`: reserved area for shared packages
- `infra/`: local infrastructure bootstrap assets
- `qa/`: reserved area for QA assets and test documentation

## Quick Start

### 1. Install workspace dependencies

```bash
npm install
```

### 2. Start local infrastructure

Windows:

```powershell
.\scripts\dev\start-services.ps1
```

Root shortcut:

```bash
npm run services:start
```

### 3. Start the web admin

```bash
cd web-admin
npm run dev
```

Default URL: `http://localhost:3000`

### 4. Start the client API when needed

```bash
cd cmx-api
npm install
npm run start:dev
```

Default URL: `http://localhost:3004`

## Documentation Map

Start with these entrypoints:

- `docs/README.md`: main documentation index
- `docs/plan/master_plan_cc_01.md`: current high-level master plan reference
- `docs/features/`: feature-level docs, implementation notes, and PRD-aligned material
- `web-admin/README.md`: web admin module guide
- `cmx-api/README.md`: API module guide
- `supabase/README.md`: shared database and migration guide
- `CLAUDE.md`: project guardrails, AI workflow rules, and implementation requirements

## Current Stack

### Application stack

- Web admin: Next.js 16, React 19, TypeScript, Tailwind CSS, `next-intl`
- API: NestJS 10, TypeScript, Supabase client, Swagger/OpenAPI
- Shared data layer: PostgreSQL 16 via Supabase, RLS, tenant-aware patterns
- Local supporting services: Redis, MinIO, Supabase Studio, Inbucket

### Workspace tooling

- Node.js 20+
- npm workspaces
- Prisma is used inside `web-admin` for generated client workflows
- Supabase CLI is used from the repo-level `supabase/` directory

## Common Commands

From repo root:

```bash
npm run services:start
npm run services:stop
npm run test:smoke
npm run validate:env
```

From `web-admin/`:

```bash
npm run dev
npm run build
npm run test
npm run test:e2e
npm run check:i18n
```

From `cmx-api/`:

```bash
npm run start:dev
npm run build
npm run test
npm run test:e2e
```

## Project Guardrails

- Treat the codebase as multi-tenant by default. Tenant-scoped data must honor `tenant_org_id`.
- English/Arabic support and RTL awareness are mandatory for user-facing work.
- After frontend changes in `web-admin`, run `npm run build`.
- Use the shared Supabase setup in `supabase/` for schema and database workflow.
- Do not treat local reset scripts as a routine workflow. Use them only intentionally for controlled local development and never as the default recommendation in feature docs.

## Key Directories

```text
cleanmatex/
├── README.md
├── CLAUDE.md
├── docs/
├── web-admin/
├── cmx-api/
├── supabase/
├── scripts/
├── cmx_mobile_apps/
├── packages/
├── infra/
└── qa/
```

## Documentation Maintenance

When updating project docs:

- reconcile documentation with the already implemented reality
- update module docs and PRDs together when both exist
- clearly separate implemented, in-progress, deferred, and proposed scope
- capture unresolved decisions in a dated `current_urgent_decesion_YYYY_MM_DD.md` file before treating them as approved direction

## License

`UNLICENSED`
