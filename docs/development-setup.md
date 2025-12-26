# CleanMateX - Development Setup Guide

Complete guide to setting up your local development environment for CleanMateX.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Service URLs](#service-urls)
- [Common Commands](#common-commands)
- [IDE Setup](#ide-setup)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

1. **Docker Desktop** (version 20.10+)

   - Windows: [Download Docker Desktop](https://www.docker.com/products/docker-desktop)
   - Enable WSL2 backend for better performance
   - Allocate at least 4GB RAM to Docker

2. **Node.js** (version 20+)

   - [Download Node.js](https://nodejs.org/)
   - Verify: `node --version`

3. **Supabase CLI**

   ```bash
   npm install -g supabase
   ```

4. **Git**
   - [Download Git](https://git-scm.com/)

### Recommended Software

- **VS Code** with extensions:

  - Docker
  - Prettier
  - ESLint
  - TypeScript
  - Flutter (for mobile development)

- **Database Client** (choose one):
  - DBeaver
  - pgAdmin
  - TablePlus

---

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd cleanmatex
```

### 2. Setup Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your preferred editor
code .env  # or nano .env
```

### 3. Start Infrastructure Services

**Windows (PowerShell):**

```powershell
.\scripts\dev\start-services.ps1
```

**Linux/Mac:**

```bash
chmod +x scripts/dev/*.sh
./scripts/dev/start-services.sh
```

### 4. Verify Services

```bash
# Windows
.\scripts\smoke-test.ps1

# Linux/Mac
./scripts/smoke-test.sh
```

### 5. Start Application Services

```bash
# Web Admin (Terminal 1)
cd web-admin
npm install
npm run dev

# Backend API (Terminal 2)
cd backend
npm install
npm run dev
```

### 6. Access Applications

- **Web Admin:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **Supabase Studio:** http://localhost:54323

---

## Detailed Setup

### Step 1: Environment Configuration

The `.env` file controls all configuration. Key variables:

#### Database Configuration

```bash
# Direct PostgreSQL connection
DATABASE_URL=postgresql://cmx_user:cmx_pass_dev@localhost:5432/cmx_db
```

#### Supabase Configuration

After running `supabase start`, copy the keys from the output:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-from-supabase-start>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-from-supabase-start>
```

#### Redis Configuration

```bash
REDIS_URL=redis://localhost:6379
REDIS_DB=0
```

#### MinIO (S3) Configuration

```bash
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=cleanmatex-dev
```

### Step 2: Docker Services

Our `docker-compose.yml` includes:

1. **PostgreSQL** - Primary database
2. **Redis** - Caching and queues
3. **MinIO** - S3-compatible storage
4. **Redis Commander** - Redis GUI (optional)

All services include health checks and data persistence.

### Step 3: Supabase Setup

Supabase provides:

- Authentication
- Real-time subscriptions
- Storage
- Auto-generated REST API

```bash
cd supabase

# Start Supabase (first time)
supabase start

# Check status
supabase status

# Reset database (WARNING: deletes all data)
supabase db reset

# Generate TypeScript types
supabase gen types typescript --local > ../web-admin/types/database.ts
```

### Step 4: Database Migrations

Migrations are located in `supabase/migrations/`:

```bash
# Apply migrations
supabase db reset

# Create new migration
supabase migration new <migration-name>

# Push to remote (production)
supabase db push
```

### Step 5: Seed Data

Seed data is in `supabase/seeds/`:

```bash
# Seeds run automatically with db reset
supabase db reset

# Or manually
psql $DATABASE_URL -f supabase/seeds/0001_init.sql
```

---

## Service URLs

### Development Services

| Service          | URL                    | Credentials                |
| ---------------- | ---------------------- | -------------------------- |
| PostgreSQL       | `localhost:5432`       | cmx_user / cmx_pass_dev    |
| Redis            | `localhost:6379`       | (no auth)                  |
| MinIO API        | http://localhost:9000  | minioadmin / minioadmin123 |
| MinIO Console    | http://localhost:9001  | minioadmin / minioadmin123 |
| Redis Commander  | http://localhost:8081  | (no auth)                  |
| Supabase API     | http://localhost:54321 | (use anon key)             |
| Supabase Studio  | http://localhost:54323 | (no auth)                  |
| Inbucket (Email) | http://localhost:54324 | (no auth)                  |

### Application Services

| Service     | URL                            | Description     |
| ----------- | ------------------------------ | --------------- |
| Web Admin   | http://localhost:3000          | Admin dashboard |
| Backend API | http://localhost:3001          | REST API        |
| API Docs    | http://localhost:3001/api/docs | Swagger UI      |

---

## Common Commands

### Infrastructure Management

```bash
# Start all services
npm run services:start    # (add to package.json)

# Stop all services (preserves data)
npm run services:stop

# Reset database
./scripts/dev/reset-db.sh

# Run smoke tests
npm run test:smoke
```

### Docker Commands

```bash
# View running containers
docker-compose ps

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f postgres

# Restart a service
docker-compose restart postgres

# Stop and remove containers (KEEPS volumes)
docker-compose down

# Stop and remove everything INCLUDING DATA
docker-compose down -v
```

### Supabase Commands

```bash
# Start Supabase
cd supabase && supabase start

# Stop Supabase
cd supabase && supabase stop

# View Supabase status
cd supabase && supabase status

# Reset database
cd supabase && supabase db reset

# Create migration
cd supabase && supabase migration new my_migration

# Generate types
cd supabase && supabase gen types typescript --local
```

### Database Commands

```bash
# Connect to PostgreSQL
psql postgresql://cmx_user:cmx_pass_dev@localhost:5432/cmx_db

# Or via Docker
docker exec -it cmx-postgres psql -U cmx_user -d cmx_db

# Backup database
docker exec cmx-postgres pg_dump -U cmx_user cmx_db > backup.sql

# Restore database
docker exec -i cmx-postgres psql -U cmx_user -d cmx_db < backup.sql
```

### Redis Commands

```bash
# Connect to Redis CLI
docker exec -it cmx-redis redis-cli

# Common Redis operations
# SET key value
# GET key
# KEYS *
# FLUSHALL  (clear all data)
```

---

## IDE Setup

### VS Code

1. **Install Extensions**

   - Docker
   - Prettier - Code formatter
   - ESLint
   - TypeScript and JavaScript Language Features

2. **Workspace Settings** (`.vscode/settings.json`)

   ```json
   {
     "editor.formatOnSave": true,
     "editor.defaultFormatter": "esbenp.prettier-vscode",
     "typescript.tsdk": "node_modules/typescript/lib",
     "[typescript]": {
       "editor.defaultFormatter": "esbenp.prettier-vscode"
     }
   }
   ```

3. **Recommended Extensions File** (`.vscode/extensions.json`)
   ```json
   {
     "recommendations": [
       "ms-azuretools.vscode-docker",
       "esbenp.prettier-vscode",
       "dbaeumer.vscode-eslint",
       "bradlc.vscode-tailwindcss"
     ]
   }
   ```

---

## Troubleshooting

### Services Won't Start

**Problem:** Docker Compose fails to start

**Solutions:**

1. Check Docker Desktop is running
2. Check port conflicts: `netstat -ano | findstr :5432`
3. View logs: `docker-compose logs`

### Supabase Won't Start

**Problem:** `supabase start` fails

**Solutions:**

1. Check Docker is running
2. Stop existing Supabase: `supabase stop`
3. Clear Supabase volumes: `docker volume prune`
4. Update Supabase CLI: `npm update -g supabase`

### Database Connection Fails

**Problem:** Can't connect to PostgreSQL

**Solutions:**

1. Verify container is running: `docker-compose ps`
2. Check health: `docker exec cmx-postgres pg_isready -U cmx_user`
3. Verify environment variables in `.env`
4. Check connection string format

### Port Already in Use

**Problem:** Error: "port is already allocated"

**Solutions:**

1. Find process using port: `netstat -ano | findstr :5432`
2. Kill process: `taskkill /PID <pid> /F`
3. Or change port in `docker-compose.yml`

### Slow Performance on Windows

**Solutions:**

1. Enable WSL2 backend in Docker Desktop
2. Increase Docker memory allocation (4GB+)
3. Move project to WSL filesystem
4. Disable antivirus scanning for Docker folders

For more troubleshooting, see [troubleshooting.md](./troubleshooting.md).

---

## Next Steps

After successful setup:

1. **Read the Documentation**

   - [Master Plan](./plan/master_plan_cc_01.md)
   - [Architecture](./Complete%20Project%20Structure%20Documentation_Draft%20suggestion_01.md)

2. **Run Tests**

   ```bash
   npm run test
   ```

3. **Start Development**

   - Pick a module from the plan
   - Create a feature branch
   - Start coding!

4. **Join the Team**
   - Review code standards
   - Check current sprint
   - Assign yourself a task

---

## Support

- **Documentation:** `/docs` folder
- **Issues:** GitHub Issues
- **Team Chat:** [Your chat platform]

---

**Last Updated:** 2025-10-10  
**Version:** 1.0  
**Maintained by:** DevOps Team
