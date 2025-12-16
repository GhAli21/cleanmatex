# Workflow Seed Auto-Initialization Plan

## Overview
Extend the existing `initialize_new_tenant()` function in `0007_tenant_auto_init.sql` to automatically create default workflow configurations for newly registered tenants.

## Current State
- Migration `0013_workflow_status_system.sql` seeds workflow configs for **existing** tenants using a `SELECT...FROM org_tenants_mst` query
- Migration `0007_tenant_auto_init.sql` has a trigger that auto-initializes new tenants with subscription, branch, and service categories
- **Gap**: New tenants created after migration 0013 don't get workflow configs automatically

## Implementation Strategy

### Option 1: Extend `initialize_new_tenant()` Function (Recommended)
**File**: `supabase/migrations/0007_tenant_auto_init.sql`

Add workflow seeding logic to the existing `initialize_new_tenant()` function:
- After service category enablement (around line 150)
- Insert default workflow config (NULL category)
- Insert category-specific workflow configs (e.g., PRESSED_IRONED)
- Return workflow IDs in result JSONB

**Pros**:
- Single source of truth for tenant initialization
- Consistent with existing pattern
- Automatically covers all tenant creation paths

**Cons**:
- Modifies existing migration (need new migration to ALTER function)

### Option 2: Create Separate Trigger (Alternative)
Create a dedicated trigger on `org_tenants_mst` that fires after `trg_after_tenant_insert` to seed workflows.

**Pros**:
- Cleaner separation of concerns
- Easier to test independently

**Cons**:
- Multiple triggers on same event
- Harder to maintain initialization order

## Implementation Steps (Option 1 - Recommended)

### 1. Create New Migration
**File**: `supabase/migrations/0017_workflow_auto_seed.sql`

- Use `CREATE OR REPLACE FUNCTION` to update `initialize_new_tenant()`
- Add workflow seeding step after service categories
- Seed default workflow (service_category_code = NULL)
- Optionally seed category-specific workflows if categories are enabled

### 2. Workflow Seeding Logic
```sql
-- Add to initialize_new_tenant() around line 180
-- Step 4: Create default workflow configurations
RAISE NOTICE '  → Creating workflow configurations...';

-- Default workflow (all orders)
INSERT INTO org_workflow_settings_cf (
  tenant_org_id,
  service_category_code,
  workflow_steps,
  status_transitions,
  quality_gate_rules
) VALUES (
  p_tenant_id,
  NULL,
  '["DRAFT","INTAKE","PREPARATION",...,"CLOSED"]'::jsonb,
  '{...transitions...}'::jsonb,
  '{...gates...}'::jsonb
)
ON CONFLICT (tenant_org_id, service_category_code) DO NOTHING
RETURNING id INTO v_workflow_default_id;

-- Category-specific workflow for PRESSED_IRONED (if enabled)
IF EXISTS (
  SELECT 1 FROM org_service_category_cf 
  WHERE tenant_org_id = p_tenant_id 
  AND service_category_code = 'PRESSED_IRONED'
) THEN
  INSERT INTO org_workflow_settings_cf (...)
  VALUES (...) -- simplified workflow for ironing
  RETURNING id INTO v_workflow_ironing_id;
END IF;
```

### 3. Update Result JSON
Add workflow IDs to the function's return value:
```sql
v_result := jsonb_build_object(
  ...
  'workflow_configs', jsonb_build_object(
    'default_id', v_workflow_default_id,
    'category_specific_count', v_category_workflow_count
  ),
  ...
);
```

### 4. Backfill Existing Tenants (Optional Safety Net)
Add a validation query at end of migration to ensure all tenants have configs:
```sql
-- Backfill any tenants created between migrations 0013 and 0017
INSERT INTO org_workflow_settings_cf (...)
SELECT ...
FROM org_tenants_mst t
WHERE NOT EXISTS (
  SELECT 1 FROM org_workflow_settings_cf w
  WHERE w.tenant_org_id = t.id
  AND w.service_category_code IS NULL
)
ON CONFLICT DO NOTHING;
```

## Files to Modify/Create
1. **New**: `supabase/migrations/0017_workflow_auto_seed.sql`
2. **Reference**: `supabase/migrations/0007_tenant_auto_init.sql` (read to understand structure)
3. **Reference**: `supabase/migrations/0013_workflow_status_system.sql` (copy workflow JSON from lines 212-235)

## Testing Checklist
- [ ] Create new tenant via registration API
- [ ] Verify default workflow config exists with `service_category_code = NULL`
- [ ] Verify category-specific workflows created if categories enabled
- [ ] Check `initialize_new_tenant()` return value includes workflow IDs
- [ ] Test idempotency (re-run initialization doesn't duplicate)
- [ ] Validate composite FK constraint respected

## Rollout
- Migration 0017 is additive (extends function, doesn't break existing)
- Safe to apply to production
- Backfill clause ensures no tenants are missed
