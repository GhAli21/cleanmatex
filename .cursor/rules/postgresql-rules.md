# PostgreSQL Rules

## Overview
Rules for working with PostgreSQL database in CleanMateX.

## Rules

### Database Connection
- Use Supabase Local PostgreSQL (port 54322) for development
- Connection string: `postgresql://postgres:postgres@localhost:54322/postgres`
- Never use separate Docker Postgres container
- Use connection pooling (PgBouncer) for production

### Schema Design
- Use composite primary keys for tenant data: `(tenant_org_id, entity_id)`
- Use appropriate data types: UUID for IDs, DECIMAL for money, JSONB for flexible data
- Use custom domains for data types: MONEY, IS_ACTIVE
- Plan partitioning for high-volume tables

### Indexes
- Always index `tenant_org_id` on org_* tables
- Create composite indexes: `(tenant_org_id, rec_status)`
- Create full-text search GIN indexes on name fields
- Create date indexes: `(tenant_org_id, created_at DESC)`
- Index foreign keys for JOIN performance

### Row-Level Security (RLS)
- Enable RLS on all org_* tables
- Create policies ensuring tenant isolation
- Test RLS policies before deploying
- Use service role for admin operations

### Functions and Procedures
- Use PostgreSQL functions for complex business logic
- Wrap logic in Supabase RPCs for reusability
- Keep functions focused and testable
- Document function parameters and return types

### Migrations
- Use Supabase migrations for all schema changes
- Create migrations with descriptive names
- Use transactions for migrations
- Test migrations before deploying
- Never modify production schema directly

### Performance
- Use EXPLAIN ANALYZE to check query performance
- Optimize slow queries with proper indexes
- Use connection pooling for serverless compatibility
- Monitor query performance regularly

### Backup and Recovery
- Backup schema weekly to `infra/backups/`
- Test backup restoration procedures
- Keep migration history for rollback capability

## Conventions
- Always use migrations for schema changes
- Always enable RLS on org_* tables
- Always add appropriate indexes
- Always test queries before deploying
- Always backup schema regularly
