---
name: architecture
description: System architecture, tech stack, and module boundaries for CleanMateX. Use when discussing system design, data access patterns, or how repo modules fit together.
user-invocable: true
---

# CleanMateX System Architecture

## Current Stack

- database: Supabase PostgreSQL with RLS
- web admin: Next.js 16, React 19, TypeScript
- backend API: `cmx-api` with NestJS and Supabase
- mobile apps: planned/reserved area

## Module Boundaries

- `web-admin/` is the active admin frontend
- `cmx-api/` is the active NestJS backend module
- `supabase/` is the shared schema and migration authority
- `docs/plan/` is the approved planning authority

## Data Access Guidance

- client-side realtime/auth flows commonly use Supabase clients
- `web-admin` may use Prisma locally for selected server-side workflows
- `cmx-api` should be documented and reasoned about as NestJS plus Supabase, not Prisma-first
- tenant handling is mandatory, but implementation patterns can differ by module

## Use Higher Authorities When Needed

- `../../CLAUDE.md`
- `../../README.md`
- `../../web-admin/README.md`
- `../../cmx-api/README.md`
- `../../supabase/README.md`

## Additional Resource

- `reference.md`
