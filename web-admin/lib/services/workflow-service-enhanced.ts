/**
 * WorkflowServiceEnhanced
 * Enhanced workflow service with simplified database functions and HQ Platform API integration
 * Implements USE_OLD_WF_CODE_OR_NEW parameter for gradual migration
 */

import { createClient } from '@/lib/supabase/server';
import { getFeatureFlags } from '@/lib/services/feature-flags.service';
import { canCreateOrder } from '@/lib/services/usage-tracking.service';
import { hqApiClient } from '@/lib/api/hq-api-client';
import { WorkflowService } from './workflow-service';
import type { Order } from '@/types/order';

// ==================================================================
// Type Definitions
// ==================================================================

export interface TransitionResult {
  ok: boolean;
  from_status?: string;
  to_status?: string;
  order_id?: string;
  updated_at?: string;
  idempotent?: boolean;
  code?: string;
  message?: string;
  errors?: Array<{ code: string; message: string }>;
}

export interface QualityGateResult {
  passed: boolean;
  blockers: string[];
}

export interface ScreenContract {
  statuses: string[];
  additional_filters: Record<string, any>;
  required_permissions: string[];
}

export class ValidationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class PermissionError extends Error {
  constructor(message: string, public missingPermissions: string[]) {
    super(message);
    this.name = 'PermissionError';
  }
}

export class FeatureFlagError extends Error {
  constructor(message: string, public flagKey: string) {
    super(message);
    this.name = 'FeatureFlagError';
  }
}

export class LimitExceededError extends Error {
  constructor(message: string, public details: any) {
    super(message);
    this.name = 'LimitExceededError';
  }
}

export class SettingsError extends Error {
  constructor(message: string, public settingKey: string) {
    super(message);
    this.name = 'SettingsError';
  }
}

export class QualityGateError extends Error {
  constructor(message: string, public blockers: string[]) {
    super(message);
    this.name = 'QualityGateError';
  }
}

export class TransitionError extends Error {
  constructor(message: string, public errors?: any[]) {
    super(message);
    this.name = 'TransitionError';
  }
}

// ==================================================================
// WorkflowServiceEnhanced
// ==================================================================

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
    const { data: order, error: orderError } = await supabase
      .from('org_orders_mst')
      .select('*, tenant_org_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new ValidationError('Order not found', 'ORDER_NOT_FOUND');
    }

    const tenantId = order.tenant_org_id;
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    if (!userId) {
      throw new ValidationError('User not authenticated', 'UNAUTHORIZED');
    }

    // Check USE_OLD_WF_CODE_OR_NEW flag (from options or feature flag)
    const USE_OLD_WF_CODE_OR_NEW =
      options?.useOldWfCodeOrNew ??
      (await this.getFeatureFlag('USE_NEW_WORKFLOW_SYSTEM', tenantId, options?.authHeader));

    if (!USE_OLD_WF_CODE_OR_NEW) {
      // Use existing old code path
      const nextStatus = input.to_status || this.resolveNextStatus(screen, order);
      const result = await WorkflowService.changeStatus({
        orderId,
        tenantId,
        fromStatus: order.current_status || 'draft',
        toStatus: nextStatus,
        userId,
        userName: input.user_name,
        notes: input.notes,
        metadata: input.metadata,
      });

      return {
        ok: result.success,
        from_status: order.current_status,
        to_status: nextStatus,
        order_id: orderId,
        message: result.error,
      };
    }

    // ============================================
    // NEW CODE PATH: Application Layer Validation
    // ============================================

    // 1. Get screen contract from DB (simple config)
    const { data: contract, error: contractError } = await supabase.rpc(
      'cmx_ord_screen_pre_conditions',
      { p_screen: screen }
    );

    if (contractError || !contract) {
      throw new ValidationError(
        `Failed to get screen contract: ${contractError?.message}`,
        'CONTRACT_ERROR'
      );
    }

    // 2. Validate pre-conditions
    const currentStatus = order.current_status || 'draft';
    if (!contract.statuses.includes(currentStatus)) {
      throw new ValidationError(
        `Order status ${currentStatus} does not match screen requirements`,
        'STATUS_MISMATCH'
      );
    }

    // 3. Permission check (application layer)
    const requiredPermissions = contract.required_permissions || [];
    if (requiredPermissions.length > 0) {
      const userPermissions = await this.getUserPermissions(userId, tenantId);
      const missingPermissions = requiredPermissions.filter(
        (p) => !userPermissions.includes(p)
      );
      if (missingPermissions.length > 0) {
        throw new PermissionError(
          `Missing permissions: ${missingPermissions.join(', ')}`,
          missingPermissions
        );
      }
    }

    // 4. Feature flag check (via HQ Platform API or service)
    const featureFlags = await getFeatureFlags(tenantId);
    const screenFeatureFlag = this.mapScreenToFeatureFlag(screen);
    if (screenFeatureFlag && !featureFlags[screenFeatureFlag as keyof typeof featureFlags]) {
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
            limit: limitCheck.limit,
          }
        );
      }
    }

    // 6. Settings check (via HQ Platform API)
    const settingKey = `workflow.${screen}.enabled`;
    try {
      const settings = await hqApiClient.getEffectiveSettings(tenantId, {
        authHeader: options?.authHeader,
      });
      const setting = settings.find((s) => s.stngCode === settingKey);
      if (setting && setting.stngValue === false) {
        throw new SettingsError(
          `Workflow screen ${screen} is disabled in settings`,
          settingKey
        );
      }
    } catch (settingsError) {
      // Log but don't fail if settings API is unavailable
      console.warn('Settings check failed:', settingsError);
    }

    // 7. Complex business rules (application layer)
    await this.validateBusinessRules(order as Order, screen, input);

    // 8. Quality gates (application layer)
    const nextStatus = input.to_status || this.resolveNextStatus(screen, order as Order);
    if (nextStatus === 'ready') {
      const qualityCheck = await this.checkQualityGates(orderId, tenantId);
      if (!qualityCheck.passed) {
        throw new QualityGateError('Quality gates not met', qualityCheck.blockers);
      }
    }

    // ============================================
    // Database Layer: Atomic Update
    // ============================================

    const { data: result, error } = await supabase.rpc('cmx_ord_execute_transition', {
      p_tenant_org_id: tenantId,
      p_order_id: orderId,
      p_screen: screen,
      p_from_status: currentStatus,
      p_to_status: nextStatus,
      p_user_id: userId,
      p_input: input,
      p_idempotency_key: input.idempotency_key,
      p_expected_updated_at: order.updated_at,
    });

    if (error || !result?.ok) {
      throw new TransitionError(
        result?.message || error?.message || 'Transition failed',
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
    try {
      // Use existing feature flags service
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
  private static mapScreenToFeatureFlag(screen: string): string | null {
    const mapping: Record<string, string> = {
      assembly: 'assembly_workflow',
      qa: 'qa_workflow',
      packing: 'packing_workflow',
      driver_delivery: 'driver_app',
      processing: 'basic_workflow',
    };
    return mapping[screen] || null;
  }

  /**
   * Get user permissions
   */
  private static async getUserPermissions(
    userId: string,
    tenantId: string
  ): Promise<string[]> {
    const supabase = await createClient();

    // Get user roles and permissions
    const { data: userRoles } = await supabase
      .from('org_users_mst')
      .select('roles')
      .eq('user_id', userId)
      .eq('tenant_org_id', tenantId)
      .eq('is_active', true)
      .single();

    if (!userRoles?.roles) {
      return [];
    }

    // Get permissions for roles
    const roles = Array.isArray(userRoles.roles) ? userRoles.roles : [userRoles.roles];
    const { data: permissions } = await supabase
      .from('sys_rbac_permissions_cd')
      .select('permission_key')
      .in('role_code', roles);

    return permissions?.map((p) => p.permission_key) || [];
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
        const expectedPieces = item.qty || 0;
        const scannedPieces =
          item.pieces?.filter((p: any) => p.scan_state === 'scanned').length || 0;

        if (scannedPieces < expectedPieces) {
          throw new ValidationError(
            `Item ${item.item_name || item.id} missing ${expectedPieces - scannedPieces} pieces`,
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
      .select(
        `
        *,
        items:org_order_items_dtl(*)
      `
      )
      .eq('id', orderId)
      .eq('tenant_org_id', tenantId)
      .single();

    // Get issues separately
    const { data: issues } = await supabase
      .from('org_order_item_issues')
      .select('*')
      .eq('order_id', orderId)
      .eq('tenant_org_id', tenantId)
      .is('solved_at', null);

    if (!order) {
      return {
        passed: false,
        blockers: ['Order not found'],
      };
    }

    const blockers: string[] = [];

    // Get workflow flags
    const { data: flags } = await supabase.rpc('cmx_ord_order_workflow_flags', {
      p_tenant_org_id: tenantId,
      p_order_id: orderId,
    });

    // Check 1: All items assembled (if assembly enabled)
    if (flags?.assembly_enabled) {
      const unassembled =
        order.items?.filter((item: any) => item.item_status !== 'assembled') || [];
      if (unassembled.length > 0) {
        blockers.push(`${unassembled.length} items not assembled`);
      }
    }

    // Check 2: QA passed (if QA enabled)
    if (flags?.qa_enabled) {
      const failedQA =
        order.items?.filter((item: any) => item.qa_status !== 'passed') || [];
      if (failedQA.length > 0) {
        blockers.push(`${failedQA.length} items failed QA`);
      }
    }

    // Check 3: No blocking issues
    const blockingIssues =
      issues?.filter((issue: any) => issue.priority === 'high' || issue.priority === 'urgent') || [];
    if (blockingIssues.length > 0) {
      blockers.push(`${blockingIssues.length} blocking issues unresolved`);
    }

    return {
      passed: blockers.length === 0,
      blockers,
    };
  }

  /**
   * Resolve next status based on screen and order state
   */
  private static resolveNextStatus(screen: string, order: Order | any): string {
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
        return 'out_for_delivery';

      case 'driver_delivery':
        return 'delivered';

      case 'new_order':
        return 'intake';

      default:
        throw new Error(`Unknown screen: ${screen}`);
    }
  }
}

