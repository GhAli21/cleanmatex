/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param */
/**
 * WorkflowServiceEnhanced
 * Enhanced workflow service with simplified database functions and HQ Platform API integration
 * Implements USE_OLD_WF_CODE_OR_NEW parameter for gradual migration
 */

import { createClient } from '@/lib/supabase/server';
import { FLAG_KEYS } from '@/lib/constants/feature-flags';
import { getFeatureFlags } from '@/lib/services/feature-flags.service';
import { canCreateOrder } from '@/lib/services/usage-tracking.service';
import { hqApiClient } from '@/lib/api/hq-api-client';
import { WorkflowService } from './workflow-service';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import {
  unwindOrderFinancialsOnCancel,
  CANCEL_DISPOSITIONS,
  type CancelDisposition,
} from '@/lib/services/order-cancel-financials.service';
import type { Order } from '@/types/order';
import type { OrderStatus } from '@/lib/types/workflow';

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
  constructor(message: string, public details: unknown) {
    super(message);
    this.name = 'LimitExceededError';
  }
}

/** RPC payloads for order transition helpers (Postgrest `Json`). */
type RpcTransitionPayload = {
  ok?: boolean;
  message?: string;
  errors?: Array<{ code: string; message: string }>;
};

type WorkflowFlagsPayload = {
  assembly_enabled?: boolean;
  qa_enabled?: boolean;
  packing_enabled?: boolean;
};

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

    // FN-02 disposition gate (Order-Fin remediation Phase 4): cancelling an
    // order that holds collected money requires an explicit disposition —
    // REFUND (maker-checker refund flow), STORE_CREDIT (credit note), or
    // KEEP_ON_ACCOUNT (retain funds; requires orders:approve_refund). Applied
    // stored-value credit is always reversed to its source ledger by the
    // unwind. Runs before the old/new workflow fork so both paths are covered.
    let cancelDisposition: CancelDisposition | undefined;
    if (screen === 'canceling') {
      const paidAmount = Number(order.total_paid_amount ?? 0);
      if (paidAmount > 0.001) {
        const requested = String(input.cancellation_disposition ?? '').toUpperCase();
        if (!Object.values(CANCEL_DISPOSITIONS).includes(requested as CancelDisposition)) {
          throw new ValidationError(
            'This order has collected payments. Choose a disposition (refund, store credit, or keep on account) to cancel it.',
            'CANCEL_DISPOSITION_REQUIRED'
          );
        }
        cancelDisposition = requested as CancelDisposition;
        if (cancelDisposition === CANCEL_DISPOSITIONS.KEEP_ON_ACCOUNT) {
          const canKeep = await hasPermissionServer('orders:approve_refund');
          if (!canKeep) {
            throw new PermissionError(
              'Keeping collected money on a cancelled order requires refund-approval permission.',
              ['orders:approve_refund']
            );
          }
        }
      }
    }

    // Check USE_OLD_WF_CODE_OR_NEW flag (from options or feature flag)
    const USE_OLD_WF_CODE_OR_NEW =
      options?.useOldWfCodeOrNew ??
      (await this.getFeatureFlag('USE_NEW_WORKFLOW_SYSTEM', tenantId, options?.authHeader));

    if (!USE_OLD_WF_CODE_OR_NEW) {
      // Use existing old code path
      const nextStatus = (input.to_status ||
        this.resolveNextStatus(screen, order)) as OrderStatus;
      const result = await WorkflowService.changeStatus({
        orderId,
        tenantId,
        fromStatus: (order.current_status || 'draft') as OrderStatus,
        toStatus: nextStatus,
        userId,
        userName: input.user_name,
        notes: input.notes,
        metadata: input.metadata,
      });

      // FN-02: the financial unwind must run on BOTH workflow paths.
      if (result.success && screen === 'canceling') {
        await unwindOrderFinancialsOnCancel({
          tenantId,
          orderId,
          userId: userId!,
          disposition: cancelDisposition,
          reason: (input.cancelled_note || input.notes || '').trim(),
        });
      }

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
    const screenContract = contract as unknown as ScreenContract;
    const currentStatus = (order.current_status || 'draft') as OrderStatus;
    if (!screenContract.statuses.includes(currentStatus)) {
      throw new ValidationError(
        `Order status ${currentStatus} does not match screen requirements`,
        'STATUS_MISMATCH'
      );
    }

    // 3. Permission check (application layer)
    const requiredPermissions = screenContract.required_permissions || [];
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
    await this.validateBusinessRules(order as unknown as Order, screen, input);

    // 7b. Cancel/return require reason
    if (screen === 'canceling') {
      const reason = (input.cancelled_note || input.notes || '').trim();
      if (reason.length < 10) {
        throw new ValidationError(
          'Cancellation reason is required (min 10 characters)',
          'REASON_REQUIRED'
        );
      }
    }
    if (screen === 'returning') {
      const reason = (input.return_reason || input.notes || '').trim();
      if (reason.length < 10) {
        throw new ValidationError(
          'Return reason is required (min 10 characters)',
          'REASON_REQUIRED'
        );
      }
    }

    // 8. Quality gates (application layer)
    const nextStatus = (input.to_status ||
      this.resolveNextStatus(screen, order as unknown as Order)) as OrderStatus;
    if (nextStatus === 'ready') {
      const qualityCheck = await this.checkQualityGates(orderId, tenantId);
      if (!qualityCheck.passed) {
        throw new QualityGateError('Quality gates not met', qualityCheck.blockers);
      }
    }

    // ============================================
    // Database Layer: Atomic Update
    // ============================================

    // Use dedicated RPCs for canceling and returning (they set cancelled_at, returned_at, etc.)
    if (screen === 'canceling') {
      const { data: result, error } = await supabase.rpc('cmx_ord_canceling_transition', {
        p_tenant_org_id: tenantId,
        p_order_id: orderId,
        p_user_id: userId,
        p_input: {
          cancelled_note: input.cancelled_note || input.notes,
          cancellation_reason_code: input.cancellation_reason_code,
          ...input,
        },
        p_idempotency_key: input.idempotency_key,
        p_expected_updated_at: order.updated_at,
      });

      const cancelPayload = (result ?? null) as RpcTransitionPayload | null;
      if (error || !cancelPayload?.ok) {
        throw new TransitionError(
          cancelPayload?.message || error?.message || 'Cancel failed',
          cancelPayload?.errors || []
        );
      }
      // FN-02 financial unwind: reverse applied credit to source ledgers,
      // route collected payments per the chosen disposition, reverse promo
      // usage, recalc the snapshot, and emit the audit event. Runs after the
      // status transition committed; every step is idempotent, so on failure
      // the operator retries from the order screen without double effects.
      try {
        const unwind = await unwindOrderFinancialsOnCancel({
          tenantId,
          orderId,
          userId: userId!,
          disposition: cancelDisposition,
          reason: (input.cancelled_note || input.notes || '').trim(),
        });
        if (unwind.warnings.length > 0) {
          return {
            ...(cancelPayload as TransitionResult),
            message: `Cancelled with financial warnings: ${unwind.warnings.join(' | ')}`,
          };
        }
      } catch (unwindError) {
        const message =
          unwindError instanceof Error ? unwindError.message : String(unwindError);
        throw new TransitionError(
          `Order was cancelled but the financial unwind failed (${message}). Retry the cancellation to complete the refund/credit handling — it is safe to repeat.`,
          [{ code: 'CANCEL_UNWIND_FAILED', message }]
        );
      }
      return cancelPayload as TransitionResult;
    }

    if (screen === 'returning') {
      const { data: result, error } = await supabase.rpc('cmx_ord_returning_transition', {
        p_tenant_org_id: tenantId,
        p_order_id: orderId,
        p_user_id: userId,
        p_input: {
          return_reason: input.return_reason || input.notes,
          return_reason_code: input.return_reason_code,
          ...input,
        },
        p_idempotency_key: input.idempotency_key,
        p_expected_updated_at: order.updated_at,
      });

      const returnPayload = (result ?? null) as RpcTransitionPayload | null;
      if (error || !returnPayload?.ok) {
        throw new TransitionError(
          returnPayload?.message || error?.message || 'Customer return failed',
          returnPayload?.errors || []
        );
      }
      // Refund handling: the legacy loop refunded the legacy payments ledger rows —
      // that ledger is deprecated and empty (ADR-002), so it refunded nothing.
      // Canonical refunds for returned orders go through the order refund flow
      // (order-refund.service); auto-wiring returns into it lands with
      // Order-Fin remediation Phase 4.
      return returnPayload as TransitionResult;
    }

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

    const execPayload = (result ?? null) as RpcTransitionPayload | null;
    if (error || !execPayload?.ok) {
      throw new TransitionError(
        execPayload?.message || error?.message || 'Transition failed',
        execPayload?.errors || []
      );
    }

    return execPayload as TransitionResult;
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
      const raw = flags[flagKey as keyof typeof flags];
      if (typeof raw === 'boolean') return raw;
      return Boolean(raw);
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
      assembly: FLAG_KEYS.ASSEMBLY_WORKFLOW,
      qa: FLAG_KEYS.QA_WORKFLOW,
      packing: FLAG_KEYS.PACKING_WORKFLOW,
      driver_delivery: FLAG_KEYS.DRIVER_APP,
      processing: 'basic_workflow', // not in catalog
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

    const { data: assignments } = await supabase
      .from('org_auth_user_roles')
      .select('role_code')
      .eq('user_id', userId)
      .eq('tenant_org_id', tenantId)
      .eq('is_active', true);

    const roleCodes = [...new Set((assignments ?? []).map((a) => a.role_code))];
    if (roleCodes.length === 0) return [];

    const { data: permRows } = await supabase
      .from('sys_auth_role_default_permissions')
      .select('permission_code')
      .in('role_code', roleCodes);

    const codes = [...new Set((permRows ?? []).map((p) => p.permission_code))];
    return codes;
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
        const expectedPieces = item.quantity ?? 0;
        const scannedPieces =
          item.pieces?.filter((p: { scan_state?: string }) => p.scan_state === 'scanned')
            .length || 0;

        if (scannedPieces < expectedPieces) {
          throw new ValidationError(
            `Item ${item.product_name || item.id} missing ${expectedPieces - scannedPieces} pieces`,
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
    const { data: flagsRpc } = await supabase.rpc('cmx_ord_order_workflow_flags', {
      p_tenant_org_id: tenantId,
      p_order_id: orderId,
    });
    const flags = flagsRpc as WorkflowFlagsPayload | null;

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
  private static resolveNextStatus(screen: string, order: Order | Record<string, unknown>): OrderStatus {
    const flags = (order as { workflow_flags?: WorkflowFlagsPayload }).workflow_flags || {};

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
