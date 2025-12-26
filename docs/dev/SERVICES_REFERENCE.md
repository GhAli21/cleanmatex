# Services Reference - CleanMateX Development

> **Last Updated:** 2025-10-17
> **Purpose:** Complete reference for all development services, architecture, and connections

This document provides detailed information about all services used in CleanMateX development.

---

## 🏗️ Architecture Overview

CleanMateX uses a dual-layer architecture with Supabase for data and Docker for supporting services.

```
┌─────────────────────────────────────────────────────────────┐
│                   DEVELOPMENT ENVIRONMENT                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Supabase Local (10 containers)          │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  • PostgreSQL 16         (port 54322)                │   │
│  │  • PostgREST API         (port 54321)                │   │
│  │  • Studio UI             (port 54323)                │   │
│  │  • GoTrue Auth           (internal)                  │   │
│  │  • Storage API           (internal)                  │   │
│  │  • Realtime              (internal)                  │   │
│  │  • Kong Gateway          (internal)                  │   │
│  │  │  • Mailpit             (port 54324)                  │   │
│  │  • Meta API              (internal)                  │   │
│  │  • Analytics             (internal)                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Docker Compose (3 containers)              │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  • Redis 7               (port 6379)                 │   │
│  │  • Redis Commander       (port 8081)                 │   │
│  │  • MinIO                 (ports 9000, 9001)          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Application Layer (Manual)              │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  • Web Admin (Next.js)   (port 3000)                 │   │
│  │  • Backend API (NestJS)  (port 3001) [Phase 2]      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Service Details

### Supabase Local Stack

Managed by Supabase CLI (`supabase start/stop`).

#### PostgreSQL Database
- **Port:** 54322
- **Connection String:** `postgresql://postgres:postgres@localhost:54322/postgres`
- **Purpose:** Primary database with RLS policies
- **Used By:** Prisma (server-side), Supabase Client (client-side)
- **Notes:**
  - This is the ONLY PostgreSQL instance in development
  - No separate Docker postgres container

#### PostgREST API
- **Port:** 54321
- **URL:** http://localhost:54321
- **Purpose:** Auto-generated REST API from database schema
- **Used By:** Supabase JS Client
- **Features:** Row Level Security (RLS) enforcement, real-time subscriptions

#### Studio UI
- **Port:** 54323
- **URL:** http://localhost:54323
- **Purpose:** Visual database management interface
- **Features:** Table editor, SQL editor, RLS policy manager, logs viewer

#### GoTrue Auth
- **Internal:** Accessed via Supabase API
- **Purpose:** Authentication and user management
- **Features:** Email/password, OAuth, JWT tokens, magic links

#### Storage API
- **Internal:** Accessed via Supabase API
- **Purpose:** File storage (S3-compatible)
- **Features:** Bucket management, RLS policies for files, CDN

#### Realtime
- **Internal:** WebSocket via Supabase API
- **Purpose:** Real-time database subscriptions
- **Features:** Live queries, presence, broadcast

#### Mailpit (Inbucket)
- **Port:** 54324
- **URL:** http://localhost:54324
- **Purpose:** Email testing (catches all outgoing emails)
- **Notes:** Emails never leave localhost in development

---

### Docker Compose Services

Managed by `docker-compose up/down`.

#### Redis
- **Port:** 6379
- **Purpose:** Caching and session storage (future backend)
- **Used By:** Backend API (Phase 2)
- **Features:** In-memory data store, pub/sub
- **Persistence:** Append-only file (AOF) enabled

#### Redis Commander
- **Port:** 8081
- **URL:** http://localhost:8081
- **Purpose:** Visual Redis management interface
- **Features:** Key browser, value editor, CLI interface

#### MinIO
- **API Port:** 9000
- **Console Port:** 9001
- **Console URL:** http://localhost:9001
- **Credentials:** `minioadmin` / `minioadmin123`
- **Purpose:** S3-compatible object storage (alternative to Supabase Storage)
- **Features:** Bucket management, versioning, encryption
- **Notes:** Optional - Supabase Storage can be used instead

---

### Application Services

Started manually by developers.

#### Web Admin (Next.js)
- **Port:** 3000
- **URL:** http://localhost:3000
- **Tech Stack:**
  - Next.js 15 (App Router)
  - React 19
  - TypeScript 5+
  - Tailwind CSS v4
  - Supabase Client + Prisma
- **Start Command:** `cd web-admin && npm run dev`
- **Features:** Admin dashboard, order management, customer management

#### Backend API (NestJS) - Phase 2
- **Port:** 3001
- **URL:** http://localhost:3001
- **Tech Stack:**
  - NestJS
  - Prisma
  - Redis (caching)
  - BullMQ (job queue)
- **Start Command:** `cd backend && npm run start:dev`
- **Purpose:** Complex business logic, integrations, background jobs
- **Status:** Planned for Phase 2

---

## 🔌 Connection Strings

### For Prisma (Server-Side)

```env
# web-admin/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

Used by:
- API Routes
- Server Actions
- Server Components
- Background jobs

### For Supabase Client (Client-Side)

```env
# web-admin/.env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

Used by:
- Client Components
- Auth flows
- Real-time subscriptions
- File uploads

### For Redis

```env
REDIS_URL=redis://localhost:6379
```

### For MinIO

```env
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=cleanmatex-dev
```

---

## 🔀 Data Flow

### Client-Side Query (React Component)

```
Browser Component
      ↓
Supabase JS Client
      ↓
PostgREST API (port 54321)
      ↓
RLS Policy Check
      ↓
PostgreSQL (port 54322)
```

### Server-Side Query (API Route)

```
API Route / Server Action
      ↓
Prisma Client
      ↓
PostgreSQL (port 54322)
      ↓
Direct access (bypasses RLS)
```

**Note:** Server-side still needs tenant filtering via Prisma middleware!

---

## 🛠️ Service Dependencies

```
Startup Order (Automated by start-services.ps1):

1. Supabase Local
   ├─ PostgreSQL (must start first)
   ├─ PostgREST (depends on PostgreSQL)
   ├─ GoTrue (depends on PostgreSQL)
   ├─ Storage (depends on PostgreSQL)
   └─ Studio (depends on PostgreSQL)

2. Docker Services (parallel)
   ├─ Redis (independent)
   ├─ Redis Commander (depends on Redis)
   └─ MinIO (independent)

3. Application Layer (manual)
   ├─ Web Admin (depends on Supabase + Docker)
   └─ Backend API (depends on all services)
```

---

## 📊 Resource Usage

Typical resource consumption on Windows:

| Service | Memory | CPU | Disk |
|---------|--------|-----|------|
| Supabase Stack | ~1.5 GB | 5-10% | Minimal |
| PostgreSQL | ~200 MB | 2-5% | Variable |
| Redis | ~50 MB | <1% | Minimal |
| MinIO | ~100 MB | <1% | Variable |
| Web Admin (dev) | ~300 MB | 10-20% | Minimal |
| **Total** | **~2.2 GB** | **20-40%** | **<1 GB** |

**Recommendation:** 8GB RAM minimum, 16GB RAM recommended

---

## 🔍 Health Checks

### Check All Services

```powershell
.\scripts\dev\status-services.ps1
```

### Manual Port Checks

```powershell
# PowerShell
Test-NetConnection -ComputerName localhost -Port 54321

# or using curl
curl http://localhost:54321
```

### Docker Container Health

```bash
docker-compose ps
```

### Supabase Status

```bash
supabase status
```

---

## 🚨 Important Notes

### About PostgreSQL

**⚠️ We do NOT use a separate Docker PostgreSQL container!**

- ❌ **Removed:** Docker postgres on port 5432
- ✅ **Using:** Supabase's postgres on port 54322

**Why?**
- Supabase Local includes a fully-featured PostgreSQL
- No need for duplicate database containers
- Saves ~200MB RAM
- Avoids port conflicts

### About Prisma

**Prisma is a library, NOT a service!**

- ❌ **Removed:** Docker prisma-cli container
- ✅ **Using:** `npx prisma` commands directly

**How to use:**
```bash
cd web-admin
npx prisma db pull      # Sync schema
npx prisma generate     # Generate client
npx prisma studio       # Open GUI
```

---

## 🔧 Configuration Files

### Supabase Config
- **Location:** `supabase/config.toml`
- **Controls:** Ports, features, auth providers
- **Docs:** https://supabase.com/docs/guides/cli/config

### Docker Compose
- **Location:** `docker-compose.yml`
- **Services:** Redis, MinIO, Redis Commander only
- **Networks:** cmx-network (bridge)

### Environment Variables
- **Location:** `.env` (web-admin and root)
- **Template:** `.env.example`
- **Never commit:** `.env` is in `.gitignore`

---

## 📚 Related Documentation

- [Quick Start Guide](./QUICK_START.md) - Daily workflow
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues
- [Architecture Overview](../../.claude/docs/architecture.md) - System design
- [Database Conventions](../../.claude/docs/database_conventions.md) - Schema patterns

---

## 🆘 Need Help?

- **Service won't start:** Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Port conflict:** See port reference table above
- **Connection issues:** Verify DATABASE_URL in `.env`
- **Performance issues:** Check resource usage table above

---

**Last Updated:** 2025-10-17
**Maintained By:** Development Team
