# Troubleshooting Guide - CleanMateX Development

> **Last Updated:** 2025-10-17
> **Purpose:** Solutions to common development environment issues

This guide covers common problems and their solutions when working with CleanMateX development environment.

---

## 🚨 Quick Diagnostics

Before diving into specific issues, run these checks:

```powershell
# Check all services
.\scripts\dev\status-services.ps1

# Check Supabase
supabase status

# Check Docker
docker-compose ps
docker info

# Check ports
netstat -ano | findstr "54321 54323 6379 9000"
```

---

## 🔴 Service Startup Issues

### Supabase Won't Start

**Symptoms:**
- `supabase start` hangs or fails
- Error: "containers failed to start"
- Timeout errors

**Solutions:**

1. **Check Docker is running:**
   ```bash
   docker info
   ```
   If error: Start Docker Desktop

2. **Stop and restart:**
   ```bash
   supabase stop
   supabase start
   ```

3. **Check for port conflicts:**
   ```bash
   # Windows
   netstat -ano | findstr "54321 54322 54323 54324"
   ```
   If ports are in use, kill the processes or stop conflicting services

4. **Reset Supabase:**
   ```bash
   supabase stop
   supabase db reset
   ```

5. **Nuclear option - remove all Supabase containers:**
   ```bash
   docker ps -a | grep supabase
   docker rm -f $(docker ps -a | grep supabase | awk '{print $1}')
   supabase start
   ```

---

### Docker Services Won't Start

**Symptoms:**
- `docker-compose up` fails
- "port is already allocated" error
- Container immediately exits

**Solutions:**

1. **Check Docker Desktop is running:**
   - Open Docker Desktop app
   - Wait for "Docker Desktop is running" message

2. **Check for port conflicts:**
   ```bash
   # Check if ports 6379, 9000, 9001, 8081 are in use
   netstat -ano | findstr "6379 9000 9001 8081"
   ```

3. **Remove old containers:**
   ```bash
   docker-compose down -v
   docker-compose up -d redis redis-commander minio
   ```

4. **Check docker-compose.yml:**
   - Ensure file exists in project root
   - Verify no syntax errors
   - Only redis, minio, redis-commander services (no postgres!)

5. **View logs:**
   ```bash
   docker-compose logs -f
   ```

---

### Web Admin Won't Start

**Symptoms:**
- `npm run dev` fails
- Port 3000 already in use
- Build errors

**Solutions:**

1. **Check port 3000:**
   ```bash
   netstat -ano | findstr ":3000"
   # Kill process if found
   taskkill /PID <PID> /F
   ```

2. **Reinstall dependencies:**
   ```bash
   cd web-admin
   rm -rf node_modules
   rm package-lock.json
   npm install
   ```

3. **Check .env file:**
   ```bash
   cd web-admin
   # Ensure .env exists with correct values
   cat .env
   ```

4. **Clear Next.js cache:**
   ```bash
   cd web-admin
   rm -rf .next
   npm run dev
   ```

---

## 🔌 Connection Issues

### "Cannot connect to database" (Prisma)

**Symptoms:**
- Prisma commands fail
- Error: "Can't reach database server"
- Connection timeout

**Solutions:**

1. **Check DATABASE_URL:**
   ```bash
   # web-admin/.env should have:
   DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
   # NOT port 5432!
   ```

2. **Verify Supabase postgres is running:**
   ```bash
   supabase status
   # Look for "DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres"
   ```

3. **Test connection:**
   ```bash
   cd web-admin
   npx tsx scripts/test-prisma-connection.ts
   ```

4. **Re-generate Prisma client:**
   ```bash
   cd web-admin
   npx prisma generate
   ```

---

### "Auth session missing" (Supabase Client)

**Symptoms:**
- User logged in but queries fail
- RLS policies blocking access
- "JWT token invalid"

**Solutions:**

1. **Check Supabase config in .env:**
   ```bash
   # web-admin/.env
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   ```

2. **Get correct keys from Supabase:**
   ```bash
   supabase status
   # Copy anon key from output
   ```

3. **Clear browser storage:**
   - Open DevTools → Application → Storage
   - Clear all storage for localhost:3000

4. **Check RLS policies:**
   - Open Supabase Studio: http://localhost:54323
   - Navigate to Authentication → Policies
   - Verify policies are enabled and correct

---

## ⚠️ Port Conflicts

### Port Already in Use

**Symptoms:**
- "port is already allocated"
- "address already in use"
- Service fails to bind to port

**Common Port Conflicts:**

| Port | Service | How to Check | How to Fix |
|------|---------|--------------|------------|
| 5432 | Old Docker Postgres | `netstat -ano \| findstr :5432` | Stop docker postgres (removed in new setup) |
| 6379 | Redis | `netstat -ano \| findstr :6379` | Stop other Redis instances |
| 9000 | MinIO | `netstat -ano \| findstr :9000` | Stop other S3-compatible services |
| 54321 | Supabase API | `netstat -ano \| findstr :54321` | Stop other Supabase instances |
| 54322 | Supabase DB | `netstat -ano \| findstr :54322` | Stop other PostgreSQL instances |

**Kill Process by Port (Windows):**
```powershell
# Find process
netstat -ano | findstr :PORT_NUMBER

# Kill process (replace <PID> with actual process ID)
taskkill /PID <PID> /F
```

---

## 🗄️ Database Issues

### Migration Fails

**Symptoms:**
- `supabase db reset` fails
- SQL syntax errors
- Foreign key constraint violations

**Solutions:**

1. **Check migration files:**
   ```bash
   ls supabase/migrations/
   # Ensure .sql files are valid
   ```

2. **Run with debug:**
   ```bash
   supabase db reset --debug
   ```

3. **Reset completely:**
   ```bash
   supabase stop
   docker volume ls | grep supabase
   docker volume rm <supabase-volumes>
   supabase start
   supabase db reset
   ```

---

### Prisma Schema Out of Sync

**Symptoms:**
- TypeScript errors about missing fields
- Prisma query fails for existing columns
- "Unknown field" errors

**Solutions:**

1. **Pull latest schema:**
   ```bash
   cd web-admin
   npx prisma db pull
   npx prisma generate
   ```

2. **Check connection:**
   - Verify DATABASE_URL points to port 54322
   - Test: `npx tsx scripts/test-prisma-connection.ts`

3. **Manual schema validation:**
   ```bash
   npx prisma validate
   npx prisma format
   ```

---

### RLS Policies Blocking Queries

**Symptoms:**
- Query returns empty results
- Permission denied errors
- Works in Supabase Studio but not in app

**Solutions:**

1. **Check if RLS is enabled:**
   ```sql
   -- In Supabase Studio SQL Editor
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public';
   ```

2. **View policies:**
   ```sql
   SELECT * FROM pg_policies
   WHERE tablename = 'your_table_name';
   ```

3. **Test with service role:**
   - Use service_role key for testing (bypasses RLS)
   - Check `.env` for `SUPABASE_SERVICE_ROLE_KEY`

4. **Common RLS issues:**
   - Missing `tenant_org_id` in JWT
   - Policy uses wrong JWT claim
   - User not assigned to tenant

---

## 💾 Performance Issues

### Slow Query Performance

**Symptoms:**
- Queries take >1 second
- Page loads slowly
- Database CPU high

**Solutions:**

1. **Check for missing indexes:**
   ```sql
   -- In Supabase Studio
   EXPLAIN ANALYZE your_query_here;
   ```

2. **Common missing indexes:**
   ```sql
   CREATE INDEX idx_orders_tenant ON org_orders_mst(tenant_org_id);
   CREATE INDEX idx_orders_status ON org_orders_mst(tenant_org_id, order_status);
   ```

3. **Check N+1 queries:**
   - Use Prisma's `include` for relations
   - Avoid queries in loops

---

### High Memory Usage

**Symptoms:**
- System slowdown
- Docker uses too much RAM
- Out of memory errors

**Solutions:**

1. **Check resource usage:**
   ```bash
   docker stats
   ```

2. **Restart services:**
   ```powershell
   .\scripts\dev\stop-services.ps1
   .\scripts\dev\start-services.ps1
   ```

3. **Limit Docker resources:**
   - Open Docker Desktop → Settings → Resources
   - Set Memory limit to 4GB (min) or 6GB (recommended)

---

## 🔧 Configuration Issues

### Missing .env File

**Symptoms:**
- App crashes on start
- "Environment variable not found"
- Services can't connect

**Solutions:**

1. **Create .env from template:**
   ```bash
   copy .env.example .env
   # or for web-admin
   cd web-admin
   copy .env.example .env
   ```

2. **Get Supabase keys:**
   ```bash
   supabase status
   # Copy API URL, anon key, service_role key
   ```

3. **Verify DATABASE_URL:**
   ```env
   # Must use port 54322 (Supabase postgres)
   DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
   ```

---

### TypeScript Errors After DB Changes

**Symptoms:**
- Type errors in code
- "Property does not exist" errors
- IntelliSense not working

**Solutions:**

1. **Regenerate types:**
   ```bash
   # Supabase types
   supabase gen types typescript --local > web-admin/types/database.ts

   # Prisma types
   cd web-admin
   npx prisma generate
   ```

2. **Restart TypeScript server:**
   - VS Code: Ctrl+Shift+P → "Restart TypeScript Server"

3. **Clear cache:**
   ```bash
   cd web-admin
   rm -rf .next
   npm run dev
   ```

---

## 🆘 Emergency Fixes

### Nuclear Option - Reset Everything

**⚠️ Warning:** This will delete all local data!

```bash
# Stop all services
.\scripts\dev\stop-services.ps1

# Remove Docker containers and volumes
docker-compose down -v
docker system prune -a --volumes

# Remove Supabase data
supabase stop
# Manually delete: C:\Users\<you>\AppData\Local\supabase

# Restart from scratch
supabase start
docker-compose up -d redis redis-commander minio
supabase db reset

# Regenerate types
cd web-admin
npx prisma db pull
npx prisma generate
npm run dev
```

---

## 📞 Still Having Issues?

### Gather Debug Information

```bash
# System info
docker --version
node --version
npm --version

# Service status
supabase status
docker-compose ps
.\scripts\dev\status-services.ps1

# Logs
supabase logs
docker-compose logs
```

### Check Documentation

- [Quick Start Guide](./QUICK_START.md)
- [Services Reference](./SERVICES_REFERENCE.md)
- [Architecture Overview](../../.claude/docs/architecture.md)
- [Database Conventions](../../.claude/docs/database_conventions.md)

### Common Error Messages

| Error | Likely Cause | Fix |
|-------|--------------|-----|
| "ECONNREFUSED 54322" | Supabase not running | `supabase start` |
| "EADDRINUSE 3000" | Port conflict | Kill process on port 3000 |
| "JWT expired" | Auth session timeout | Re-login |
| "permission denied for table" | RLS blocking | Check RLS policies |
| "relation does not exist" | Migration not applied | `supabase db reset` |
| "P2002 Unique constraint" | Duplicate data | Check your data |

---

**Last Updated:** 2025-10-17
**Need more help?** Check `docs/plan/` for implementation guides or `.claude/docs/` for detailed documentation.
