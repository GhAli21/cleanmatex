/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param */
/**
 * AssemblyService
 * Core business logic for Assembly & QA Workflow operations
 * PRD-009: Assembly & QA Workflow
 * @version 1.0.0
 * @last_updated 2025-01-20
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import {
  AssemblyTaskNotFoundError,
  InvalidScanError,
  ExceptionNotResolvedError,
  AssemblyNotCompleteError,
  LocationNotFoundError,
  LocationCapacityExceededError,
} from '@/lib/errors/assembly-errors';

export interface CreateAssemblyTaskParams {
  orderId: string;
  tenantId: string;
  userId: string;
}

export interface CreateAssemblyTaskResult {
  success: boolean;
  taskId?: string;
  error?: string;
}

export interface StartAssemblyTaskParams {
  taskId: string;
  tenantId: string;
  userId: string;
  locationId?: string;
}

export interface StartAssemblyTaskResult {
  success: boolean;
  alreadyStarted?: boolean;
  error?: string;
}

export interface CompleteAssemblyTaskParams {
  taskId: string;
  tenantId: string;
  userId: string;
}

export interface CompleteAssemblyTaskResult {
  success: boolean;
  orderId?: string;
  orderNo?: string | null;
  error?: string;
}

export interface ScanItemParams {
  taskId: string;
  tenantId: string;
  barcode: string;
  userId: string;
}

export interface ScanItemResult {
  success: boolean;
  itemId?: string;
  isMatch?: boolean;
  error?: string;
}

export interface CreateExceptionParams {
  taskId: string;
  tenantId: string;
  exceptionTypeCode: string;
  description: string;
  description2?: string;
  severity?: string;
  photoUrls?: string[];
  assemblyItemId?: string;
  userId: string;
}

export interface CreateExceptionResult {
  success: boolean;
  exceptionId?: string;
  error?: string;
}

export interface ResolveExceptionParams {
  exceptionId: string;
  tenantId: string;
  resolution: string;
  userId: string;
}

export interface ResolveExceptionResult {
  success: boolean;
  error?: string;
}

export interface PerformQAParams {
  taskId: string;
  tenantId: string;
  decisionTypeCode: string;
  qaNote?: string;
  qaPhotoUrl?: string;
  userId: string;
}

export interface PerformQAResult {
  success: boolean;
  error?: string;
}

export interface PackOrderParams {
  taskId: string;
  tenantId: string;
  packagingTypeCode: string;
  packingNote?: string;
  userId: string;
}

export interface PackOrderResult {
  success: boolean;
  packingListId?: string;
  error?: string;
}

export interface AssemblyDashboardData {
  pendingTasks: number;
  inProgressTasks: number;
  qaPendingTasks: number;
  completedToday: number;
  exceptionsOpen: number;
}

export interface AssemblyTaskItemDetail {
  id: string;
  orderItemId: string;
  itemStatus: string;
  barcode: string | null;
  scannedAt: string | null;
  hasException: boolean;
  productName: string;
  productName2: string;
  quantity: number;
}

export interface AssemblyTaskDetail {
  id: string;
  orderId: string;
  orderNo: string | null;
  taskStatus: string;
  totalItems: number;
  scannedItems: number;
  exceptionItems: number;
  assignedTo: string | null;
  locationId: string | null;
  qaStatus: string | null;
  items: AssemblyTaskItemDetail[];
}

export interface MarkItemSelectedParams {
  taskId: string;
  tenantId: string;
  assemblyItemId: string;
  userId: string;
}

export interface GetAssemblyTaskParams {
  taskId: string;
  tenantId: string;
}

export class AssemblyService {
  /**
   * Recount scanned / exception / total counters from org_asm_items_dtl (race-safe).
   */
  private static async syncTaskItemCounters(
    supabase: Awaited<ReturnType<typeof createClient>>,
    taskId: string,
    tenantId: string,
    userId: string
  ): Promise<{ total: number; scanned: number; exceptions: number; pending: number }> {
    const { data: items } = await supabase
      .from('org_asm_items_dtl')
      .select('item_status')
      .eq('task_id', taskId)
      .eq('tenant_org_id', tenantId);

    const rows = items ?? [];
    const total = rows.length;
    const scanned = rows.filter((row) => row.item_status === 'SCANNED').length;
    const exceptions = rows.filter((row) => row.item_status === 'EXCEPTION').length;
    const pending = rows.filter((row) => row.item_status === 'PENDING').length;

    await supabase
      .from('org_asm_tasks_mst')
      .update({
        total_items: total,
        scanned_items: scanned,
        exception_items: exceptions,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('tenant_org_id', tenantId);

    return { total, scanned, exceptions, pending };
  }

  /**
   * Create assembly task for an order
   * Auto-creates when order enters ASSEMBLY status
   */
  static async createAssemblyTask(
    params: CreateAssemblyTaskParams
  ): Promise<CreateAssemblyTaskResult> {
    try {
      const { orderId, tenantId, userId } = params;
      const supabase = await createClient();

      logger.info('Creating assembly task', {
        tenantId,
        userId,
        orderId,
        feature: 'assembly',
        action: 'create_task',
      });

      // Check if task already exists
      const { data: existingTask } = await supabase
        .from('org_asm_tasks_mst')
        .select('id')
        .eq('order_id', orderId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (existingTask) {
        logger.warn('Assembly task already exists', {
          tenantId,
          userId,
          orderId,
          taskId: existingTask.id,
        });
        return {
          success: true,
          taskId: existingTask.id,
        };
      }

      // Get order items (include names/barcodes for assembly item seed)
      const { data: orderItems, error: itemsError } = await supabase
        .from('org_order_items_dtl')
        .select('id, barcode, product_name, product_name2')
        .eq('order_id', orderId)
        .eq('tenant_org_id', tenantId);

      if (itemsError) {
        logger.error('Failed to fetch order items', itemsError as Error, {
          tenantId,
          userId,
          orderId,
        });
        throw new Error('Failed to fetch order items');
      }

      const totalItems = orderItems?.length || 0;

      // Create assembly task
      const { data: task, error: taskError } = await supabase
        .from('org_asm_tasks_mst')
        .insert({
          tenant_org_id: tenantId,
          order_id: orderId,
          task_status: 'PENDING',
          total_items: totalItems,
          scanned_items: 0,
          exception_items: 0,
          created_by: userId,
        })
        .select('id')
        .single();

      if (taskError || !task) {
        logger.error('Failed to create assembly task', taskError as Error, {
          tenantId,
          userId,
          orderId,
          code: taskError?.code,
          details: taskError?.details,
          hint: taskError?.hint,
        });
        throw new Error(
          `Failed to create assembly task${taskError?.message ? `: ${taskError.message}` : ''}`
        );
      }

      // Create assembly items for each order item
      if (orderItems && orderItems.length > 0) {
        const assemblyItems = orderItems.map((item) => ({
          task_id: task.id,
          order_item_id: item.id,
          tenant_org_id: tenantId,
          item_status: 'PENDING',
          barcode: item.barcode || null,
          item_name: item.product_name || null,
          item_name2: item.product_name2 || null,
          created_by: userId,
        }));

        const { error: itemsInsertError } = await supabase
          .from('org_asm_items_dtl')
          .insert(assemblyItems);

        if (itemsInsertError) {
          logger.error('Failed to create assembly items', itemsInsertError as Error, {
            tenantId,
            userId,
            taskId: task.id,
          });
          throw new Error(
            `Failed to create assembly items: ${itemsInsertError.message}`
          );
        }
      }

      logger.info('Assembly task created successfully', {
        tenantId,
        userId,
        orderId,
        taskId: task.id,
        totalItems,
      });

      return {
        success: true,
        taskId: task.id,
      };
    } catch (error) {
      logger.error('Failed to create assembly task', error as Error, {
        tenantId: params.tenantId,
        userId: params.userId,
        orderId: params.orderId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Start assembly task - assign location and user
   */
  static async startAssemblyTask(
    params: StartAssemblyTaskParams
  ): Promise<StartAssemblyTaskResult> {
    try {
      const { taskId, tenantId, userId, locationId } = params;
      const supabase = await createClient();

      logger.info('Starting assembly task', {
        tenantId,
        userId,
        taskId,
        locationId,
        feature: 'assembly',
        action: 'start_task',
      });

      // Verify task exists
      const { data: task, error: taskError } = await supabase
        .from('org_asm_tasks_mst')
        .select('*')
        .eq('id', taskId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (taskError || !task) {
        throw new AssemblyTaskNotFoundError(taskId);
      }

      // Verify location if provided
      if (locationId) {
        const { data: location, error: locationError } = await supabase
          .from('org_asm_locations_mst')
          .select('*')
          .eq('id', locationId)
          .eq('tenant_org_id', tenantId)
          .single();

        if (locationError || !location) {
          throw new LocationNotFoundError(locationId);
        }

        // Check capacity
        if (location.current_load >= location.capacity) {
          throw new LocationCapacityExceededError(
            locationId,
            location.current_load,
            location.capacity
          );
        }

        // Update location load
        await supabase
          .from('org_asm_locations_mst')
          .update({
            current_load: location.current_load + 1,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', locationId)
          .eq('tenant_org_id', tenantId);
      }

      // Idempotent: already started tasks can be resumed without error
      if (task.task_status === 'IN_PROGRESS') {
        return { success: true, alreadyStarted: true };
      }

      if (task.task_status === 'COMPLETE' || task.task_status === 'READY') {
        return { success: true, alreadyStarted: true };
      }

      if (task.task_status !== 'PENDING') {
        throw new InvalidScanError(
          `Task cannot be started. Current status: ${task.task_status}`
        );
      }

      // Update task
      const { error: updateError } = await supabase
        .from('org_asm_tasks_mst')
        .update({
          task_status: 'IN_PROGRESS',
          assigned_to: userId,
          location_id: locationId || null,
          started_at: new Date().toISOString(),
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .eq('tenant_org_id', tenantId);

      if (updateError) {
        logger.error('Failed to start assembly task', updateError as Error, {
          tenantId,
          userId,
          taskId,
        });
        throw new Error('Failed to start assembly task');
      }

      logger.info('Assembly task started successfully', {
        tenantId,
        userId,
        taskId,
        locationId,
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to start assembly task', error as Error, {
        tenantId: params.tenantId,
        userId: params.userId,
        taskId: params.taskId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Scan item during assembly
   * Validates barcode matches expected item
   */
  static async scanItem(params: ScanItemParams): Promise<ScanItemResult> {
    try {
      const { taskId, tenantId, barcode, userId } = params;
      const supabase = await createClient();

      logger.info('Scanning item', {
        tenantId,
        userId,
        taskId,
        barcode: barcode.substring(0, 10) + '...', // Log partial barcode only
        feature: 'assembly',
        action: 'scan_item',
      });

      // Get task with pending items
      const { data: task, error: taskError } = await supabase
        .from('org_asm_tasks_mst')
        .select('*')
        .eq('id', taskId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (taskError || !task) {
        throw new AssemblyTaskNotFoundError(taskId);
      }

      if (task.task_status !== 'IN_PROGRESS') {
        throw new InvalidScanError(
          `Task is not in progress. Current status: ${task.task_status}`
        );
      }

      // Find pending item with matching barcode
      const { data: items, error: itemsError } = await supabase
        .from('org_asm_items_dtl')
        .select(
          `
          *,
          order_item:org_order_items_dtl(
            id,
            barcode,
            product_name,
            product_name2
          )
        `
        )
        .eq('task_id', taskId)
        .eq('tenant_org_id', tenantId)
        .eq('item_status', 'PENDING');

      if (itemsError) {
        logger.error('Failed to fetch assembly items', itemsError as Error, {
          tenantId,
          userId,
          taskId,
        });
        throw new Error('Failed to fetch assembly items');
      }

      // Match asm-item barcode OR order-item barcode
      const matchingItem = items?.find((item: {
        barcode?: string | null;
        order_item?: { barcode?: string | null } | { barcode?: string | null }[] | null;
      }) => {
        const orderItem = Array.isArray(item.order_item)
          ? item.order_item[0]
          : item.order_item;
        const candidates = [item.barcode, orderItem?.barcode].filter(Boolean);
        return candidates.includes(barcode);
      });

      if (!matchingItem) {
        logger.warn('Barcode not found in pending items', {
          tenantId,
          userId,
          taskId,
          barcode: barcode.substring(0, 10) + '...',
        });
        return {
          success: false,
          isMatch: false,
          error: 'Barcode not found in expected items',
        };
      }

      // Update item status
      const { error: updateError } = await supabase
        .from('org_asm_items_dtl')
        .update({
          item_status: 'SCANNED',
          scanned_at: new Date().toISOString(),
          scanned_by: userId,
          barcode: barcode,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', matchingItem.id)
        .eq('tenant_org_id', tenantId);

      if (updateError) {
        logger.error('Failed to update item status', updateError as Error, {
          tenantId,
          userId,
          taskId,
          itemId: matchingItem.id,
        });
        throw new Error('Failed to update item status');
      }

      const counts = await AssemblyService.syncTaskItemCounters(
        supabase,
        taskId,
        tenantId,
        userId
      );

      logger.info('Item scanned successfully', {
        tenantId,
        userId,
        taskId,
        itemId: matchingItem.id,
        scannedCount: counts.scanned,
      });

      return {
        success: true,
        itemId: matchingItem.id,
        isMatch: true,
      };
    } catch (error) {
      logger.error('Failed to scan item', error as Error, {
        tenantId: params.tenantId,
        userId: params.userId,
        taskId: params.taskId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create exception for missing/wrong/damaged item
   */
  static async createException(
    params: CreateExceptionParams
  ): Promise<CreateExceptionResult> {
    try {
      const {
        taskId,
        tenantId,
        exceptionTypeCode,
        description,
        description2,
        severity,
        photoUrls,
        assemblyItemId,
        userId,
      } = params;
      const supabase = await createClient();

      logger.info('Creating assembly exception', {
        tenantId,
        userId,
        taskId,
        exceptionTypeCode,
        assemblyItemId,
        feature: 'assembly',
        action: 'create_exception',
      });

      // Verify task exists
      const { data: task, error: taskError } = await supabase
        .from('org_asm_tasks_mst')
        .select('*')
        .eq('id', taskId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (taskError || !task) {
        throw new AssemblyTaskNotFoundError(taskId);
      }

      // Create exception
      const { data: exception, error: exceptionError } = await supabase
        .from('org_asm_exceptions_tr')
        .insert({
          task_id: taskId,
          tenant_org_id: tenantId,
          branch_id: (task as { branch_id?: string | null }).branch_id ?? null,
          exception_type_code: exceptionTypeCode,
          severity: severity || 'MEDIUM',
          description,
          description2: description2 || null,
          photo_urls: photoUrls || [],
          exception_status: 'OPEN',
          created_by: userId,
        })
        .select('id')
        .single();

      if (exceptionError || !exception) {
        logger.error('Failed to create exception', exceptionError as Error, {
          tenantId,
          userId,
          taskId,
        });
        throw new Error('Failed to create exception');
      }

      if (assemblyItemId) {
        await supabase
          .from('org_asm_items_dtl')
          .update({
            item_status: 'EXCEPTION',
            has_exception: true,
            exception_id: exception.id,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', assemblyItemId)
          .eq('task_id', taskId)
          .eq('tenant_org_id', tenantId);
      }

      await AssemblyService.syncTaskItemCounters(
        supabase,
        taskId,
        tenantId,
        userId
      );

      logger.info('Exception created successfully', {
        tenantId,
        userId,
        taskId,
        exceptionId: exception.id,
      });

      return {
        success: true,
        exceptionId: exception.id,
      };
    } catch (error) {
      logger.error('Failed to create exception', error as Error, {
        tenantId: params.tenantId,
        userId: params.userId,
        taskId: params.taskId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Resolve exception
   */
  static async resolveException(
    params: ResolveExceptionParams
  ): Promise<ResolveExceptionResult> {
    try {
      const { exceptionId, tenantId, resolution, userId } = params;
      const supabase = await createClient();

      logger.info('Resolving exception', {
        tenantId,
        userId,
        exceptionId,
        feature: 'assembly',
        action: 'resolve_exception',
      });

      // Get exception with task
      const { data: exception, error: exceptionError } = await supabase
        .from('org_asm_exceptions_tr')
        .select('*, task:org_asm_tasks_mst(id, task_status)')
        .eq('id', exceptionId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (exceptionError || !exception) {
        throw new Error('Exception not found');
      }

      // Update exception
      const { error: updateError } = await supabase
        .from('org_asm_exceptions_tr')
        .update({
          exception_status: 'RESOLVED',
          resolution,
          resolved_at: new Date().toISOString(),
          resolved_by: userId,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', exceptionId)
        .eq('tenant_org_id', tenantId);

      if (updateError) {
        logger.error('Failed to resolve exception', updateError as Error, {
          tenantId,
          userId,
          exceptionId,
        });
        throw new Error('Failed to resolve exception');
      }

      // Clear EXCEPTION flag on linked items so they can be re-marked
      await supabase
        .from('org_asm_items_dtl')
        .update({
          item_status: 'PENDING',
          has_exception: false,
          exception_id: null,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('exception_id', exceptionId)
        .eq('tenant_org_id', tenantId);

      if (exception.task_id) {
        await AssemblyService.syncTaskItemCounters(
          supabase,
          exception.task_id,
          tenantId,
          userId
        );
      }

      logger.info('Exception resolved successfully', {
        tenantId,
        userId,
        exceptionId,
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to resolve exception', error as Error, {
        tenantId: params.tenantId,
        userId: params.userId,
        exceptionId: params.exceptionId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Perform QA decision (PASS/FAIL)
   */
  static async performQA(params: PerformQAParams): Promise<PerformQAResult> {
    try {
      const {
        taskId,
        tenantId,
        decisionTypeCode,
        qaNote,
        qaPhotoUrl,
        userId,
      } = params;
      const supabase = await createClient();

      logger.info('Performing QA', {
        tenantId,
        userId,
        taskId,
        decisionTypeCode,
        feature: 'assembly',
        action: 'perform_qa',
      });

      // Get task with order
      const { data: task, error: taskError } = await supabase
        .from('org_asm_tasks_mst')
        .select('*, order:org_orders_mst(id)')
        .eq('id', taskId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (taskError || !task) {
        throw new AssemblyTaskNotFoundError(taskId);
      }

      // Check if assembly is complete
      if (task.scanned_items < task.total_items) {
        throw new AssemblyNotCompleteError((task.order as any).id, {
          scanned: task.scanned_items,
          total: task.total_items,
        });
      }

      // Check if all exceptions are resolved
      const { data: openExceptions } = await supabase
        .from('org_asm_exceptions_tr')
        .select('id')
        .eq('task_id', taskId)
        .eq('tenant_org_id', tenantId)
        .eq('exception_status', 'OPEN');

      if (openExceptions && openExceptions.length > 0) {
        throw new ExceptionNotResolvedError(openExceptions[0].id);
      }

      // Create QA decision
      const { error: qaError } = await supabase.from('org_qa_decisions_tr').insert({
        task_id: taskId,
        tenant_org_id: tenantId,
        branch_id: (task as { branch_id?: string | null }).branch_id ?? null,
        order_id: (task.order as { id?: string })?.id,
        decision_type_code: decisionTypeCode,
        qa_by: userId,
        qa_note: qaNote || null,
        qa_photo_url: qaPhotoUrl || null,
        created_by: userId,
      });

      if (qaError) {
        logger.error('Failed to create QA decision', qaError as Error, {
          tenantId,
          userId,
          taskId,
        });
        throw new Error('Failed to create QA decision');
      }

      // Update task QA status
      const qaStatus = decisionTypeCode === 'PASS' ? 'QA_PASSED' : 'QA_FAILED';
      await supabase
        .from('org_asm_tasks_mst')
        .update({
          qa_status: qaStatus,
          qa_by: userId,
          qa_at: new Date().toISOString(),
          qa_note: qaNote || null,
          qa_photo_url: qaPhotoUrl || null,
          task_status: qaStatus,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .eq('tenant_org_id', tenantId);

      logger.info('QA decision recorded successfully', {
        tenantId,
        userId,
        taskId,
        decision: decisionTypeCode,
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to perform QA', error as Error, {
        tenantId: params.tenantId,
        userId: params.userId,
        taskId: params.taskId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Pack order and generate packing list
   */
  static async packOrder(params: PackOrderParams): Promise<PackOrderResult> {
    try {
      const { taskId, tenantId, packagingTypeCode, packingNote, userId } = params;
      const supabase = await createClient();

      logger.info('Packing order', {
        tenantId,
        userId,
        taskId,
        packagingTypeCode,
        feature: 'assembly',
        action: 'pack_order',
      });

      // Get task with order and items
      const { data: task, error: taskError } = await supabase
        .from('org_asm_tasks_mst')
        .select(
          `
          *,
          order:org_orders_mst(
            id,
            order_no
          ),
          items:org_asm_items_dtl(
            order_item:org_order_items_dtl(
              product_name,
              product_name2,
              quantity
            )
          )
        `
        )
        .eq('id', taskId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (taskError || !task) {
        throw new AssemblyTaskNotFoundError(taskId);
      }

      // Packing requires assembly verification (all items scanned, no open exceptions).
      // Separate QA screen may still apply at order-workflow level.
      const counts = await AssemblyService.syncTaskItemCounters(
        supabase,
        taskId,
        tenantId,
        userId
      );
      if (counts.pending > 0 || counts.scanned < counts.total) {
        throw new AssemblyNotCompleteError(
          (task.order as { id?: string })?.id || task.order_id,
          { scanned: counts.scanned, total: counts.total }
        );
      }

      const { data: openExceptions } = await supabase
        .from('org_asm_exceptions_tr')
        .select('id')
        .eq('task_id', taskId)
        .eq('tenant_org_id', tenantId)
        .eq('exception_status', 'OPEN');

      if (openExceptions && openExceptions.length > 0) {
        throw new ExceptionNotResolvedError(openExceptions[0].id);
      }

      // Assembly-level verification stamp (does not replace the QA screen)
      if (task.qa_status !== 'QA_PASSED') {
        await supabase
          .from('org_asm_tasks_mst')
          .update({
            qa_status: 'QA_PASSED',
            qa_by: userId,
            qa_at: new Date().toISOString(),
            updated_by: userId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', taskId)
          .eq('tenant_org_id', tenantId);
      }

      // Generate packing list number
      const orderNo = (task.order as { order_no?: string })?.order_no;
      const listNumber = `PL-${orderNo}-${Date.now()}`;

      // Build items summary
      const itemsSummary =
        (task.items as Array<{
          order_item?:
            | { product_name?: string; product_name2?: string; quantity?: number }
            | Array<{ product_name?: string; product_name2?: string; quantity?: number }>;
        }>)?.map((item) => {
          const orderItem = Array.isArray(item.order_item)
            ? item.order_item[0]
            : item.order_item;
          return {
            productName: orderItem?.product_name || '',
            productName2: orderItem?.product_name2 || '',
            quantity: orderItem?.quantity || 1,
          };
        }) || [];

      // Create packing list
      const { data: packingList, error: listError } = await supabase
        .from('org_pck_packing_lists_mst')
        .insert({
          tenant_org_id: tenantId,
          branch_id: (task as { branch_id?: string | null }).branch_id ?? null,
          order_id: (task.order as { id?: string })?.id,
          task_id: taskId,
          list_number: listNumber,
          items_summary: itemsSummary,
          packaging_type_code: packagingTypeCode,
          item_count: counts.total,
          generated_by: userId,
          created_by: userId,
        })
        .select('id')
        .single();

      if (listError || !packingList) {
        logger.error('Failed to create packing list', listError as Error, {
          tenantId,
          userId,
          taskId,
        });
        throw new Error('Failed to create packing list');
      }

      // Update task status
      await supabase
        .from('org_asm_tasks_mst')
        .update({
          task_status: 'READY',
          packaging_type_code: packagingTypeCode,
          packing_note: packingNote || null,
          packed_at: new Date().toISOString(),
          packed_by: userId,
          completed_at: new Date().toISOString(),
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .eq('tenant_org_id', tenantId);

      logger.info('Order packed successfully', {
        tenantId,
        userId,
        taskId,
        packingListId: packingList.id,
      });

      return {
        success: true,
        packingListId: packingList.id,
      };
    } catch (error) {
      logger.error('Failed to pack order', error as Error, {
        tenantId: params.tenantId,
        userId: params.userId,
        taskId: params.taskId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Ensure org_asm_items_dtl rows exist for every order line on the task.
   * Safe to call repeatedly — only inserts missing order_item_id rows.
   */
  static async ensureAssemblyItemsForTask(params: {
    taskId: string;
    orderId: string;
    tenantId: string;
    userId: string;
  }): Promise<number> {
    const { taskId, orderId, tenantId, userId } = params;
    const supabase = await createClient();

    const [{ data: orderItems }, { data: existing }] = await Promise.all([
      supabase
        .from('org_order_items_dtl')
        .select('id, barcode, product_name, product_name2')
        .eq('order_id', orderId)
        .eq('tenant_org_id', tenantId),
      supabase
        .from('org_asm_items_dtl')
        .select('order_item_id')
        .eq('task_id', taskId)
        .eq('tenant_org_id', tenantId),
    ]);

    if (!orderItems?.length) return 0;

    const existingIds = new Set(
      (existing ?? []).map((row) => String(row.order_item_id))
    );
    const missing = orderItems.filter((item) => !existingIds.has(String(item.id)));

    if (missing.length === 0) return 0;

    const { error } = await supabase.from('org_asm_items_dtl').insert(
      missing.map((item) => ({
        task_id: taskId,
        order_item_id: item.id,
        tenant_org_id: tenantId,
        item_status: 'PENDING',
        barcode: item.barcode || null,
        item_name: item.product_name || null,
        item_name2: item.product_name2 || null,
        created_by: userId,
      }))
    );

    if (error) {
      logger.error('Failed to backfill assembly items', error as Error, {
        tenantId,
        taskId,
        orderId,
      });
      return 0;
    }

    logger.info('Backfilled assembly items', {
      tenantId,
      taskId,
      orderId,
      inserted: missing.length,
    });

    return missing.length;
  }

  /**
   * Load assembly task with line items for scanning / manual selection UI.
   */
  static async getAssemblyTask(
    params: GetAssemblyTaskParams
  ): Promise<AssemblyTaskDetail | null> {
    try {
      const { taskId, tenantId } = params;
      const supabase = await createClient();

      const { data: task, error: taskError } = await supabase
        .from('org_asm_tasks_mst')
        .select(
          `
          id,
          order_id,
          task_status,
          total_items,
          scanned_items,
          exception_items,
          assigned_to,
          location_id,
          qa_status,
          order:org_orders_mst(
            id,
            order_no
          ),
          items:org_asm_items_dtl(
            id,
            order_item_id,
            item_status,
            barcode,
            scanned_at,
            has_exception,
            item_name,
            item_name2,
            order_item:org_order_items_dtl(
              id,
              barcode,
              product_name,
              product_name2,
              quantity
            )
          )
        `
        )
        .eq('id', taskId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (taskError || !task) {
        logger.warn('Assembly task not found', {
          tenantId,
          taskId,
          error: taskError?.message,
        });
        return null;
      }

      const order = task.order as { id?: string; order_no?: string } | null;
      let rawItems = (task.items as Array<Record<string, unknown>> | null) ?? [];

      // Always reconcile missing assembly rows from order lines
      if (task.order_id) {
        const inserted = await AssemblyService.ensureAssemblyItemsForTask({
          taskId,
          orderId: task.order_id,
          tenantId,
          userId: 'system',
        });

        if (inserted > 0 || rawItems.length === 0) {
          const { data: refreshedItems } = await supabase
            .from('org_asm_items_dtl')
            .select(
              `
              id,
              order_item_id,
              item_status,
              barcode,
              scanned_at,
              has_exception,
              item_name,
              item_name2,
              order_item:org_order_items_dtl(
                id,
                barcode,
                product_name,
                product_name2,
                quantity
              )
            `
            )
            .eq('task_id', taskId)
            .eq('tenant_org_id', tenantId);

          rawItems = (refreshedItems as Array<Record<string, unknown>> | null) ?? [];
        }

        const counts = await AssemblyService.syncTaskItemCounters(
          supabase,
          taskId,
          tenantId,
          'system'
        );
        task.total_items = counts.total;
        task.scanned_items = counts.scanned;
        task.exception_items = counts.exceptions;
      }

      const items: AssemblyTaskItemDetail[] = rawItems.map((item) => {
        const orderItemRaw = item.order_item;
        const orderItem = (
          Array.isArray(orderItemRaw) ? orderItemRaw[0] : orderItemRaw
        ) as {
          id?: string;
          barcode?: string | null;
          product_name?: string | null;
          product_name2?: string | null;
          quantity?: number | null;
        } | null;

        return {
          id: String(item.id),
          orderItemId: String(item.order_item_id ?? orderItem?.id ?? ''),
          itemStatus: String(item.item_status ?? 'PENDING'),
          barcode:
            (item.barcode as string | null) ??
            orderItem?.barcode ??
            null,
          scannedAt: (item.scanned_at as string | null) ?? null,
          hasException: Boolean(item.has_exception),
          productName:
            (item.item_name as string | null) ||
            orderItem?.product_name ||
            'Item',
          productName2:
            (item.item_name2 as string | null) ||
            orderItem?.product_name2 ||
            '',
          quantity: Number(orderItem?.quantity ?? 1),
        };
      });

      // Stable list order: pending first, then scanned, then exceptions
      const statusRank: Record<string, number> = {
        PENDING: 0,
        SCANNED: 1,
        EXCEPTION: 2,
        RESOLVED: 3,
      };
      items.sort(
        (a, b) =>
          (statusRank[a.itemStatus] ?? 9) - (statusRank[b.itemStatus] ?? 9) ||
          a.productName.localeCompare(b.productName)
      );

      return {
        id: task.id,
        orderId: task.order_id,
        orderNo: order?.order_no ?? null,
        taskStatus: task.task_status,
        totalItems: task.total_items ?? items.length,
        scannedItems: task.scanned_items ?? 0,
        exceptionItems: task.exception_items ?? 0,
        assignedTo: task.assigned_to ?? null,
        locationId: task.location_id ?? null,
        qaStatus: task.qa_status ?? null,
        items,
      };
    } catch (error) {
      logger.error('Failed to get assembly task', error as Error, {
        tenantId: params.tenantId,
        taskId: params.taskId,
      });
      return null;
    }
  }

  /**
   * Mark a pending assembly item as scanned via manual selection (no barcode required).
   */
  static async markItemSelected(
    params: MarkItemSelectedParams
  ): Promise<ScanItemResult> {
    try {
      const { taskId, tenantId, assemblyItemId, userId } = params;
      const supabase = await createClient();

      logger.info('Marking assembly item selected', {
        tenantId,
        userId,
        taskId,
        assemblyItemId,
        feature: 'assembly',
        action: 'mark_item_selected',
      });

      const { data: task, error: taskError } = await supabase
        .from('org_asm_tasks_mst')
        .select('*')
        .eq('id', taskId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (taskError || !task) {
        throw new AssemblyTaskNotFoundError(taskId);
      }

      if (task.task_status !== 'IN_PROGRESS') {
        throw new InvalidScanError(
          `Task is not in progress. Current status: ${task.task_status}`
        );
      }

      const { data: item, error: itemError } = await supabase
        .from('org_asm_items_dtl')
        .select(
          `
          id,
          item_status,
          barcode,
          order_item:org_order_items_dtl(
            id,
            barcode
          )
        `
        )
        .eq('id', assemblyItemId)
        .eq('task_id', taskId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (itemError || !item) {
        return {
          success: false,
          isMatch: false,
          error: 'Assembly item not found on this task',
        };
      }

      if (item.item_status === 'SCANNED') {
        return {
          success: true,
          itemId: item.id,
          isMatch: true,
        };
      }

      if (item.item_status !== 'PENDING') {
        return {
          success: false,
          isMatch: false,
          error: `Item cannot be selected. Current status: ${item.item_status}`,
        };
      }

      const orderItemRaw = item.order_item;
      const orderItem = (
        Array.isArray(orderItemRaw) ? orderItemRaw[0] : orderItemRaw
      ) as { barcode?: string | null } | null;
      const resolvedBarcode =
        item.barcode || orderItem?.barcode || `MANUAL:${assemblyItemId}`;

      const { error: updateError } = await supabase
        .from('org_asm_items_dtl')
        .update({
          item_status: 'SCANNED',
          scanned_at: new Date().toISOString(),
          scanned_by: userId,
          barcode: resolvedBarcode,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)
        .eq('tenant_org_id', tenantId);

      if (updateError) {
        logger.error('Failed to mark assembly item selected', updateError as Error, {
          tenantId,
          userId,
          taskId,
          assemblyItemId,
        });
        throw new Error('Failed to update item status');
      }

      const counts = await AssemblyService.syncTaskItemCounters(
        supabase,
        taskId,
        tenantId,
        userId
      );

      logger.info('Assembly item marked selected', {
        tenantId,
        userId,
        taskId,
        itemId: item.id,
        scannedCount: counts.scanned,
      });

      return {
        success: true,
        itemId: item.id,
        isMatch: true,
      };
    } catch (error) {
      logger.error('Failed to mark assembly item selected', error as Error, {
        tenantId: params.tenantId,
        userId: params.userId,
        taskId: params.taskId,
        assemblyItemId: params.assemblyItemId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Complete assembly verification for a task (all items assembled, no open exceptions).
   * Marks the task COMPLETE and stamps assembly-level QA_PASSED so packing can proceed.
   * Order status advance remains the caller's responsibility (workflow transition).
   */
  static async completeAssemblyTask(
    params: CompleteAssemblyTaskParams
  ): Promise<CompleteAssemblyTaskResult> {
    try {
      const { taskId, tenantId, userId } = params;
      const supabase = await createClient();

      const { data: task, error: taskError } = await supabase
        .from('org_asm_tasks_mst')
        .select(
          `
          id,
          order_id,
          task_status,
          order:org_orders_mst(id, order_no)
        `
        )
        .eq('id', taskId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (taskError || !task) {
        throw new AssemblyTaskNotFoundError(taskId);
      }

      if (task.task_status === 'COMPLETE' || task.task_status === 'READY') {
        const order = task.order as { id?: string; order_no?: string } | null;
        return {
          success: true,
          orderId: order?.id || task.order_id,
          orderNo: order?.order_no ?? null,
        };
      }

      await AssemblyService.ensureAssemblyItemsForTask({
        taskId,
        orderId: task.order_id,
        tenantId,
        userId,
      });

      const counts = await AssemblyService.syncTaskItemCounters(
        supabase,
        taskId,
        tenantId,
        userId
      );

      if (counts.total === 0) {
        return {
          success: false,
          error: 'Assembly task has no items to complete',
        };
      }

      if (counts.pending > 0) {
        throw new AssemblyNotCompleteError(task.order_id, {
          scanned: counts.scanned,
          total: counts.total,
        });
      }

      const { data: openExceptions } = await supabase
        .from('org_asm_exceptions_tr')
        .select('id')
        .eq('task_id', taskId)
        .eq('tenant_org_id', tenantId)
        .eq('exception_status', 'OPEN');

      if (openExceptions && openExceptions.length > 0) {
        throw new ExceptionNotResolvedError(openExceptions[0].id);
      }

      const { error: updateError } = await supabase
        .from('org_asm_tasks_mst')
        .update({
          task_status: 'COMPLETE',
          qa_status: 'QA_PASSED',
          qa_by: userId,
          qa_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .eq('tenant_org_id', tenantId);

      if (updateError) {
        throw new Error('Failed to complete assembly task');
      }

      const order = task.order as { id?: string; order_no?: string } | null;
      logger.info('Assembly task completed', {
        tenantId,
        userId,
        taskId,
        orderId: order?.id || task.order_id,
      });

      return {
        success: true,
        orderId: order?.id || task.order_id,
        orderNo: order?.order_no ?? null,
      };
    } catch (error) {
      logger.error('Failed to complete assembly task', error as Error, {
        tenantId: params.tenantId,
        userId: params.userId,
        taskId: params.taskId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get assembly dashboard data
   */
  static async getAssemblyDashboard(
    tenantId: string
  ): Promise<AssemblyDashboardData> {
    try {
      const supabase = await createClient();

      logger.info('Fetching assembly dashboard', {
        tenantId,
        feature: 'assembly',
        action: 'get_dashboard',
      });

      // Get pending tasks
      const { count: pendingCount } = await supabase
        .from('org_asm_tasks_mst')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_org_id', tenantId)
        .eq('task_status', 'PENDING')
        .eq('rec_status', 1);

      // Get in-progress tasks
      const { count: inProgressCount } = await supabase
        .from('org_asm_tasks_mst')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_org_id', tenantId)
        .eq('task_status', 'IN_PROGRESS')
        .eq('rec_status', 1);

      // Get QA pending tasks
      const { count: qaPendingCount } = await supabase
        .from('org_asm_tasks_mst')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_org_id', tenantId)
        .eq('task_status', 'QA_PENDING')
        .eq('rec_status', 1);

      // Get completed today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: completedTodayCount } = await supabase
        .from('org_asm_tasks_mst')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_org_id', tenantId)
        .eq('task_status', 'READY')
        .gte('completed_at', todayStart.toISOString())
        .eq('rec_status', 1);

      // Get open exceptions
      const { count: exceptionsOpenCount } = await supabase
        .from('org_asm_exceptions_tr')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_org_id', tenantId)
        .eq('exception_status', 'OPEN')
        .eq('rec_status', 1);

      return {
        pendingTasks: pendingCount || 0,
        inProgressTasks: inProgressCount || 0,
        qaPendingTasks: qaPendingCount || 0,
        completedToday: completedTodayCount || 0,
        exceptionsOpen: exceptionsOpenCount || 0,
      };
    } catch (error) {
      logger.error('Failed to get assembly dashboard', error as Error, {
        tenantId,
      });
      return {
        pendingTasks: 0,
        inProgressTasks: 0,
        qaPendingTasks: 0,
        completedToday: 0,
        exceptionsOpen: 0,
      };
    }
  }
}

