# Orders Workflow Screens Implementation Plan (Enhanced)

**Version:** 2.0.0  
**Created:** 2026-01-09  
**Status:** Planning Phase  
**Last Updated:** 2026-01-09

---

## Executive Summary

This plan implements a complete configuration-driven Orders workflow system where all screen logic (pre-conditions, post-conditions, transitions, validations) is derived from database functions and configuration tables. The implementation follows the "Screen Contract Functions" (SCF) pattern where the database is the single source of truth for workflow rules.

**Key Principles:**

1. **Status fields (`current_status`, `current_stage`, `item_status`, `piece_status`, `scan_state`) may ONLY change via transition service** - enforced by application logic (no database triggers)
2. **Every transition writes history** - mandatory audit trail
3. **Each screen has a contract** - PRE conditions, permissions, POST status resolution, validation rules, atomic execution
4. **Database-driven configuration** - no hardcoded workflow logic in application code
5. **Future-proof and flexible** - easy to add new screens, validations, and workflow variations
6. **ALL database functions use `cmx_ord_*` prefix** - See [Function Naming Convention](function_naming_convention.md) for details
7. **Two-layer validation** - Screen/API validation AND database validation for security
8. **Feature flags, plan limits, and settings integration** - All workflow features respect tenant plan limits and feature flags
9. **Gradual migration** - Implement alongside existing code using `USE_OLD_CODE_OR_NEW` boolean parameter

---

## Critical Enhancements to Draft SQL Files

### Table Naming Convention (MANDATORY)

**RULE: ALL configuration tables for order workflow MUST use `sys_ord_*_cf` naming**

#### Configuration Tables (sys*ord*\*\_cf):

- `sys_ord_screen_contracts_cf` - Screen contract customization (system-level config, can have tenant_org_id)
- `sys_ord_custom_validations_cf` - Custom validation functions (system-level config, can have tenant_org_id)
- `sys_ord_webhook_subscriptions_cf` - Webhook subscription configuration (system-level config, can have tenant_org_id)

#### Tenant-Specific Data Tables (org*ord*\*):

- `org_ord_transition_events` - Event logs (tenant-specific data)
- `org_order_history` - Status transition history (tenant-specific data)
- `org_ord_workflow_settings_cf` - Tenant-specific workflow settings/overrides (if needed)

#### Versioning Tables (sys*ord*\*):

- `sys_ord_workflow_template_versions` - Workflow template version history

**Naming Rules:**

- **Configuration tables:** `sys_ord_*_cf` (system-level order workflow configuration)
- **Tenant-specific data tables:** `org_ord_*` (tenant-specific order workflow data)
- **Tenant-specific config overrides:** Can use `org_ord_*_cf` if needed for tenant-specific configuration

### Function Naming Convention (MANDATORY)

**RULE: ALL database functions MUST start with `cmx_ord_` prefix**

#### Core Functions (Generic):

- `cmx_ord_screen_pre_conditions(p_screen text)`
- `cmx_ord_screen_required_permissions(p_screen text)`
- `cmx_ord_screen_end_user_help(p_screen text)`
- `cmx_ord_screen_dev_help(p_screen text)`
- `cmx_ord_order_workflow_flags(p_tenant_org_id uuid, p_order_id uuid)`
- `cmx_ord_order_live_metrics(p_tenant_org_id uuid, p_order_id uuid)`
- `cmx_ord_resolve_post_status(...)`
- `cmx_ord_validate_transition(...)`
- `cmx_ord_execute_screen_transition(...)`
- `cmx_ord_get_effective_screen_contract(...)`
- `cmx_ord_validate_transition_enhanced(...)`
- `cmx_ord_emit_transition_event(...)`
- `cmx_ord_get_workflow_version(...)`
- `cmx_ord_check_feature_flags(...)` - Check feature flags for workflow features
- `cmx_ord_check_plan_limits(...)` - Check plan limits/constraints
- `cmx_ord_check_settings(...)` - Check tenant settings

#### Per-Screen Wrapper Functions:

- `cmx_ord_preparation_pre_conditions()`
- `cmx_ord_preparation_required_permissions()`
- `cmx_ord_preparation_resolve_post_status(...)`
- `cmx_ord_preparation_transition(...)`
- `cmx_ord_preparation_end_user_help()`
- `cmx_ord_preparation_dev_help()`

Similar pattern for: `processing`, `assembly`, `qa`, `packing`, `ready_release`, `driver_delivery`, `exceptions`, `new_order`, `workboard`

#### Legacy Functions (Consider Deprecation):

- `cmx_order_transition()` - **Should be deprecated** in favor of `cmx_ord_execute_screen_transition()` or per-screen wrappers
- `cmx_get_allowed_transitions()` - **Should be renamed** to `cmx_ord_get_allowed_transitions()` for consistency

**Note:** All new functions MUST use `cmx_ord_*` prefix. Existing functions without this prefix should be considered for renaming or deprecation.

### Issues Identified in Draft Files

1. **Function Naming Inconsistency**

   - Draft wrapper functions use `cmx_*` prefix (e.g., `cmx_preparation_pre_conditions()`) but should use `cmx_ord_*` prefix
   - Draft wrapper functions call `cmx_screen_*` functions which don't exist - should call `cmx_ord_*` functions
   - **Fix:** All database functions must use `cmx_ord_*` prefix consistently:
     - Core functions: `cmx_ord_screen_pre_conditions()`, `cmx_ord_execute_screen_transition()`, etc.
     - Per-screen wrappers: `cmx_ord_preparation_pre_conditions()`, `cmx_ord_preparation_transition()`, etc. (not `cmx_preparation_*`)

2. **Schema Field Mismatches**

   - Draft assumes `is_quick_drop` but actual field is `is_order_quick_drop`
   - Draft assumes `org_workflow_templates` but actual uses `sys_workflow_template_cd` + `org_tenant_workflow_templates_cf`
   - **Fix:** Align all function references to actual schema

3. **Status Field Protection**

   - Status fields should only change via transition service
   - **Fix:** Enforce via application logic (API/service layer), NOT database triggers
   - All status updates must go through `cmx_ord_execute_screen_transition()` function

4. **Workflow Template Resolution**

   - Draft uses simple lookup, but actual schema has tenant-specific assignments
   - **Fix:** Implement proper resolution: order → tenant default → system default

5. **Missing Flexibility Mechanisms**
   - Hardcoded screen contracts, no tenant customization
   - **Fix:** Add configuration tables for customizable screen contracts

---

## Enhanced Database Design

### Phase 1.1: Enhanced Screen Contract Functions

**File:** `supabase/migrations/NNNN_screen_contract_functions_enhanced.sql`

#### Key Enhancements:

1. **Fixed Function Names - ALL functions use `cmx_ord_*` prefix**

   - **Core functions:** `cmx_ord_screen_pre_conditions()`, `cmx_ord_execute_screen_transition()`, `cmx_ord_validate_transition()`, etc.
   - **Per-screen wrapper functions:** `cmx_ord_preparation_*()`, `cmx_ord_processing_*()`, `cmx_ord_assembly_*()`, etc.
   - **NO exceptions:** All database functions must start with `cmx_ord_`
   - Wrapper functions correctly reference core `cmx_ord_*` functions

2. **Schema Alignment**

   ```sql
   -- Use actual field names
   is_order_quick_drop (not is_quick_drop)
   sys_workflow_template_cd + org_tenant_workflow_templates_cf (not org_workflow_templates)

   -- Configuration tables use sys_ord_*_cf naming
   sys_ord_screen_contracts_cf (not org_screen_contracts_cf)
   sys_ord_custom_validations_cf (not org_custom_validations_cf)
   sys_ord_webhook_subscriptions_cf (not org_webhook_subscriptions)
   ```

3. **Enhanced Workflow Template Resolution**

   ```sql
   -- Proper resolution order:
   -- 1. Order's workflow_template_id
   -- 2. Tenant's default template (org_tenant_workflow_templates_cf where is_default=true)
   -- 3. System default template (sys_workflow_template_cd where template_code='WF_STANDARD')
   ```

4. **Status Field Protection (Application-Level)**

   ```typescript
   // Enforce in API/service layer - NO database triggers
   // All status updates must go through transition service

   // In WorkflowService:
   async changeStatus(orderId: string, newStatus: string) {
     // REJECT direct status updates
     throw new Error('Direct status updates not allowed. Use executeScreenTransition()');
   }

   // Only allow via:
   async executeScreenTransition(screen: string, orderId: string, input: object) {
     // Calls cmx_ord_execute_screen_transition() database function
   }
   ```

5. **Configurable Screen Contracts Table**

   ```sql
   -- Configuration table: uses sys_ord_*_cf naming convention
   CREATE TABLE sys_ord_screen_contracts_cf (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_org_id UUID NOT NULL, -- Tenant-specific customization
     screen_key TEXT NOT NULL,
     pre_conditions JSONB NOT NULL,
     required_permissions JSONB NOT NULL,
     post_status_rules JSONB, -- Custom post-status resolution rules
     validation_rules JSONB,  -- Custom validation rules
     is_active BOOLEAN DEFAULT true,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW(),
     UNIQUE(tenant_org_id, screen_key)
   );

   COMMENT ON TABLE sys_ord_screen_contracts_cf IS 'Order workflow screen contract configuration - allows tenant-specific customization of screen behavior';
   ```

6. **Enhanced Error Messages with Localization Support**

   ```sql
   -- Error messages include i18n keys
   jsonb_build_object(
     'code', 'NO_ITEMS',
     'message', 'Cannot move to processing without items.',
     'i18n_key', 'workflow.errors.no_items',
     'severity', 'error'
   )
   ```

7. **Idempotency Support**

   ```sql
   -- Check idempotency key in history before processing
   IF p_idempotency_key IS NOT NULL THEN
     IF EXISTS (
       SELECT 1 FROM org_order_history
       WHERE tenant_org_id = p_tenant_org_id
         AND order_id = p_order_id
         AND meta->>'idempotency_key' = p_idempotency_key
     ) THEN
       -- Return existing result
       RETURN (SELECT result FROM org_order_history WHERE ...);
     END IF;
   END IF;
   ```

8. **Enhanced Metrics Calculation**
   ```sql
   -- Add more comprehensive metrics
   RETURN jsonb_build_object(
     'items_count', v_items_count,
     'qty_total', v_qty_total,
     'pieces_total', v_pieces_total,
     'pieces_scanned', v_pieces_scanned,
     'pieces_missing', v_pieces_missing,
     'pieces_wrong', v_pieces_wrong,
     'all_items_processed', v_all_items_processed,
     'blocking_issues', v_blocking_issues,
     'non_blocking_issues', v_non_blocking_issues,
     'assembly_complete', (v_qty_total > 0 AND v_pieces_scanned = v_qty_total),
     'qa_passed', v_qa_passed,
     'payment_collected', v_payment_collected,
     'ready_by_overdue', (NOW() > v_order.ready_by_at_new),
     'sla_hours_remaining', EXTRACT(EPOCH FROM (v_order.ready_by_at_new - NOW())) / 3600
   );
   ```

### Phase 1.2: Two-Layer Validation System

**Purpose:** Implement validation at both screen/API layer AND database layer for security

#### Screen/API Layer Validation

**File:** `web-admin/lib/services/workflow-service.ts`

```typescript
// Pre-validation before calling database function
async executeScreenTransition(
  screen: string,
  orderId: string,
  input: object,
  options?: { useOldCodeOrNew?: boolean }
) {
  // Use feature flag to choose old or new code
  const USE_OLD_CODE_OR_NEW = options?.useOldCodeOrNew ??
    await getFeatureFlag('USE_NEW_WORKFLOW_SYSTEM', tenantId);

  if (!USE_OLD_CODE_OR_NEW) {
    // Use existing old code path
    return this.changeStatusOld(orderId, ...);
  }

  // NEW CODE PATH:

  // 1. Screen-level validation
  const contract = await this.getScreenContract(screen);
  const preConditions = contract.preConditions;

  // Validate order matches pre-conditions
  const order = await this.getOrder(orderId);
  if (!preConditions.statuses.includes(order.current_status)) {
    throw new ValidationError('Order status does not match screen requirements');
  }

  // 2. Permission check
  const requiredPermissions = contract.requiredPermissions;
  if (!await this.hasPermissions(requiredPermissions)) {
    throw new PermissionError('Missing required permissions');
  }

  // 3. Feature flag check
  if (!await this.checkFeatureFlags(screen, order)) {
    throw new FeatureFlagError('Feature not enabled for this tenant');
  }

  // 4. Plan limits check
  if (!await this.checkPlanLimits(order)) {
    throw new LimitExceededError('Plan limit exceeded');
  }

  // 5. Settings check
  if (!await this.checkSettings(screen, order)) {
    throw new SettingsError('Setting prevents this action');
  }

  // 6. Call database function (which does its own validation)
  return await this.callDatabaseTransition(screen, orderId, input);
}
```

#### Database Layer Validation

**File:** `supabase/migrations/NNNN_screen_contract_functions_enhanced.sql`

```sql
-- Enhanced validation function with feature flags, plan limits, settings
CREATE OR REPLACE FUNCTION cmx_ord_validate_transition(
  p_screen TEXT,
  p_order_status TEXT,
  p_flags JSONB,
  p_metrics JSONB,
  p_to_status TEXT,
  p_input JSONB,
  p_tenant_org_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_errors JSONB := '[]'::jsonb;
  v_feature_flags JSONB;
  v_plan_limits JSONB;
  v_settings JSONB;
BEGIN
  -- 1. Basic validation (existing logic)
  -- ... existing validation code ...

  -- 2. Feature flags check
  IF p_tenant_org_id IS NOT NULL THEN
    v_feature_flags := cmx_ord_check_feature_flags(p_tenant_org_id, p_screen);
    IF (v_feature_flags->>'enabled')::boolean = false THEN
      v_errors := v_errors || jsonb_build_object(
        'code', 'FEATURE_DISABLED',
        'message', v_feature_flags->>'message',
        'i18n_key', 'workflow.errors.feature_disabled'
      );
    END IF;
  END IF;

  -- 3. Plan limits check
  IF p_tenant_org_id IS NOT NULL THEN
    v_plan_limits := cmx_ord_check_plan_limits(p_tenant_org_id, p_screen, p_input);
    IF (v_plan_limits->>'allowed')::boolean = false THEN
      v_errors := v_errors || jsonb_build_object(
        'code', 'PLAN_LIMIT_EXCEEDED',
        'message', v_plan_limits->>'message',
        'i18n_key', 'workflow.errors.plan_limit_exceeded',
        'limit_type', v_plan_limits->>'limit_type',
        'current_value', v_plan_limits->>'current_value',
        'limit_value', v_plan_limits->>'limit_value'
      );
    END IF;
  END IF;

  -- 4. Settings check
  IF p_tenant_org_id IS NOT NULL THEN
    v_settings := cmx_ord_check_settings(p_tenant_org_id, p_screen, p_input);
    IF (v_settings->>'allowed')::boolean = false THEN
      v_errors := v_errors || jsonb_build_object(
        'code', 'SETTING_BLOCKS_ACTION',
        'message', v_settings->>'message',
        'i18n_key', 'workflow.errors.setting_blocks_action',
        'setting_key', v_settings->>'setting_key'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', jsonb_array_length(v_errors) = 0,
    'errors', v_errors
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

### Phase 1.3: Feature Flags, Plan Limits, and Settings Integration

**Purpose:** Integrate workflow system with existing feature flags, plan limits, and settings

#### Feature Flags Integration

```sql
-- Function to check feature flags for workflow features
CREATE OR REPLACE FUNCTION cmx_ord_check_feature_flags(
  p_tenant_org_id UUID,
  p_screen TEXT
) RETURNS JSONB AS $$
DECLARE
  v_flag_key TEXT;
  v_flag_value JSONB;
  v_enabled BOOLEAN;
BEGIN
  -- Map screen to feature flag key
  v_flag_key := CASE p_screen
    WHEN 'assembly' THEN 'assembly_workflow'
    WHEN 'qa' THEN 'qa_workflow'
    WHEN 'packing' THEN 'packing_workflow'
    WHEN 'driver_delivery' THEN 'driver_app'
    ELSE 'basic_workflow'
  END;

  -- Check feature flag using HQ feature flags system
  SELECT hq_ff_get_effective_flag_value(p_tenant_org_id, v_flag_key)
  INTO v_flag_value;

  v_enabled := COALESCE((v_flag_value->>'value')::boolean, false);

  RETURN jsonb_build_object(
    'enabled', v_enabled,
    'flag_key', v_flag_key,
    'message', CASE WHEN NOT v_enabled THEN 'Feature not enabled for your plan' ELSE NULL END
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

#### Plan Limits Integration

```sql
-- Function to check plan limits/constraints
CREATE OR REPLACE FUNCTION cmx_ord_check_plan_limits(
  p_tenant_org_id UUID,
  p_screen TEXT,
  p_input JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
  v_plan_code TEXT;
  v_limit_type TEXT;
  v_current_value INTEGER;
  v_limit_value INTEGER;
  v_allowed BOOLEAN := true;
  v_message TEXT;
BEGIN
  -- Get tenant's plan
  SELECT s_current_plan INTO v_plan_code
  FROM org_tenants_mst
  WHERE id = p_tenant_org_id;

  -- Check order count limits (if creating new order)
  IF p_screen = 'new_order' THEN
    SELECT orders_used, orders_limit
    INTO v_current_value, v_limit_value
    FROM org_subscriptions_mst
    WHERE tenant_org_id = p_tenant_org_id;

    IF v_current_value >= v_limit_value THEN
      v_allowed := false;
      v_message := format('Order limit reached (%s/%s). Please upgrade your plan.',
        v_current_value, v_limit_value);
      v_limit_type := 'orders_limit';
    END IF;
  END IF;

  -- Check plan setting constraints
  -- Example: Check if workflow template is allowed for this plan
  IF p_input ? 'workflow_template_id' THEN
    -- Check sys_plan_setting_constraints for workflow_template setting
    -- ... constraint check logic ...
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'message', v_message,
    'limit_type', v_limit_type,
    'current_value', v_current_value,
    'limit_value', v_limit_value
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

#### Settings Integration

```sql
-- Function to check tenant settings
CREATE OR REPLACE FUNCTION cmx_ord_check_settings(
  p_tenant_org_id UUID,
  p_screen TEXT,
  p_input JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
  v_setting_value JSONB;
  v_allowed BOOLEAN := true;
  v_message TEXT;
  v_setting_key TEXT;
BEGIN
  -- Check screen-specific settings
  v_setting_key := 'workflow.' || p_screen || '.enabled';

  -- Get effective setting value (from org_tenant_settings_cf or sys_tenant_settings_cd)
  SELECT stng_get_effective_value(p_tenant_org_id, v_setting_key)
  INTO v_setting_value;

  -- If setting exists and is false, block action
  IF v_setting_value IS NOT NULL AND (v_setting_value->>'value')::boolean = false THEN
    v_allowed := false;
    v_message := 'This workflow screen is disabled in your settings';
    v_setting_key := v_setting_key;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'message', v_message,
    'setting_key', v_setting_key
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

### Phase 1.3: Enhanced Per-Screen Wrapper Functions

**File:** `supabase/migrations/NNNN_per_screen_wrappers_enhanced.sql`

#### Fixes:

1. **Correct Function Naming - ALL functions use `cmx_ord_*` prefix**

   ```sql
   -- CORRECT: All wrapper functions use cmx_ord_ prefix
   CREATE OR REPLACE FUNCTION cmx_ord_preparation_pre_conditions()
   RETURNS jsonb
   LANGUAGE sql
   IMMUTABLE
   AS $$ SELECT cmx_ord_screen_pre_conditions('preparation'); $$;

   CREATE OR REPLACE FUNCTION cmx_ord_preparation_transition(
     p_tenant_org_id uuid,
     p_order_id uuid,
     p_user_id uuid,
     p_input jsonb default '{}'::jsonb,
     p_idempotency_key text default null,
     p_expected_updated_at timestamp default null
   ) RETURNS jsonb
   LANGUAGE sql
   SECURITY DEFINER
   AS $$ SELECT cmx_ord_execute_screen_transition(p_tenant_org_id, 'preparation', p_order_id, p_user_id, p_input, p_idempotency_key, p_expected_updated_at); $$;

   -- WRONG (from draft):
   -- CREATE FUNCTION cmx_preparation_pre_conditions() ... -- Missing cmx_ord_ prefix
   -- AS $$ SELECT cmx_screen_pre_conditions('preparation'); $$; -- Wrong function name
   ```

2. **Function Naming Convention - Complete List**

   ```sql
   -- All per-screen wrapper functions follow this pattern:
   -- cmx_ord_{screen}_pre_conditions()
   -- cmx_ord_{screen}_required_permissions()
   -- cmx_ord_{screen}_resolve_post_status()
   -- cmx_ord_{screen}_transition()
   -- cmx_ord_{screen}_end_user_help()
   -- cmx_ord_{screen}_dev_help()

   -- Screens: preparation, processing, assembly, qa, packing, ready_release, driver_delivery, exceptions, new_order, workboard
   ```

3. **Add Missing Fields**

   ```sql
   -- Include previous_status in transition function
   -- Include current_stage synchronization
   ```

4. **Enhanced Error Handling**
   ```sql
   -- Wrap in exception handling
   BEGIN
     RETURN cmx_ord_execute_screen_transition(...);
   EXCEPTION
     WHEN OTHERS THEN
       RETURN jsonb_build_object(
         'ok', false,
         'code', 'FUNCTION_ERROR',
         'message', SQLERRM
       );
   END;
   ```

---

## Flexibility & Future-Proofing Enhancements

### Phase 1.4: Configurable Screen Contracts

**Purpose:** Allow tenants to customize screen behavior without code changes

**Implementation:**

```sql
-- Screen contract configuration table (already defined above)
-- Function to get effective screen contract (tenant override or default)
CREATE OR REPLACE FUNCTION cmx_ord_get_effective_screen_contract(
  p_tenant_org_id UUID,
  p_screen TEXT
) RETURNS JSONB AS $$
DECLARE
  v_custom JSONB;
  v_default JSONB;
BEGIN
  -- Try tenant-specific override
  SELECT jsonb_build_object(
    'pre_conditions', pre_conditions,
    'required_permissions', required_permissions,
    'post_status_rules', post_status_rules,
    'validation_rules', validation_rules
  ) INTO v_custom
   FROM sys_ord_screen_contracts_cf
  WHERE tenant_org_id = p_tenant_org_id
    AND screen_key = p_screen
    AND is_active = true;

  -- Fall back to default
  IF v_custom IS NULL THEN
    v_default := jsonb_build_object(
      'pre_conditions', cmx_ord_screen_pre_conditions(p_screen),
      'required_permissions', cmx_ord_screen_required_permissions(p_screen)
    );
    RETURN v_default;
  END IF;

  -- Merge custom with defaults (custom takes precedence)
  RETURN v_custom || jsonb_build_object(
    'pre_conditions', COALESCE(v_custom->'pre_conditions', cmx_ord_screen_pre_conditions(p_screen)),
    'required_permissions', COALESCE(v_custom->'required_permissions', cmx_ord_screen_required_permissions(p_screen))
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

### Phase 1.5: Plugin Architecture for Custom Validations

**Purpose:** Allow custom validation logic per tenant without modifying core functions

**Implementation:**

```sql
-- Custom validation functions table
CREATE TABLE sys_ord_custom_validations_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  screen_key TEXT NOT NULL,
  validation_name TEXT NOT NULL,
  validation_function_name TEXT NOT NULL, -- Name of function to call
  validation_order INTEGER DEFAULT 0, -- Order of execution
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced validation function that calls custom validations
CREATE OR REPLACE FUNCTION cmx_ord_validate_transition_enhanced(
  p_tenant_org_id UUID,
  p_screen TEXT,
  p_order_status TEXT,
  p_flags JSONB,
  p_metrics JSONB,
  p_to_status TEXT,
  p_input JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
  v_base_validation JSONB;
  v_custom_validation JSONB;
  v_custom_func_name TEXT;
  v_errors JSONB := '[]'::jsonb;
BEGIN
  -- Run base validation
  v_base_validation := cmx_ord_validate_transition(
    p_screen, p_order_status, p_flags, p_metrics, p_to_status, p_input
  );

  -- Collect base errors
  IF (v_base_validation->>'ok')::boolean = false THEN
    v_errors := v_base_validation->'errors';
  END IF;

  -- Run custom validations
  FOR v_custom_func_name IN
    SELECT validation_function_name
    FROM sys_ord_custom_validations_cf
    WHERE tenant_org_id = p_tenant_org_id
      AND screen_key = p_screen
      AND is_active = true
    ORDER BY validation_order
  LOOP
    -- Dynamically call custom validation function
    EXECUTE format('SELECT %I($1, $2, $3, $4, $5, $6)',
      v_custom_func_name)
    INTO v_custom_validation
    USING p_tenant_org_id, p_screen, p_order_status, p_flags, p_metrics, p_to_status, p_input;

    -- Merge errors
    IF (v_custom_validation->>'ok')::boolean = false THEN
      v_errors := v_errors || (v_custom_validation->'errors');
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', jsonb_array_length(v_errors) = 0,
    'errors', v_errors
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

### Phase 1.6: Event/Webhook System

**Purpose:** Allow external systems to react to workflow transitions

**Implementation:**

```sql
-- Transition events table (data/logs, NOT config - uses org_ prefix)
CREATE TABLE org_ord_transition_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  order_id UUID NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  screen TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'transition', 'validation_failed', 'quality_gate_blocked'
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook subscriptions table (configuration)
CREATE TABLE sys_ord_webhook_subscriptions_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  secret_token TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to emit events (called from transition function)
CREATE OR REPLACE FUNCTION cmx_ord_emit_transition_event(
  p_tenant_org_id UUID,
  p_order_id UUID,
  p_from_status TEXT,
  p_to_status TEXT,
  p_screen TEXT,
  p_event_type TEXT,
  p_payload JSONB
) RETURNS VOID AS $$
BEGIN
  INSERT INTO org_ord_transition_events (
    tenant_org_id, order_id, from_status, to_status, screen, event_type, payload
  ) VALUES (
    p_tenant_org_id, p_order_id, p_from_status, p_to_status, p_screen, p_event_type, p_payload
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Phase 1.7: Workflow Versioning

**Purpose:** Track workflow template changes for audit compliance

**Implementation:**

```sql
-- Workflow template versions table (versioning/history, uses sys_ prefix)
CREATE TABLE sys_ord_workflow_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES sys_workflow_template_cd(template_id),
  version_number INTEGER NOT NULL,
  transitions JSONB NOT NULL,
  stages JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  UNIQUE(template_id, version_number)
);

-- Track which version was used for each order
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS workflow_template_version_id UUID;

-- Function to get workflow version used for order
CREATE OR REPLACE FUNCTION cmx_ord_get_workflow_version(
  p_order_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_version INTEGER;
BEGIN
  SELECT version_number INTO v_version
  FROM sys_ord_workflow_template_versions
  WHERE id = (
    SELECT workflow_template_version_id
    FROM org_orders_mst
    WHERE id = p_order_id
  );

  RETURN COALESCE(v_version, 1);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

---

## Enhanced API Layer

### Phase 2.1: Enhanced Transition API

**File:** `web-admin/app/api/v1/orders/[id]/transition/route.ts`

#### Enhancements:

1. **Idempotency Key Support**

   ```typescript
   const idempotencyKey = request.headers.get("Idempotency-Key");
   if (idempotencyKey) {
     // Check if already processed
     const existing = await checkIdempotency(idempotencyKey);
     if (existing) return existing;
   }
   ```

2. **Optimistic Concurrency**

   ```typescript
   const expectedUpdatedAt = body.expected_updated_at;
   // Pass to database function for conflict detection
   ```

3. **Enhanced Error Responses**

   ```typescript
   {
     ok: false,
     code: 'VALIDATION_FAILED',
     message: 'Transition validation failed',
     validation: {
       errors: [
         {
           code: 'ITEMS_NOT_PROCESSED',
           message: 'All items must be processed first.',
           i18n_key: 'workflow.errors.items_not_processed',
           severity: 'error',
           field: 'items'
         }
       ]
     },
     flags: {...},
     metrics: {...}
   }
   ```

4. **Event Emission**
   ```typescript
   // After successful transition, emit event for webhooks
   await emitTransitionEvent({
     tenantId,
     orderId,
     fromStatus: result.from_status,
     toStatus: result.to_status,
     screen: body.screen,
     eventType: "transition",
     payload: body.input,
   });
   ```

### Phase 2.2: Screen Contract API with Caching

**File:** `web-admin/app/api/v1/workflows/screens/[screen]/contract/route.ts`

#### Enhancements:

1. **Tenant-Specific Contracts**

   ```typescript
   // Check for tenant-specific override first
   const customContract = await getCustomScreenContract(tenantId, screen);
   if (customContract) return customContract;

   // Fall back to default
   return await getDefaultScreenContract(screen);
   ```

2. **Caching**

   ```typescript
   // Cache screen contracts (immutable, can cache aggressively)
   const cacheKey = `screen_contract:${screen}`;
   const cached = await redis.get(cacheKey);
   if (cached) return JSON.parse(cached);

   // Fetch and cache
   const contract = await fetchContract(screen);
   await redis.setex(cacheKey, 3600, JSON.stringify(contract));
   return contract;
   ```

---

## Frontend Enhancements

### Phase 3.1: Enhanced Hooks with Caching

**File:** `web-admin/lib/hooks/use-screen-contract.ts`

#### Enhancements:

1. **React Query Caching**

   ```typescript
   export function useScreenContract(screen: ScreenKey) {
     return useQuery({
       queryKey: ["screen-contract", screen],
       queryFn: () => fetchScreenContract(screen),
       staleTime: Infinity, // Screen contracts are immutable
       cacheTime: Infinity,
     });
   }
   ```

2. **Type Safety**
   ```typescript
   interface ScreenContract {
     preConditions: {
       statuses: string[];
       additional?: Record<string, any>;
       notes?: string;
     };
     requiredPermissions: string[];
     helpText: {
       endUser: string;
       developer: string;
     };
   }
   ```

### Phase 3.2: Enhanced Transition Hook with Optimistic Updates

**File:** `web-admin/lib/hooks/use-order-transition.ts`

#### Enhancements:

1. **Optimistic Updates**

   ```typescript
   const queryClient = useQueryClient();

   mutate(
     {
       screen,
       input,
       idempotencyKey: generateIdempotencyKey(),
       expectedUpdatedAt: order.updated_at,
     },
     {
       onMutate: async (variables) => {
         // Cancel outgoing queries
         await queryClient.cancelQueries(["order", orderId]);

         // Snapshot previous value
         const previousOrder = queryClient.getQueryData(["order", orderId]);

         // Optimistically update
         queryClient.setQueryData(["order", orderId], (old: Order) => ({
           ...old,
           current_status: expectedNextStatus,
           updated_at: new Date(),
         }));

         return { previousOrder };
       },
       onError: (err, variables, context) => {
         // Rollback on error
         queryClient.setQueryData(["order", orderId], context.previousOrder);
       },
       onSettled: () => {
         // Refetch to ensure consistency
         queryClient.invalidateQueries(["order", orderId]);
       },
     }
   );
   ```

2. **Retry Logic**
   ```typescript
   {
     retry: 3,
     retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
     onRetry: (error) => {
       // Log retry attempt
       console.warn('Retrying transition:', error);
     }
   }
   ```

---

## Testing Strategy Enhancements

### Phase 6.1: Comprehensive Database Function Tests

**File:** `supabase/tests/functions/test_screen_contracts.sql`

#### Test Coverage:

1. **Function Naming Consistency**

   ```sql
   -- Test that all wrapper functions call correct core functions
   SELECT assert_function_exists('cmx_ord_screen_pre_conditions');
   SELECT assert_function_exists('cmx_ord_preparation_pre_conditions');
   ```

2. **Schema Field Alignment**

   ```sql
   -- Test that functions use correct field names
   SELECT assert_column_exists('org_orders_mst', 'is_order_quick_drop');
   SELECT assert_column_exists('org_orders_mst', 'current_status');
   ```

3. **Two-Layer Validation**

   ```typescript
   // Test screen/API validation
   test("API rejects direct status updates", async () => {
     await expect(
       workflowService.changeStatus(orderId, "ready")
     ).rejects.toThrow("Direct status updates not allowed");
   });

   // Test database validation
   test("Database validates feature flags", async () => {
     // Disable feature flag
     await disableFeatureFlag("assembly_workflow", tenantId);

     // Attempt transition should fail
     const result = await executeTransition("assembly", orderId, {});
     expect(result.ok).toBe(false);
     expect(result.errors).toContainEqual(
       expect.objectContaining({ code: "FEATURE_DISABLED" })
     );
   });
   ```

4. **Workflow Template Resolution**

   ```sql
   -- Test resolution order: order → tenant default → system default
   ```

5. **Idempotency**
   ```sql
   -- Test that same idempotency key returns same result
   ```

### Phase 6.2: Performance Tests

**File:** `supabase/tests/performance/test_transition_performance.sql`

#### Performance Benchmarks:

1. **Transition Execution Time**

   - Target: < 100ms for simple transitions
   - Target: < 500ms for complex transitions with validations

2. **Concurrent Transitions**

   - Test: 100 concurrent transitions on different orders
   - Test: 10 concurrent transitions on same order (should handle conflicts)

3. **Metrics Calculation**
   - Target: < 50ms for metrics calculation
   - Cache metrics if possible

---

## Migration Strategy

### Phase 7.1: Gradual Migration with Feature Flag

**Strategy:** Implement alongside existing code using `USE_OLD_CODE_OR_NEW` boolean parameter

#### Implementation Pattern

```typescript
// In WorkflowService
const USE_OLD_CODE_OR_NEW = await getFeatureFlag(
  "USE_NEW_WORKFLOW_SYSTEM",
  tenantId
);

if (!USE_OLD_CODE_OR_NEW) {
  // Use existing old code
  return this.changeStatusOld(orderId, newStatus);
} else {
  // Use new database-driven code
  return this.executeScreenTransition(screen, orderId, input);
}
```

#### Migration Phases

1. **Phase 1: Deploy Database Functions**

   - Deploy all database functions alongside existing code
   - Functions are available but not used yet
   - No breaking changes

2. **Phase 2: Add Feature Flag**

   - Create feature flag: `USE_NEW_WORKFLOW_SYSTEM`
   - Default: `false` (use old code)
   - Add `USE_OLD_CODE_OR_NEW` parameter to all transition functions

3. **Phase 3: Per-Screen Migration**

   - Migrate one screen at a time
   - Enable feature flag per tenant or globally
   - Test thoroughly before enabling next screen
   - Can rollback by setting flag to `false`

4. **Phase 4: Complete Migration**
   - All screens migrated
   - Remove old code paths
   - Remove feature flag (or keep for emergency rollback)

#### Feature Flag Configuration

```sql
-- Add feature flag to hq_ff_feature_flags_mst
INSERT INTO hq_ff_feature_flags_mst (
  flag_key,
  flag_name,
  flag_description,
  governance_category,
  data_type,
  default_value,
  plan_binding_type,
  enabled_plan_codes
) VALUES (
  'USE_NEW_WORKFLOW_SYSTEM',
  'Use New Workflow System',
  'Enable new database-driven workflow system with screen contracts',
  'tenant_feature',
  'boolean',
  'false'::jsonb,
  'plan_bound',
  '["STARTER", "BUSINESS", "ENTERPRISE"]'::jsonb
);
```

#### Rollback Strategy

- Set `USE_NEW_WORKFLOW_SYSTEM` to `false` for affected tenants
- Old code path remains available
- No data migration needed (both systems use same tables)

### Phase 7.2: Data Migration

**File:** `supabase/migrations/NNNN_migrate_existing_workflows.sql`

```sql
-- Ensure all existing orders have:
-- 1. current_status set (migrate from status field)
-- 2. workflow_template_id set (assign default)
-- 3. previous_status set (from history if available)
-- 4. last_transition_at set (from history if available)
```

---

## Future Enhancements (Post-MVP)

### 1. Workflow Analytics Dashboard

- Transition time metrics
- Bottleneck identification
- SLA compliance tracking

### 2. Workflow Configuration UI

- Visual workflow builder
- Drag-and-drop screen configuration
- A/B testing different workflows

### 3. Workflow Templates Marketplace

- Pre-configured workflows for common scenarios
- Import/export workflow templates
- Community-shared workflows

### 4. Advanced Validation Rules Builder

- Visual rule builder UI
- Custom validation function editor
- Test validation rules before deployment

### 5. Workflow Simulation

- Test workflow changes before applying
- What-if analysis
- Impact assessment

### 6. Multi-Language Error Messages

- Store error messages in i18n tables
- Support for EN/AR and future languages
- Context-aware error messages

---

## Success Criteria (Enhanced)

1. ✅ All screens query database functions for PRE conditions (no hardcoded status filters)
2. ✅ All transitions go through `cmx_ord_execute_screen_transition()` (no direct status updates)
3. ✅ **Application-level enforcement prevents direct status field updates** (NO database triggers)
4. ✅ Quality gates are enforced before Ready status
5. ✅ Permission checks prevent unauthorized transitions
6. ✅ Every transition writes to `org_order_history`
7. ✅ Workflow templates can be configured per tenant/service category
8. ✅ **Screen contracts can be customized per tenant**
9. ✅ **Custom validations can be added without code changes**
10. ✅ **Idempotency prevents duplicate transitions**
11. ✅ **Optimistic concurrency prevents race conditions**
12. ✅ All screens follow the screen contract pattern consistently
13. ✅ **Function naming is consistent throughout - ALL functions use `cmx_ord_*` prefix**
14. ✅ **Schema fields match actual database structure**
15. ✅ **Per-screen wrapper functions use `cmx_ord_*` prefix (e.g., `cmx_ord_preparation_*`, not `cmx_preparation_*`)**
16. ✅ **Configuration tables use `sys_ord_*_cf` naming convention** (`sys_ord_screen_contracts_cf`, `sys_ord_custom_validations_cf`, `sys_ord_webhook_subscriptions_cf`)
17. ✅ **Tenant-specific data tables use `org_ord_*` naming** (`org_ord_transition_events`)
18. ✅ **Two-layer validation implemented** (screen/API validation + database validation)
19. ✅ **Feature flags, plan limits, and settings integrated** into validation flow
20. ✅ **Gradual migration strategy** using `USE_OLD_CODE_OR_NEW` feature flag
21. ✅ **No database triggers** - status protection enforced at application level

---

## Risk Mitigation (Enhanced)

**Risk 1:** Database function performance

- **Mitigation:**
  - Add indexes on `(tenant_org_id, current_status)`
  - Cache screen contracts in frontend (React Query)
  - Cache metrics calculation results
  - Monitor and optimize slow queries

**Risk 2:** Breaking existing functionality

- **Mitigation:**
  - Implement alongside existing code
  - Feature flag for gradual rollout
  - Comprehensive test coverage
  - Rollback plan ready

**Risk 3:** Complex validation logic in database

- **Mitigation:**
  - Keep core validations simple
  - Use plugin architecture for complex validations
  - Document validation function interface
  - Provide validation testing tools

**Risk 4:** Status field protection breaking legitimate updates

- **Mitigation:**
  - Thoroughly test transition functions
  - Provide migration scripts for bulk updates
  - Admin override function (with audit log)

**Risk 5:** Schema mismatches causing runtime errors

- **Mitigation:**
  - Comprehensive schema validation tests
  - Migration scripts verify schema before deployment
  - Type-safe database client (Prisma)

---

## Implementation Checklist

### Database Layer

- [ ] Create enhanced screen contract functions SQL
- [ ] **CRITICAL: Ensure ALL NEW functions use `cmx_ord_*` prefix** (core + wrappers)
- [ ] **CRITICAL: Ensure ALL configuration tables use `sys_ord_*_cf` naming** (screen contracts, custom validations, webhook subscriptions)
- [ ] **Tenant-specific data tables use `org_ord_*` naming** (transition events, workflow settings)
- [ ] Implement two-layer validation (screen/API + database)
- [ ] Integrate feature flags, plan limits, and settings checks
- [ ] Add `USE_OLD_CODE_OR_NEW` feature flag for gradual migration
- [ ] **Consider renaming legacy functions:** `cmx_order_transition()` → `cmx_ord_order_transition()`, `cmx_get_allowed_transitions()` → `cmx_ord_get_allowed_transitions()`
- [ ] Implement application-level status field protection (NO triggers)
- [ ] Create configurable screen contracts table: `sys_ord_screen_contracts_cf` (config)
- [ ] Create custom validations table: `sys_ord_custom_validations_cf` (config)
- [ ] Create transition events table: `org_ord_transition_events` (data/logs, NOT config)
- [ ] Create webhook subscriptions table: `sys_ord_webhook_subscriptions_cf` (config)
- [ ] Create workflow versioning table: `sys_ord_workflow_template_versions` (versioning/history)
- [ ] Fix function naming inconsistencies (wrapper functions must use `cmx_ord_*` prefix)
- [ ] Fix wrapper function calls (must call `cmx_ord_*` functions, not `cmx_screen_*`)
- [ ] Align schema field references
- [ ] Add comprehensive indexes
- [ ] Add RLS policies

### Backend API Layer

- [ ] Create screen contract API with caching
- [ ] Enhance transition API with idempotency
- [ ] Create workflow context API
- [ ] Add event emission system
- [ ] Update WorkflowService to use new functions
- [ ] Add error handling and retry logic

### Frontend Layer

- [ ] Create enhanced hooks with caching
- [ ] Update all screens to use contracts
- [ ] Add optimistic updates
- [ ] Create permission matrix component
- [ ] Create quality gates component
- [ ] Add error handling UI

### Testing

- [ ] Database function tests
- [ ] API integration tests
- [ ] Frontend E2E tests
- [ ] Performance tests
- [ ] Concurrent access tests

### Documentation

- [ ] Update architecture documentation
- [ ] Create migration guide
- [ ] Create developer guide
- [ ] Create admin configuration guide

---

**End of Enhanced Plan**
