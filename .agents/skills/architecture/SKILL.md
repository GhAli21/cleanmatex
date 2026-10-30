---
name: architecture
description: System architecture, tech stack, and module boundaries for CleanMateX. Use when discussing system design, data access patterns, or how repo modules fit together.
user-invocable: true
effort: medium
agents:
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

## Performance engineering

Apply the [shared performance rules](../../../docs/dev/rules/performance-engineering.md) for changes affecting latency, throughput or resource use.

- Revalidate current contracts and prerequisites before implementing an older plan; trace the affected UI-to-provider path and its dependency graph without auditing unrelated modules.
- Keep policy ownership and module boundaries explicit. Separate loading verified facts from pure policy/math evaluation and reuse one business algorithm across preview and submit.
- Define complete cache identity, freshness, invalidation, failure behavior and owner before reuse across requests. Cached display data, token hints and retained queries are not current financial or permission authority.
- Preserve tenant isolation, shared auth/session checks, money invariants, idempotency and reviewed transaction/lock order when changing orchestration.
- Use proportional baseline, correctness and runtime evidence. Count transport calls separately from executed work; do not claim readiness or latency targets from visibility, static checks or an unmeasured design.

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
