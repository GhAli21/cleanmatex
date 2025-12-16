# CleanMateX - Troubleshooting Guide

Comprehensive troubleshooting guide for common issues in CleanMateX development.

## 📋 Table of Contents

- [Docker Issues](#docker-issues)
- [Database Issues](#database-issues)
- [Supabase Issues](#supabase-issues)
- [Redis Issues](#redis-issues)
- [MinIO Issues](#minio-issues)
- [Network Issues](#network-issues)
- [Performance Issues](#performance-issues)
- [Windows-Specific Issues](#windows-specific-issues)

---

## Docker Issues

### Docker Desktop Won't Start

**Symptoms:**

- Docker Desktop icon shows error
- `docker` commands fail
- "Docker daemon is not running" error

**Solutions:**

1. **Restart Docker Desktop**

   - Right-click Docker Desktop tray icon
   - Select "Restart Docker"

2. **Check WSL2 (Windows)**

   ```powershell
   wsl --status
   wsl --update
   ```

3. **Reset Docker Desktop**

   - Settings → Troubleshoot → Reset to factory defaults
   - ⚠️ Warning: This removes all containers and images

4. **Check System Requirements**
   - Windows 10/11 Pro or Enterprise
   - Hyper-V enabled
   - Virtualization enabled in BIOS

### Port Already in Use

**Symptoms:**

- Error: "Bind for 0.0.0.0:5432 failed: port is already allocated"

**Solutions:**

1. **Find Process Using Port (Windows)**

   ```powershell
   netstat -ano | findstr :5432
   taskkill /PID <process_id> /F
   ```

2. **Find Process Using Port (Linux/Mac)**

   ```bash
   lsof -i :5432
   kill -9 <process_id>
   ```

3. **Change Port**
   Edit `docker-compose.yml`:
   ```yaml
   ports:
     - "5433:5432" # Use different host port
   ```

### Container Won't Start

**Symptoms:**

- Container status is "Exited"
- Health check fails

**Solutions:**

1. **Check Logs**

   ```bash
   docker-compose logs <service-name>
   docker-compose logs postgres
   ```

2. **Inspect Container**

   ```bash
   docker inspect <container-name>
   docker exec -it <container-name> sh
   ```

3. **Remove and Recreate**

   ```bash
   docker-compose down
   docker-compose up -d
   ```

4. **Check Disk Space**
   ```bash
   docker system df
   docker system prune  # Clean up unused resources
   ```

### Docker Compose Version Issues

**Symptoms:**

- "version is obsolete" warning
- Unknown syntax errors

**Solutions:**

1. **Update Docker Compose**

   ```bash
   # Check version
   docker-compose --version

   # Update (if needed)
   # Windows: Update Docker Desktop
   # Linux:
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

2. **Use Compatible Version**
   Update `docker-compose.yml`:
   ```yaml
   version: "3.8" # Compatible with most Docker versions
   ```

---

## Database Issues

### PostgreSQL Won't Start

**Symptoms:**

- Container exits immediately
- "database system was shut down" in logs

**Solutions:**

1. **Check Logs**

   ```bash
   docker-compose logs postgres
   ```

2. **Corrupted Data Volume**

   ```bash
   docker-compose down
   docker volume rm cleanmatex_postgres_data
   docker-compose up -d postgres
   ```

   ⚠️ Warning: This deletes all database data!

3. **Permission Issues**
   ```bash
   docker exec -it cmx-postgres ls -la /var/lib/postgresql/data
   docker exec -it cmx-postgres chown -R postgres:postgres /var/lib/postgresql/data
   ```

### Can't Connect to Database

**Symptoms:**

- "Connection refused"
- "password authentication failed"
- Timeout errors

**Solutions:**

1. **Verify Container is Running**

   ```bash
   docker-compose ps
   docker exec cmx-postgres pg_isready -U cmx_user
   ```

2. **Check Connection String**

   ```bash
   # Should be:
   DATABASE_URL=postgresql://cmx_user:cmx_pass_dev@localhost:5432/cmx_db

   # Not:
   DATABASE_URL=postgresql://cmx_user:cmx_pass_dev@cmx-postgres:5432/cmx_db
   # (use 'localhost' from host, 'cmx-postgres' only inside Docker network)
   ```

3. **Test Connection**

   ```bash
   psql postgresql://cmx_user:cmx_pass_dev@localhost:5432/cmx_db

   # Or via Docker
   docker exec -it cmx-postgres psql -U cmx_user -d cmx_db
   ```

4. **Check Firewall**
   - Windows: Allow PostgreSQL through Windows Firewall
   - Linux: Check iptables rules

### Migration Fails

**Symptoms:**

- "relation already exists"
- "column does not exist"
- Migration hangs

**Solutions:**

1. **Reset Database**

   ```bash
   cd supabase
   supabase db reset
   ```

2. **Manual Rollback**

   ```bash
   # Connect to database
   psql $DATABASE_URL

   # Check migration status
   SELECT * FROM supabase_migrations.schema_migrations;

   # Manually drop problematic objects
   DROP TABLE IF EXISTS problem_table CASCADE;
   ```

3. **Fix Migration File**

   - Edit migration in `supabase/migrations/`
   - Add `IF NOT EXISTS` clauses
   - Use transactions

4. **Check Migration Order**
   - Migrations run alphabetically
   - Ensure dependencies are met

### Database is Slow

**Symptoms:**

- Queries take too long
- High CPU usage
- Connection pool exhausted

**Solutions:**

1. **Check Active Connections**

   ```sql
   SELECT count(*), state
   FROM pg_stat_activity
   WHERE datname = 'cmx_db'
   GROUP BY state;
   ```

2. **Kill Idle Connections**

   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE datname = 'cmx_db'
   AND state = 'idle'
   AND state_change < NOW() - INTERVAL '5 minutes';
   ```

3. **Analyze Tables**

   ```sql
   ANALYZE VERBOSE;
   VACUUM ANALYZE;
   ```

4. **Check Slow Queries**

   ```sql
   SELECT query, mean_exec_time, calls
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

5. **Increase Resources**
   Edit `docker-compose.yml`:
   ```yaml
   postgres:
     deploy:
       resources:
         limits:
           memory: 2G
   ```

---

## Supabase Issues

### Supabase Won't Start

**Symptoms:**

- `supabase start` fails
- "port already in use"
- "Docker daemon error"

**Solutions:**

1. **Check Docker**

   ```bash
   docker info
   ```

2. **Stop Existing Instance**

   ```bash
   supabase stop
   ```

3. **Check Ports**
   Supabase uses ports: 54321-54327

   ```bash
   # Windows
   netstat -ano | findstr :54321

   # Linux/Mac
   lsof -i :54321
   ```

4. **Clean Up**

   ```bash
   supabase stop --no-backup
   docker system prune -a
   supabase start
   ```

5. **Update Supabase CLI**
   ```bash
   npm update -g supabase
   supabase --version
   ```

### Supabase Studio Not Loading

**Symptoms:**

- http://localhost:54323 shows error
- "Failed to fetch" errors

**Solutions:**

1. **Check Status**

   ```bash
   supabase status
   ```

2. **Restart Supabase**

   ```bash
   supabase stop
   supabase start
   ```

3. **Clear Browser Cache**

   - Hard refresh: Ctrl+Shift+R
   - Clear localStorage
   - Try incognito mode

4. **Check API URL**
   In `supabase/config.toml`:
   ```toml
   [studio]
   enabled = true
   port = 54323
   api_url = "http://127.0.0.1"
   ```

### Auth Not Working

**Symptoms:**

- Can't sign in
- Token errors
- "Invalid JWT"

**Solutions:**

1. **Check JWT Secret**
   Get from `supabase status`:

   ```bash
   supabase status
   # Copy JWT secret to .env
   ```

2. **Verify Anon Key**

   ```bash
   # In .env
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase status>
   ```

3. **Check Site URL**
   In `supabase/config.toml`:

   ```toml
   [auth]
   site_url = "http://127.0.0.1:3000"
   additional_redirect_urls = ["http://localhost:3000"]
   ```

4. **Email Confirmations**
   For development:

   ```toml
   [auth.email]
   enable_confirmations = false
   ```

5. **View Test Emails**
   - Go to http://localhost:54324 (Inbucket)
   - All emails sent by Supabase appear here

---

## Redis Issues

### Redis Won't Start

**Symptoms:**

- Container exits
- Health check fails

**Solutions:**

1. **Check Logs**

   ```bash
   docker-compose logs redis
   ```

2. **Permission Issues**

   ```bash
   docker exec -it cmx-redis ls -la /data
   docker exec -it cmx-redis chown -R redis:redis /data
   ```

3. **Corrupted AOF File**

   ```bash
   docker exec -it cmx-redis redis-check-aof --fix /data/appendonly.aof
   docker-compose restart redis
   ```

4. **Remove Volume**
   ```bash
   docker-compose down
   docker volume rm cleanmatex_redis_data
   docker-compose up -d redis
   ```

### Can't Connect to Redis

**Symptoms:**

- "Connection refused"
- Timeout errors

**Solutions:**

1. **Test Connection**

   ```bash
   docker exec -it cmx-redis redis-cli ping
   # Should return: PONG
   ```

2. **Check URL**

   ```bash
   # In .env
   REDIS_URL=redis://localhost:6379
   ```

3. **Test from Host**
   ```bash
   # Install redis-cli locally or use Docker
   docker run --rm -it --network=cmx-network redis redis-cli -h redis ping
   ```

### Redis Memory Issues

**Symptoms:**

- "Out of memory" errors
- Redis crashes

**Solutions:**

1. **Check Memory Usage**

   ```bash
   docker exec -it cmx-redis redis-cli INFO memory
   ```

2. **Clear Cache**

   ```bash
   docker exec -it cmx-redis redis-cli FLUSHALL
   ```

3. **Increase Memory Limit**
   Edit `docker-compose.yml`:
   ```yaml
   redis:
     command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
   ```

---

## MinIO Issues

### MinIO Won't Start

**Symptoms:**

- Container exits
- Can't access console

**Solutions:**

1. **Check Logs**

   ```bash
   docker-compose logs minio
   ```

2. **Verify Credentials**

   ```bash
   # In docker-compose.yml
   MINIO_ROOT_USER: minioadmin
   MINIO_ROOT_PASSWORD: minioadmin123
   ```

3. **Test Access**
   ```bash
   curl http://localhost:9000/minio/health/live
   # Should return: 200 OK
   ```

### Can't Upload Files

**Symptoms:**

- "Access Denied"
- "Bucket does not exist"

**Solutions:**

1. **Create Bucket**

   - Go to http://localhost:9001
   - Login: minioadmin / minioadmin123
   - Create bucket: `cleanmatex-dev`

2. **Set Bucket Policy**

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": { "AWS": ["*"] },
         "Action": ["s3:GetObject"],
         "Resource": ["arn:aws:s3:::cleanmatex-dev/*"]
       }
     ]
   }
   ```

3. **Check Credentials in Code**
   ```typescript
   const s3Client = new S3Client({
     endpoint: "http://localhost:9000",
     region: "us-east-1",
     credentials: {
       accessKeyId: "minioadmin",
       secretAccessKey: "minioadmin123",
     },
     forcePathStyle: true,
   });
   ```

---

## Network Issues

### Services Can't Communicate

**Symptoms:**

- Backend can't connect to database
- CORS errors

**Solutions:**

1. **Check Docker Network**

   ```bash
   docker network inspect cmx-network
   ```

2. **Use Service Names**
   Inside Docker containers, use service names:

   ```bash
   # Good (inside container)
   DATABASE_URL=postgresql://cmx_user:cmx_pass_dev@postgres:5432/cmx_db

   # Good (from host)
   DATABASE_URL=postgresql://cmx_user:cmx_pass_dev@localhost:5432/cmx_db
   ```

3. **Recreate Network**
   ```bash
   docker-compose down
   docker network rm cmx-network
   docker-compose up -d
   ```

### CORS Errors

**Symptoms:**

- "CORS policy blocked"
- Cross-origin errors in browser

**Solutions:**

1. **Check CORS Settings**
   In `.env`:

   ```bash
   CORS_ORIGINS=http://localhost:3000,http://localhost:3001
   ```

2. **Supabase CORS**
   Supabase handles CORS automatically for local development

3. **Backend CORS**
   ```typescript
   // In NestJS
   app.enableCors({
     origin: process.env.CORS_ORIGINS.split(","),
     credentials: true,
   });
   ```

---

## Performance Issues

### Slow Docker on Windows

**Solutions:**

1. **Enable WSL2**

   - Docker Desktop → Settings → General
   - Enable "Use WSL2 based engine"

2. **Move Project to WSL**

   ```bash
   # In WSL
   cd /home/<username>/projects
   git clone <repo>
   ```

3. **Increase Resources**

   - Docker Desktop → Settings → Resources
   - CPU: 4+ cores
   - Memory: 4+ GB
   - Swap: 2GB

4. **Disable Antivirus Scanning**
   - Exclude Docker folders from real-time scanning

### Slow Database Queries

**Solutions:**

1. **Add Indexes**

   ```sql
   CREATE INDEX idx_users_email ON users(email);
   ```

2. **Analyze Query Plan**

   ```sql
   EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
   ```

3. **Connection Pooling**
   Use PgBouncer or configure pool in application

---

## Windows-Specific Issues

### WSL2 Issues

**Solutions:**

1. **Update WSL**

   ```powershell
   wsl --update
   wsl --shutdown
   ```

2. **Check WSL Version**

   ```powershell
   wsl -l -v
   # Should show Version 2
   ```

3. **Set Default Version**
   ```powershell
   wsl --set-default-version 2
   ```

### Path Issues

**Solutions:**

Use forward slashes in scripts:

```bash
# Good
./scripts/dev/start-services.sh

# Bad
.\scripts\dev\start-services.sh
```

Or use PowerShell scripts (`.ps1`)

---

## Still Having Issues?

1. **Check Logs**

   - Docker: `docker-compose logs -f`
   - Supabase: `supabase status`
   - Application: Check console output

2. **Run Smoke Tests**

   ```bash
   ./scripts/smoke-test.sh
   ```

3. **Clean Slate**

   ```bash
   docker-compose down -v
   docker system prune -a
   ./scripts/dev/start-services.sh
   ```

4. **Ask for Help**
   - Check documentation in `/docs`
   - Ask team members
   - Create GitHub issue with:
     - Error message
     - Steps to reproduce
     - Environment details
     - Logs

---

**Last Updated:** 2025-10-10  
**Version:** 1.0  
**Maintained by:** DevOps Team
