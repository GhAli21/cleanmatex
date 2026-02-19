---
name: architecture
description: System architecture, tech stack, and data access patterns. Use when discussing system design, database choices, layer architecture, or Prisma/Supabase hybrid approach.
user-invocable: true
---

# CleanMateX System Architecture

## Dual-Layer Data Model

- **SYSTEM LAYER (sys_*)**: Global shared data, no tenant_id
- **ORGANIZATION LAYER (org_*)**: Tenant data with RLS

## Tech Stack

- **DB**: PostgreSQL 16 (Supabase Local port 54322)
- **ORM**: Prisma + Supabase Client (Hybrid)
- **Web Admin**: Next.js 15, React 19, TypeScript 5, Tailwind v4
- **Mobile (planned)**: Flutter
- **cmx-api Backend (planned)**: NestJS

## Data Access Strategy

| Use Case | Tool | Location |
|----------|------|----------|
| Client-side queries | Supabase JS | React Components |
| Server API routes | Prisma | API Routes/Actions |
| Authentication | Supabase Auth | Both |
| Complex joins | Prisma | Server |
| Real-time | Supabase Realtime | Client |

## Multi-Tenancy Enforcement

**Application Layer**: Prisma Middleware auto-injects `tenant_org_id`

**Database Layer**: RLS policies as defense-in-depth

## Project Structure

```
cleanmatex/
├── supabase/              # Database & Auth (PostgreSQL + RLS)
├── web-admin/             # Next.js Admin Dashboard (Active)
├── cmx-api/               # NestJS API client api (Phase 2)
├── mobile-apps/
│   ├── customer-app/      # Flutter Customer App (Future)
│   ├── driver-app/        # Flutter Driver App (Future)
│   └── store-app/         # Flutter Store App (Future)
└── docs/                  # All documentation
```

## Additional Resources

- [reference.md](./reference.md) for detailed architecture
- [project-structure.md](./project-structure.md) for folder structure
