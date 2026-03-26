---
name: dev-commands
description: Development commands for Supabase, Next.js, NestJS, Prisma, and project scripts. Use when you need to run or recommend commands.
user-invocable: true
---

# Development Commands

## Quick Start

```powershell
.\scripts\dev\start-services.ps1
```

## Web Admin

```bash
cd web-admin
npm run dev
npm run build
npm run lint
npm run typecheck
```

## Prisma In web-admin

```bash
cd web-admin
npm run prisma:pull
npm run prisma:generate
npm run prisma:studio
```

## cmx-api

```bash
cd cmx-api
npm run start:dev
npm run build
npm run lint
npm run test
```

## Supabase

```bash
supabase start
supabase stop
supabase status
supabase migration new descriptive_name
```

## Guardrails

- ask before any reset workflow
- do not push Prisma migrations as the primary schema path
- prefer commands that match current package scripts and module READMEs
