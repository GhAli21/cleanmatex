# System Architecture Rules

## Overview
System architecture patterns and technology stack for CleanMateX.

## Rules

### Dual-Layer Data Model
- SYSTEM LAYER (`sys_*`): Global shared data, no tenant_id
- ORGANIZATION LAYER (`org_*`): Tenant data with RLS enforcement
- Use composite keys like `(tenant_org_id, entity_id)` to enforce isolation at schema level
- RLS provides runtime isolation

### Technology Stack
- Database: PostgreSQL 16 (Supabase Local on port 54322), JSONB, composite PKs, RLS
- ORM: Prisma (server-side) + Supabase Client (client-side) - Hybrid approach
- Web Admin: Next.js 15, React 19, TypeScript 5, Tailwind v4, React Query + Zustand, next-intl
- Mobile (planned): Flutter apps for customer, driver, store; Riverpod, Dio, Hive
- Backend (planned): NestJS with Prisma, Redis, BullMQ
- Infrastructure: Supabase Local (includes Postgres on port 54322), Docker Compose for Redis & MinIO only

### Data Access Layer - Hybrid Strategy
- Client-side queries: Use Supabase JS Client (RLS enforcement, real-time)
- Server API routes: Use Prisma (Type safety, middleware)
- Authentication: Use Supabase Auth (Built-in, JWT tokens)
- File uploads: Use Supabase Storage (S3-compatible)
- Real-time subscriptions: Use Supabase Realtime (WebSocket support)
- Complex joins: Use Prisma (Better query builder)
- Business logic: Use Prisma (Transactions, middleware)
- Reporting: Use Prisma (Aggregations, raw SQL)

### Multi-Tenancy Enforcement
- Application Layer: Auto-inject `tenant_org_id` filter on all `org_*` tables via Prisma middleware
- Database Layer: RLS policies provide defense-in-depth security
- Prisma middleware enforces tenant filtering at compile-time
- RLS policies work even if application layer is bypassed

### Connection Strategy
- Prisma: Direct PostgreSQL connection via PgBouncer (connection pooling), transaction mode for serverless compatibility
- Supabase Client: PostgREST API via HTTPS, Row Level Security (RLS) enforced

### Infrastructure
- Supabase Local: API (http://127.0.0.1:54321), Studio (http://127.0.0.1:54323), Database (postgresql://postgres:postgres@localhost:54322/postgres), Mailpit (http://127.0.0.1:54324)
- Docker Compose: Redis (localhost:6379), MinIO API (localhost:9000), MinIO Console (localhost:9001), Redis Commander (localhost:8081)
- Note: PostgreSQL runs inside Supabase Local (port 54322), NOT as a separate Docker container

### Architecture Decisions
- Phase 1 (Current): Supabase-only for all CRUD operations, leverage auto-generated APIs, implement business logic in database functions
- Phase 2 (Future): Add NestJS for complex business logic, keep Supabase for simple CRUD, implement background jobs with BullMQ

## Conventions
- Always use hybrid approach: Supabase Client for client-side, Prisma for server-side
- Never bypass tenant filtering
- Always enable RLS on org_* tables
- Use composite foreign keys for tenant-scoped joins
