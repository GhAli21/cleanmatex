# Quick Start Guide - CleanMateX Development

> **Last Updated:** 2025-10-17
> **For:** Daily development workflow

This guide covers starting and stopping all development services for CleanMateX.

---

## 📋 Prerequisites

Before starting, ensure you have:

- ✅ **Docker Desktop** installed and running
- ✅ **Supabase CLI** installed (`npm i -g supabase`)
- ✅ **Node.js 20+** installed
- ✅ **Git** for version control

### First-Time Setup Only

```bash
# 1. Clone and navigate to project
cd f:/jhapp/cleanmatex

# 2. Create .env file
copy .env.example .env

# 3. Install web-admin dependencies
cd web-admin
npm install

# 4. Initialize Supabase (first time only)
cd ..
supabase init

# 5. Run initial migrations
supabase db reset
```

---

## 🚀 Daily Startup (Automated)

### Option 1: One-Command Startup (Recommended)

```powershell
# From project root
.\scripts\dev\start-services.ps1
```

This script will:
1. ✅ Start Supabase Local (10 containers including PostgreSQL on port 54322)
2. ✅ Start Docker services (Redis, MinIO, Redis Commander)
3. ✅ Verify all services are healthy
4. ✅ Display service URLs and next steps

Expected output:
```
========================================
  ✓ All Services Started Successfully!
========================================

📍 Service URLs:
  Supabase Studio:    http://localhost:54323
  Supabase API:       http://localhost:54321
  Redis Commander:    http://localhost:8081
  MinIO Console:      http://localhost:9001

📦 Next Steps:
  1. cd web-admin
  2. npm run dev
  3. Open http://localhost:3000
```

### Start Web Admin

```bash
# In a new terminal
cd web-admin
npm run dev
```

Visit: [http://localhost:3000](http://localhost:3000)

---

## 🛠️ Manual Startup (Step-by-Step)

If you prefer manual control:

### Step 1: Start Supabase Local

```bash
# Start all Supabase services
supabase start

# Check status
supabase status
```

### Step 2: Start Docker Services

```bash
# Start Redis, MinIO, and Redis Commander
docker-compose up -d redis redis-commander minio

# Verify containers
docker-compose ps
```

### Step 3: Start Web Admin

```bash
cd web-admin
npm run dev
```

---

## 🛑 Stopping Services

### Option 1: Automated Shutdown

```powershell
.\scripts\dev\stop-services.ps1
```

### Option 2: Manual Shutdown

```bash
# Stop Docker services
docker-compose down

# Stop Supabase
supabase stop
```

---

## 📊 Check Service Status

```powershell
# Run status check script
.\scripts\dev\status-services.ps1
```

Or manually:

```bash
# Supabase status
supabase status

# Docker status
docker-compose ps

# Check specific port
curl http://localhost:54321
```

---

## 🌐 Service URLs & Ports

| Service | Port | URL | Credentials |
|---------|------|-----|-------------|
| **Supabase Studio** | 54323 | http://localhost:54323 | - |
| **Supabase API** | 54321 | http://localhost:54321 | - |
| **Supabase DB** | 54322 | postgresql://postgres:postgres@localhost:54322/postgres | - |
| **Mailpit (emails)** | 54324 | http://localhost:54324 | - |
| **Web Admin** | 3000 | http://localhost:3000 | - |
| **Redis** | 6379 | - | - |
| **Redis Commander** | 8081 | http://localhost:8081 | - |
| **MinIO API** | 9000 | http://localhost:9000 | - |
| **MinIO Console** | 9001 | http://localhost:9001 | minioadmin / minioadmin123 |

---

## 🔄 Working with Prisma

Prisma is a **library**, not a service. Use these commands from `web-admin/`:

```bash
cd web-admin

# After running Supabase migrations
npx prisma db pull          # Sync schema from database
npx prisma generate         # Generate TypeScript types

# Database tools
npx prisma studio           # Visual database browser
npx prisma format           # Format schema.prisma
npx prisma validate         # Validate schema

# Test connection
npx tsx scripts/test-prisma-connection.ts
```

### Typical Workflow After Schema Changes

```bash
# 1. Create Supabase migration
supabase migration new add_new_feature

# 2. Edit SQL file in supabase/migrations/

# 3. Apply migration
supabase db reset

# 4. Sync Prisma schema
cd web-admin
npx prisma db pull
npx prisma generate
```

---

## 🐛 Troubleshooting

### Port Already in Use

If you see "port already in use" errors:

```bash
# Check what's using the port (Windows)
netstat -ano | findstr :54321

# Kill process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### Supabase Won't Start

```bash
# Stop and restart
supabase stop
supabase start

# Check logs
supabase logs

# Nuclear option: reset everything
supabase db reset
```

### Docker Services Won't Start

```bash
# Check Docker is running
docker info

# Remove all containers and restart
docker-compose down -v
docker-compose up -d redis redis-commander minio
```

### Prisma Can't Connect

```bash
# Check DATABASE_URL in web-admin/.env
# Should be: postgresql://postgres:postgres@localhost:54322/postgres

# Test connection
cd web-admin
npx tsx scripts/test-prisma-connection.ts
```

For more issues, see: [docs/dev/TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## 💡 Pro Tips

### Run Services in Background

All services run in Docker containers and can run in the background. Just close your terminal - they keep running!

### Multiple Terminal Setup

Recommended terminal layout:

```
Terminal 1: Services (run start script)
Terminal 2: web-admin (npm run dev)
Terminal 3: Git / general commands
```

### VS Code Integration

Add to `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start Services",
      "type": "shell",
      "command": ".\\scripts\\dev\\start-services.ps1",
      "problemMatcher": []
    },
    {
      "label": "Start Web Admin",
      "type": "shell",
      "command": "npm run dev",
      "options": {
        "cwd": "${workspaceFolder}/web-admin"
      }
    }
  ]
}
```

---

## 📚 Related Documentation

- [Service Reference](./SERVICES_REFERENCE.md) - Detailed service architecture
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues and solutions
- [Commands Reference](../../.claude/docs/dev_commands.md) - All development commands
- [Architecture Overview](../../.claude/docs/architecture.md) - System design

---

## 🎯 Next Steps

Once services are running:

1. **Explore Supabase Studio**: [http://localhost:54323](http://localhost:54323)
   - View tables, run queries, manage RLS policies

2. **Check Database**: Use Prisma Studio
   ```bash
   cd web-admin
   npx prisma studio
   ```

3. **Start Coding**: Web admin at [http://localhost:3000](http://localhost:3000)

4. **Read the Docs**: Check [CLAUDE.md](../../CLAUDE.md) for project guidelines

---

**Need Help?**
- Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- Review [.claude/docs/](../../.claude/docs/)
- Refer to implementation plans in `docs/plan/`
