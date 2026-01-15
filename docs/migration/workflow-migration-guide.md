# Orders Workflow Migration Guide

## Overview

This guide explains how to migrate from the old workflow system to the new simplified database-driven workflow system.

## Migration Strategy

The migration uses a gradual rollout approach with the `USE_OLD_WF_CODE_OR_NEW` parameter, allowing per-request, per-tenant, or global control.

## Step-by-Step Migration Process

### Step 1: Deploy Database Functions

Deploy the simplified database functions without breaking existing functionality:

```bash
# Apply migrations
supabase migration up

# Verify functions exist
psql -d cleanmatex -c "\df cmx_ord_*"
```

**Expected result:** All `cmx_ord_*` functions are available but not used yet.

### Step 2: Add Feature Flag

Create the `USE_NEW_WORKFLOW_SYSTEM` feature flag:

```sql
-- Add feature flag to HQ Platform
INSERT INTO hq_ff_feature_flags_mst (
  flag_key,
  flag_name,
  flag_description,
  default_value_jsonb
) VALUES (
  'USE_NEW_WORKFLOW_SYSTEM',
  'Use New Workflow System',
  'Enable new simplified workflow system',
  'false'::jsonb
);
```

**Default:** `false` (use old code)

### Step 3: Deploy Application Layer

Deploy the enhanced workflow service and API endpoints:

```bash
# Build and deploy
npm run build
npm run deploy
```

**Verify:**
- `WorkflowServiceEnhanced` is available
- API endpoints support `useOldWfCodeOrNew` parameter
- Frontend hooks are available

### Step 4: Per-Screen Migration

Migrate one screen at a time:

#### 4.1 Test Screen in Isolation

```typescript
// Test with useOldWfCodeOrNew: true
const result = await fetch('/api/v1/orders/123/transition', {
  method: 'POST',
  body: JSON.stringify({
    screen: 'preparation',
    useOldWfCodeOrNew: true,
  }),
});
```

#### 4.2 Enable for Test Tenant

```sql
-- Enable for test tenant
UPDATE org_tenants_mst
SET feature_flags = jsonb_set(
  COALESCE(feature_flags, '{}'::jsonb),
  '{USE_NEW_WORKFLOW_SYSTEM}',
  'true'::jsonb
)
WHERE id = 'test-tenant-uuid';
```

#### 4.3 Monitor and Verify

- Check transition events: `SELECT * FROM org_ord_transition_events WHERE event_type = 'TRANSITION_FAILED';`
- Verify order history: `SELECT * FROM org_order_history WHERE order_id = '...';`
- Check application logs for errors

#### 4.4 Rollout to Production

Once verified, enable for production tenants:

```sql
-- Enable for all tenants (gradual)
UPDATE org_tenants_mst
SET feature_flags = jsonb_set(
  COALESCE(feature_flags, '{}'::jsonb),
  '{USE_NEW_WORKFLOW_SYSTEM}',
  'true'::jsonb
)
WHERE id IN ('tenant-1', 'tenant-2', ...);
```

### Step 5: Complete Migration

Once all screens are migrated and stable:

1. **Remove old code paths** (optional, keep for emergency rollback)
2. **Remove feature flag** (optional, keep for rollback)
3. **Update documentation**

## Rollback Procedures

### Immediate Rollback (Per Request)

Set `useOldWfCodeOrNew: false` in API request:

```typescript
{
  screen: 'preparation',
  useOldWfCodeOrNew: false, // Use old code
}
```

### Per-Tenant Rollback

```sql
-- Disable for tenant
UPDATE org_tenants_mst
SET feature_flags = jsonb_set(
  feature_flags,
  '{USE_NEW_WORKFLOW_SYSTEM}',
  'false'::jsonb
)
WHERE id = 'tenant-uuid';
```

### Global Rollback

```sql
-- Disable for all tenants
UPDATE org_tenants_mst
SET feature_flags = jsonb_set(
  COALESCE(feature_flags, '{}'::jsonb),
  '{USE_NEW_WORKFLOW_SYSTEM}',
  'false'::jsonb
);
```

## Testing Migration

### Pre-Migration Tests

1. **Database Functions:**
   ```sql
   SELECT cmx_ord_screen_pre_conditions('preparation');
   SELECT cmx_ord_validate_transition_basic(...);
   ```

2. **API Endpoints:**
   ```bash
   curl -X GET http://localhost/api/v1/workflows/screens/preparation/contract
   ```

3. **Frontend Hooks:**
   ```typescript
   const { data } = useScreenContract('preparation');
   ```

### Post-Migration Tests

1. **Verify transitions work:**
   - Test each screen transition
   - Verify history logging
   - Check quality gates

2. **Verify integrations:**
   - Feature flags work correctly
   - Plan limits enforced
   - Settings respected

3. **Performance tests:**
   - Response times < 100ms
   - Concurrent transitions work
   - No deadlocks

## Common Issues and Solutions

### Issue: Transition fails with STATUS_MISMATCH

**Cause:** Order status doesn't match screen requirements

**Solution:**
```sql
-- Check order status
SELECT current_status FROM org_orders_mst WHERE id = '...';

-- Verify screen contract
SELECT cmx_ord_screen_pre_conditions('preparation');
```

### Issue: Permission denied

**Cause:** User lacks required permissions

**Solution:**
```sql
-- Check user permissions
SELECT permission_key
FROM sys_rbac_permissions_cd
WHERE role_code IN (
  SELECT role_code FROM org_users_mst WHERE user_id = '...'
);
```

### Issue: Feature flag check fails

**Cause:** Feature flag not enabled or HQ API unavailable

**Solution:**
```sql
-- Check feature flags
SELECT feature_flags FROM org_tenants_mst WHERE id = '...';

-- Verify HQ API is accessible
-- Check HQ_API_URL and HQ_SERVICE_TOKEN environment variables
```

### Issue: Plan limit exceeded

**Cause:** Tenant exceeded order limit

**Solution:**
```sql
-- Check usage
SELECT orders_used, orders_limit
FROM org_subscriptions_mst
WHERE tenant_org_id = '...';

-- Upgrade plan or increase limit
```

### Issue: Quality gates not met

**Cause:** Missing required steps

**Solution:**
- Complete assembly (if enabled)
- Pass QA (if enabled)
- Resolve blocking issues

## Migration Checklist

### Pre-Migration

- [ ] Database migrations applied
- [ ] Feature flag created
- [ ] Application code deployed
- [ ] API endpoints tested
- [ ] Frontend hooks tested
- [ ] Documentation updated

### During Migration

- [ ] Test screen migrated
- [ ] Test tenant verified
- [ ] Production tenants enabled (gradual)
- [ ] Monitoring active
- [ ] Rollback plan ready

### Post-Migration

- [ ] All screens migrated
- [ ] All tenants using new system
- [ ] Performance verified
- [ ] Errors resolved
- [ ] Documentation updated
- [ ] Old code removed (optional)

## Monitoring

### Key Metrics

1. **Transition Success Rate:**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE event_type = 'TRANSITION_COMPLETED') * 100.0 / COUNT(*) as success_rate
   FROM org_ord_transition_events
   WHERE created_at > NOW() - INTERVAL '1 day';
   ```

2. **Average Response Time:**
   - Monitor API response times
   - Target: < 100ms for simple transitions

3. **Error Rate:**
   ```sql
   SELECT 
     event_type,
     COUNT(*)
   FROM org_ord_transition_events
   WHERE event_type LIKE '%FAILED%'
   GROUP BY event_type;
   ```

### Alerts

Set up alerts for:
- High error rate (> 5%)
- Slow response times (> 500ms)
- Failed transitions
- HQ API unavailability

## Support

For migration support:
- Check logs: `SELECT * FROM org_ord_transition_events WHERE event_type = 'TRANSITION_FAILED';`
- Review documentation: `docs/developers/workflow-system-guide.md`
- Contact development team

