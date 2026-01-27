/**
 * ItemProcessingService
 * Per-item workflow and processing step tracking
 * PRD-010: Advanced Order Management
 */

import { createClient } from '@/lib/supabase/server';
import { WorkflowService } from './workflow-service';
import { OrderService } from './order-service';
import { ProcessingStepsService } from './processing-steps-service';
import type { OrderStatus } from '@/lib/types/workflow';

export interface RecordProcessingStepParams {
  orderId: string;
  orderItemId: string;
  tenantId: string;
  stepCode: string;
  stepSeq: number;
  notes?: string;
  userId: string;
  userName: string;
}

export interface RecordProcessingStepResult {
  success: boolean;
  error?: string;
}

export interface MarkItemCompleteParams {
  orderId: string;
  orderItemId: string;
  tenantId: string;
  userId: string;
  userName: string;
}

export interface MarkItemCompleteResult {
  success: boolean;
  allItemsReady?: boolean;
  error?: string;
}

export interface GetItemStepsResult {
  success: boolean;
  steps?: any[];
  error?: string;
}

export class ItemProcessingService {
  /**
   * Record a processing step for an item
   * PRD-010: Track 5-step processing
   */
  static async recordProcessingStep(
    params: RecordProcessingStepParams
  ): Promise<RecordProcessingStepResult> {
    try {
      const supabase = createClient();
      const { orderId, orderItemId, tenantId, stepCode, stepSeq, notes, userId, userName } = params;

      // Get order item to find service category
      const { data: orderItem, error: itemError } = await supabase
        .from('org_order_items_dtl')
        .select('service_category_code')
        .eq('id', orderItemId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (itemError || !orderItem) {
        return {
          success: false,
          error: 'Order item not found',
        };
      }

      // Validate step_code against service category configuration
      if (!orderItem.service_category_code) {
        return {
          success: false,
          error: 'Service category not found for this item',
        };
      }

      const isValidStep = await ProcessingStepsService.isValidStepForCategory(
        tenantId,
        orderItem.service_category_code,
        stepCode
      );

      if (!isValidStep) {
        // Get valid steps for better error message
        const validStepCodes = await ProcessingStepsService.getValidStepCodes({
          tenantId,
          serviceCategoryCode: orderItem.service_category_code,
        });

        return {
          success: false,
          error: `Invalid step_code "${stepCode}" for service category "${orderItem.service_category_code}". Valid steps: ${validStepCodes.join(', ')}`,
        };
      }

      // Check if step already recorded for this item
      const { data: existingStep } = await supabase
        .from('org_order_item_processing_steps')
        .select('id')
        .eq('order_item_id', orderItemId)
        .eq('step_code', stepCode)
        .single();

      if (existingStep) {
        return {
          success: false,
          error: `Step ${stepCode} already recorded for this item`,
        };
      }

      // Record the processing step
      const { data: step, error: stepError } = await supabase
        .from('org_order_item_processing_steps')
        .insert({
          tenant_org_id: tenantId,
          order_id: orderId,
          order_item_id: orderItemId,
          step_code: stepCode,
          step_seq: stepSeq,
          done_by: userId,
          done_at: new Date().toISOString(),
          notes,
        })
        .select()
        .single();

      if (stepError || !step) {
        return {
          success: false,
          error: 'Failed to record processing step',
        };
      }

      // Update item with last step info
      await supabase
        .from('org_order_items_dtl')
        .update({
          item_last_step: stepCode,
          item_last_step_at: step.done_at,
          item_last_step_by: userId,
        })
        .eq('id', orderItemId);

      // Log to history
      await supabase.rpc('log_order_action', {
        p_tenant_org_id: tenantId,
        p_order_id: orderId,
        p_action_type: 'ITEM_STEP',
        p_from_value: null,
        p_to_value: stepCode,
        p_done_by: userId,
        p_payload: {
          order_item_id: orderItemId,
          step_seq: stepSeq,
          notes,
        },
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error('ItemProcessingService.recordProcessingStep error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Mark item as complete
   * PRD-010: Check if all items ready and auto-transition order
   */
  static async markItemComplete(
    params: MarkItemCompleteParams
  ): Promise<MarkItemCompleteResult> {
    try {
      const supabase = createClient();
      const { orderId, orderItemId, tenantId, userId, userName } = params;

      // Update item status
      const { error: updateError } = await supabase
        .from('org_order_items_dtl')
        .update({
          item_status: 'ready',
          item_stage: 'ready',
        })
        .eq('id', orderItemId)
        .eq('order_id', orderId);

      if (updateError) {
        return {
          success: false,
          error: 'Failed to mark item as complete',
        };
      }

      // Check if all items are ready
      const { data: order, error: orderError } = await supabase
        .from('org_orders_mst')
        .select('*, items:org_order_items_dtl(*)')
        .eq('id', orderId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (orderError || !order) {
        return {
          success: false,
          error: 'Failed to fetch order',
        };
      }

      const allItemsReady = order.items?.every(
        (item: any) => item.item_status === 'ready' || item.item_status === 'pending'
      );

      // If all items ready and rack_location set, transition order to ready
      if (allItemsReady && order.current_status !== 'ready') {
        const { data: rackLocation } = await supabase
          .from('org_orders_mst')
          .select('rack_location')
          .eq('id', orderId)
          .single();

        if (rackLocation?.rack_location) {
          // Auto-transition to ready
          await WorkflowService.transitionOrder(
            orderId,
            tenantId,
            order.current_status as OrderStatus,
            'ready',
            userId,
            userName,
            'All items processed',
            {}
          );
        }
      }

      return {
        success: true,
        allItemsReady: allItemsReady || false,
      };
    } catch (error) {
      console.error('ItemProcessingService.markItemComplete error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if all items are complete for an order
   * PRD-010: Quality gate check
   */
  static async checkAllItemsReady(orderId: string, tenantId: string): Promise<boolean> {
    try {
      const supabase = createClient();

      const { data: items, error } = await supabase
        .from('org_order_items_dtl')
        .select('item_status')
        .eq('order_id', orderId)
        .eq('tenant_org_id', tenantId);

      if (error || !items) {
        return false;
      }

      return items.every(item => item.item_status === 'ready' || item.item_status === 'pending');
    } catch (error) {
      console.error('ItemProcessingService.checkAllItemsReady error:', error);
      return false;
    }
  }

  /**
   * Get processing steps for an item
   * PRD-010: Step history
   */
  static async getItemSteps(
    orderItemId: string,
    tenantId: string
  ): Promise<GetItemStepsResult> {
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('org_order_item_processing_steps')
        .select('*')
        .eq('order_item_id', orderItemId)
        .eq('tenant_org_id', tenantId)
        .order('step_seq', { ascending: true });

      if (error) {
        return {
          success: false,
          error: 'Failed to fetch processing steps',
        };
      }

      return {
        success: true,
        steps: data || [],
      };
    } catch (error) {
      console.error('ItemProcessingService.getItemSteps error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

