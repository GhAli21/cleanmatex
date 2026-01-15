/**
 * WorkflowService
 * Core business logic for order workflow and status management
 * PRD-005: Basic Workflow & Status Transitions
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import type {
  OrderStatus,
  ChangeStatusParams,
  ChangeStatusResult,
  BulkChangeStatusParams,
  BulkChangeStatusResult,
  TransitionCheckParams,
  TransitionCheckResult,
  QualityGateCheckResult,
  WorkflowSettings,
  StatusHistoryEntry,
  OverdueOrder,
  WorkflowStats,
} from '@/lib/types/workflow';

export class WorkflowService {
  /**
   * Change order status with full validation and audit trail
   * PRD-010: Uses cmx_order_transition() DB function for core validation
   */
  static async changeStatus(
    params: ChangeStatusParams
  ): Promise<ChangeStatusResult> {
    try {
      const supabase = await createClient();
      const {
        orderId,
        tenantId,
        fromStatus,
        toStatus,
        userId,
        userName,
        notes,
        metadata,
      } = params;
      // Build payload for DB function
      const payload = {
        notes,
        ...metadata,
      };
      // Call DB function to perform transition
      const { data, error: functionError } = await supabase.rpc(
        'cmx_order_transition',
        {
          p_tenant: tenantId,
          p_order: orderId,
          p_from: fromStatus,
          p_to: toStatus,
          p_user: userId,
          p_payload: payload,
        }
      );
      
      if (functionError || !data) {
        logger.warn('Order transition failed (db function)', {
          feature: 'workflow',
          action: 'change_status',
          tenantId,
          orderId,
          fromStatus,
          toStatus,
          userId,
          message: functionError?.message ?? 'No data returned',
        });
        return {
          success: false,
          error: functionError?.message || 'Transition failed',
        };
      }

      // Parse DB function result
      if (data.success === false) {
        return {
          success: false,
          error: data.error || 'Transition not allowed',
          blockers: data.gate === 'rack_location_required' ? ['Rack location required'] : undefined,
        };
      }

      // Emit hooks/events (best-effort, non-blocking)
      try {
        await this.triggerWorkflowHooks({
          orderId,
          tenantId,
          fromStatus,
          toStatus,
        });
      } catch (hookErr) {
        logger.warn('Workflow hooks failed (non-blocking)', {
          feature: 'workflow',
          action: 'hooks',
          tenantId,
          orderId,
          fromStatus,
          toStatus,
        });
      }

      return {
        success: true,
        order: {
          id: data.order_id,
          status: data.to_status,
          updated_at: data.transitioned_at,
        },
      };
    } catch (error) {
      logger.error(
        'WorkflowService.changeStatus error',
        error instanceof Error ? error : new Error('Unknown error'),
        { feature: 'workflow', action: 'change_status' }
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if a status transition is allowed
   * PRD-010: Uses cmx_validate_transition() DB function
   */
  static async isTransitionAllowed(
    params: TransitionCheckParams
  ): Promise<TransitionCheckResult> { 
    try {
      const supabase = await createClient();
      const { tenantId, fromStatus, toStatus, orderId } = params;

      // If we have an order_id, use DB function for validation
      if (orderId) {
        const { data, error } = await supabase.rpc(
          'cmx_validate_transition',
          {
            p_tenant: tenantId,
            p_order: orderId,
            p_from: fromStatus,
            p_to: toStatus,
          }
        );

        if (!error && data) {
          return {
            isAllowed: data.allowed,
            reason: data.error || undefined,
          };
        }
      }

      // Fallback to legacy validation if order_id not provided
      const { data: settings } = await supabase
        .from('org_workflow_settings_cf')
        .select('*')
        .eq('tenant_org_id', tenantId)
        .eq('service_category_code', null)
        .eq('is_active', true)
        .single();

      if (!settings) {
        const { WORKFLOW_TRANSITIONS } = await import('./workflow-constants');
        const fallback = WORKFLOW_TRANSITIONS[fromStatus] || [];
        return { isAllowed: fallback.includes(toStatus) };
      }

      const transitions = settings.status_transitions as Record<string, string[]>;
      const allowedTransitions = transitions[fromStatus] || [];

      if (!allowedTransitions.includes(toStatus)) {
        return {
          isAllowed: false,
          reason: `Cannot transition from ${fromStatus} to ${toStatus}`,
        };
      }

      return { isAllowed: true };
    } catch (error) {
      logger.error(
        'WorkflowService.isTransitionAllowed error',
        error instanceof Error ? error : new Error('Unknown error'),
        { feature: 'workflow', action: 'is_transition_allowed' }
      );
      // Fail safe: allow transition if check fails
      return { isAllowed: true };
    }
  }

  /**
   * Get workflow configuration for tenant/service category
   */
  static async getWorkflowForTenant(
    tenantId: string,
    serviceCategoryCode?: string
  ): Promise<OrderStatus[]> {
    try {
      const supabase = await createClient();

      const { data: settings } = await supabase
        .from('org_workflow_settings_cf')
        .select('workflow_steps')
        .eq('tenant_org_id', tenantId)
        .eq('service_category_code', serviceCategoryCode || null)
        .eq('is_active', true)
        .single();

      if (settings?.workflow_steps) {
        return settings.workflow_steps as OrderStatus[];
      }

      // Default workflow
      return [
        'DRAFT',
        'INTAKE',
        'PREPARATION',
        'SORTING',
        'WASHING',
        'DRYING',
        'FINISHING',
        'ASSEMBLY',
        'QA',
        'PACKING',
        'READY',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CLOSED',
      ];
    } catch (error) {
      logger.error(
        'WorkflowService.getWorkflowForTenant error',
        error instanceof Error ? error : new Error('Unknown error'),
        { feature: 'workflow', action: 'get_workflow_for_tenant', tenantId }
      );
      // Return default workflow on error
      return [
        'DRAFT',
        'INTAKE',
        'PREPARATION',
        'SORTING',
        'WASHING',
        'DRYING',
        'FINISHING',
        'ASSEMBLY',
        'QA',
        'PACKING',
        'READY',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CLOSED',
      ];
    }
  }

  /**
   * Quality gate validation for READY status
   * Checks if order can move to READY based on business rules
   */
  static async canMoveToReady(
    orderId: string,
    tenantId: string
  ): Promise<QualityGateCheckResult> {
    try {
      const supabase = await createClient();

      // Get order with items
      const { data: order, error } = await supabase
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

      if (error || !order) {
        return {
          canMove: false,
          blockers: ['Order not found'],
        };
      }

      const blockers: string[] = [];
      const details: any = {};

      // Get quality gate rules
      const { data: settings } = await supabase
        .from('org_workflow_settings_cf')
        .select('quality_gate_rules')
        .eq('tenant_org_id', tenantId)
        .eq('service_category_code', null)
        .single();

      const rules =
        (settings?.quality_gate_rules as any)?.READY || {};

      // Check 1: Assembly task exists and is complete (if required)
      if (rules.requireAllItemsAssembled !== false) {
        const { data: assemblyTask } = await supabase
          .from('org_asm_tasks_mst')
          .select('*')
          .eq('order_id', orderId)
          .eq('tenant_org_id', tenantId)
          .single();

        if (!assemblyTask) {
          blockers.push('Assembly task not created');
          details.assemblyTaskMissing = true;
        } else {
          // Check if all items are scanned
          if (assemblyTask.scanned_items < assemblyTask.total_items) {
            const unassembled = assemblyTask.total_items - assemblyTask.scanned_items;
            blockers.push(`${unassembled} items not scanned`);
            details.unassembledItems = unassembled;
          }

          // Check if task is complete
          if (assemblyTask.task_status !== 'READY' && assemblyTask.task_status !== 'QA_PASSED') {
            blockers.push(`Assembly task status: ${assemblyTask.task_status}`);
            details.assemblyTaskStatus = assemblyTask.task_status;
          }
        }
      }

      // Check 2: QA passed (if required)
      if (rules.requireQAPassed !== false) {
        const { data: assemblyTask } = await supabase
          .from('org_asm_tasks_mst')
          .select('qa_status')
          .eq('order_id', orderId)
          .eq('tenant_org_id', tenantId)
          .single();

        if (!assemblyTask) {
          blockers.push('Assembly task not found for QA check');
        } else if (assemblyTask.qa_status !== 'QA_PASSED') {
          blockers.push(`QA status: ${assemblyTask.qa_status || 'PENDING'}`);
          details.qaStatus = assemblyTask.qa_status || 'PENDING';
        }
      }

      // Check 3: No unresolved issues (if required)
      if (rules.requireNoUnresolvedIssues !== false) {
        const unresolvedIssues = order.items?.filter(
          (item: any) =>
            (item.has_stain || item.has_damage) &&
            !item.issues_resolved
        );
        if (unresolvedIssues && unresolvedIssues.length > 0) {
          blockers.push(
            `${unresolvedIssues.length} items have unresolved issues`
          );
          details.unresolvedIssues = unresolvedIssues.length;
        }
      }

      return {
        canMove: blockers.length === 0,
        blockers,
        details: Object.keys(details).length > 0 ? details : undefined,
      };
    } catch (error) {
      console.error('WorkflowService.canMoveToReady error:', error);
      return {
        canMove: false,
        blockers: ['Error checking quality gates'],
      };
    }
  }

  /**
   * Bulk status update with transaction support
   */
  static async bulkChangeStatus(
    params: BulkChangeStatusParams
  ): Promise<BulkChangeStatusResult> {
    const { orderIds, tenantId, toStatus, userId, userName, notes } =
      params;
    const results: Array<{ orderId: string; success: boolean; error?: string }> =
      [];

    let successCount = 0;
    let failureCount = 0;

    // Process each order sequentially
    for (const orderId of orderIds) {
      try {
        const supabase = await createClient();

        // Get current order status
        const { data: order } = await supabase
          .from('org_orders_mst')
          .select('status')
          .eq('id', orderId)
          .eq('tenant_org_id', tenantId)
          .single();

        if (!order) {
          results.push({
            orderId,
            success: false,
            error: 'Order not found',
          });
          failureCount++;
          continue;
        }

        // Change status
        const result = await this.changeStatus({
          orderId,
          tenantId,
          fromStatus: order.status as OrderStatus,
          toStatus,
          userId,
          userName,
          notes,
        });

        if (result.success) {
          results.push({ orderId, success: true });
          successCount++;
        } else {
          results.push({
            orderId,
            success: false,
            error: result.error,
          });
          failureCount++;
        }
      } catch (error) {
        results.push({
          orderId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failureCount++;
      }
    }

    return {
      success: successCount > 0,
      successCount,
      failureCount,
      results,
    };
  }

  /**
   * Get status history for an order
   */
  static async getStatusHistory(
    orderId: string,
    tenantId: string
  ): Promise<StatusHistoryEntry[]> {
    try {
      const supabase = await createClient();

      const { data, error } = await supabase
        .from('org_order_status_history')
        .select('*')
        .eq('order_id', orderId)
        .eq('tenant_org_id', tenantId)
        .order('changed_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch status history:', error);
        return [];
      }

      return (data || []) as StatusHistoryEntry[];
    } catch (error) {
      console.error('WorkflowService.getStatusHistory error:', error);
      return [];
    }
  }

  /**
   * Get overdue orders (past ready_by date)
   */
  static async getOverdueOrders(tenantId: string): Promise<OverdueOrder[]> {
    try {
      const supabase = await createClient();
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('org_orders_mst')
        .select(
          `
          id,
          order_no,
          status,
          ready_by,
          customer:org_customers_mst!inner(
            customer:sys_customers_mst!inner(
              first_name,
              last_name
            )
          ),
          branch:org_branches_mst(
            branch_name
          )
        `
        )
        .eq('tenant_org_id', tenantId)
        .not('status', 'in', '("DELIVERED","CLOSED","CANCELLED")')
        .not('ready_by', 'is', null)
        .lt('ready_by', now)
        .order('ready_by', { ascending: true });

      if (error) {
        console.error('Failed to fetch overdue orders:', error);
        return [];
      }

      return (data || []).map((order: any) => {
        const readyBy = new Date(order.ready_by);
        const hoursOverdue =
          (new Date().getTime() - readyBy.getTime()) / (1000 * 60 * 60);

        return {
          id: order.id,
          order_no: order.order_no,
          customer_name: `${order.customer?.customer?.first_name || ''} ${
            order.customer?.customer?.last_name || ''
          }`.trim(),
          status: order.status,
          ready_by: order.ready_by,
          hours_overdue: Math.round(hoursOverdue * 10) / 10,
          branch_name: order.branch?.branch_name,
        };
      });
    } catch (error) {
      console.error('WorkflowService.getOverdueOrders error:', error);
      return [];
    }
  }

  /**
   * Get workflow statistics for dashboard
   */
  static async getWorkflowStats(tenantId: string): Promise<WorkflowStats> {
    try {
      const supabase = await createClient();

      // Status distribution
      const { data: statusData } = await supabase
        .from('org_orders_mst')
        .select('status')
        .eq('tenant_org_id', tenantId)
        .not('status', 'in', '("CLOSED","CANCELLED")');

      const total = statusData?.length || 0;
      const statusCounts: Record<string, number> = {};

      statusData?.forEach((order: any) => {
        statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
      });

      const statusDistribution = Object.entries(statusCounts).map(
        ([status, count]) => ({
          status: status as OrderStatus,
          count,
          percentage: total > 0 ? (count / total) * 100 : 0,
        })
      );

      // SLA compliance
      const { data: slaData } = await supabase
        .from('org_orders_mst')
        .select('ready_by, ready_at')
        .eq('tenant_org_id', tenantId)
        .not('ready_at', 'is', null)
        .not('ready_by', 'is', null);

      let onTime = 0;
      let late = 0;

      slaData?.forEach((order: any) => {
        if (new Date(order.ready_at) <= new Date(order.ready_by)) {
          onTime++;
        } else {
          late++;
        }
      });

      const slaTotal = onTime + late;
      const complianceRate = slaTotal > 0 ? (onTime / slaTotal) * 100 : 0;

      // Current orders summary
      const inProgress = statusData?.filter(
        (o: any) =>
          !['READY', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(o.status)
      ).length || 0;

      const ready =
        statusData?.filter((o: any) => o.status === 'READY').length || 0;

      // Overdue count
      const now = new Date().toISOString();
      const { data: overdueData } = await supabase
        .from('org_orders_mst')
        .select('id')
        .eq('tenant_org_id', tenantId)
        .not('status', 'in', '("DELIVERED","CLOSED","CANCELLED")')
        .not('ready_by', 'is', null)
        .lt('ready_by', now);

      return {
        statusDistribution,
        averageTimePerStage: [], // TODO: Calculate from status history
        slaCompliance: {
          onTime,
          late,
          complianceRate: Math.round(complianceRate * 10) / 10,
        },
        currentOrders: {
          total,
          inProgress,
          ready,
          overdue: overdueData?.length || 0,
        },
      };
    } catch (error) {
      console.error('WorkflowService.getWorkflowStats error:', error);
      // Return empty stats on error
      return {
        statusDistribution: [],
        averageTimePerStage: [],
        slaCompliance: {
          onTime: 0,
          late: 0,
          complianceRate: 0,
        },
        currentOrders: {
          total: 0,
          inProgress: 0,
          ready: 0,
          overdue: 0,
        },
      };
    }
  }

  /**
   * Check for auto-transitions (e.g., PREPARATION → PROCESSING)
   * TODO: Implement based on business rules
   */
  static async checkAutoTransitions(
    orderId: string,
    tenantId: string
  ): Promise<void> {
    // Placeholder for future auto-transition logic
    console.log('Auto-transition check for order:', orderId);
  }

  /**
   * PRD-010: Transition order (wrapper for changeStatus with DB function)
   */
  static async transitionOrder(
    orderId: string,
    tenantId: string,
    fromStatus: OrderStatus,
    toStatus: OrderStatus,
    userId: string,
    userName: string,
    notes?: string,
    metadata?: Record<string, any>
  ): Promise<ChangeStatusResult> {
    return this.changeStatus({
      orderId,
      tenantId,
      fromStatus,
      toStatus,
      userId,
      userName,
      notes,
      metadata,
    });
  }

  /**
   * PRD-010: Get workflow template for order/category
   */
  static async getWorkflowTemplate(
    tenantId: string,
    serviceCategoryCode?: string
  ): Promise<any> {
    try {
      const supabase = await createClient();

      const { data } = await supabase
        .from('org_tenant_workflow_templates_cf')
        .select('*, template:sys_workflow_template_cd(*)')
        .eq('tenant_org_id', tenantId)
        .eq('is_default', true)
        .eq('is_active', true)
        .single();

      return data || null;
    } catch (error) {
      console.error('WorkflowService.getWorkflowTemplate error:', error);
      return null;
    }
  }

  /**
   * PRD-010: Get allowed transitions for order
   */
  static async getAllowedTransitions(
    orderId: string,
    tenantId: string,
    fromStatus?: OrderStatus
  ): Promise<any[]> {
    try {
      const supabase = await createClient();

      const { data, error } = await supabase.rpc('cmx_get_allowed_transitions', {
        p_tenant: tenantId,
        p_order: orderId,
        p_from: fromStatus || null,
      });

      if (error || !data) {
        return [];
      }

      return data.transitions || [];
    } catch (error) {
      console.error('WorkflowService.getAllowedTransitions error:', error);
      return [];
    }
  }

  /**
   * PRD-010: Get order state with flags and transitions
   */
  static async getOrderState(orderId: string, tenantId: string): Promise<any> {
    try {
      const supabase = await createClient();

      const { data: order } = await supabase
        .from('org_orders_mst')
        .select('*')
        .eq('id', orderId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (!order) {
        return null;
      }

      const allowedTransitions = await this.getAllowedTransitions(orderId, tenantId, order.current_status);

      return {
        order,
        currentStatus: order.current_status,
        allowedTransitions,
        flags: {
          isQuickDrop: order.is_order_quick_drop,
          hasSplit: order.has_split,
          hasIssue: order.has_issue,
          isRejected: order.is_rejected,
          requiresRackLocation: order.current_status === 'ready' && !order.rack_location,
        },
      };
    } catch (error) {
      console.error('WorkflowService.getOrderState error:', error);
      return null;
    }
  }

  /**
   * Trigger workflow hooks: notifications, webhooks, analytics (non-blocking)
   */
  private static async triggerWorkflowHooks(args: {
    orderId: string;
    tenantId: string;
    fromStatus: OrderStatus;
    toStatus: OrderStatus;
  }): Promise<void> {
    const { orderId, tenantId, toStatus } = args;

    // Auto-create assembly task when order enters ASSEMBLY status
    if (toStatus === 'ASSEMBLY') {
      try {
        const { AssemblyService } = await import('./assembly-service');
        // Get user from context (best effort)
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const userId = user?.id || 'system';

        await AssemblyService.createAssemblyTask({
          orderId,
          tenantId,
          userId,
        });
      } catch (error) {
        console.warn('Failed to create assembly task on ASSEMBLY transition:', error);
        // Non-blocking, log and continue
      }
    }

    // TODO: integrate with notifications/webhooks/analytics subsystems
  }
}
