---
version: v0.2.0
last_updated: 2025-01-14
author: Gehad Abdo Mohammed Ali
status: Architecture Update
---

# ARCHITECTURE UPDATE: Standalone Applications Structure

## Critical Change: Multi-Application Architecture

### Updated Project Structure

```
cleanmatex/
├── web-admin/              # Tenant-facing dashboard (existing)
│   ├── Port: 3000
│   ├── Users: Tenant staff (admin, operator, viewer)
│   └── Auth: Tenant-scoped JWT
│
├── platform-web/           # NEW: Platform HQ Frontend
│   ├── Port: 3001
│   ├── Framework: Next.js 15 (App Router)
│   ├── Users: Platform admins (super_admin, support, billing, analyst)
│   ├── Auth: Platform admin JWT
│   └── Purpose: Platform management UI
│
├── platform-api/           # NEW: Platform HQ Backend API
│   ├── Port: 3002
│   ├── Framework: NestJS
│   ├── Purpose: Platform-specific business logic & APIs
│   ├── Auth: JWT verification middleware
│   └── Services: Billing, analytics, tenant management, support
│
├── platform-workers/       # NEW: Background Job Processors
│   ├── Framework: BullMQ + Redis
│   ├── Purpose: Async tasks (billing, notifications, metrics)
│   └── Workers:
│       ├── billing-worker (invoice generation, payment processing)
│       ├── analytics-worker (metrics aggregation, reporting)
│       ├── notification-worker (emails, SMS, WhatsApp)
│       └── cleanup-worker (data retention, archiving)
│
├── backend/                # Shared API (NestJS) - existing/planned
│   ├── Port: 3003
│   ├── Purpose: Shared business logic for both web-admin and platform
│   └── May be merged with platform-api in future
│
├── packages/               # Shared Libraries
│   ├── @cleanmatex/types
│   ├── @cleanmatex/utils
│   ├── @cleanmatex/database
│   ├── @cleanmatex/auth
│   └── @cleanmatex/ui-components
│
├── infra/                  # Infrastructure & DevOps
│   ├── docker/
│   ├── k8s/
│   ├── terraform/
│   └── scripts/
│
└── docs/                   # Documentation
    └── features/
        └── SAAS_Platform_Management/
```

---

## Application Breakdown

### 1. platform-web (Platform HQ Frontend)

**Technology Stack:**
- Next.js 15 (App Router)
- React 19
- TypeScript 5+
- Tailwind CSS v4
- React Query + Zustand
- next-intl (EN/AR)

**Purpose:**
- Platform administrator dashboard
- Tenant management UI
- Billing & subscription management UI
- Analytics & reporting dashboards
- Support ticketing interface
- System configuration UI

**Key Features:**
- Separate login system
- Platform-specific navigation
- Cross-tenant visibility
- Admin role-based UI
- Audit trail views
- Real-time notifications

**Environment Variables:**
```env
# platform-web/.env.local
NEXT_PUBLIC_PLATFORM_API_URL=http://localhost:3002
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
PLATFORM_API_SECRET=your_platform_secret
NODE_ENV=development
```

**Deployment:**
- Vercel (recommended) or dedicated VPS
- Separate deployment from web-admin
- Internal access only (IP whitelisting optional)
- Custom domain: platform.cleanmatex.com

---

### 2. platform-api (Platform HQ Backend)

**Technology Stack:**
- NestJS
- TypeScript 5+
- Prisma (database ORM)
- PostgreSQL (Supabase)
- Redis (caching & sessions)
- BullMQ (job queue integration)

**Purpose:**
- Platform-specific business logic
- Billing & subscription APIs
- Analytics & metrics calculations
- Tenant lifecycle management
- Support ticket management
- Admin authentication & authorization

**Module Structure:**
```
platform-api/
├── src/
│   ├── auth/
│   │   ├── platform-auth.controller.ts
│   │   ├── platform-auth.service.ts
│   │   └── guards/
│   │       ├── platform-admin.guard.ts
│   │       └── permissions.guard.ts
│   ├── tenants/
│   │   ├── tenants.controller.ts
│   │   ├── tenants.service.ts
│   │   ├── lifecycle.service.ts
│   │   └── health.service.ts
│   ├── billing/
│   │   ├── billing.controller.ts
│   │   ├── billing.service.ts
│   │   ├── invoices.service.ts
│   │   ├── payments.service.ts
│   │   └── dunning.service.ts
│   ├── analytics/
│   │   ├── analytics.controller.ts
│   │   ├── analytics.service.ts
│   │   ├── metrics.service.ts
│   │   └── reporting.service.ts
│   ├── support/
│   │   ├── tickets.controller.ts
│   │   ├── tickets.service.ts
│   │   └── impersonation.service.ts
│   ├── core-data/
│   │   ├── code-tables.controller.ts
│   │   ├── code-tables.service.ts
│   │   └── seed-data.service.ts
│   ├── workflows/
│   │   ├── workflows.controller.ts
│   │   └── workflows.service.ts
│   ├── audit/
│   │   ├── audit.service.ts
│   │   └── audit.middleware.ts
│   └── common/
│       ├── decorators/
│       ├── filters/
│       ├── interceptors/
│       └── pipes/
├── prisma/
│   └── schema.prisma
└── package.json
```

**API Endpoints:**
```
/api/v1/platform/
├── /auth
│   ├── POST   /login
│   ├── POST   /logout
│   └── GET    /me
├── /tenants
│   ├── GET    /tenants
│   ├── POST   /tenants
│   ├── GET    /tenants/:id
│   ├── PATCH  /tenants/:id
│   ├── POST   /tenants/:id/suspend
│   └── POST   /tenants/:id/impersonate
├── /billing
│   ├── GET    /invoices
│   ├── POST   /invoices/generate
│   ├── GET    /invoices/:id
│   ├── POST   /payments/:id/process
│   └── GET    /revenue/metrics
├── /analytics
│   ├── GET    /metrics/platform
│   ├── GET    /metrics/tenant/:id
│   └── POST   /reports/generate
└── /support
    ├── GET    /tickets
    ├── POST   /tickets
    └── PATCH  /tickets/:id
```

**Environment Variables:**
```env
# platform-api/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Payment Gateways
STRIPE_SECRET_KEY=sk_test_...
HYPERPAY_ENTITY_ID=...
PAYTABS_SERVER_KEY=...

# Email
SENDGRID_API_KEY=...

# Monitoring
SENTRY_DSN=...
```

**Deployment:**
- Railway, Fly.io, or AWS ECS
- Auto-scaling enabled
- Health check endpoint: `/health`
- Metrics endpoint: `/metrics` (Prometheus)

---

### 3. platform-workers (Background Job Processors)

**Technology Stack:**
- Node.js + TypeScript
- BullMQ (job queue)
- Redis (queue storage)
- Prisma (database access)
- Node-cron (scheduling)

**Purpose:**
- Asynchronous task processing
- Scheduled jobs (cron)
- Long-running operations
- Decoupled from API for performance

**Worker Types:**

#### 3.1 Billing Worker
```typescript
// platform-workers/src/workers/billing-worker.ts
import { Worker } from 'bullmq';

const billingWorker = new Worker('billing-queue', async (job) => {
  switch (job.name) {
    case 'generate-monthly-invoices':
      await generateMonthlyInvoices();
      break;
    case 'process-payment':
      await processPayment(job.data.invoice_id);
      break;
    case 'retry-failed-payment':
      await retryFailedPayment(job.data.invoice_id);
      break;
    case 'send-invoice-email':
      await sendInvoiceEmail(job.data.invoice_id);
      break;
  }
});

// Scheduled job: Run on 1st of every month
cron.schedule('0 0 1 * *', async () => {
  await billingQueue.add('generate-monthly-invoices', {});
});
```

#### 3.2 Analytics Worker
```typescript
// platform-workers/src/workers/analytics-worker.ts
const analyticsWorker = new Worker('analytics-queue', async (job) => {
  switch (job.name) {
    case 'aggregate-daily-metrics':
      await aggregateDailyMetrics(job.data.date);
      break;
    case 'calculate-health-scores':
      await calculateHealthScores();
      break;
    case 'update-churn-predictions':
      await updateChurnPredictions();
      break;
    case 'generate-revenue-report':
      await generateRevenueReport(job.data.period);
      break;
  }
});

// Scheduled job: Run daily at 23:59
cron.schedule('59 23 * * *', async () => {
  await analyticsQueue.add('aggregate-daily-metrics', { date: new Date() });
});
```

#### 3.3 Notification Worker
```typescript
// platform-workers/src/workers/notification-worker.ts
const notificationWorker = new Worker('notification-queue', async (job) => {
  switch (job.name) {
    case 'send-email':
      await sendEmail(job.data);
      break;
    case 'send-sms':
      await sendSMS(job.data);
      break;
    case 'send-whatsapp':
      await sendWhatsApp(job.data);
      break;
    case 'send-welcome-email':
      await sendWelcomeEmail(job.data.tenant_id);
      break;
    case 'send-dunning-reminder':
      await sendDunningReminder(job.data.tenant_id, job.data.stage);
      break;
  }
});
```

#### 3.4 Cleanup Worker
```typescript
// platform-workers/src/workers/cleanup-worker.ts
const cleanupWorker = new Worker('cleanup-queue', async (job) => {
  switch (job.name) {
    case 'archive-old-invoices':
      await archiveOldInvoices();
      break;
    case 'delete-churned-tenants':
      await deleteChurnedTenants();
      break;
    case 'clean-old-logs':
      await cleanOldLogs();
      break;
    case 'purge-temp-files':
      await purgeTempFiles();
      break;
  }
});

// Scheduled job: Run weekly on Sunday at 2 AM
cron.schedule('0 2 * * 0', async () => {
  await cleanupQueue.add('archive-old-invoices', {});
  await cleanupQueue.add('clean-old-logs', {});
});
```

**Worker Structure:**
```
platform-workers/
├── src/
│   ├── workers/
│   │   ├── billing-worker.ts
│   │   ├── analytics-worker.ts
│   │   ├── notification-worker.ts
│   │   └── cleanup-worker.ts
│   ├── jobs/
│   │   ├── billing/
│   │   ├── analytics/
│   │   ├── notifications/
│   │   └── cleanup/
│   ├── queues/
│   │   └── queue-config.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

**Deployment:**
- Separate container/process per worker type
- Auto-restart on failure (PM2 or Kubernetes)
- Monitoring via BullMQ dashboard
- Horizontal scaling for high load

---

## Inter-Application Communication

### 1. platform-web ↔ platform-api

```typescript
// platform-web/lib/api-client.ts
const platformApiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_PLATFORM_API_URL,
  headers: {
    'Authorization': `Bearer ${getPlatformAdminToken()}`,
    'Content-Type': 'application/json'
  }
});

// Example usage
export async function getTenants(filters: TenantFilters) {
  const response = await platformApiClient.get('/api/v1/platform/tenants', {
    params: filters
  });
  return response.data;
}
```

### 2. platform-api ↔ platform-workers

```typescript
// platform-api/src/billing/billing.service.ts
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class BillingService {
  constructor(
    @InjectQueue('billing-queue') private billingQueue: Queue
  ) {}

  async scheduleInvoiceGeneration(tenantId: string) {
    await this.billingQueue.add('generate-monthly-invoices', {
      tenant_id: tenantId,
      date: new Date()
    }, {
      priority: 1,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
  }
}
```

### 3. All Applications ↔ Database (Supabase PostgreSQL)

```typescript
// Shared database access via Prisma
// packages/@cleanmatex/database/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Used by all applications
import { PrismaClient } from '@cleanmatex/database';
const prisma = new PrismaClient();
```

---

## Deployment Architecture

### Development Environment

```
Local Machine
├── platform-web:          http://localhost:3001
├── platform-api:          http://localhost:3002
├── platform-workers:      (background processes)
├── web-admin:             http://localhost:3000
├── Supabase Local:        http://localhost:54321
├── PostgreSQL:            localhost:54322
└── Redis:                 localhost:6379
```

### Production Environment

```
Cloud Infrastructure
├── platform-web:          https://platform.cleanmatex.com (Vercel)
├── platform-api:          https://api-platform.cleanmatex.com (Railway/Fly.io)
├── platform-workers:      (Background containers on Railway/AWS ECS)
├── web-admin:             https://app.cleanmatex.com (Vercel)
├── Supabase:              https://xxx.supabase.co
└── Redis:                 Redis Cloud (free tier)
```

---

## Updated PRD References

All PRDs (0001-0023) should now reference this architecture:

**Application Names:**
- ✅ `platform-web` (not platform-admin)
- ✅ `platform-api` (not backend/platform)
- ✅ `platform-workers` (not workers)

**Folder Paths:**
- ✅ `/platform-web/app/(dashboard)/...`
- ✅ `/platform-api/src/tenants/...`
- ✅ `/platform-workers/src/workers/...`

**URLs:**
- ✅ Frontend: `https://platform.cleanmatex.com`
- ✅ API: `https://api-platform.cleanmatex.com`
- ✅ Web Admin: `https://app.cleanmatex.com`

---

## Migration Notes

### From Previous Architecture

**Old:**
```
cleanmatex/
├── platform-admin/  ❌
└── backend/
```

**New:**
```
cleanmatex/
├── platform-web/    ✅
├── platform-api/    ✅
└── platform-workers/ ✅
```

### Why This Structure?

1. **Clear Separation**: Each application has a distinct purpose
2. **Independent Scaling**: Scale web, API, and workers separately
3. **Technology Flexibility**: Different tech stacks per application
4. **Deployment Independence**: Deploy each app independently
5. **Team Organization**: Clear ownership boundaries
6. **Microservices Ready**: Easy migration to microservices if needed

---

## Repository Structure

### Monorepo Approach (Recommended)

```
cleanmatex/ (root)
├── .github/
│   └── workflows/
│       ├── platform-web-deploy.yml
│       ├── platform-api-deploy.yml
│       └── platform-workers-deploy.yml
├── apps/
│   ├── platform-web/
│   ├── platform-api/
│   ├── platform-workers/
│   └── web-admin/
├── packages/
│   ├── @cleanmatex/types/
│   ├── @cleanmatex/utils/
│   ├── @cleanmatex/database/
│   └── @cleanmatex/ui-components/
├── infra/
├── docs/
├── package.json (root - workspace config)
├── turbo.json (Turborepo config)
└── pnpm-workspace.yaml
```

### Package Manager: pnpm (with workspaces)

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// package.json (root)
{
  "name": "cleanmatex-monorepo",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "dev:platform-web": "turbo run dev --filter=platform-web",
    "dev:platform-api": "turbo run dev --filter=platform-api",
    "dev:platform-workers": "turbo run dev --filter=platform-workers"
  }
}
```

---

## Summary of Changes

| Aspect | Old | New |
|--------|-----|-----|
| **Frontend Name** | platform-admin | platform-web |
| **Backend Name** | backend (shared) | platform-api (dedicated) |
| **Workers** | N/A | platform-workers (new) |
| **Structure** | Single apps | Multi-app monorepo |
| **Ports** | 3001 (frontend only) | 3001 (web), 3002 (api), N/A (workers) |
| **Deployment** | Single deploy | Independent deploys |
| **Scaling** | Monolithic | Per-application |

---

**Approval Required**: Please confirm this architecture before proceeding with remaining PRDs.

---

**End of Architecture Update**
