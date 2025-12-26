# Database Core - Development Plan & PRD

**Document ID**: 000_database_core_dev_prd  
**Version**: 1.0  
**Status**: Ready for Implementation  
**Owner**: Backend Team  
**Dependencies**: infrastructure setup- done 
**Related Requirements**: NFR-SEC-001, NFR-PERF-001, NFR-SCL-001

---

## 1. Overview & Context

### Purpose

Implement and validate the core database schema for CleanMateX, including multi-tenant data model, Row-Level Security (RLS) policies, seed data, migration management, and performance optimization.

### Business Value

- Ensures data integrity across the platform
- Enforces tenant isolation at database level
- Provides performant queries for business operations
- Enables scalable data growth
- Maintains audit trail for compliance

### User Personas Affected

- All application users (indirectly)
- Database Administrators
- Backend Developers
- DevOps Engineers

### Key Use Cases

- UC-DB-001: Tenant data is completely isolated
- UC-DB-002: Migrations execute reliably across environments
- UC-DB-003: Database performs within SLA targets
- UC-DB-004: Seed data provides working examples

---

## 2. Functional Requirements

### FR-DB-001: Schema Implementation

**Description**: Implement complete database schema with all required tables

**Existing Tables** (from `0001_core.sql`):

- System Layer: `sys_order_type_cd`, `sys_service_category_cd`, `sys_customers_mst`
- Tenant Layer: `org_tenants_mst`, `org_subscriptions`, `org_branches_mst`, `org_service_category_cf`
- Catalog: `org_product_data_mst`
- Orders: `org_orders_mst`, `org_order_items_dtl`
- Finance: `org_invoice_mst`, `org_payments_dtl_tr`
- Customers: `org_customers_mst` (junction table)

**Acceptance Criteria**:

- All tables created with proper constraints
- Foreign keys enforce referential integrity
- Composite keys for tenant boundaries
- Indexes on frequently queried columns
- Audit fields on all tables
- Bilingual fields for UI text

### FR-DB-002: Row-Level Security (RLS)

**Description**: Implement RLS policies for complete tenant isolation

**Acceptance Criteria**:

- RLS enabled on all tenant tables
- Policies validate JWT tenant_id claim
- No cross-tenant data leakage possible
- Read/write policies defined
- Admin bypass policies for platform layer
- Performance impact < 10ms per query

### FR-DB-003: Migration Management

**Description**: Organize and manage database migrations systematically

**Acceptance Criteria**:

- Sequential numbering (0001, 0002, ...)
- Idempotent migrations where possible
- Rollback capability for reversible changes
- Migration logs tracked
- Version control integrated
- Documentation for each migration

### FR-DB-004: Seed Data

**Description**: Provide comprehensive seed data for development and testing

**Acceptance Criteria**:

- Demo tenant with sample data
- Service categories populated
- Order types defined
- Sample products and pricing
- Example orders at various stages
- Realistic test data (not Lorem Ipsum)
- Seed script idempotent

### FR-DB-005: Performance Optimization

**Description**: Optimize database for production-level performance

**Acceptance Criteria**:

- Indexes on tenant_org_id + commonly filtered columns
- Query plans analyzed and optimized
- Connection pooling configured
- Query timeout settings
- Statistics updated regularly
- Explain analyze on critical queries

---

## 3. Technical Design

### Database Schema (Existing in `0001_core.sql`)

**System Layer (Global Data)**:

```sql
-- Code/Lookup Tables
sys_order_type_cd (order_type_id PK, order_type_name, order_type_name2, ...)
sys_service_category_cd (service_category_code PK, ctg_name, ctg_name2, ...)

-- Global Customer Registry
sys_customers_mst (id UUID PK, first_name, last_name, phone, email, ...)
```

**Organization Layer (Tenant Data)**:

```sql
-- Tenant & Subscription
org_tenants_mst (id UUID PK, name, slug UNIQUE, email UNIQUE, ...)
org_subscriptions_mst(id UUID PK, tenant_id FK, plan, orders_limit, ...)
org_branches_mst (id UUID PK, tenant_org_id FK, branch_name, ...)

-- Catalog
org_service_category_cf (tenant_org_id FK, service_category_code FK, PK)
org_product_data_mst (id UUID PK, tenant_org_id FK, product_code, ...)

-- Customers (Tenant Link)
org_customers_mst (customer_id FK, tenant_org_id FK, loyalty_points, PK)

-- Orders
org_orders_mst (id UUID PK, tenant_org_id FK, order_no, status, ...)
org_order_items_dtl (id UUID PK, order_id FK, tenant_org_id FK, ...)

-- Finance
org_invoice_mst (id UUID PK, tenant_org_id FK, invoice_no, ...)
org_payments_dtl_tr (id UUID PK, invoice_id FK, tenant_org_id FK, ...)
```

### Additional Tables Needed

**Workflow & Tracking**:

```sql
CREATE TABLE IF NOT EXISTS org_workflow_states_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  tenant_org_id UUID NOT NULL,
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  transition_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  transition_by VARCHAR(120),
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  FOREIGN KEY (order_id) REFERENCES org_orders_mst(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE
);

CREATE INDEX idx_workflow_log_order ON org_workflow_states_log(order_id);
CREATE INDEX idx_workflow_log_tenant ON org_workflow_states_log(tenant_org_id);
```

**Assembly & QA**:

```sql
CREATE TABLE IF NOT EXISTS org_assembly_tasks_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  tenant_org_id UUID NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed
  location_code VARCHAR(50), -- bin/rack location
  assigned_to VARCHAR(120),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES org_orders_mst(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS org_assembly_items_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_task_id UUID NOT NULL,
  order_item_id UUID NOT NULL,
  tenant_org_id UUID NOT NULL,
  expected BOOLEAN DEFAULT TRUE,
  scanned BOOLEAN DEFAULT FALSE,
  scanned_at TIMESTAMP,
  scanned_by VARCHAR(120),
  exception_type VARCHAR(50), -- missing, wrong, damaged
  exception_notes TEXT,
  FOREIGN KEY (assembly_task_id) REFERENCES org_assembly_tasks_mst(id) ON DELETE CASCADE,
  FOREIGN KEY (order_item_id) REFERENCES org_order_items_dtl(id),
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS org_qa_checks_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  tenant_org_id UUID NOT NULL,
  check_type VARCHAR(50) DEFAULT 'final_qa',
  result VARCHAR(20) NOT NULL, -- pass, fail, rework
  checked_by VARCHAR(120) NOT NULL,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  photo_urls TEXT[],
  FOREIGN KEY (order_id) REFERENCES org_orders_mst(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE
);
```

**Delivery & Logistics**:

```sql
CREATE TABLE IF NOT EXISTS org_delivery_routes_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  route_code VARCHAR(100) NOT NULL,
  driver_id UUID,
  route_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'planned', -- planned, in_progress, completed
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  UNIQUE(tenant_org_id, route_code, route_date)
);

CREATE TABLE IF NOT EXISTS org_delivery_stops_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL,
  order_id UUID NOT NULL,
  tenant_org_id UUID NOT NULL,
  stop_sequence INTEGER NOT NULL,
  stop_type VARCHAR(20) NOT NULL, -- pickup, delivery
  status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
  scheduled_time TIMESTAMP,
  actual_time TIMESTAMP,
  pod_method VARCHAR(20), -- otp, signature, photo
  pod_data JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  FOREIGN KEY (route_id) REFERENCES org_delivery_routes_mst(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES org_orders_mst(id),
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE
);
```

**Users & Roles**:

```sql
CREATE TABLE IF NOT EXISTS org_users_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  auth_user_id UUID NOT NULL, -- Supabase auth.users.id
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) NOT NULL, -- tenant_admin, branch_manager, operator, assembly, qa, driver
  branch_id UUID,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id, tenant_org_id) REFERENCES org_branches_mst(id, tenant_org_id),
  UNIQUE(tenant_org_id, email)
);

CREATE INDEX idx_users_tenant ON org_users_mst(tenant_org_id);
CREATE INDEX idx_users_auth ON org_users_mst(auth_user_id);
```

### RLS Policies (Existing in `0002_rls_core.sql`)

**Tenant Isolation Template**:

```sql
-- Enable RLS
ALTER TABLE org_<table_name> ENABLE ROW LEVEL SECURITY;

-- Policy: Users see only their tenant's data
CREATE POLICY tenant_isolation_org_<table_name>
ON org_<table_name>
FOR ALL
USING (tenant_org_id::text = auth.jwt() ->> 'tenant_id');
```

**Additional RLS Policies Needed**:

```sql
-- Workflow logs
CREATE POLICY tenant_isolation_workflow_log
ON org_workflow_states_log
FOR ALL
USING (tenant_org_id::text = auth.jwt() ->> 'tenant_id');

-- Assembly tasks
CREATE POLICY tenant_isolation_assembly_tasks
ON org_assembly_tasks_mst
FOR ALL
USING (tenant_org_id::text = auth.jwt() ->> 'tenant_id');

-- Assembly items
CREATE POLICY tenant_isolation_assembly_items
ON org_assembly_items_dtl
FOR ALL
USING (tenant_org_id::text = auth.jwt() ->> 'tenant_id');

-- QA checks
CREATE POLICY tenant_isolation_qa_checks
ON org_qa_checks_log
FOR ALL
USING (tenant_org_id::text = auth.jwt() ->> 'tenant_id');

-- Delivery routes
CREATE POLICY tenant_isolation_delivery_routes
ON org_delivery_routes_mst
FOR ALL
USING (tenant_org_id::text = auth.jwt() ->> 'tenant_id');

-- Delivery stops
CREATE POLICY tenant_isolation_delivery_stops
ON org_delivery_stops_dtl
FOR ALL
USING (tenant_org_id::text = auth.jwt() ->> 'tenant_id');

-- Users
CREATE POLICY tenant_isolation_users
ON org_users_mst
FOR ALL
USING (tenant_org_id::text = auth.jwt() ->> 'tenant_id');
```

### Performance Indexes

**Critical Indexes**:

```sql
-- Orders (most queried)
CREATE INDEX idx_org_orders_tenant_no ON org_orders_mst(tenant_org_id, order_no);
CREATE INDEX idx_org_orders_tenant_status ON org_orders_mst(tenant_org_id, status);
CREATE INDEX idx_org_orders_tenant_customer ON org_orders_mst(tenant_org_id, customer_id);
CREATE INDEX idx_org_orders_received_at ON org_orders_mst(tenant_org_id, received_at DESC);
CREATE INDEX idx_org_orders_ready_by ON org_orders_mst(tenant_org_id, ready_by) WHERE status != 'delivered';

-- Order items
CREATE INDEX idx_org_items_order ON org_order_items_dtl(order_id);
CREATE INDEX idx_org_items_tenant_product ON org_order_items_dtl(tenant_org_id, product_id);
CREATE INDEX idx_org_items_barcode ON org_order_items_dtl(barcode) WHERE barcode IS NOT NULL;

-- Customers
CREATE INDEX idx_org_customers_tenant ON org_customers_mst(tenant_org_id);
CREATE INDEX idx_sys_customers_phone ON sys_customers_mst(phone);
CREATE INDEX idx_sys_customers_email ON sys_customers_mst(email) WHERE email IS NOT NULL;

-- Invoices
CREATE INDEX idx_org_invoice_tenant_no ON org_invoice_mst(tenant_org_id, invoice_no);
CREATE INDEX idx_org_invoice_order ON org_invoice_mst(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_org_invoice_status ON org_invoice_mst(tenant_org_id, status);

-- Payments
CREATE INDEX idx_org_payments_invoice ON org_payments_dtl_tr(invoice_id);
CREATE INDEX idx_org_payments_tenant ON org_payments_dtl_tr(tenant_org_id, created_at DESC);

-- Products
CREATE INDEX idx_org_products_tenant_code ON org_product_data_mst(tenant_org_id, product_code);
CREATE INDEX idx_org_products_tenant_category ON org_product_data_mst(tenant_org_id, service_category_code);
CREATE INDEX idx_org_products_active ON org_product_data_mst(tenant_org_id, is_active) WHERE is_active = true;
```

---

## 4. Implementation Plan

### Phase 1: Schema Validation 

**Tasks**:

1. Review existing migrations (0001, 0002, 0003)
2. Identify missing tables for MVP
3. Create migration 0004 for additional tables
4. Test migrations on clean database
5. Verify all constraints work correctly

**Deliverables**:

- `supabase/migrations/0004_workflow_tracking.sql`
- `supabase/migrations/0005_delivery_logistics.sql`
- `supabase/migrations/0006_users_roles.sql`

### Phase 2: RLS Policy Implementation 

**Tasks**:

1. Review existing RLS policies
2. Add policies for new tables
3. Test tenant isolation thoroughly
4. Verify no data leakage
5. Performance test RLS overhead
6. Document policy patterns

**Deliverables**:

- `supabase/migrations/0007_rls_additional.sql`
- `tests/rls-isolation.test.ts`

### Phase 3: Performance Optimization 

**Tasks**:

1. Add indexes on critical paths
2. Run EXPLAIN ANALYZE on key queries
3. Optimize slow queries
4. Configure PostgreSQL settings
5. Test with realistic data volume
6. Document query patterns

**Deliverables**:

- `supabase/migrations/0008_indexes_optimization.sql`
- `docs/database-performance.md`
- Query analysis report

### Phase 4: Seed Data Expansion 

**Tasks**:

1. Expand existing seed data (0003)
2. Add multiple tenants for testing
3. Add orders at various workflow stages
4. Add assembly and QA data
5. Add delivery routes and stops
6. Make seed data idempotent

**Deliverables**:

- `supabase/migrations/0009_seed_extended.sql`
- `supabase/seeds/demo-data-generator.ts`

### Phase 5: Migration Testing & Documentation 

**Tasks**:

1. Test migrations on multiple environments
2. Test rollback procedures
3. Create migration checklist
4. Document migration process
5. Train team on migration workflow
6. Update CLAUDE.md

**Deliverables**:

- `docs/database-migrations.md`
- Migration runbook
- CI integration for migration testing

---

## 5. Database Changes

### New Migrations

**0004_workflow_tracking.sql**:

- `org_workflow_states_log`
- Indexes on workflow tracking

**0005_delivery_logistics.sql**:

- `org_delivery_routes_mst`
- `org_delivery_stops_dtl`
- Indexes on delivery tables

**0006_users_roles.sql**:

- `org_users_mst`
- Indexes on users

**0007_rls_additional.sql**:

- RLS policies for all new tables

**0008_indexes_optimization.sql**:

- Additional indexes for performance
- Composite indexes for common queries

**0009_seed_extended.sql**:

- Extended demo data
- Multiple tenants
- Complete workflow examples

---

## 6. Testing Strategy

### Unit Tests

**Schema Validation**:

```typescript
describe("Database Schema", () => {
  test("all tenant tables have tenant_org_id", async () => {
    const result = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'org_%'
        AND table_name NOT IN (
          SELECT table_name 
          FROM information_schema.columns 
          WHERE column_name = 'tenant_org_id'
        )
    `);
    expect(result.rows).toHaveLength(0);
  });

  test("all tables have audit fields", async () => {
    // created_at, updated_at, etc.
  });
});
```

### Integration Tests

**RLS Isolation**:

```typescript
describe('RLS Tenant Isolation', () => {
  let tenant1JWT, tenant2JWT;

  beforeAll(async () => {
    // Create two test tenants
    // Generate JWTs with different tenant_ids
  });

  test('tenant cannot read other tenant orders', async () => {
    // Create order for tenant1
    await createOrder({ tenant_org_id: 'tenant1', ... });

    // Try to read with tenant2 JWT
    const { data, error } = await supabase
      .from('org_orders_mst')
      .select('*')
      .eq('tenant_org_id', 'tenant1');

    expect(data).toHaveLength(0); // RLS blocks it
  });

  test('tenant cannot update other tenant data', async () => {
    // Similar tests for update, delete
  });
});
```

### Performance Tests

**Query Performance**:

```typescript
describe("Query Performance", () => {
  test("order search by tenant < 100ms", async () => {
    const start = Date.now();
    await db.query(
      `
      SELECT * FROM org_orders_mst 
      WHERE tenant_org_id = $1 
        AND status = 'intake'
      LIMIT 50
    `,
      [tenantId]
    );
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100);
  });

  test("customer order history < 200ms", async () => {
    const start = Date.now();
    await db.query(
      `
      SELECT o.*, 
        COUNT(oi.id) as item_count
      FROM org_orders_mst o
      LEFT JOIN org_order_items_dtl oi ON o.id = oi.order_id
      WHERE o.tenant_org_id = $1 
        AND o.customer_id = $2
      GROUP BY o.id
      ORDER BY o.received_at DESC
      LIMIT 20
    `,
      [tenantId, customerId]
    );
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });
});
```

### Load Tests

**Concurrent Tenant Operations**:

```typescript
describe('Load Tests', () => {
  test('100 concurrent order creates', async () => {
    const promises = Array(100).fill(null).map(() =>
      createOrder({ tenant_org_id: randomTenant(), ... })
    );
    await Promise.all(promises);
    // Verify all succeeded
  });
});
```

---

## 7. Success Metrics

| Metric                  | Target           | Measurement             |
| ----------------------- | ---------------- | ----------------------- |
| Migration Success Rate  | 100%             | CI/CD logs              |
| RLS Overhead            | < 10ms per query | Query analysis          |
| Query Performance (p95) | < 100ms          | APM tools               |
| Data Integrity          | 100%             | Foreign key constraints |
| Test Coverage           | ≥ 80%            | Jest coverage           |
| Seed Data Load Time     | < 10s            | Script timing           |

---

## 8. Risks & Mitigations

| Risk                              | Impact   | Mitigation                                 |
| --------------------------------- | -------- | ------------------------------------------ |
| RLS performance degradation       | High     | Thorough testing, indexes on tenant_org_id |
| Migration failure in production   | Critical | Test on staging, rollback plan, backups    |
| Composite FK complexity           | Medium   | Clear documentation, helper functions      |
| Seed data drift from schema       | Medium   | Automated validation in CI                 |
| Missing indexes on common queries | High     | Query analysis, monitoring slow queries    |

---

## 9. Future Enhancements

### Phase 2

- Database partitioning by tenant_id for scale
- Read replicas for reporting queries
- Automated query performance monitoring
- Database backup and restore automation

### Phase 3

- Time-series tables for analytics
- Full-text search indexes
- Materialized views for complex reports
- Database audit triggers

---

## 10. Acceptance Checklist

- [ ] All core tables created successfully
- [ ] Foreign keys enforce integrity
- [ ] RLS policies active on all tenant tables
- [ ] No cross-tenant data leakage in tests
- [ ] Indexes created on critical columns
- [ ] Query performance meets targets
- [ ] Migrations are idempotent
- [ ] Rollback procedures documented
- [ ] Seed data loads successfully
- [ ] Integration tests passing
- [ ] Performance tests passing
- [ ] Documentation complete
- [ ] Team trained on schema

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-09  
**Next Review**: After Phase 1 implementation
