# CleanMateX — Local Infrastructure Guide

> **Location:** `docs/dev/cleanmatex_infra_guide.md`
> **Last Updated:** 2026-05-06
> **Covers:** Everything from a bare machine to a running dev environment.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Step 0 — Prerequisites Check](#2-step-0--prerequisites-check)
3. [Step 1 — Install Required Tools](#3-step-1--install-required-tools)
4. [Step 2 — First-Time Project Setup](#4-step-2--first-time-project-setup)
5. [Step 3 — Start Infrastructure Services](#5-step-3--start-infrastructure-services)
6. [Step 4 — Database Setup](#6-step-4--database-setup)
7. [Step 5 — Verify Health (Smoke Test)](#7-step-5--verify-health-smoke-test)
8. [Step 6 — Start the Web Application](#8-step-6--start-the-web-application)
9. [Daily Dev Workflow](#9-daily-dev-workflow)
10. [Service Reference](#10-service-reference)
11. [Connection Strings and Env Vars](#11-connection-strings-and-env-vars)
12. [Script Reference](#12-script-reference)
13. [Troubleshooting](#13-troubleshooting)
14. [Emergency Procedures](#14-emergency-procedures)

---

## 1. Architecture Overview

CleanMateX local dev uses two orchestration layers managed by two separate tools.

```
┌──────────────────────────────────────────────────────────────┐
│                  LOCAL DEV ENVIRONMENT                        │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  Supabase Local Stack  (managed by: supabase CLI)   │     │
│  │                                                       │     │
│  │   PostgreSQL 17 ............ :54322  (database)      │     │
│  │   PostgREST API ............ :54321  (REST + auth)   │     │
│  │   Studio UI ................ :54323  (admin UI)      │     │
│  │   Mailpit .................. :54324  (email testing) │     │
│  │   GoTrue / Storage / Kong .. internal                │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  Docker Compose Stack  (managed by: docker compose) │     │
│  │                                                       │     │
│  │   Redis 7 .................. :6379   (cache/queue)   │     │
│  │   Redis Commander .......... :8081   (Redis GUI)     │     │
│  │   MinIO .................... :9000   (S3 API)        │     │
│  │                   .......... :9001   (MinIO Console) │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  Application Layer  (started manually by developer) │     │
│  │                                                       │     │
│  │   Web Admin (Next.js) ...... :3000                   │     │
│  │   Backend API (NestJS) ..... :3001   [Phase 2]       │     │
│  └─────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

**Key rules:**
- There is NO standalone Docker postgres container. PostgreSQL runs inside Supabase at port `54322`.
- Migrations live in `supabase/migrations/` and are the **source of truth** for schema.
- `docker-compose.yml` only contains Redis, MinIO, and Redis Commander.

---

## 2. Step 0 — Prerequisites Check

Before anything else, run the prerequisites check script. It validates every requirement on the machine and tells you exactly what is missing.

```powershell
.\scripts\dev\check-prerequisites.ps1
```

**What it checks:**

| Check | Minimum | Recommended |
|---|---|---|
| Docker Desktop installed | Any | Latest stable |
| Docker Desktop running | — | — |
| Docker memory allocation | 4 GB | 6 GB or more |
| Supabase CLI in PATH | Any | Latest stable |
| Node.js version | v20 | v22 LTS |
| npm | Any | Matches Node.js |
| `web-admin/.env.local` exists | Required | — |
| `supabase/config.toml` exists | Required | — |
| Required ports free | All 7 ports | — |

Fix every `[FAIL]` item before proceeding. `[WARN]` items are advisory.

---

## 3. Step 1 — Install Required Tools

### 3.1 Docker Desktop

Download and install from the official site. After installation, open Docker Desktop and wait until the whale icon in the system tray is steady (not animating).

**Set memory allocation (critical for Supabase):**
Docker Desktop → Settings → Resources → Memory → set to **6 GB or more** → Apply & Restart.

### 3.2 Supabase CLI

**Use Scoop — this is the only supported method on Windows.**
`npm install -g supabase` is explicitly blocked by the Supabase CLI postinstall script (exits with error).

**Step 1 — Install Scoop** (if not already installed):

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
irm get.scoop.sh | iex
```

**Step 2 — Add Scoop shims to your permanent PATH** (do this immediately after Scoop install):

```powershell
[System.Environment]::SetEnvironmentVariable(
    "PATH",
    "$env:USERPROFILE\scoop\shims;" + [System.Environment]::GetEnvironmentVariable("PATH", "User"),
    "User"
)
```

> **Why:** Scoop adds its shims folder to the PATH of the session that ran the installer, but not to the permanent User PATH. Without this step, every new terminal (including VS Code integrated terminal) will not find `supabase`. Run this once and it persists permanently.

**Step 3 — Close and reopen your terminal**, then install Supabase CLI:

```powershell
scoop install supabase
```

**Step 4 — Verify:**

```powershell
supabase --version
```

To update in the future:

```powershell
scoop update supabase
```

**If you see "Supabase CLI not found in PATH" after install**, it means the PATH fix in Step 2 was not applied. Fix it for the current session immediately:

```powershell
$env:PATH = "$env:USERPROFILE\scoop\shims;$env:PATH"
```

Then re-run Step 2 to make it permanent and restart your terminal.

### 3.3 Node.js

Install Node.js v20 or higher. Verify:

```powershell
node --version   # must be v20.x or higher
npm --version
```

### 3.4 psql (PostgreSQL client)

Required by the seed loading scripts (`load-seeds.ps1`). Install via:

```powershell
# Option A — Scoop
scoop install postgresql

# Option B — Download from https://www.postgresql.org/download/windows/
# (install "Command Line Tools" component only — no server needed)
```

Verify:

```powershell
psql --version
```

### 3.5 Git

```powershell
git --version
```

---

## 4. Step 2 — First-Time Project Setup

### 4.1 Clone the repository

```powershell
git clone <repository-url> f:\jhapp\cleanmatex
cd f:\jhapp\cleanmatex
```

### 4.2 Create the environment file

The app will not start without `web-admin/.env.local`. Copy it from another developer or create it after starting Supabase for the first time.

```powershell
cd web-admin
copy .env.example .env.local
```

After starting Supabase (Step 3), populate it with the real keys:

```powershell
supabase status
# Copy the API URL, anon key, and service_role key from output
```

Minimum required keys in `web-admin/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase status>
```

### 4.3 Install npm dependencies

```powershell
cd f:\jhapp\cleanmatex\web-admin
npm install
```

---

## 5. Step 3 — Start Infrastructure Services

The start script handles everything in the correct order: checks prerequisites, starts Supabase, waits for readiness, then starts Docker Compose services.

```powershell
cd f:\jhapp\cleanmatex
.\scripts\dev\start-services.ps1
```

**What the script does:**

| Phase | Action |
|---|---|
| [1/4] | Verifies Docker Desktop is running and checks memory allocation |
| [2/4] | Verifies Supabase CLI is installed |
| [3/4] | Runs `supabase start` and waits for ports 54321, 54322, 54323 |
| [4/4] | Runs `docker compose up` for Redis, MinIO, Redis Commander and waits for ports 6379, 9000 |

On success, the script prints a status table and all service URLs.

---

## 6. Step 4 — Database Setup

After starting services, the PostgreSQL database is running but **empty** (no tables). You must choose one of the options below based on your situation.

### Decision Tree

```
Is this a new machine / fresh Supabase instance?
│
├─ YES — Do you have a dump from remote (production/staging)?
│         ├─ YES ──► Option D: Restore from remote dump
│         └─ NO  ──► Do you want demo data?
│                     ├─ YES ──► Option B: Reset with seeds (recommended for dev)
│                     └─ NO  ──► Option A: Migrations only (clean schema)
│
└─ NO — Schema already exists, do you need to load seed data?
          ├─ YES ──► Option C: Load seeds only
          └─ NO  ──► Option E: Apply pending migrations (non-destructive)
```

---

### Option A — Apply All Migrations (Fresh Schema, No Data)

**When:** New machine, no existing data, no demo data needed.
**Effect:** Destroys any existing local data. Replays all migrations in `supabase/migrations/`.

```powershell
cd f:\jhapp\cleanmatex
supabase db reset
```

> **CAUTION:** `supabase db reset` destroys all data in the local database. Never run this against a remote database.

After this you have a clean schema with no tenant data. Use Option C to load demo data if needed.

---

### Option B — Reset with Seeds (Fresh Schema + Demo Data)

**When:** New machine, want a fully working dev environment with demo tenants and users.
**Effect:** Destroys any existing local data, replays all migrations, loads lookup tables and demo tenant data, creates demo admin users.

```powershell
cd f:\jhapp\cleanmatex
.\scripts\db\reset-with-seeds.ps1
```

**Options:**

```powershell
# Full reset with both demo tenants (default)
.\scripts\db\reset-with-seeds.ps1

# Skip confirmation prompt (for automation)
.\scripts\db\reset-with-seeds.ps1 -SkipConfirm

# Load only Demo Tenant 1
.\scripts\db\reset-with-seeds.ps1 -Tenant1Only

# Load only Demo Tenant 2
.\scripts\db\reset-with-seeds.ps1 -Tenant2Only
```

**What it does (3 steps internally):**
1. Calls `reset-production.ps1` — resets schema via `supabase db reset`
2. Calls `load-seeds.ps1` — loads lookup tables and demo tenant data via `psql`
3. Runs `create-demo-admins.js` — creates auth users for demo tenants

**Demo credentials after reset:**

| Tenant | Email | Password |
|---|---|---|
| Demo Laundry LLC | admin@demo-laundry.example | Admin123 |
| BlueWave Laundry Co. | admin@bluewave.example | Admin123 |

---

### Option C — Load Seeds Only (Schema Already Exists)

**When:** Schema is already set up, you just need demo/lookup data loaded.
**Effect:** Non-destructive — adds data without touching the schema.

```powershell
cd f:\jhapp\cleanmatex
.\scripts\db\load-seeds.ps1
```

**Options:**

```powershell
# Load all lookup tables + both demo tenants
.\scripts\db\load-seeds.ps1

# Load all + automatically create admin users
.\scripts\db\load-seeds.ps1 -AutoCreateAdmins

# Load only Demo Tenant 1
.\scripts\db\load-seeds.ps1 -Tenant1Only

# Load only Demo Tenant 2
.\scripts\db\load-seeds.ps1 -Tenant2Only

# Skip lookup tables (if already loaded)
.\scripts\db\load-seeds.ps1 -SkipLookups
```

**Requires:** `psql` in PATH (see Step 1.4).

---

### Option D — Restore from a Remote DB Dump

**When:** You have access to the remote (staging/production) Supabase database and want to clone it locally.

#### Step D1 — Create a dump from the remote database

```powershell
# Get the remote DB connection string from your team lead or Supabase dashboard
# Then dump the schema + data:
pg_dump "<remote-connection-string>" `
  --no-owner `
  --no-acl `
  --format=plain `
  --file=".\supabase\dumps\remote_dump.sql"
```

For Supabase remote, the connection string is in the Supabase dashboard under:
Project Settings → Database → Connection string → URI

#### Step D2 — Restore the dump to your local database

```powershell
# Ensure Supabase is running first (Step 3)
# Then restore:
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" `
  --file=".\supabase\dumps\remote_dump.sql"
```

#### Step D3 — Verify

```powershell
# Open Studio and check tables are populated
Start-Process "http://127.0.0.1:54323"
```

> **NOTE:** Remote dumps may include RLS policies that reference production JWT claims. Test thoroughly after restore. Auth users from the remote dump will not have local passwords — create new local users via Supabase Studio.

---

### Option E — Restore from a .sql Dump File

**When:** A teammate has given you a `.sql` dump file.

```powershell
# Ensure Supabase is running first (Step 3)
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" `
  --file="path\to\dump_file.sql"
```

For `.dump` (custom format) files:

```powershell
pg_restore `
  --dbname="postgresql://postgres:postgres@127.0.0.1:54322/postgres" `
  --no-owner `
  --no-acl `
  "path\to\dump_file.dump"
```

---

### Option F — Apply Pending Migrations Only (Non-Destructive)

**When:** You already have a working database and only need to apply new migrations added since your last pull.
**Effect:** Adds new schema objects only. Does not destroy existing data.

```powershell
cd f:\jhapp\cleanmatex
supabase db push
```

> **NOTE:** `supabase db push` applies migrations that have not yet been applied, without resetting. Use this for day-to-day schema updates after pulling new code.

---

### After Any Database Setup — Regenerate Types

Whenever the schema changes (any of the above options), regenerate the TypeScript types so the codebase stays in sync:

```powershell
cd f:\jhapp\cleanmatex

# Regenerate Supabase types
supabase gen types typescript --local > web-admin/lib/types/supabase.ts

# Regenerate Prisma client
cd web-admin
npm run prisma:pull
npm run prisma:generate
```

---

## 7. Step 5 — Verify Health (Smoke Test)

After services start and the database is set up, run the smoke test to confirm every service is reachable:

```powershell
.\scripts\smoke-test.ps1
```

**What it tests:**

| Test | Method |
|---|---|
| Supabase API (54321) | HTTP GET `/rest/v1/` — expects non-5xx |
| Supabase DB (54322) | TCP port connect |
| Supabase Studio (54323) | HTTP GET `/` — expects 200 |
| Redis (6379) | `docker exec cmx-redis redis-cli ping` — expects PONG |
| Redis Commander (8081) | HTTP GET `/` — expects 200 |
| MinIO API (9000) | HTTP GET `/minio/health/live` — expects 200 |
| MinIO Console (9001) | HTTP GET `/` — expects non-5xx |
| Docker Network | `docker network inspect cleanmatex_cmx-network` |

All 8 tests must pass before starting development.

---

## 8. Step 6 — Start the Web Application

Infrastructure services do not include the application server. Start it separately:

```powershell
cd f:\jhapp\cleanmatex\web-admin
npm run dev
```

The app is available at `http://localhost:3000`.

**Important:** Run `npm run build` after any frontend change and fix all errors before committing. The dev server does not catch all errors that the build catches.

---

## 9. Daily Dev Workflow

### Starting a new session

```powershell
# 1. Start infrastructure (from project root)
.\scripts\dev\start-services.ps1

# 2. If new migrations were pulled, apply them
supabase db push

# 3. Regenerate types if schema changed
supabase gen types typescript --local > web-admin/lib/types/supabase.ts
cd web-admin; npm run prisma:generate; cd ..

# 4. Optional: verify health
.\scripts\smoke-test.ps1

# 5. Start web admin
cd web-admin; npm run dev
```

### Checking what is running

```powershell
.\scripts\dev\status-services.ps1
```

### Restarting services (after config changes or unclean state)

```powershell
.\scripts\dev\restart-services.ps1
```

### Stopping at end of session

```powershell
.\scripts\dev\stop-services.ps1
```

---

## 10. Service Reference

### Supabase Stack

| Service | Port | URL | Purpose |
|---|---|---|---|
| Supabase API (PostgREST + Auth gateway) | 54321 | http://127.0.0.1:54321 | REST API, auth, realtime |
| PostgreSQL 17 | 54322 | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` | Primary database |
| Supabase Studio | 54323 | http://127.0.0.1:54323 | DB management UI |
| Mailpit (email testing) | 54324 | http://127.0.0.1:54324 | Catches all outgoing emails |

### Docker Compose Stack

| Service | Port | URL | Credentials |
|---|---|---|---|
| Redis | 6379 | `redis://127.0.0.1:6379` | None |
| Redis Commander | 8081 | http://127.0.0.1:8081 | None |
| MinIO API | 9000 | http://127.0.0.1:9000 | minioadmin / minioadmin123 |
| MinIO Console | 9001 | http://127.0.0.1:9001 | minioadmin / minioadmin123 |

### Application Layer

| Service | Port | URL | Start command |
|---|---|---|---|
| Web Admin (Next.js) | 3000 | http://localhost:3000 | `cd web-admin && npm run dev` |
| Backend API (NestJS) | 3001 | http://localhost:3001 | `cd cmx-api && npm run start:dev` [Phase 2] |

### Resource Usage (typical, Windows)

| Service Group | Memory | Notes |
|---|---|---|
| Supabase stack | ~1.5 – 2 GB | Includes 10+ internal containers |
| Docker Compose (Redis + MinIO) | ~150 MB | Lightweight |
| Web Admin dev server | ~300 MB | Higher during hot reload |
| **Total** | **~2 – 2.5 GB** | Docker Desktop needs 6 GB allocated |

---

## 11. Connection Strings and Env Vars

### `web-admin/.env.local`

```env
# Supabase — client-side (RLS enforced, anon key)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from: supabase status>

# Supabase — server-side (direct DB for Prisma)
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Supabase — service role (bypasses RLS, server only)
SUPABASE_SERVICE_ROLE_KEY=<from: supabase status>

# Redis
REDIS_URL=redis://127.0.0.1:6379

# MinIO (S3-compatible)
S3_ENDPOINT=http://127.0.0.1:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=cleanmatex-dev
```

Get current Supabase keys at any time:

```powershell
supabase status
```

---

## 12. Script Reference

All scripts live under `scripts/`. Run them from the **project root** (`f:\jhapp\cleanmatex`).

### Infrastructure Scripts

| Script | Purpose | When to use |
|---|---|---|
| [scripts/dev/check-prerequisites.ps1](../../scripts/dev/check-prerequisites.ps1) | Validates machine readiness | First time on a new machine |
| [scripts/dev/start-services.ps1](../../scripts/dev/start-services.ps1) | Starts Supabase + Docker Compose | Start of every dev session |
| [scripts/dev/stop-services.ps1](../../scripts/dev/stop-services.ps1) | Stops all services cleanly | End of dev session |
| [scripts/dev/restart-services.ps1](../../scripts/dev/restart-services.ps1) | Stop then start in one command | After config changes or unclean state |
| [scripts/dev/status-services.ps1](../../scripts/dev/status-services.ps1) | Shows Supabase status, Docker ps, port reachability | Any time you want to see what is running |
| [scripts/smoke-test.ps1](../../scripts/smoke-test.ps1) | HTTP + TCP health checks against all 8 services | After start, before beginning development |

### Database Scripts

| Script | Purpose | Destructive? |
|---|---|---|
| [scripts/db/reset-with-seeds.ps1](../../scripts/db/reset-with-seeds.ps1) | Full reset: schema + lookup data + demo tenants + admin users | YES — destroys all local data |
| [scripts/db/reset-production.ps1](../../scripts/db/reset-production.ps1) | Schema-only reset: no demo data | YES — destroys all local data |
| [scripts/db/load-seeds.ps1](../../scripts/db/load-seeds.ps1) | Loads lookup tables and demo tenant data into existing schema | NO |
| `supabase db reset` | Replays all migrations from scratch | YES — destroys all local data |
| `supabase db push` | Applies pending migrations only | NO |

### Script Interaction Diagram

```
New machine
    └─► check-prerequisites.ps1      fix any [FAIL] items first
            └─► start-services.ps1
                    └─► reset-with-seeds.ps1   (Option B — fresh + demo data)
                            OR
                    └─► supabase db reset       (Option A — clean schema only)
                            OR
                    └─► psql restore            (Option D/E — from dump)
                            └─► smoke-test.ps1
                                    └─► cd web-admin && npm run dev

New migrations pulled
    └─► start-services.ps1
            └─► supabase db push               (Option F — non-destructive)
                    └─► regenerate types
                            └─► npm run dev

Daily start (no schema changes)
    └─► start-services.ps1
            └─► (optional) smoke-test.ps1
                    └─► npm run dev

Something wrong?
    └─► status-services.ps1          see what is up or down
    └─► restart-services.ps1         full stop + start cycle

End of session
    └─► stop-services.ps1
```

---

## 13. Troubleshooting

### `supabase` not found in PATH after install

Scoop adds its shims folder to the PATH of the session that ran the installer only — not to the permanent User PATH. New terminals (including VS Code integrated terminal) will not find `supabase` until you fix this.

**Fix permanently** (run once, then restart terminal):

```powershell
[System.Environment]::SetEnvironmentVariable(
    "PATH",
    "$env:USERPROFILE\scoop\shims;" + [System.Environment]::GetEnvironmentVariable("PATH", "User"),
    "User"
)
```

**Fix for current session only** (immediate, no restart needed):

```powershell
$env:PATH = "$env:USERPROFILE\scoop\shims;$env:PATH"
```

Verify Scoop shims are in PATH:

```powershell
$env:PATH -split ';' | Where-Object { $_ -like '*scoop*' }
# Should show: C:\Users\<you>\scoop\shims
```

After the permanent fix, close and reopen the terminal, then verify:

```powershell
supabase --version
```

### `npm install -g supabase` fails

This is expected. Supabase CLI explicitly blocks global npm install with:
`Installing Supabase CLI as a global module is not supported.`

Use Scoop instead — see Step 1.2 above.

### `supabase start` fails silently

The start script surfaces the real error. If it still fails, run directly:

```powershell
cd f:\jhapp\cleanmatex
supabase start
```

Common causes:

| Symptom | Cause | Fix |
|---|---|---|
| "containers failed to start" | Docker not running | Start Docker Desktop |
| Timeout / hangs | Docker memory too low | Set to 6+ GB in Docker Desktop > Settings > Resources |
| "port already in use" | Port conflict | See port conflict section below |
| "config.toml not found" | Wrong working directory | `cd f:\jhapp\cleanmatex` first |

### Port conflicts

```powershell
# Find what is occupying a port (example: 54322)
netstat -ano | findstr ":54322"
# Returns: TCP  0.0.0.0:54322  ...  LISTENING  <PID>

Get-Process -Id <PID>       # identify the process
taskkill /PID <PID> /F      # kill if safe to do so
```

### `supabase db reset` fails

```powershell
# Check for syntax errors in the failing migration
supabase db reset --debug

# Check which migration is failing from the output, then inspect it
# Migrations live in: supabase/migrations/
```

Never modify existing migration files. Create a new migration to fix the issue.

### `load-seeds.ps1` fails with "psql not found"

`psql` is not installed or not in PATH. Install it (see Step 1.4) and restart your terminal.

### `load-seeds.ps1` fails with "Cannot connect to PostgreSQL"

Supabase is not running. Run `.\scripts\dev\start-services.ps1` first.

### Supabase is running but smoke tests fail

```powershell
supabase status
supabase logs --follow
supabase stop
supabase start
```

### Docker Compose services fail

```powershell
docker compose ps
docker compose logs redis
docker compose logs minio
docker compose down
docker compose up -d redis redis-commander minio
```

### `web-admin/.env.local` is missing

```powershell
supabase start
supabase status   # copy the keys from here
# Create web-admin/.env.local with those values
```

### TypeScript errors after a migration

```powershell
cd f:\jhapp\cleanmatex
supabase gen types typescript --local > web-admin/lib/types/supabase.ts
cd web-admin
npm run prisma:pull
npm run prisma:generate
```

### Port conflict table

| Port | Service | Conflict if occupied by |
|---|---|---|
| 54321 | Supabase API | Another Supabase instance |
| 54322 | Supabase DB | Any PostgreSQL instance |
| 54323 | Supabase Studio | Any web server |
| 6379 | Redis | Another Redis instance |
| 8081 | Redis Commander | Any web server |
| 9000 | MinIO API | Any S3-compatible service |
| 9001 | MinIO Console | Any web server |
| 3000 | Web Admin | Any Next.js or dev server |

---

## 14. Emergency Procedures

### Restart all services from scratch (keeps your data)

```powershell
cd f:\jhapp\cleanmatex
.\scripts\dev\stop-services.ps1
.\scripts\dev\start-services.ps1
```

### Wipe and rebuild everything (destroys all local data)

```powershell
cd f:\jhapp\cleanmatex
.\scripts\dev\stop-services.ps1
docker compose down -v           # removes Redis and MinIO volumes
supabase stop --no-backup        # removes Supabase volumes
supabase start
.\scripts\db\reset-with-seeds.ps1
.\scripts\dev\start-services.ps1
.\scripts\smoke-test.ps1
```

### Create a local dump for sharing

```powershell
# Dump schema + data (shareable with teammates)
pg_dump "postgresql://postgres:postgres@127.0.0.1:54322/postgres" `
  --no-owner --no-acl --format=plain `
  --file=".\supabase\dumps\local_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
```

### Check Docker resource usage in real time

```powershell
docker stats
```

### Find and kill a process occupying a port

```powershell
$p = (netstat -ano | findstr ":54322" | Where-Object { $_ -match "LISTENING" }).Trim().Split()[-1]
taskkill /PID $p /F
```

---

## Related Documentation

- [SERVICES_REFERENCE.md](./SERVICES_REFERENCE.md) — detailed per-service connection strings and configuration
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — extended troubleshooting for DB, auth, and Prisma issues
- [QUICK_START.md](./QUICK_START.md) — condensed daily workflow reference
- [scripts/db/README.md](../../scripts/db/README.md) — database script usage rules and guardrails
- [supabase/config.toml](../../supabase/config.toml) — Supabase port and feature configuration
- [docker-compose.yml](../../docker-compose.yml) — Docker Compose service definitions

---

*For architecture decisions and multi-tenant rules, see `CLAUDE.md` and `.claude/skills/`.*
