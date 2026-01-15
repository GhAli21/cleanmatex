---
name: Orders Workflow Simplified Implementation
overview: Implement simplified database-driven Orders workflow system where database handles configuration and atomic updates, while application layer handles complex business logic using existing HQ Platform APIs for feature flags, plan limits, and settings. Implement alongside existing code using USE_OLD_WF_CODE_OR_NEW boolean parameter.
todos: []
---

# Orders Workflow Simplified Implementation Plan

## Overview

This plan implements a simplified database-driven Orders workflow system following the principle: **"Database for Config & Atomicity, Code for Logic"**. Complex business logic (feature flags, plan limits, settings, quality gates) is handled in the application layer using existing HQ Platform APIs, while database functions handle simple configuration retrieval and atomic status updates.

## Architecture Principles

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

## Key Requirements

1. **USE_OLD_WF_CODE_OR_NEW Parameter**: All transition functions accept this boolean to choose between old and new code paths
2. **HQ Platform API Integration**: Use existing APIs from cleanmatexsaas/platform-api for:

                - Feature flags: `hqApiClient` or feature flags service
                - Plan limits: Usage tracking service or HQ API
                - Settings: `hqApiClient.getEffectiveSettings()`

3. **Gradual Migration**: Implement alongside existing code, migrate one screen at a time
4. **Comprehensive Documentation**: Developer guides, testing guides, user guides, admin guides

## Implementation Phases

### Phase 1: Database Foundation (Simplified Functions)

#### 1.1 Create Simplified Screen Contract Functions

**File:** `supabase/migrations/NNNN_screen_contract_functions_simplified.sql`**Functions to Create:**

```sql
-- 1. Simple screen contract retrieval (no complex logic)
CREATE OR REPLACE FUNCTION cmx_ord_screen_pre_conditions(
  p_screen TEXT
) RETURNS JSONB AS $$
BEGIN
  -- Return simple configuration, no tenant-specific logic here
  RETURN jsonb_build_object(
    'statuses', CASE p_screen
      WHEN 'preparation' THEN ARRAY['preparing', 'intake']
      WHEN 'processing' THEN ARRAY['processing']
      WHEN 'assembly' THEN ARRAY['assembly']
      WHEN 'qa' THEN ARRAY['qa']
      WHEN 'packing' THEN ARRAY['packing']
      WHEN 'ready_release' THEN ARRAY['ready']
      WHEN 'driver_delivery' THEN ARRAY['out_for_delivery']
      ELSE ARRAY[]::TEXT[]
    END,
    'additional_filters', jsonb_build_object()
  );
END;
$$ LANGUAGE sql IMMUTABLE;

-- 2. Basic transition validation (data integrity only)
CREATE OR REPLACE FUNCTION cmx_ord_validate_transition_basic(
  p_tenant_org_id UUID,
  p_order_id UUID,
  p_from_status TEXT,
  p_to_status TEXT
) RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_errors JSONB := '[]'::jsonb;
BEGIN
  -- Get order with row lock
  SELECT * INTO v_order
  FROM org_orders_mst
  WHERE id = p_order_id AND tenant_org_id = p_tenant_org_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'errors', jsonb_build_array(
        jsonb_build_object('code', 'ORDER_NOT_FOUND', 'message', 'Order not found')
      )
    );
  END IF;
  
  -- Basic validation: status matches
  IF v_order.current_status != p_from_status THEN
    v_errors := v_errors || jsonb_build_object(
      'code', 'STATUS_MISMATCH',
      'message', format('Order is %s, expected %s', v_order.current_status, p_from_status)
    );
  END IF;
  
  -- Basic validation: required fields (data integrity only)
  IF p_to_status = 'ready' AND COALESCE(v_order.items_count, 0) = 0 THEN
    v_errors := v_errors || jsonb_build_object(
      'code', 'NO_ITEMS',
      'message', 'Cannot move to ready without items'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'ok', jsonb_array_length(v_errors) = 0,
    'errors', v_errors
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Atomic transition execution (simple update + history)
CREATE OR REPLACE FUNCTION cmx_ord_execute_transition(
  p_tenant_org_id UUID,
  p_order_id UUID,
  p_screen TEXT,
  p_from_status TEXT,
  p_to_status TEXT,
  p_user_id UUID,
  p_input JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL,
  p_expected_updated_at TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_validation JSONB;
  v_existing_history UUID;
BEGIN
  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_history
    FROM org_order_history
    WHERE tenant_org_id = p_tenant_org_id
      AND order_id = p_order_id
      AND meta->>'idempotency_key' = p_idempotency_key
    LIMIT 1;
    
    IF v_existing_history IS NOT NULL THEN
      -- Return existing result
      RETURN jsonb_build_object(
        'ok', true,
        'from_status', p_from_status,
        'to_status', p_to_status,
        'order_id', p_order_id,
        'idempotent', true
      );
    END IF;
  END IF;
  
  -- Lock order row
  SELECT * INTO v_order
  FROM org_orders_mst
  WHERE id = p_order_id AND tenant_org_id = p_tenant_org_id
  FOR UPDATE;
  
  -- Optimistic concurrency check
  IF p_expected_updated_at IS NOT NULL AND v_order.updated_at != p_expected_updated_at THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'CONCURRENT_UPDATE',
      'message', 'Order was modified by another user',
      'current_updated_at', v_order.updated_at,
      'expected_updated_at', p_expected_updated_at
    );
  END IF;
  
  -- Basic validation (data integrity only)
  v_validation := cmx_ord_validate_transition_basic(
    p_tenant_org_id, p_order_id, p_from_status, p_to_status
  );
  
  IF (v_validation->>'ok')::boolean = false THEN
    RETURN v_validation;
  END IF;
  
  -- Atomic update
  UPDATE org_orders_mst
  SET
    previous_status = current_status,
    current_status = p_to_status,
    last_transition_at = NOW(),
    last_transition_by = p_user_id,
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Write history
  INSERT INTO org_order_history (
    tenant_org_id, order_id, from_status, to_status,
    screen, user_id, meta
  ) VALUES (
    p_tenant_org_id, p_order_id, p_from_status, p_to_status,
    p_screen, p_user_id, p_input || jsonb_build_object('idempotency_key', p_idempotency_key)
  );
  
  RETURN jsonb_build_object(
    'ok', true,
    'from_status', p_from_status,
    'to_status', p_to_status,
    'order_id', p_order_id,
    'updated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Get workflow flags (simple lookup, no complex logic)
CREATE OR REPLACE FUNCTION cmx_ord_order_workflow_flags(
  p_tenant_org_id UUID,
  p_order_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_template JSONB;
BEGIN
  SELECT * INTO v_order
  FROM org_orders_mst
  WHERE id = p_order_id AND tenant_org_id = p_tenant_org_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Order not found');
  END IF;
  
  -- Get workflow template flags (simple lookup)
  SELECT workflow_flags INTO v_template
  FROM sys_workflow_template_cd
  WHERE template_id = v_order.workflow_template_id;
  
  RETURN COALESCE(v_template, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 5. Get order metrics (simple calculations)
CREATE OR REPLACE FUNCTION cmx_ord_order_live_metrics(
  p_tenant_org_id UUID,
  p_order_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_items_count INTEGER;
  v_pieces_total INTEGER;
  v_pieces_scanned INTEGER;
BEGIN
  -- Simple counts
  SELECT COUNT(*) INTO v_items_count
  FROM org_order_items_dtl
  WHERE order_id = p_order_id AND tenant_org_id = p_tenant_org_id;
  
  SELECT 
    COALESCE(SUM(qty), 0),
    COALESCE(SUM(CASE WHEN item_status = 'processed' THEN qty ELSE 0 END), 0)
  INTO v_pieces_total, v_pieces_scanned
  FROM org_order_items_dtl
  WHERE order_id = p_order_id AND tenant_org_id = p_tenant_org_id;
  
  RETURN jsonb_build_object(
    'items_count', v_items_count,
    'pieces_total', v_pieces_total,
    'pieces_scanned', v_pieces_scanned,
    'all_items_processed', v_pieces_scanned >= v_pieces_total
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```



#### 1.2 Create Per-Screen Wrapper Functions

**File:** `supabase/migrations/NNNN_per_screen_wrappers_simplified.sql`

```sql
-- All wrapper functions use cmx_ord_ prefix and call simplified core functions

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
AS $$ 
  SELECT cmx_ord_execute_transition(
    p_tenant_org_id, 
    p_order_id, 
    'preparation',
    (SELECT current_status FROM org_orders_mst WHERE id = p_order_id),
    'processing',
    p_user_id,
    p_input,
    p_idempotency_key,
    p_expected_updated_at
  );
$$;

-- Similar wrappers for: processing, assembly, qa, packing, ready_release, driver_delivery, new_order, workboard
```



#### 1.3 Create Configuration Tables

**File:** `supabase/migrations/NNNN_workflow_config_tables.sql`

```sql
-- Screen contracts configuration (sys_ord_*_cf)
CREATE TABLE IF NOT EXISTS sys_ord_screen_contracts_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID, -- NULL for system default, UUID for tenant override
  screen_key TEXT NOT NULL,
  pre_conditions JSONB NOT NULL,
  required_permissions JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_org_id, screen_key)
);

-- Indexes
CREATE INDEX idx_sys_ord_screen_contracts_tenant ON sys_ord_screen_contracts_cf(tenant_org_id, screen_key);
CREATE INDEX idx_sys_ord_screen_contracts_active ON sys_ord_screen_contracts_cf(is_active);

-- RLS Policies
ALTER TABLE sys_ord_screen_contracts_cf ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_sys_ord_screen_contracts_select ON sys_ord_screen_contracts_cf
  FOR SELECT
  USING (
    tenant_org_id IS NULL OR 
    tenant_org_id = (SELECT tenant_org_id FROM org_users_mst WHERE user_id = auth.uid() LIMIT 1)
  );
```



### Phase 2: Application Layer (Complex Logic)

#### 2.1 Create Enhanced WorkflowService

**File:** `web-admin/lib/services/workflow-service-enhanced.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { getFeatureFlags } from '@/lib/services/feature-flags.service';
import { canCreateOrder } from '@/lib/services/usage-tracking.service';
import { hqApiClient } from '@/lib/api/hq-api-client';

export class WorkflowServiceEnhanced {
  /**
            * Execute screen transition with USE_OLD_WF_CODE_OR_NEW parameter
   */
  static async executeScreenTransition(
    screen: string,
    orderId: string,
    input: Record<string, any> = {},
    options?: { 
      useOldWfCodeOrNew?: boolean;
      authHeader?: string | null;
    }
  ): Promise<TransitionResult> {
    const supabase = await createClient();
    
    // Get tenant and order info
    const { data: order } = await supabase
      .from('org_orders_mst')
      .select('*, tenant_org_id')
      .eq('id', orderId)
      .single();
    
    const tenantId = order.tenant_org_id;
    const userId = (await supabase.auth.getUser()).data.user?.id;
    
    // Check USE_OLD_WF_CODE_OR_NEW flag (from options or feature flag)
    const USE_OLD_WF_CODE_OR_NEW = options?.useOldWfCodeOrNew ?? 
      await this.getFeatureFlag('USE_NEW_WORKFLOW_SYSTEM', tenantId, options?.authHeader);
    
    if (!USE_OLD_WF_CODE_OR_NEW) {
      // Use existing old code path
      return WorkflowService.changeStatus({
        orderId,
        tenantId,
        fromStatus: order.current_status,
        toStatus: input.to_status || this.resolveNextStatus(screen, order),
        userId,
        userName: input.user_name,
        notes: input.notes,
        metadata: input.metadata
      });
    }
    
    // ============================================
    // NEW CODE PATH: Application Layer Validation
    // ============================================
    
    // 1. Get screen contract from DB (simple config)
    const { data: contract } = await supabase.rpc(
      'cmx_ord_screen_pre_conditions',
      { p_screen: screen }
    );
    
    // 2. Validate pre-conditions
    if (!contract.statuses.includes(order.current_status)) {
      throw new ValidationError(
        `Order status ${order.current_status} does not match screen requirements`,
        'STATUS_MISMATCH'
      );
    }
    
    // 3. Permission check (application layer)
    const requiredPermissions = contract.required_permissions || [];
    const userPermissions = await this.getUserPermissions(userId, tenantId);
    const missingPermissions = requiredPermissions.filter(
      p => !userPermissions.includes(p)
    );
    if (missingPermissions.length > 0) {
      throw new PermissionError(
        `Missing permissions: ${missingPermissions.join(', ')}`,
        missingPermissions
      );
    }
    
    // 4. Feature flag check (via HQ Platform API or service)
    const featureFlags = await getFeatureFlags(tenantId);
    const screenFeatureFlag = this.mapScreenToFeatureFlag(screen);
    if (!featureFlags[screenFeatureFlag]) {
      throw new FeatureFlagError(
        `Feature ${screenFeatureFlag} not enabled for your plan`,
        screenFeatureFlag
      );
    }
    
    // 5. Plan limits check (via usage tracking service)
    if (screen === 'new_order') {
      const limitCheck = await canCreateOrder(tenantId);
      if (!limitCheck.canProceed) {
        throw new LimitExceededError(
          limitCheck.message || 'Plan limit exceeded',
          {
            limitType: limitCheck.limitType || 'orders',
            current: limitCheck.current,
            limit: limitCheck.limit
          }
        );
      }
    }
    
    // 6. Settings check (via HQ Platform API)
    const settingKey = `workflow.${screen}.enabled`;
    const settings = await hqApiClient.getEffectiveSettings(tenantId, {
      authHeader: options?.authHeader
    });
    const setting = settings.find(s => s.stngCode === settingKey);
    if (setting && setting.stngValue === false) {
      throw new SettingsError(
        `Workflow screen ${screen} is disabled in settings`,
        settingKey
      );
    }
    
    // 7. Complex business rules (application layer)
    await this.validateBusinessRules(order, screen, input);
    
    // 8. Quality gates (application layer)
    const nextStatus = input.to_status || this.resolveNextStatus(screen, order);
    if (nextStatus === 'ready') {
      const qualityCheck = await this.checkQualityGates(orderId, tenantId);
      if (!qualityCheck.passed) {
        throw new QualityGateError(
          'Quality gates not met',
          qualityCheck.blockers
        );
      }
    }
    
    // ============================================
    // Database Layer: Atomic Update
    // ============================================
    
    const { data: result, error } = await supabase.rpc(
      'cmx_ord_execute_transition',
      {
        p_tenant_org_id: tenantId,
        p_order_id: orderId,
        p_screen: screen,
        p_from_status: order.current_status,
        p_to_status: nextStatus,
        p_user_id: userId,
        p_input: input,
        p_idempotency_key: input.idempotency_key,
        p_expected_updated_at: order.updated_at
      }
    );
    
    if (error || !result?.ok) {
      throw new TransitionError(
        result?.message || error.message,
        result?.errors || []
      );
    }
    
    return result;
  }
  
  /**
            * Get feature flag value (via HQ Platform API or service)
   */
  private static async getFeatureFlag(
    flagKey: string,
    tenantId: string,
    authHeader?: string | null
  ): Promise<boolean> {
    // Try HQ Platform API first if available
    try {
      // If HQ Platform has feature flags API, use it
      // Otherwise fall back to existing service
      const flags = await getFeatureFlags(tenantId);
      return flags[flagKey as keyof typeof flags] || false;
    } catch (error) {
      console.error('Error getting feature flag:', error);
      return false; // Fail safe: default to false
    }
  }
  
  /**
            * Map screen to feature flag key
   */
  private static mapScreenToFeatureFlag(screen: string): string {
    const mapping: Record<string, string> = {
      'assembly': 'assembly_workflow',
      'qa': 'qa_workflow',
      'packing': 'packing_workflow',
      'driver_delivery': 'driver_app',
      'processing': 'basic_workflow'
    };
    return mapping[screen] || 'basic_workflow';
  }
  
  /**
            * Complex business rules validation
   */
  private static async validateBusinessRules(
    order: Order,
    screen: string,
    input: Record<string, any>
  ): Promise<void> {
    const supabase = await createClient();
    
    // Example: Assembly screen requires all pieces scanned
    if (screen === 'assembly') {
      const { data: items } = await supabase
        .from('org_order_items_dtl')
        .select('*, pieces:org_order_item_pieces_dtl(*)')
        .eq('order_id', order.id)
        .eq('tenant_org_id', order.tenant_org_id);
      
      for (const item of items || []) {
        const expectedPieces = item.qty;
        const scannedPieces = item.pieces?.filter(
          (p: any) => p.scan_state === 'scanned'
        ).length || 0;
        
        if (scannedPieces < expectedPieces) {
          throw new ValidationError(
            `Item ${item.item_name} missing ${expectedPieces - scannedPieces} pieces`,
            'PIECES_MISSING'
          );
        }
      }
    }
    
    // Example: QA screen requires inspection data
    if (screen === 'qa' && input.action === 'pass') {
      if (!input.inspection_data || !input.inspected_by) {
        throw new ValidationError(
          'QA pass requires inspection data and inspector',
          'MISSING_INSPECTION_DATA'
        );
      }
    }
  }
  
  /**
            * Quality gates check
   */
  private static async checkQualityGates(
    orderId: string,
    tenantId: string
  ): Promise<QualityGateResult> {
    const supabase = await createClient();
    
    const { data: order } = await supabase
      .from('org_orders_mst')
      .select(`
        *,
        items:org_order_items_dtl(*),
        issues:org_order_issues(*)
      `)
      .eq('id', orderId)
      .eq('tenant_org_id', tenantId)
      .single();
    
    const blockers: string[] = [];
    
    // Get workflow flags
    const { data: flags } = await supabase.rpc(
      'cmx_ord_order_workflow_flags',
      { p_tenant_org_id: tenantId, p_order_id: orderId }
    );
    
    // Check 1: All items assembled (if assembly enabled)
    if (flags?.assembly_enabled) {
      const unassembled = order.items?.filter(
        (item: any) => item.item_status !== 'assembled'
      ) || [];
      if (unassembled.length > 0) {
        blockers.push(`${unassembled.length} items not assembled`);
      }
    }
    
    // Check 2: QA passed (if QA enabled)
    if (flags?.qa_enabled) {
      const failedQA = order.items?.filter(
        (item: any) => item.qa_status !== 'passed'
      ) || [];
      if (failedQA.length > 0) {
        blockers.push(`${failedQA.length} items failed QA`);
      }
    }
    
    // Check 3: No blocking issues
    const blockingIssues = order.issues?.filter(
      (issue: any) => issue.is_blocking && !issue.resolved
    ) || [];
    if (blockingIssues.length > 0) {
      blockers.push(`${blockingIssues.length} blocking issues unresolved`);
    }
    
    return {
      passed: blockers.length === 0,
      blockers
    };
  }
  
  /**
            * Resolve next status based on screen and order state
   */
  private static resolveNextStatus(screen: string, order: Order): string {
    const flags = order.workflow_flags || {};
    
    switch (screen) {
      case 'preparation':
        return 'processing';
      
      case 'processing':
        if (flags.assembly_enabled) return 'assembly';
        if (flags.qa_enabled) return 'qa';
        if (flags.packing_enabled) return 'packing';
        return 'ready';
      
      case 'assembly':
        if (flags.qa_enabled) return 'qa';
        if (flags.packing_enabled) return 'packing';
        return 'ready';
      
      case 'qa':
        if (flags.packing_enabled) return 'packing';
        return 'ready';
      
      case 'packing':
        return 'ready';
      
      case 'ready_release':
        if (input.pickup_confirmed) return 'delivered';
        return 'out_for_delivery';
      
      case 'driver_delivery':
        return 'delivered';
      
      default:
        throw new Error(`Unknown screen: ${screen}`);
    }
  }
}
```



#### 2.2 Create API Endpoints

**File:** `web-admin/app/api/v1/orders/[id]/transition/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { WorkflowServiceEnhanced } from '@/lib/services/workflow-service-enhanced';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { screen, input, useOldWfCodeOrNew } = body;
    
    const authHeader = request.headers.get('Authorization');
    
    const result = await WorkflowServiceEnhanced.executeScreenTransition(
      screen,
      params.id,
      input,
      {
        useOldWfCodeOrNew,
        authHeader
      }
    );
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { 
        ok: false,
        error: error.message,
        code: error.code
      },
      { status: error.statusCode || 400 }
    );
  }
}
```

**File:** `web-admin/app/api/v1/workflows/screens/[screen]/contract/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { screen: string } }
) {
  try {
    const supabase = await createClient();
    
    const { data: contract } = await supabase.rpc(
      'cmx_ord_screen_pre_conditions',
      { p_screen: params.screen }
    );
    
    return NextResponse.json({
      preConditions: contract,
      screen: params.screen
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

**File:** `web-admin/app/api/v1/orders/[id]/workflow-context/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Get order to extract tenant_id
    const { data: order } = await supabase
      .from('org_orders_mst')
      .select('tenant_org_id')
      .eq('id', params.id)
      .single();
    
    // Get workflow flags and metrics
    const [flagsResult, metricsResult] = await Promise.all([
      supabase.rpc('cmx_ord_order_workflow_flags', {
        p_tenant_org_id: order.tenant_org_id,
        p_order_id: params.id
      }),
      supabase.rpc('cmx_ord_order_live_metrics', {
        p_tenant_org_id: order.tenant_org_id,
        p_order_id: params.id
      })
    ]);
    
    return NextResponse.json({
      flags: flagsResult.data,
      metrics: metricsResult.data,
      orderId: params.id
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```



### Phase 3: Frontend Implementation

#### 3.1 Create React Hooks

**File:** `web-admin/lib/hooks/use-screen-contract.ts`

```typescript
import { useQuery } from '@tanstack/react-query';

export function useScreenContract(screen: string) {
  return useQuery({
    queryKey: ['screen-contract', screen],
    queryFn: async () => {
      const response = await fetch(`/api/v1/workflows/screens/${screen}/contract`);
      if (!response.ok) throw new Error('Failed to fetch screen contract');
      return response.json();
    },
    staleTime: Infinity, // Screen contracts are immutable
  });
}
```

**File:** `web-admin/lib/hooks/use-workflow-context.ts`

```typescript
import { useQuery } from '@tanstack/react-query';

export function useWorkflowContext(orderId: string) {
  return useQuery({
    queryKey: ['workflow-context', orderId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/orders/${orderId}/workflow-context`);
      if (!response.ok) throw new Error('Failed to fetch workflow context');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
```

**File:** `web-admin/lib/hooks/use-order-transition.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useOrderTransition() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      orderId,
      screen,
      input,
      useOldWfCodeOrNew
    }: {
      orderId: string;
      screen: string;
      input?: Record<string, any>;
      useOldWfCodeOrNew?: boolean;
    }) => {
      const response = await fetch(`/api/v1/orders/${orderId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screen, input, useOldWfCodeOrNew }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Transition failed');
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries(['order', variables.orderId]);
      queryClient.invalidateQueries(['workflow-context', variables.orderId]);
    },
  });
}
```



#### 3.2 Update Screens to Use New Hooks

**File:** `web-admin/app/dashboard/preparation/page.tsx`

```typescript
'use client';

import { useScreenContract } from '@/lib/hooks/use-screen-contract';
import { useOrderTransition } from '@/lib/hooks/use-order-transition';

export default function PreparationPage() {
  const { data: contract, isLoading } = useScreenContract('preparation');
  const transition = useOrderTransition();
  
  // Filter orders by contract pre-conditions
  const statuses = contract?.preConditions?.statuses || ['preparing'];
  
  // ... rest of component
  
  const handleComplete = async (orderId: string) => {
    await transition.mutateAsync({
      orderId,
      screen: 'preparation',
      input: {},
      useOldWfCodeOrNew: false // Use new workflow system
    });
  };
  
  // ... rest of component
}
```



### Phase 4: Testing & Val

### Phase 4: Testing & Valididation

#### 4.1 Database Function Tests

**File:** `supabase/tests/functions/test_screen_contracts_simplified.sql`

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

-- Test atomic transition
SELECT assert(
  (cmx_ord_execute_transition(
    test_tenant_id,
    test_order_id,
    'preparation',
    'preparing',
    'processing',
    test_user_id
  )->>'ok')::boolean = true,
  'Transition should execute successfully'
);
```



#### 4.2 API Integration Tests

**File:** `web-admin/__tests__/api/workflow-transition.test.ts`

```typescript
import { POST } from '@/app/api/v1/orders/[id]/transition/route';
import { WorkflowServiceEnhanced } from '@/lib/services/workflow-service-enhanced';

describe('Workflow Transition API', () => {
  it('should use old code when USE_OLD_WF_CODE_OR_NEW is false', async () => {
    const request = new Request('http://localhost/api/v1/orders/123/transition', {
      method: 'POST',
      body: JSON.stringify({
        screen: 'preparation',
        useOldWfCodeOrNew: false
      })
    });
    
    const response = await POST(request, { params: { id: '123' } });
    const data = await response.json();
    
    // Should call old WorkflowService.changeStatus
    expect(data).toBeDefined();
  });
  
  it('should use new code when USE_OLD_WF_CODE_OR_NEW is true', async () => {
    // Mock HQ Platform APIs
    jest.mock('@/lib/services/feature-flags.service');
    jest.mock('@/lib/services/usage-tracking.service');
    jest.mock('@/lib/api/hq-api-client');
    
    const request = new Request('http://localhost/api/v1/orders/123/transition', {
      method: 'POST',
      body: JSON.stringify({
        screen: 'preparation',
        useOldWfCodeOrNew: true
      })
    });
    
    const response = await POST(request, { params: { id: '123' } });
    const data = await response.json();
    
    // Should call new WorkflowServiceEnhanced.executeScreenTransition
    expect(data.ok).toBe(true);
  });
});
```



#### 4.3 E2E Tests

**File:** `web-admin/__tests__/e2e/workflow-transition.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Workflow Transition', () => {
  test('should transition order from preparation to processing', async ({ page }) => {
    await page.goto('/dashboard/preparation');
    
    // Wait for orders to load
    await page.waitForSelector('[data-testid="order-card"]');
    
    // Click complete button
    await page.click('[data-testid="complete-preparation-btn"]');
    
    // Verify transition
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });
});
```



### Phase 5: Documentation

#### 5.1 Developer Documentation

**File:** `docs/developers/workflow-system-guide.md`**Contents:**

- Architecture overview
- Database functions reference
- Application service API
- How to add new screens
- How to add custom validations
- Testing guidelines
- Debugging tips

#### 5.2 Testing Documentation

**File:** `docs/testing/workflow-testing-guide.md`**Contents:**

- Test database functions
- Test API endpoints
- Test frontend hooks
- E2E test scenarios
- Performance testing
- Load testing

#### 5.3 User Documentation

**File:** `docs/users/workflow-user-guide.md`**Contents:**

- How to use each workflow screen
- Understanding order statuses
- Quality gates explanation
- Troubleshooting common issues
- FAQ

#### 5.4 Admin Documentation

**File:** `docs/admins/workflow-configuration-guide.md`**Contents:**

- How to configure screen contracts
- How to customize workflows per tenant
- Feature flag configuration
- Plan limits configuration
- Settings configuration

#### 5.5 Migration Documentation

**File:** `docs/migration/workflow-migration-guide.md`**Contents:**

- Migration strategy overview
- Step-by-step migration process
- Rollback procedures
- Testing migration
- Common issues and solutions

## Migration Strategy

### Step 1: Deploy Database Functions

- Deploy simplified database functions
- Functions available but not used yet
- No breaking changes

### Step 2: Add Feature Flag

- Create `USE_NEW_WORKFLOW_SYSTEM` feature flag in HQ Platform
- Default: `false` (use old code)
- Add to `hq_ff_feature_flags_mst` table

### Step 3: Implement Application Layer

- Create `WorkflowServiceEnhanced`
- Implement API endpoints
- Add `USE_OLD_WF_CODE_OR_NEW` parameter support

### Step 4: Per-Screen Migration

- Migrate one screen at a time
- Enable feature flag per tenant or globally
- Test thoroughly before next screen
- Can rollback by setting flag to `false`

### Step 5: Complete Migration

- All screens migrated
- Remove old code paths (or keep for emergency)
- Remove feature flag (or keep for rollback)

## Success Criteria

- [ ] All database functions use `cmx_ord_*` prefix
- [ ] Database functions are simple (< 100 lines each)
- [ ] Complex logic moved to application layer
- [ ] HQ Platform APIs integrated for feature flags, plan limits, settings
- [ ] `USE_OLD_WF_CODE_OR_NEW` parameter works correctly
- [ ] All screens can use new or old code path
- [ ] Comprehensive documentation created
- [ ] Tests cover all scenarios