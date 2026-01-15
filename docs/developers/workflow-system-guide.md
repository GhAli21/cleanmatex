# Orders Workflow System - Developer Guide

## Overview

The Orders Workflow System implements a simplified database-driven approach following the principle: **"Database for Config & Atomicity, Code for Logic"**. Complex business logic (feature flags, plan limits, settings, quality gates) is handled in the application layer using HQ Platform APIs, while database functions handle simple configuration retrieval and atomic status updates.

## Architecture

### Database Layer (Simple & Focused)

- Screen contract configuration (read-only)
- Basic data integrity validation (status checks, required fields)
- Atomic status updates (transaction safety)
- History logging (audit trail)
- Simple metrics calculation

### Application Layer (Complex Logic)

- Feature flag evaluation (via HQ Platform API)
- Plan limit validation (via HQ Platform API)
- Settings checks (via HQ Platform API)
- Complex business rules
- Quality gate validation
- Permission checks
- Orchestration logic

## Database Functions Reference

### Core Functions

#### `cmx_ord_screen_pre_conditions(p_screen TEXT)`

Returns screen contract configuration (statuses, filters, permissions).

**Parameters:**

- `p_screen`: Screen identifier (preparation, processing, assembly, qa, packing, ready_release, driver_delivery, new_order, workboard)

**Returns:** JSONB with:

- `statuses`: Array of allowed order statuses for this screen
- `additional_filters`: Additional filter criteria
- `required_permissions`: Array of required permission keys

**Example:**

```sql
SELECT cmx_ord_screen_pre_conditions('preparation');
-- Returns: {"statuses": ["preparing", "intake"], "required_permissions": ["orders:preparation:complete"]}
```

#### `cmx_ord_validate_transition_basic(p_tenant_org_id UUID, p_order_id UUID, p_from_status TEXT, p_to_status TEXT)`

Basic data integrity validation for transitions.

**Returns:** JSONB with:

- `ok`: Boolean indicating if validation passed
- `errors`: Array of error objects with `code` and `message`

#### `cmx_ord_execute_transition(...)`

Atomic transition execution with history logging.

**Parameters:**

- `p_tenant_org_id`: Tenant ID
- `p_order_id`: Order ID
- `p_screen`: Screen identifier
- `p_from_status`: Current status
- `p_to_status`: Target status
- `p_user_id`: User ID performing transition
- `p_input`: JSONB input data
- `p_idempotency_key`: Optional idempotency key
- `p_expected_updated_at`: Optional optimistic concurrency timestamp

**Returns:** JSONB with:

- `ok`: Boolean indicating success
- `from_status`: Previous status
- `to_status`: New status
- `order_id`: Order ID
- `updated_at`: Timestamp

#### `cmx_ord_order_workflow_flags(p_tenant_org_id UUID, p_order_id UUID)`

Returns workflow flags based on template.

**Returns:** JSONB with:

- `template_id`: Workflow template ID
- `assembly_enabled`: Boolean
- `qa_enabled`: Boolean
- `packing_enabled`: Boolean

#### `cmx_ord_order_live_metrics(p_tenant_org_id UUID, p_order_id UUID)`

Returns simple order metrics.

**Returns:** JSONB with:

- `items_count`: Number of items
- `pieces_total`: Total pieces
- `pieces_scanned`: Scanned pieces
- `all_items_processed`: Boolean

### Per-Screen Wrapper Functions

Each screen has wrapper functions:

- `cmx_ord_{screen}_pre_conditions()`: Returns pre-conditions for screen
- `cmx_ord_{screen}_transition(...)`: Executes transition for screen

Available screens: `preparation`, `processing`, `assembly`, `qa`, `packing`, `ready_release`, `driver_delivery`, `new_order`, `workboard`

## Application Service API

### WorkflowServiceEnhanced

#### `executeScreenTransition(screen, orderId, input, options)`

Executes a screen transition with full validation.

**Parameters:**

- `screen`: Screen identifier
- `orderId`: Order ID
- `input`: Input data object
- `options`: Optional configuration
  - `useOldWfCodeOrNew`: Boolean to use old or new code path
  - `authHeader`: Authorization header for HQ API calls

**Returns:** `TransitionResult` object

**Example:**

```typescript
import { WorkflowServiceEnhanced } from "@/lib/services/workflow-service-enhanced";

const result = await WorkflowServiceEnhanced.executeScreenTransition(
  "preparation",
  orderId,
  {
    notes: "Completed preparation",
  },
  {
    useOldWfCodeOrNew: true, // Use new workflow system
    authHeader: request.headers.get("Authorization"),
  }
);
```

## How to Add New Screens

1. **Add screen to `cmx_ord_screen_pre_conditions` function:**

   ```sql
   WHEN 'new_screen' THEN ARRAY['status1', 'status2']::TEXT[]
   ```

2. **Create wrapper functions:**

   ```sql
   CREATE OR REPLACE FUNCTION cmx_ord_new_screen_pre_conditions()
   RETURNS jsonb AS $$
     SELECT cmx_ord_screen_pre_conditions('new_screen');
   $$;
   ```

3. **Add screen contract configuration:**

   ```sql
   INSERT INTO org_ord_screen_contracts_cf (screen_key, pre_conditions, required_permissions)
   VALUES ('new_screen', '{"statuses": ["status1"]}', '["orders:new_screen:complete"]');
   ```

4. **Create API endpoint:**

   ```typescript
   // app/api/v1/workflows/screens/new_screen/contract/route.ts
   ```

5. **Create frontend hook:**
   ```typescript
   // lib/hooks/use-new-screen-contract.ts
   ```

## How to Add Custom Validations

1. **Create validation function in database:**

   ```sql
   CREATE OR REPLACE FUNCTION cmx_ord_validate_custom_rule(
     p_order_id UUID,
     p_input JSONB
   ) RETURNS JSONB AS $$
   -- Validation logic
   $$;
   ```

2. **Register in configuration table:**

   ```sql
   INSERT INTO org_ord_custom_validations_cf (
     screen_key,
     validation_key,
     validation_function,
     validation_config
   ) VALUES (
     'preparation',
     'custom_rule',
     'cmx_ord_validate_custom_rule',
     '{"param": "value"}'::jsonb
   );
   ```

3. **Call from application layer:**
   ```typescript
   // In WorkflowServiceEnhanced.validateBusinessRules()
   const validation = await supabase.rpc("cmx_ord_validate_custom_rule", {
     p_order_id: orderId,
     p_input: input,
   });
   ```

## Testing Guidelines

### Database Function Tests

```sql
-- Test screen contract retrieval
SELECT assert(
  cmx_ord_screen_pre_conditions('preparation')->>'statuses' IS NOT NULL,
  'Screen contract should return statuses'
);

-- Test basic validation
SELECT assert(
  (cmx_ord_validate_transition_basic(
    test_tenant_id,
    test_order_id,
    'preparing',
    'processing'
  )->>'ok')::boolean = true,
  'Valid transition should pass basic validation'
);
```

### API Integration Tests

```typescript
import { WorkflowServiceEnhanced } from "@/lib/services/workflow-service-enhanced";

describe("WorkflowServiceEnhanced", () => {
  it("should execute transition with new workflow system", async () => {
    const result = await WorkflowServiceEnhanced.executeScreenTransition(
      "preparation",
      orderId,
      {},
      { useOldWfCodeOrNew: true }
    );

    expect(result.ok).toBe(true);
  });
});
```

## Debugging Tips

1. **Check screen contract:**

   ```sql
   SELECT cmx_ord_screen_pre_conditions('preparation');
   ```

2. **Check workflow flags:**

   ```sql
   SELECT cmx_ord_order_workflow_flags(tenant_id, order_id);
   ```

3. **Check order metrics:**

   ```sql
   SELECT cmx_ord_order_live_metrics(tenant_id, order_id);
   ```

4. **View transition history:**

   ```sql
   SELECT * FROM org_order_history
   WHERE order_id = '...'
   ORDER BY done_at DESC;
   ```

5. **Check feature flags:**

   ```typescript
   const flags = await getFeatureFlags(tenantId);
   console.log("Feature flags:", flags);
   ```

6. **Check HQ Platform API calls:**
   - Monitor network requests in browser DevTools
   - Check HQ API logs
   - Verify `HQ_API_URL` and `HQ_SERVICE_TOKEN` environment variables

## Migration Strategy

The system supports gradual migration using the `USE_OLD_WF_CODE_OR_NEW` parameter:

1. **Default:** Use old workflow system (`useOldWfCodeOrNew: false`)
2. **Per-request:** Override with `useOldWfCodeOrNew: true`
3. **Feature flag:** Set `USE_NEW_WORKFLOW_SYSTEM` feature flag per tenant
4. **Complete migration:** Remove old code paths

## Common Issues

### Issue: Transition fails with STATUS_MISMATCH

**Solution:** Check order's current status matches screen requirements:

```sql
SELECT current_status FROM org_orders_mst WHERE id = '...';
```

### Issue: Permission denied

**Solution:** Verify user has required permissions:

```typescript
const permissions = await getUserPermissions(userId, tenantId);
```

### Issue: Feature flag check fails

**Solution:** Verify feature flag is enabled:

```typescript
const flags = await getFeatureFlags(tenantId);
console.log("Feature flags:", flags);
```

### Issue: HQ API unavailable

**Solution:** System falls back gracefully, but check:

- `HQ_API_URL` environment variable
- `HQ_SERVICE_TOKEN` environment variable
- HQ Platform API service status
