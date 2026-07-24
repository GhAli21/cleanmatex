# Orders Workflow - Admin Configuration Guide

## Overview

This guide explains how to configure the Orders Workflow system, including screen contracts, tenant customization, feature flags, plan limits, and settings.

## Configuring Screen Contracts

### System Default Contracts

Screen contracts are defined in the `org_ord_screen_contracts_cf` table. System defaults have `tenant_org_id = NULL`.

**View system defaults:**
```sql
SELECT * FROM org_ord_screen_contracts_cf
WHERE tenant_org_id IS NULL;
```

**Create system default:**
```sql
INSERT INTO org_ord_screen_contracts_cf (
  tenant_org_id,
  screen_key,
  pre_conditions,
  required_permissions
) VALUES (
  NULL,
  'preparation',
  '{"statuses": ["preparing", "intake"]}'::jsonb,
  '["orders:preparation:complete"]'::jsonb
);
```

### Tenant-Specific Contracts

Override system defaults for specific tenants:

```sql
INSERT INTO org_ord_screen_contracts_cf (
  tenant_org_id,
  screen_key,
  pre_conditions,
  required_permissions
) VALUES (
  'tenant-uuid',
  'preparation',
  '{"statuses": ["preparing"]}'::jsonb,
  '["orders:preparation:complete"]'::jsonb
);
```

## Customizing Workflows Per Tenant

### Workflow Templates

Tenants can use different workflow templates based on service category:

```sql
-- Assign template to tenant for service category
INSERT INTO org_tenant_workflow_templates_cf (
  tenant_org_id,
  service_category_code,
  workflow_template_id
) VALUES (
  'tenant-uuid',
  'WASH_FOLD',
  (SELECT template_id FROM sys_workflow_template_cd WHERE template_code = 'WF_ASSEMBLY_QA')
);
```

### Custom Validations

Add custom validation rules:

```sql
INSERT INTO org_ord_custom_validations_cf (
  tenant_org_id,
  screen_key,
  validation_key,
  validation_function,
  validation_config
) VALUES (
  'tenant-uuid',
  'preparation',
  'check_minimum_items',
  'cmx_ord_validate_minimum_items',
  '{"minimum": 3}'::jsonb
);
```

## Feature Flag Configuration

### Enable Feature Flags

Feature flags control which workflow features are available:

**Via HQ Platform API:**
```typescript
// Set feature flag for tenant
await hqApiClient.upsertOverride(tenantId, {
  settingCode: 'feature.assembly_workflow',
  value: true,
});
```

**Via Database:**
```sql
-- Update tenant feature flags
UPDATE org_tenants_mst
SET feature_flags = jsonb_set(
  COALESCE(feature_flags, '{}'::jsonb),
  '{assembly_workflow}',
  'true'::jsonb
)
WHERE id = 'tenant-uuid';
```

### Available Feature Flags

- `assembly_workflow` - Enable assembly screen
- `qa_workflow` - Enable QA screen
- `packing_workflow` - Enable packing screen
- `driver_app` - Enable driver delivery screen
- `USE_NEW_WORKFLOW_SYSTEM` - Use new workflow system (migration flag)

## Plan Limits Configuration

### Configure Order Limits

Plan limits are configured in the subscription system:

```sql
-- Update plan limits
UPDATE sys_plan_limits
SET orders_limit = 1000
WHERE plan_code = 'GROWTH';
```

### Check Current Usage

```sql
-- View tenant usage
SELECT 
  tenant_org_id,
  orders_used,
  orders_limit
FROM org_subscriptions_mst
WHERE tenant_org_id = 'tenant-uuid';
```

## Settings Configuration

### Workflow Settings

Configure workflow behavior via settings:

**Via HQ Platform API:**
```typescript
// Disable workflow screen
await hqApiClient.upsertOverride(tenantId, {
  settingCode: 'workflow.assembly.enabled',
  value: false,
});
```

**Via Database:**
```sql
-- Set tenant override
INSERT INTO org_tenant_settings_cf (
  tenant_org_id,
  setting_code,
  setting_value_jsonb
) VALUES (
  'tenant-uuid',
  'workflow.assembly.enabled',
  'false'::jsonb
);
```

### Available Settings

- `workflow.{screen}.enabled` - Enable/disable workflow screen
- `workflow.quality_gates.strict` - Enable strict quality gates
- `workflow.auto_transition.enabled` - Enable auto-transitions

## Webhook Configuration

### Subscribe to Transition Events

```sql
INSERT INTO org_ord_webhook_subscriptions_cf (
  tenant_org_id,
  screen_key,
  event_type,
  webhook_url,
  webhook_secret
) VALUES (
  'tenant-uuid',
  'preparation',
  'TRANSITION_COMPLETED',
  'https://example.com/webhook',
  'secret-key'
);
```

### Event Types

- `TRANSITION_STARTED` - Transition initiated
- `TRANSITION_COMPLETED` - Transition successful
- `TRANSITION_FAILED` - Transition failed
- `WEBHOOK_SENT` - Webhook notification sent

## Workflow Template Versioning

### Create Template Version

```sql
INSERT INTO sys_ord_workflow_template_versions (
  template_id,
  version_number,
  template_snapshot,
  change_description
) VALUES (
  'template-uuid',
  2,
  '{"stages": [...]}'::jsonb,
  'Added QA stage'
);
```

### Rollback to Previous Version

```sql
-- Get previous version snapshot
SELECT template_snapshot
FROM sys_ord_workflow_template_versions
WHERE template_id = 'template-uuid'
ORDER BY version_number DESC
LIMIT 1 OFFSET 1;
```

## Monitoring and Troubleshooting

### View Transition Events

```sql
SELECT *
FROM org_ord_transition_events
WHERE tenant_org_id = 'tenant-uuid'
ORDER BY created_at DESC
LIMIT 100;
```

### Check Failed Transitions

```sql
SELECT *
FROM org_ord_transition_events
WHERE event_type = 'TRANSITION_FAILED'
AND tenant_org_id = 'tenant-uuid'
ORDER BY created_at DESC;
```

### View Order History

```sql
SELECT *
FROM org_order_history
WHERE order_id = 'order-uuid'
ORDER BY done_at DESC;
```

## Best Practices

1. **Start with system defaults** - Only override when necessary
2. **Test changes** - Test workflow changes in staging first
3. **Monitor events** - Set up alerts for failed transitions
4. **Document customizations** - Document tenant-specific configurations
5. **Version control** - Use template versioning for major changes

## Migration Checklist

When migrating tenants to new workflow system:

- [ ] Enable `USE_NEW_WORKFLOW_SYSTEM` feature flag
- [ ] Verify screen contracts are configured
- [ ] Test transitions for each screen
- [ ] Monitor transition events
- [ ] Verify quality gates work correctly
- [ ] Check webhook subscriptions
- [ ] Update user documentation

