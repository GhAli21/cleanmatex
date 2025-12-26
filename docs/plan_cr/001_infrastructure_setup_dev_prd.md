# Infrastructure Setup - Development Plan & PRD

**Document ID**: 001_infrastructure_setup_dev_prd  
**Version**: 1.0  
**Status**: Ready for Implementation  
**Owner**: DevOps Team  
**Dependencies**: None (Foundation)  
**Related Requirements**: NFR-OBS-001, NFR-AVL-001

---

## 1. Overview & Context

### Purpose

Establish the complete local development infrastructure and production-ready container orchestration setup for CleanMateX. This includes Docker Compose for local development, Supabase configuration, environment management, and basic monitoring setup.

### Business Value

- Enables developers to work efficiently with a consistent environment
- Reduces "works on my machine" issues
- Establishes foundation for scalable production deployment
- Enables rapid onboarding of new team members

### User Personas Affected

- Backend Developers
- Frontend Developers
- Mobile Developers
- DevOps Engineers
- QA Engineers

### Key Use Cases

- UC-DEV-001: Developer sets up local environment in < 30 minutes
- UC-DEV-002: Team member runs full stack locally
- UC-DEV-003: Integration tests run against local services
- UC-DEV-004: Production environment mirrors local setup

---

## 2. Functional Requirements

### FR-INF-001: Local Development Environment

**Description**: Provide Docker Compose configuration for running all services locally

**Acceptance Criteria**:

- Single command starts all required services
- PostgreSQL, Redis, MinIO running and accessible
- Supabase local instance configured
- All services health-checked before ready
- Data persists between restarts
- Clear documentation for setup

### FR-INF-002: Environment Configuration

**Description**: Manage environment variables and secrets securely

**Acceptance Criteria**:

- `.env.example` template provided
- Separate configs for dev, staging, production
- Secrets never committed to git
- Validation of required environment variables
- Clear error messages for missing configs

### FR-INF-003: Supabase Local Setup

**Description**: Configure Supabase for local development

**Acceptance Criteria**:

- Supabase CLI configured
- Local Auth service running
- Local Storage service running
- Local Realtime service running
- Database migrations auto-apply
- Studio UI accessible

### FR-INF-004: Database Management

**Description**: Provide tools for database lifecycle management

**Acceptance Criteria**:

- Connection pooling configured (PgBouncer)
- Migration scripts organized
- Seed data available
- Backup/restore scripts
- Database reset capability

### FR-INF-005: Service Discovery

**Description**: Configure service networking and discovery

**Acceptance Criteria**:

- Services communicate via Docker network
- Predictable service hostnames
- Port mappings documented
- CORS configured for local development

---

## 3. Technical Design

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Developer Machine                                       │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Docker Compose Network (cmx-network)              │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │ │
│  │  │PostgreSQL│  │  Redis   │  │  MinIO   │        │ │
│  │  │  :5432   │  │  :6379   │  │:9000/9001│        │ │
│  │  └──────────┘  └──────────┘  └──────────┘        │ │
│  │  ┌────────────────────────────────────────┐       │ │
│  │  │  Supabase Local (:54321)              │       │ │
│  │  │  - Auth, Storage, Realtime, Studio    │       │ │
│  │  └────────────────────────────────────────┘       │ │
│  │  ┌──────────┐                                     │ │
│  │  │  Redis   │  (Optional: Redis Commander)       │ │
│  │  │Commander │                                     │ │
│  │  │  :8081   │                                     │ │
│  │  └──────────┘                                     │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Host Processes (outside Docker)                   │ │
│  │  - web-admin (Next.js :3000)                      │ │
│  │  - backend (NestJS :3001)                         │ │
│  │  - mobile apps (Flutter devices/emulators)        │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Docker Compose Services

**postgres** (PostgreSQL 16):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: cmx-postgres
    environment:
      POSTGRES_USER: cmx_user
      POSTGRES_PASSWORD: cmx_pass_dev
      POSTGRES_DB: cmx_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infra/postgres/initdb:/docker-entrypoint-initdb.d
    networks:
      - cmx-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cmx_user"]
      interval: 10s
      timeout: 5s
      retries: 5
```

**redis** (Redis 7):

```yaml
redis:
  image: redis:7-alpine
  container_name: cmx-redis
  command: redis-server --appendonly yes
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  networks:
    - cmx-network
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
```

**minio** (S3-compatible storage):

```yaml
minio:
  image: minio/minio:latest
  container_name: cmx-minio
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin123
  ports:
    - "9000:9000"
    - "9001:9001"
  volumes:
    - minio_data:/data
  networks:
    - cmx-network
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
    interval: 30s
    timeout: 20s
    retries: 3
```

**redis-commander** (Optional GUI):

```yaml
redis-commander:
  image: rediscommander/redis-commander:latest
  container_name: cmx-redis-commander
  environment:
    - REDIS_HOSTS=local:redis:6379
  ports:
    - "8081:8081"
  networks:
    - cmx-network
  depends_on:
    - redis
```

### Supabase Configuration

**supabase/config.toml**:

```toml
project_id = "cleanmatex-local"

[api]
enabled = true
port = 54321
schemas = ["public", "storage", "graphql_public"]
extra_search_path = ["public"]
max_rows = 1000

[db]
port = 54322
major_version = 15

[studio]
enabled = true
port = 54323
api_url = "http://localhost:54321"

[inbucket]
enabled = true
port = 54324
smtp_port = 54325
pop3_port = 54326

[storage]
enabled = true
file_size_limit = "50MiB"

[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000/auth/callback"]
jwt_expiry = 3600
enable_signup = true

[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = false
```

### Environment Variables

**.env.example**:

```bash
# Environment
NODE_ENV=development

# Database (Direct PostgreSQL)
DATABASE_URL=postgresql://cmx_user:cmx_pass_dev@localhost:5432/cmx_db
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<get-from-supabase-start>
SUPABASE_SERVICE_ROLE_KEY=<get-from-supabase-start>

# Redis
REDIS_URL=redis://localhost:6379
REDIS_DB=0

# MinIO (S3)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=cleanmatex-dev

# Application
APP_PORT=3001
APP_URL=http://localhost:3001
WEB_ADMIN_URL=http://localhost:3000

# JWT
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=1h

# Feature Flags
ENABLE_ASSEMBLY=true
ENABLE_MARKETPLACE=false
ENABLE_AI_FEATURES=false

# External Services (Optional in dev)
WHATSAPP_API_KEY=
WHATSAPP_PHONE_NUMBER=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
SENDGRID_API_KEY=
STRIPE_SECRET_KEY=
```

---

## 4. Implementation Plan

### Phase 1: Docker Compose Setup (2 days)

**Tasks**:

1. Validate existing `docker-compose.yml` (already present)
2. Add health checks to all services
3. Configure volume persistence
4. Add init scripts for PostgreSQL
5. Document service URLs and credentials
6. Create startup and shutdown scripts

**Files**:

- `docker-compose.yml` (enhance existing)
- `infra/postgres/initdb/001-init.sql`
- `scripts/dev/start-services.sh`
- `scripts/dev/stop-services.sh`
- `scripts/dev/reset-db.sh`

### Phase 2: Supabase Setup (2 days)

**Tasks**:

1. Install Supabase CLI
2. Initialize Supabase project
3. Configure `supabase/config.toml`
4. Test local Supabase start
5. Verify migrations apply correctly
6. Document Supabase workflows

**Commands**:

```bash
# Install Supabase CLI
npm install -g supabase

# Start Supabase
cd supabase
supabase start

# Check status
supabase status

# Reset database
supabase db reset

# Generate types
supabase gen types typescript --local > ../web-admin/types/database.ts
```

### Phase 3: Environment Configuration (1 day)

**Tasks**:

1. Create `.env.example` with all variables
2. Add `.env` to `.gitignore`
3. Create env validation script
4. Document environment setup process
5. Add env checking to CI

**Files**:

- `.env.example`
- `scripts/validate-env.js`
- `docs/setup-guide.md`

### Phase 4: Documentation & Testing (1 day)

**Tasks**:

1. Write comprehensive setup guide
2. Create troubleshooting guide
3. Test setup on clean machine
4. Record video walkthrough (optional)
5. Update CLAUDE.md with commands

**Deliverables**:

- `docs/development-setup.md`
- `docs/troubleshooting.md`
- Updated `README.md`

---

## 5. Database Configuration

### Connection Pooling

**PgBouncer Configuration** (Optional, for later optimization):

```ini
[databases]
cmx_db = host=localhost port=5432 dbname=cmx_db

[pgbouncer]
listen_port = 6432
listen_addr = 0.0.0.0
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 100
default_pool_size = 25
```

### Database Init Script

**infra/postgres/initdb/001-init.sql**:

```sql
-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create roles
CREATE ROLE cmx_readonly;
GRANT CONNECT ON DATABASE cmx_db TO cmx_readonly;
GRANT USAGE ON SCHEMA public TO cmx_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO cmx_readonly;

-- Performance settings
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
```

---

## 6. API Specifications

### Health Check Endpoint

```typescript
// GET /health
{
  status: 'healthy' | 'unhealthy',
  timestamp: string,
  services: {
    database: { status: 'up' | 'down', latency: number },
    redis: { status: 'up' | 'down', latency: number },
    storage: { status: 'up' | 'down', latency: number }
  },
  version: string
}
```

---

## 7. Testing Strategy

### Integration Tests

**Test Services Connectivity**:

```typescript
describe("Infrastructure", () => {
  test("PostgreSQL is accessible", async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const result = await client.query("SELECT NOW()");
    expect(result.rows).toHaveLength(1);
    await client.end();
  });

  test("Redis is accessible", async () => {
    const redis = new Redis(process.env.REDIS_URL);
    await redis.set("test", "value");
    const value = await redis.get("test");
    expect(value).toBe("value");
    await redis.quit();
  });

  test("MinIO is accessible", async () => {
    const s3Client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
      },
    });
    const buckets = await s3Client.send(new ListBucketsCommand({}));
    expect(buckets.Buckets).toBeDefined();
  });
});
```

### Smoke Tests

**scripts/smoke-test.sh**:

```bash
#!/bin/bash
set -e

echo "Running smoke tests..."

# Test PostgreSQL
psql $DATABASE_URL -c "SELECT 1" > /dev/null
echo "✓ PostgreSQL OK"

# Test Redis
redis-cli -u $REDIS_URL PING | grep PONG > /dev/null
echo "✓ Redis OK"

# Test MinIO
curl -f http://localhost:9000/minio/health/live > /dev/null
echo "✓ MinIO OK"

# Test Supabase
curl -f http://localhost:54321/rest/v1/ > /dev/null
echo "✓ Supabase OK"

echo "All services healthy!"
```

---

## 8. Dependencies & Integration Points

### Upstream Dependencies

- Docker Desktop / Docker Engine
- Node.js 20+
- npm/pnpm
- Supabase CLI
- Git

### Downstream Consumers

- All development modules (002-058)
- CI/CD pipelines
- Integration tests
- Local development workflows

---

## 9. Deployment Considerations

### Local Development

**Startup**:

```bash
# Start infrastructure services
docker-compose up -d

# Start Supabase
cd supabase && supabase start

# Start web admin
cd web-admin && npm run dev

# Start backend (later)
cd backend && npm run dev
```

**Shutdown**:

```bash
# Stop Supabase
cd supabase && supabase stop

# Stop Docker services
docker-compose down

# Or keep data: docker-compose stop
```

### Production Infrastructure (Future - Module 057)

- Kubernetes manifests
- Helm charts
- Terraform IaC
- Managed PostgreSQL (AWS RDS, Supabase hosted)
- Managed Redis (AWS ElastiCache)
- S3 for storage

---

## 10. Success Metrics

| Metric                     | Target               | Measurement         |
| -------------------------- | -------------------- | ------------------- |
| Setup Time (New Developer) | < 30 minutes         | Onboarding feedback |
| Service Startup Time       | < 2 minutes          | Automated timing    |
| Health Check Success Rate  | 100%                 | Monitoring          |
| Data Persistence           | 100% across restarts | Testing             |
| Documentation Clarity      | ≥ 4/5 rating         | Team survey         |

---

## 11. Risks & Mitigations

| Risk                                   | Impact | Mitigation                                   |
| -------------------------------------- | ------ | -------------------------------------------- |
| Docker version incompatibility         | Medium | Document required versions, CI checks        |
| Port conflicts on developer machines   | Medium | Document ports, provide port checking script |
| Slow Docker performance on Windows     | Medium | Document WSL2 setup, performance tips        |
| Data corruption during forced shutdown | Low    | Use volumes, document proper shutdown        |
| Supabase CLI breaking changes          | Medium | Pin CLI version, test before upgrading       |

---

## 12. Future Enhancements

### Phase 2

- Docker Compose profiles for different services
- pgAdmin container for database GUI
- Kafka/RabbitMQ for event streaming
- Grafana/Prometheus for local monitoring

### Phase 3

- Kubernetes local development (kind/k3s)
- Service mesh (Istio) for advanced routing
- Distributed tracing (Jaeger) locally
- Load testing infrastructure

---

## 13. Acceptance Checklist

- [ ] Docker Compose starts all services successfully
- [ ] All health checks pass
- [ ] Supabase local instance running
- [ ] Database migrations apply correctly
- [ ] Seed data loads successfully
- [ ] Environment variables documented
- [ ] Setup guide written and tested
- [ ] Troubleshooting guide created
- [ ] New developer can set up in < 30 minutes
- [ ] All ports documented
- [ ] Data persists across restarts
- [ ] Services communicate correctly
- [ ] Smoke tests pass
- [ ] Team trained on setup process

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-09  
**Next Review**: After implementation completion
