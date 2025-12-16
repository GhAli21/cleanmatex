# Multi-Tenancy Enforcement Rules

## Overview
Critical rules for ensuring tenant data isolation and security.

## Rules

### CRITICAL RULES - NEVER VIOLATE
1. Always filter by `tenant_org_id` in every query
2. Use composite foreign keys when joining across tenant tables
3. Leverage RLS policies for additional security
4. Global customers are linked to tenants via junction table

### Query Patterns
- Always include `tenant_org_id` filter in Supabase queries
- Always include `tenant_org_id` filter in SQL queries
- Never query org_* tables without tenant filter
- Use composite keys for joins: `(tenant_org_id, customer_id)`

### RLS Policies
- Enable RLS on all org_* tables
- Create policy ensuring `tenant_org_id` matches JWT claim
- Create service role policy for administrative use
- Test RLS policies before deploying

### Global vs Tenant Data
- System tables (`sys_*`): No `tenant_org_id` column, shared across all tenants
- Organization tables (`org_*`): MUST have `tenant_org_id` column, RLS enabled
- Junction tables link global to tenant data

### Security Best Practices
- Ensure JWT contains `tenant_org_id` claim
- Verify tenant in middleware before processing requests
- Use service role ONLY for admin operations
- Always validate tenant context before database operations
- Never allow cross-tenant access

### Multi-Tenant Testing
- Create two test tenants
- Create data for both tenants
- Query as tenant 1 - verify only tenant 1 data returned
- Query as tenant 2 - verify only tenant 2 data returned
- Attempt cross-tenant access - verify it fails
- Test joins across tables - verify tenant isolation maintained
- Test aggregations - verify counts are tenant-specific

## Conventions
- Never query without tenant filter
- Always use composite foreign keys for tenant relationships
- Always test tenant isolation
- Always verify RLS policies are active
