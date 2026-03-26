# System Architecture

## Dual-Layer Data Model

```
SYSTEM LAYER (sys_*): Global shared data, no tenant_id
ORGANIZATION LAYER (org_*): Tenant data with RLS
```
Core entities use composite keys like `(tenant_org_id, entity_id)` to enforce isolation at schema level. RLS provides runtime isolation.

## Stack
- **DB:** PostgreSQL 16 (Supabase Local on port 54322), JSONB, composite PKs, RLS, planned partitioning
- **Data Access:** shared Supabase workspace plus module-specific access patterns
- **Web Admin:** Laundry dashboard and all operations , Next.js 16, React 19, TS 5, Tailwind v4, React Query + Zustand, next-intl
- **Mobile (planned):** Flutter apps for customer, driver, store; Riverpod, Dio, Hive
- **Backend:** `cmx-api` NestJS module with Supabase-based backend patterns
- **Infra:** Supabase Local (includes Postgres on port 54322), Docker Compose for Redis & MinIO only

**Note:** We do NOT use a separate Docker Postgres container. Supabase Local includes PostgreSQL.

## Data Access Layer

### Current Repository Pattern

```
┌─────────────────────────────────────────────┐
│         Supabase PostgreSQL Database         │
│         (RLS Policies Active)                │
└────────────────┬────────────────────────────┘
                 │
        ┌────────┴─────────┐
        │                  │
┌───────▼─────────┐  ┌─────▼──────────────┐
│  Supabase JS    │  │  Module-Specific   │
│  Client         │  │  Server Data       │
│  (PostgREST)    │  │  Access Patterns   │
└─────────────────┘  └────────────────────┘
        │                  │
┌───────▼─────────┐  ┌─────▼──────────────┐
│  Client-Side    │  │  Server-Side       │
│  - React        │  │  - API Routes      │
│  - Auth         │  │  - Server Actions  │
│  - Real-time    │  │  - Business Logic  │
│  - Storage      │  │  - Complex Queries │
└─────────────────┘  └────────────────────┘
```

### When to Use Each Tool

| Use Case | Tool | Location | Why |
|----------|------|----------|-----|
| Client-side queries | Supabase JS | React Components | RLS enforcement, real-time |
| Server API routes | Module-specific server data access | API Routes/Actions | Depends on module implementation |
| Authentication | Supabase Auth | Both | Built-in, JWT tokens |
| File uploads | Supabase Storage | Both | S3-compatible |
| Real-time subs | Supabase Realtime | Client | WebSocket support |
| Complex joins | Module-specific server data access | Server | Depends on implementation |
| Business logic | Services + repositories | Server | Explicit boundaries |
| Reporting | Server-side data access | Server | Depends on implementation |

### Multi-Tenancy Enforcement

**Application Layer:**
- tenant filtering must be explicit and verifiable
- implementation varies by module
- `web-admin` and `cmx-api` may use different access patterns

**Database Layer (RLS Policies):**
- Existing RLS policies still active
- Defense-in-depth security model
- Works even if application layer bypassed

**Example - Automatic Tenant Filtering:**
```typescript
// Middleware auto-adds: WHERE tenant_org_id = {session.tenant_org_id}
const orders = await prisma.org_orders_mst.findMany({
  include: {
    customer: true,
    items: true,
  }
})
// ✅ tenant_org_id filter added automatically by middleware
```

### Type Safety Benefits

**Before (Raw Supabase):**
```typescript
const { data } = await supabase
  .from('org_orders_mst')
  .select('*')
  .eq('tenant_org_id', tenantId) // Easy to forget!
// data is loosely typed
```

**After (Prisma):**
```typescript
const orders = await prisma.org_orders_mst.findMany()
// ✅ Fully typed return value
// ✅ tenant_org_id auto-filtered
// ✅ IntelliSense for all fields
// ✅ Compile-time error checking
```

### Connection Strategy

**Prisma:**
- Direct PostgreSQL connection via PgBouncer (connection pooling)
- Transaction mode for serverless compatibility
- Environment: `DATABASE_URL`

**Supabase Client:**
- PostgREST API via HTTPS
- Row Level Security (RLS) enforced
- Environment: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`


---

## 🗏 SYSTEM ARCHITECTURE

### Multi-Tenant Strategy

**Dual-Layer Architecture** for optimal tenant isolation:

```
┌───────────────────────────────────────────────────────┐
│                   SYSTEM LAYER (sys_*)                │
│            Global Shared Data - No Tenant ID          │
├───────────────────────────────────────────────────────┤
│  • sys_customers_mst      - Global customer identities│
│  • sys_service_category_cd - Service categories       │
│  • sys_order_type_cd      - Order types              │
│  • sys_order_status_cd    - Order statuses           │
│  • sys_payment_method_cd  - Payment methods          │
└───────────────────────────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────┐
│              ORGANIZATION LAYER (org_*)               │
│         Tenant-Specific Data with RLS Enforcement     │
├───────────────────────────────────────────────────────┤
│  • org_tenants_mst        - Tenant organizations     │
│  • org_customers_mst      - Tenant-customer junction │
│  • org_orders_mst         - Orders (CORE)           │
│  • org_order_items_dtl    - Order items             │
│  • org_product_data_mst   - Service catalog         │
│  • org_branches_mst       - Multiple branches       │
│  • org_invoice_mst        - Invoices                │
│  • org_payments_dtl_tr    - Payment transactions    │
│  • org_subscriptions_mst     - Subscription management │
└───────────────────────────────────────────────────────┘
```

### Critical Pattern
- Many tables use **composite foreign keys** like `(tenant_org_id, customer_id)`
- This enforces tenant isolation at the **database level**
- Row-Level Security (RLS) provides additional runtime enforcement

---

## Technology Stack

### Database Layer
- **Database**: Supabase PostgreSQL
  - Row-Level Security (RLS) enforced per tenant via `tenant_org_id`
  - JSONB columns for flexible metadata
  - Composite primary keys for tenant data isolation
  - Custom domains for data types (MONEY, IS_ACTIVE, etc.)
  - Partitioning for high-volume tables (planned)

### Frontend - Web Admin
- **Framework**: Next.js 16 (App Router)
- **Location**: `web-admin/`
- **Language**: TypeScript 5+
- **UI Framework**: React 19
- **Styling**: Tailwind CSS v4
- **State Management**: React Query + Zustand (minimal)
- **Auth**: Supabase Auth
- **i18n**: next-intl (English + Arabic with RTL)
- **Port**: 3000

### Frontend - Mobile Apps (Planned)
- **Framework**: Flutter 3.16+
- **Directories**:
  - `customer-app/` - Customer ordering app
  - `driver-app/` - Driver delivery app
  - `store-app/` - Store/branch staff app
- **State Management**: Riverpod
- **HTTP Client**: Dio
- **Local Storage**: Hive

### Backend API 
- **Framework**: NestJS
- **Location**: `cmx-api/`
- **Cache**: Redis 7+
- **Queue**: BullMQ for background jobs
- **Purpose**: Complex business logic, integrations

### Infrastructure

**Supabase Local** (Primary infrastructure):
- **API**: `http://127.0.0.1:54321`
- **Studio**: `http://127.0.0.1:54323`
- **Database**: `postgresql://postgres:postgres@localhost:54322/postgres`
- **Mailpit**: `http://127.0.0.1:54324`

**Docker Compose** (Supporting services only):
- **Redis**: `localhost:6379`
- **MinIO API**: `localhost:9000`
- **MinIO Console**: `localhost:9001`
- **Redis Commander**: `localhost:8081`

**Note:** PostgreSQL runs inside Supabase Local (port 54322), NOT as a separate Docker container.

---

## Authority Note

This file is a high-level architecture reference.

- when it conflicts with current module READMEs, `CLAUDE.md`, or the actual codebase structure, the current module/code reality wins
- do not treat older Prisma-first descriptions in this file as universal truth across all modules

## Architecture Decisions

### Phase 1: Supabase-Only (Current)
- Use Supabase for all CRUD operations
- Leverage auto-generated APIs
- Implement business logic in database functions
- Cost: $0 (free tier)

### Phase 2: Hybrid Architecture (Future)
- Add NestJS for complex business logic
- Keep Supabase for simple CRUD
- Implement background jobs with BullMQ
- Cost: $50-100/month

### Why This Approach?
- Fastest time to market
- Lower initial cost
- Validate business idea quickly
- Scale when revenue justifies it
- Best for solo developer

---

## Return to [Main Documentation](../CLAUDE.md)
