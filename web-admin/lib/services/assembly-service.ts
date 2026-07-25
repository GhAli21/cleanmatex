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
  QANotPassedError,
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

      // Get order items count
      const { data: orderItems, error: itemsError } = await supabase
        .from('org_order_items_dtl')
        .select('id')
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
        logger.error('Failed (1) to create assembly task', taskError as Error, {
          tenantId,
          userId,
          orderId,
        });
        console.log('taskError', taskError?.message);
        console.log('taskError', taskError?.details);
        console.log('taskError', taskError?.hint);
        console.log('taskError', taskError?.code);
        throw new Error('Failed (2) to create assembly task'+taskError?.message);
      }

      // Create assembly items for each order item
      if (orderItems && orderItems.length > 0) {
        const assemblyItems = orderItems.map((item) => ({
          task_id: task.id,
          order_item_id: item.id,
          tenant_org_id: tenantId,
          item_status: 'PENDING',
          created_by: userId,
        }));

        const { error: itemsInsertError } = await supabase
          .from('org_asm_items_dtl')
          .insert(assemblyItems);

        if (itemsInsertError) {
          logger.error('Failed (3) to create assembly items', itemsInsertError as Error, {
            tenantId,
            userId,
            taskId: task.id,
          });
          // Don't fail the whole operation, log and continue
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
          .eq('id', locationId);
      }

      // Idempotent: already started tasks can be resumed without error
      if (task.task_status === 'IN_PROGRESS') {
        return { success: true };
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
        .eq('item_status', 'PENDING');

      if (itemsError) {
        logger.error('Failed to fetch assembly items', itemsError as Error, {
          tenantId,
          userId,
          taskId,
        });
        throw new Error('Failed to fetch assembly items');
      }

      // Find matching item
      const matchingItem = items?.find(
        (item: any) => item.order_item?.barcode === barcode
      );

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
        .eq('id', matchingItem.id);

      if (updateError) {
        logger.error('Failed to update item status', updateError as Error, {
          tenantId,
          userId,
          taskId,
          itemId: matchingItem.id,
        });
        throw new Error('Failed to update item status');
      }

      // Update task counters
      const newScannedCount = (task.scanned_items || 0) + 1;
      await supabase
        .from('org_asm_tasks_mst')
        .update({
          scanned_items: newScannedCount,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      logger.info('Item scanned successfully', {
        tenantId,
        userId,
        taskId,
        itemId: matchingItem.id,
        scannedCount: newScannedCount,
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
        userId,
      } = params;
      const supabase = await createClient();

      logger.info('Creating assembly exception', {
        tenantId,
        userId,
        taskId,
        exceptionTypeCode,
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
          branch_id: (task as any).branch_id ?? null,
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

      // Update task exception counter
      const newExceptionCount = (task.exception_items || 0) + 1;
      await supabase
        .from('org_asm_tasks_mst')
        .update({
          exception_items: newExceptionCount,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

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
        .eq('id', exceptionId);

      if (updateError) {
        logger.error('Failed to resolve exception', updateError as Error, {
          tenantId,
          userId,
          exceptionId,
        });
        throw new Error('Failed to resolve exception');
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
        .eq('exception_status', 'OPEN');

      if (openExceptions && openExceptions.length > 0) {
        throw new ExceptionNotResolvedError(openExceptions[0].id);
      }

      // Create QA decision
      const { error: qaError } = await supabase.from('org_qa_decisions_tr').insert({
        task_id: taskId,
        tenant_org_id: tenantId,
        branch_id: (task as any).branch_id ?? null,
        order_id: (task.order as any).id,
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
        .eq('id', taskId);

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

      // Verify QA passed
      if (task.qa_status !== 'QA_PASSED') {
        throw new QANotPassedError((task.order as any).id);
      }

      // Generate packing list number
      const orderNo = (task.order as any).order_no;
      const listNumber = `PL-${orderNo}-${Date.now()}`;

      // Build items summary
      const itemsSummary = (task.items as any[])?.map((item: any) => ({
        productName: item.order_item?.product_name || '',
        productName2: item.order_item?.product_name2 || '',
        quantity: item.order_item?.quantity || 1,
      })) || [];

      // Create packing list
      const { data: packingList, error: listError } = await supabase
        .from('org_pck_packing_lists_mst')
        .insert({
          tenant_org_id: tenantId,
          branch_id: (task as any).branch_id ?? null,
          order_id: (task.order as any).id,
          task_id: taskId,
          list_number: listNumber,
          items_summary: itemsSummary,
          packaging_type_code: packagingTypeCode,
          item_count: task.total_items,
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
        .eq('id', taskId);

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
      const rawItems = (task.items as Array<Record<string, unknown>> | null) ?? [];

      const items: AssemblyTaskItemDetail[] = rawItems.map((item) => {
        const orderItem = item.order_item as {
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

      const orderItem = item.order_item as { barcode?: string | null } | null;
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

      const newScannedCount = (task.scanned_items || 0) + 1;
      await supabase
        .from('org_asm_tasks_mst')
        .update({
          scanned_items: newScannedCount,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .eq('tenant_org_id', tenantId);

      logger.info('Assembly item marked selected', {
        tenantId,
        userId,
        taskId,
        itemId: item.id,
        scannedCount: newScannedCount,
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

