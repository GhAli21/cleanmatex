/**
 * OrderService
 * Core business logic for order operations
 * PRD-010: Advanced Order Management with workflow support
 */

import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { WorkflowService } from './workflow-service';
import { OrderPieceService } from './order-piece-service';
import { createTenantSettingsService } from './tenant-settings.service';
import { logger } from '@/lib/utils/logger';
import type { OrderStatus } from '@/lib/types/workflow';
import { RETAIL_TERMINAL_STATUS } from '@/lib/constants/order-types';
import { generateOrderNumberWithTx } from '@/lib/utils/order-number-generator';

/** Prisma transaction client for use inside $transaction */
type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export interface CreateOrderPieceData {
  pieceSeq: number;
  color?: string;
  brand?: string;
  hasStain?: boolean;
  hasDamage?: boolean;
  notes?: string;
  rackLocation?: string;
  metadata?: Record<string, any>;
}

export interface CreateOrderParams {
  tenantId: string;
  customerId: string;
  branchId?: string;
  orderTypeId: string;
  items: Array<{
    productId: string;
    productName?: string | null;
    productName2?: string | null;
    quantity: number;
    pricePerUnit: number;
    totalPrice: number;
    serviceCategoryCode?: string;
    notes?: string;
    hasStain?: boolean;
    hasDamage?: boolean;
    stainNotes?: string;
    damageNotes?: string;
    pieces?: CreateOrderPieceData[]; // Optional piece-level data for new orders
  }>;
  isQuickDrop?: boolean;
  quickDropQuantity?: number;
  priority?: string;
  express?: boolean;
  customerNotes?: string;
  internalNotes?: string;
  paymentMethod?: string;
  readyByAt?: string; // ISO datetime string for ready-by date from screen
  userId: string;
  userName: string;
  useOldWfCodeOrNew?: boolean;
  totals?: { subtotal: number; discount?: number; tax?: number; total: number; vatRate?: number; vatAmount?: number; taxRate?: number };
  discountRate?: number;
  discountType?: string;
  promoCodeId?: string;
  giftCardId?: string;
  promoDiscountAmount?: number;
  giftCardDiscountAmount?: number;
  paymentTypeCode?: string;
  currencyCode?: string;
  currencyExRate?: number;
  /** Optional audit context for stock deduction (org_inv_stock_tr) */
  stockDeductionAudit?: {
    referenceType?: string;
    referenceId?: string;
    referenceNo?: string;
    userId?: string;
    userName?: string;
    userInfo?: string;
    userAgent?: string;
    userDevice?: string;
    userBrowser?: string;
    userOs?: string;
    userIp?: string;
    reason?: string;
  };
}

export interface CreateOrderResult {
  success: boolean;
  order?: {
    id: string;
    orderNo: string;
    currentStatus: string;
    readyByAt: string;
  };
  error?: string;
}

export interface EstimateReadyByParams {
  items: Array<{
    serviceCategoryCode: string;
    turnaroundHh?: number;
    quantity: number;
  }>;
  isQuickDrop?: boolean;
  express?: boolean;
}

export interface EstimateReadyByResult {
  success: boolean;
  readyByAt?: string;
  error?: string;
}

export class OrderService {
  /**
   * Get initial status from workflow contract
   * Falls back to hardcoded values if contract unavailable
   */
  private static async getInitialStatusFromContract(
    tenantId: string,
    screen: string,
    fallbackStatus: string
  ): Promise<string> {
    try {
      const supabase = await createClient();
      const { data: contract, error } = await supabase.rpc(
        'cmx_ord_screen_pre_conditions' as any,
        { p_screen: screen }
      );

      if (error || !contract) {
        logger.debug('Screen contract not available, using fallback', {
          tenantId,
          screen,
          fallbackStatus,
          feature: 'orders',
          action: 'get_initial_status',
        });
        return fallbackStatus;
      }

      // Type guard for contract structure
      const contractData = contract as any;
      if (!contractData.statuses || !Array.isArray(contractData.statuses) || contractData.statuses.length === 0) {
        logger.debug('Screen contract has no statuses, using fallback', {
          tenantId,
          screen,
          fallbackStatus,
          feature: 'orders',
          action: 'get_initial_status',
        });
        return fallbackStatus;
      }

      // Return first valid status from contract
      const contractStatus = contractData.statuses[0] as string;
      logger.debug('Using contract-based initial status', {
        tenantId,
        screen,
        contractStatus,
        fallbackStatus,
        feature: 'orders',
        action: 'get_initial_status',
      });
      return contractStatus;
    } catch (error) {
      logger.warn('Failed to fetch screen contract, using fallback', {
        tenantId,
        screen,
        fallbackStatus,
        feature: 'orders',
        action: 'get_initial_status',
      });
      return fallbackStatus;
    }
  }

  /**
   * Create new order with workflow logic
   * PRD-010: Quick Drop vs Normal order handling
   */
  static async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    try {
      const supabase = await createClient();
      const {
        tenantId,
        customerId,
        branchId,
        orderTypeId,
        items,
        isQuickDrop,
        quickDropQuantity,
        priority,
        express,
        customerNotes,
        internalNotes,
        paymentMethod,
        readyByAt: providedReadyByAt,
        userId,
        userName,
        useOldWfCodeOrNew,
        totals,
        discountRate,
        discountType,
        promoCodeId,
        giftCardId,
        promoDiscountAmount,
        giftCardDiscountAmount,
        paymentTypeCode,
        currencyCode: passedCurrencyCode,
        currencyExRate: passedCurrencyExRate,
      } = params;

      // Determine initial status based on Retail vs Quick Drop vs Normal
      let v_initialStatus: string;
      let v_transitionFrom: string;
      let v_orderStatus: string;
      let v_current_status: string;
      let v_current_stage: string;

      // Retail-only orders: skip workflow, go directly to closed
      const isRetailOnlyOrder =
        items.length > 0 &&
        items.every((i) => i.serviceCategoryCode === 'RETAIL_ITEMS');

      if (isRetailOnlyOrder) {
        v_initialStatus = RETAIL_TERMINAL_STATUS;
        v_transitionFrom = RETAIL_TERMINAL_STATUS;
        v_orderStatus = RETAIL_TERMINAL_STATUS;
        v_current_status = RETAIL_TERMINAL_STATUS;
        v_current_stage = RETAIL_TERMINAL_STATUS;
      } else if (isQuickDrop === true && (items.length === 0 || quickDropQuantity! > items.length)) {
        // Quick Drop: insufficient items → preparing stage
        v_initialStatus = 'preparing';
        v_transitionFrom = 'intake';
        v_orderStatus = 'preparing';
        v_current_status = 'preparing';
        v_current_stage = 'intake';
      } else {
        // Normal order: has items → processing stage
        v_initialStatus = 'processing';
        v_transitionFrom = 'intake';
        v_orderStatus = 'processing';
        v_current_status = 'processing';
        v_current_stage = 'intake';
      }

      // If using new workflow system (useOldWfCodeOrNew === false), use contract-based status
      // Skip for retail orders - they bypass workflow
      if (!isRetailOnlyOrder && useOldWfCodeOrNew === false) {
        const screen = isQuickDrop === true && (items.length === 0 || quickDropQuantity! > items.length)
          ? 'preparation'
          : 'processing';

        const contractStatus = await this.getInitialStatusFromContract(
          tenantId,
          screen,
          v_current_status
        );

        v_current_status = contractStatus;
        v_orderStatus = contractStatus;
        v_initialStatus = contractStatus;

        logger.info('Using new workflow system for order creation', {
          tenantId,
          userId,
          screen,
          contractStatus,
          isQuickDrop,
          feature: 'orders',
          action: 'create_order',
        });
      } else if (isRetailOnlyOrder) {
        logger.info('Retail order created with closed status (workflow skipped)', {
          tenantId,
          userId,
          feature: 'orders',
          action: 'create_order',
        });
      } else {
        logger.debug('Using old workflow system for order creation', {
          tenantId,
          userId,
          v_current_status,
          isQuickDrop,
          feature: 'orders',
          action: 'create_order',
        });
      }

      // Generate order number
      const { data: orderNoData, error: orderNoError } = await supabase.rpc(
        'generate_order_number',
        { p_tenant_org_id: tenantId }
      );

      if (orderNoError || !orderNoData) {
        return {
          success: false,
          error: 'Failed to generate order number',
        };
      }

      const orderNo = orderNoData as string;

      // Calculate totals (use provided totals when present, else from items)
      const subtotal = totals?.subtotal ?? items.reduce((sum, item) => sum + item.totalPrice, 0);
      const discount = totals?.discount ?? 0;
      const tax = totals?.tax ?? 0;
      const total = totals?.total ?? subtotal - discount + tax;
      const vatRate = totals?.vatRate;
      const vatAmount = totals?.vatAmount;

      // Currency: prefer passed values, else fetch from tenant settings when we have payment-related data
      const hasPaymentData = !!(
        totals || paymentMethod || paymentTypeCode ||
        discountRate != null || promoCodeId || giftCardId ||
        passedCurrencyCode
      );
      let currencyCode = passedCurrencyCode;
      let currencyExRate = passedCurrencyExRate;
      if (!currencyCode && hasPaymentData) {
        const tenantSettingsSvc = createTenantSettingsService(supabase);
        const config = await tenantSettingsSvc.getCurrencyConfig(tenantId, branchId ?? undefined, userId);
        currencyCode = config.currencyCode;
      }
      if (currencyExRate == null) {
        currencyExRate = 1;
      }

      // Get primary service category from first item
      const primaryServiceCategory = items[0]?.serviceCategoryCode || null;

      // Get default workflow template
      const { data: templateData } = await supabase
        .from('org_tenant_workflow_templates_cf')
        .select('template_id')
        .eq('tenant_org_id', tenantId)
        .eq('is_default', true)
        .eq('is_active', true)
        .single();

      const v_workflowTemplateId = templateData?.template_id || null;

      const insertPayload: Record<string, unknown> = {
        tenant_org_id: tenantId,
        branch_id: branchId,
        customer_id: customerId,
        order_type_id: orderTypeId,
        order_no: orderNo,
        status: v_orderStatus,
        workflow_template_id: v_workflowTemplateId,
        current_status: v_current_status,
        current_stage: v_current_stage,
        priority: priority || 'normal',
        priority_multiplier: express ? 0.5 : 1.0,
        total_items: items.length > 0 ? items.length : quickDropQuantity || 0,
        subtotal,
        discount,
        tax,
        total,
        payment_status: paymentMethod ? 'partial' : 'pending',
        payment_method_code: paymentMethod,
        paid_amount: 0,
        service_category_code: primaryServiceCategory,
        is_order_quick_drop: isQuickDrop || false,
        quick_drop_quantity: quickDropQuantity,
        is_retail: isRetailOnlyOrder,
        customer_notes: customerNotes,
        internal_notes: internalNotes,
        created_by: userId,
        created_info: null,
        rec_status: 1,
      };

      if (currencyCode != null) {
        insertPayload.currency_code = currencyCode;
        insertPayload.currency_ex_rate = currencyExRate ?? 1;
      }
      if (vatRate != null) insertPayload.vat_rate = vatRate;
      if (vatAmount != null) insertPayload.vat_amount = vatAmount;
      if (discountRate != null) insertPayload.discount_rate = discountRate;
      if (discountType != null) insertPayload.discount_type = discountType;
      if (promoCodeId != null) insertPayload.promo_code_id = promoCodeId;
      if (giftCardId != null) insertPayload.gift_card_id = giftCardId;
      if (promoDiscountAmount != null) insertPayload.promo_discount_amount = promoDiscountAmount;
      if (giftCardDiscountAmount != null) insertPayload.gift_card_discount_amount = giftCardDiscountAmount;
      if (paymentTypeCode != null) insertPayload.payment_type_code = paymentTypeCode;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('org_orders_mst')
        .insert(insertPayload)
        .select()
        .single();

      if (orderError || !order) {
        return {
          success: false,
          error: orderError?.message || 'Failed to create order',
        };
      }

      // Create order items (only if not Quick Drop or if items were provided)
      if (items.length > 0) {
        const itemsToInsert = items.map((item, index) => ({
          order_id: order.id,
          tenant_org_id: tenantId,
          service_category_code: item.serviceCategoryCode,
          order_item_srno: `${orderNo}-${index + 1}`,
          product_id: item.productId,
          quantity: item.quantity,
          price_per_unit: item.pricePerUnit,
          total_price: item.totalPrice,
          status: 'pending',
          item_status: v_initialStatus,
          item_stage: v_transitionFrom,
          notes: item.notes,
          has_stain: item.hasStain,
          has_damage: item.hasDamage,
          stain_notes: item.stainNotes,
          damage_notes: item.damageNotes,
        }));

        const { error: itemsError, data: createdItems } = await supabase
          .from('org_order_items_dtl')
          .insert(itemsToInsert)
          .select();

        if (itemsError) {
          console.error('Failed to create order items:', itemsError);
          // Continue anyway - items can be added later in preparation
        } else if (createdItems && createdItems.length > 0) {
          // Always create pieces for each order item
          const piecesErrors: Array<{ itemId: string; error: string }> = [];

            for (let i = 0; i < createdItems.length; i++) {
              const createdItem = createdItems[i];
              const itemData = items[i];

              if (createdItem && itemData.quantity > 0) {
                // Use piece-level data if provided, otherwise use item-level data as fallback
                const piecesData = itemData.pieces && itemData.pieces.length > 0
                  ? itemData.pieces.map((piece, index) => ({
                    pieceSeq: piece.pieceSeq || index + 1,
                    color: piece.color,
                    brand: piece.brand,
                    hasStain: piece.hasStain ?? itemData.hasStain,
                    hasDamage: piece.hasDamage ?? itemData.hasDamage,
                    notes: piece.notes || itemData.notes,
                    rackLocation: piece.rackLocation,
                    metadata: piece.metadata || {},
                  }))
                  : undefined; // Will use baseData fallback

                const piecesResult = await OrderPieceService.createPiecesForItem(
                  tenantId,
                  order.id,
                  createdItem.id,
                  itemData.quantity,
                  {
                    serviceCategoryCode: itemData.serviceCategoryCode,
                    productId: itemData.productId,
                    pricePerUnit: itemData.pricePerUnit,
                    totalPrice: itemData.totalPrice,
                    color: undefined, // Fallback if no piece data
                    brand: undefined, // Fallback if no piece data
                    hasStain: itemData.hasStain,
                    hasDamage: itemData.hasDamage,
                    notes: itemData.notes,
                    metadata: {},
                  },
                  piecesData // Pass piece-level data array
                );

                // If pieces creation failed, collect the error
                if (!piecesResult.success) {
                  piecesErrors.push({
                    itemId: createdItem.id,
                    error: piecesResult.error || 'Failed to create pieces',
                  });
                }
              }
            }

          // If any pieces creation failed, rollback order and items
          if (piecesErrors.length > 0) {
              const errorMessage = `Failed to create pieces: ${piecesErrors.map(e => e.error).join('; ')}`;
              logger.error('Failed to create pieces for order items, rolling back order', new Error(errorMessage), {
                tenantId,
                orderId: order.id,
                errors: piecesErrors,
                feature: 'orders',
                action: 'create_order',
              });

              // Delete all created items
              const itemIds = createdItems.map(item => item.id);
              await supabase
                .from('org_order_items_dtl')
                .delete()
                .eq('tenant_org_id', tenantId)
                .eq('order_id', order.id)
                .in('id', itemIds);

              // Delete the order
              await supabase
                .from('org_orders_mst')
                .delete()
                .eq('id', order.id)
                .eq('tenant_org_id', tenantId);

              return {
                success: false,
                error: `Failed to create pieces: ${piecesErrors.map(e => e.error).join('; ')}`,
              };
            }
        }

        // Stock deduction for retail items
        const hasRetailItems = items.some((i) => i.serviceCategoryCode === 'RETAIL_ITEMS');
        if (hasRetailItems) {
          try {
            const { error: deductError } = await supabase.rpc('deduct_retail_stock_for_order', {
              p_order_id: order.id,
              p_tenant_org_id: tenantId,
              p_branch_id: order.branch_id ?? null,
              ...(params.stockDeductionAudit && {
                p_reference_type: params.stockDeductionAudit.referenceType ?? 'ORDER',
                p_reference_id: params.stockDeductionAudit.referenceId ?? order.id,
                p_reference_no: params.stockDeductionAudit.referenceNo,
                p_user_id: params.stockDeductionAudit.userId ?? params.userId,
                p_user_name: params.stockDeductionAudit.userName ?? params.userName,
                p_user_info: params.stockDeductionAudit.userInfo,
                p_user_agent: params.stockDeductionAudit.userAgent,
                p_user_device: params.stockDeductionAudit.userDevice,
                p_user_browser: params.stockDeductionAudit.userBrowser,
                p_user_os: params.stockDeductionAudit.userOs,
                p_user_ip: params.stockDeductionAudit.userIp,
                p_reason: params.stockDeductionAudit.reason,
              }),
            });
            if (deductError) {
              const errMsg = deductError.message || 'Insufficient stock';
              logger.error('Stock deduction failed for retail order', new Error(errMsg), {
                tenantId,
                orderId: order.id,
                feature: 'orders',
                action: 'create_order',
              });
              // Rollback: delete items then order
              await supabase
                .from('org_order_items_dtl')
                .delete()
                .eq('tenant_org_id', tenantId)
                .eq('order_id', order.id);
              await supabase
                .from('org_orders_mst')
                .delete()
                .eq('id', order.id)
                .eq('tenant_org_id', tenantId);
              return {
                success: false,
                error: errMsg.includes('INSUFFICIENT_STOCK') ? errMsg : `Stock deduction failed: ${errMsg}`,
              };
            }
          } catch (deductErr) {
            const errMsg = deductErr instanceof Error ? deductErr.message : 'Stock deduction failed';
            logger.error('Stock deduction failed for retail order', deductErr as Error, {
              tenantId,
              orderId: order.id,
              feature: 'orders',
              action: 'create_order',
            });
            await supabase
              .from('org_order_items_dtl')
              .delete()
              .eq('tenant_org_id', tenantId)
              .eq('order_id', order.id);
            await supabase
              .from('org_orders_mst')
              .delete()
              .eq('id', order.id)
              .eq('tenant_org_id', tenantId);
            return {
              success: false,
              error: errMsg.includes('INSUFFICIENT_STOCK') ? errMsg : `Stock deduction failed: ${errMsg}`,
            };
          }
        }
      }

      // Handle ready_by date: use provided value or calculate if null
      let finalReadyByAt: string | undefined;

      if (providedReadyByAt) {
        // Use the ready_by date from the screen field
        finalReadyByAt = providedReadyByAt;
      } else {
        // Calculate ready_by date if not provided
        const readyByAt = await this.estimateReadyBy({
          items: items.map(item => ({
            serviceCategoryCode: item.serviceCategoryCode || '',
            quantity: item.quantity,
          })),
          isQuickDrop,
          express,
        });

        if (readyByAt.success && readyByAt.readyByAt) {
          finalReadyByAt = readyByAt.readyByAt;
        }
      }

      // Update order with ready_by date if we have one
      if (finalReadyByAt) {
        await supabase
          .from('org_orders_mst')
          .update({
            ready_by: finalReadyByAt,
            ready_by_at_new: finalReadyByAt,
          })
          .eq('id', order.id)
          .eq('tenant_org_id', tenantId);
      }

      return {
        success: true,
        order: {
          id: order.id,
          orderNo: order.order_no,
          currentStatus: order.current_status,
          readyByAt: finalReadyByAt || '',
        },
      };
    } catch (error) {
      logger.error('OrderService.createOrder error', error as Error, {
        tenantId: params.tenantId,
        userId: params.userId,
        feature: 'orders',
        action: 'create_order',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create order within a Prisma transaction (for atomic create-with-payment flow).
   * All operations use tx - if any step fails, the whole transaction rolls back.
   */
  static async createOrderInTransaction(
    tx: PrismaTx,
    params: CreateOrderParams
  ): Promise<CreateOrderResult> {
    const {
      tenantId,
      customerId,
      branchId,
      orderTypeId,
      items,
      isQuickDrop,
      quickDropQuantity,
      priority,
      express,
      customerNotes,
      internalNotes,
      paymentMethod,
      userId,
      readyByAt,
      totals,
      discountRate,
      discountType,
      promoCodeId,
      giftCardId,
      promoDiscountAmount,
      giftCardDiscountAmount,
      paymentTypeCode,
      currencyCode: passedCurrencyCode,
      currencyExRate: passedCurrencyExRate,
    } = params;

    const isRetailOnlyOrder =
      items.length > 0 &&
      items.every((i) => i.serviceCategoryCode === 'RETAIL_ITEMS');

    let v_initialStatus: string;
    let v_transitionFrom: string;
    let v_orderStatus: string;
    let v_current_status: string;
    let v_current_stage: string;

    if (isRetailOnlyOrder) {
      v_initialStatus = RETAIL_TERMINAL_STATUS;
      v_transitionFrom = RETAIL_TERMINAL_STATUS;
      v_orderStatus = RETAIL_TERMINAL_STATUS;
      v_current_status = RETAIL_TERMINAL_STATUS;
      v_current_stage = RETAIL_TERMINAL_STATUS;
    } else if (isQuickDrop === true && (items.length === 0 || (quickDropQuantity ?? 0) > items.length)) {
      v_initialStatus = 'preparing';
      v_transitionFrom = 'intake';
      v_orderStatus = 'preparing';
      v_current_status = 'preparing';
      v_current_stage = 'intake';
    } else {
      v_initialStatus = 'processing';
      v_transitionFrom = 'intake';
      v_orderStatus = 'processing';
      v_current_status = 'processing';
      v_current_stage = 'intake';
    }

    const orderNo = await generateOrderNumberWithTx(tx, tenantId);

    const subtotal = totals?.subtotal ?? items.reduce((sum, item) => sum + item.totalPrice, 0);
    const discount = totals?.discount ?? 0;
    const tax = totals?.tax ?? 0;
    const total = totals?.total ?? subtotal - discount + tax;
    const vatRate = totals?.vatRate;
    const vatAmount = totals?.vatAmount;
    const taxRate = totals?.taxRate;
    const currencyCode = passedCurrencyCode;
    const currencyExRate = passedCurrencyExRate ?? 1;
    const primaryServiceCategory = items[0]?.serviceCategoryCode || null;

    const template = await tx.org_tenant_workflow_templates_cf.findFirst({
      where: {
        tenant_org_id: tenantId,
        is_default: true,
        is_active: true,
      },
      select: { template_id: true },
    });
    const v_workflowTemplateId = template?.template_id ?? null;

    let readyByFields: { ready_by?: Date; ready_by_at_new?: Date } = {};
    if (readyByAt) {
      try {
        const d = new Date(readyByAt);
        if (!Number.isNaN(d.getTime())) {
          readyByFields = { ready_by: d, ready_by_at_new: d };
        }
      } catch {
        // ignore invalid date
      }
    }

    const order = await tx.org_orders_mst.create({
      data: {
        tenant_org_id: tenantId,
        branch_id: branchId,
        customer_id: customerId,
        order_type_id: orderTypeId,
        order_no: orderNo,
        status: v_orderStatus,
        workflow_template_id: v_workflowTemplateId,
        current_status: v_current_status,
        current_stage: v_current_stage,
        priority: priority || 'normal',
        priority_multiplier: express ? 0.5 : 1.0,
        total_items: items.length > 0 ? items.length : quickDropQuantity ?? 0,
        subtotal,
        discount,
        tax,
        total,
        payment_status: paymentMethod ? 'partial' : 'pending',
        payment_method_code: paymentMethod,
        paid_amount: 0,
        service_category_code: primaryServiceCategory,
        is_order_quick_drop: isQuickDrop ?? false,
        quick_drop_quantity: quickDropQuantity,
        is_retail: isRetailOnlyOrder,
        customer_notes: customerNotes,
        internal_notes: internalNotes,
        created_by: userId,
        created_info: null,
        rec_status: 1,
        ...(currencyCode && { currency_code: currencyCode, currency_ex_rate: currencyExRate }),
        ...(vatRate != null && { vat_rate: vatRate }),
        ...(vatAmount != null && { vat_amount: vatAmount }),
        ...(taxRate != null && { tax_rate: taxRate }),
        ...(discountRate != null && { discount_rate: discountRate }),
        ...readyByFields,
        ...(discountType != null && { discount_type: discountType }),
        ...(promoCodeId != null && { promo_code_id: promoCodeId }),
        ...(giftCardId != null && { gift_card_id: giftCardId }),
        ...(promoDiscountAmount != null && { promo_discount_amount: promoDiscountAmount }),
        ...(giftCardDiscountAmount != null && { gift_card_discount_amount: giftCardDiscountAmount }),
        ...(paymentTypeCode != null && { payment_type_code: paymentTypeCode }),
      },
    });

    if (items.length > 0) {
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        const createdItem = await tx.org_order_items_dtl.create({
          data: {
            order_id: order.id,
            tenant_org_id: tenantId,
            service_category_code: item.serviceCategoryCode,
            order_item_srno: `${orderNo}-${index + 1}`,
            product_id: item.productId,
            product_name: item.productName ?? null,
            product_name2: item.productName2 ?? null,
            quantity: item.quantity,
            price_per_unit: item.pricePerUnit,
            total_price: item.totalPrice,
            status: 'pending',
            item_status: v_initialStatus,
            item_stage: v_transitionFrom,
            notes: item.notes,
            has_stain: item.hasStain,
            has_damage: item.hasDamage,
            stain_notes: item.stainNotes,
            damage_notes: item.damageNotes,
          },
        });

        // Always create pieces for each order item
        if (item.quantity > 0) {
          const pricePerPiece = item.totalPrice / item.quantity;
          const piecesData = Array.from({ length: item.quantity }, (_, i) => ({
            tenant_org_id: tenantId,
            order_id: order.id,
            order_item_id: createdItem.id,
            piece_seq: i + 1,
            service_category_code: item.serviceCategoryCode,
            product_id: item.productId,
            scan_state: 'expected',
            quantity: 1,
            price_per_unit: pricePerPiece,
            total_price: pricePerPiece,
            piece_status: 'processing',
            is_rejected: false,
            is_ready: false,
          }));
          await tx.org_order_item_pieces_dtl.createMany({ data: piecesData });
        }
      }

      if (isRetailOnlyOrder) {
        const audit = params.stockDeductionAudit ?? {};
        await tx.$executeRaw(
          Prisma.sql`SELECT deduct_retail_stock_for_order(
            ${order.id}::uuid,
            ${tenantId}::uuid,
            ${order.branch_id}::uuid,
            ${audit.referenceType ?? 'ORDER'},
            ${audit.referenceId ?? order.id}::uuid,
            ${audit.referenceNo ?? order.order_no},
            ${params.userId ?? null}::uuid,
            ${params.userName ?? null},
            ${audit.userInfo ?? null},
            ${audit.userAgent ?? null},
            ${audit.userDevice ?? null},
            ${audit.userBrowser ?? null},
            ${audit.userOs ?? null},
            ${audit.userIp ?? null},
            ${audit.reason ?? 'Order sale deduction'}
          )`
        );
      }
    }

    return {
      success: true,
      order: {
        id: order.id,
        orderNo: order.order_no,
        currentStatus: order.current_status ?? v_orderStatus,
        readyByAt: '',
      },
    };
  }

  /**
   * Estimate ready-by date based on items and priority
   * PRD-010: Calculate SLA based on service categories and express mode
   */
  static async estimateReadyBy(params: EstimateReadyByParams): Promise<EstimateReadyByResult> {
    try {
      const supabase = await createClient();
      const { items, isQuickDrop, express } = params;

      // If Quick Drop with no items, use default turnaround
      if (isQuickDrop && items.length === 0) {
        const defaultHours = 24; // Default 24 hours for Quick Drop
        const readyByAt = new Date(Date.now() + defaultHours * 60 * 60 * 1000);
        return {
          success: true,
          readyByAt: readyByAt.toISOString(),
        };
      }

      // Get max turnaround from service categories
      let maxTurnaround = 0;
      for (const item of items) {
        const { data: category } = await supabase
          .from('sys_service_category_cd')
          .select('turnaround_hh, turnaround_hh_express')
          .eq('service_category_code', item.serviceCategoryCode)
          .single();

        if (category) {
          const turnaround = express ? category.turnaround_hh_express : category.turnaround_hh;
          maxTurnaround = Math.max(maxTurnaround, turnaround || 0);
        }
      }

      // Fallback to default if no category found
      if (maxTurnaround === 0) {
        maxTurnaround = express ? 12 : 24;
      }

      // Apply priority multiplier if express
      const multiplier = express ? 0.5 : 1.0;
      const finalTurnaround = maxTurnaround * multiplier;

      // Calculate ready-by date
      const readyByAt = new Date(Date.now() + finalTurnaround * 60 * 60 * 1000);

      return {
        success: true,
        readyByAt: readyByAt.toISOString(),
      };
    } catch (error) {
      console.error('OrderService.estimateReadyBy error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Split order into suborder
   * PRD-010: Create suborder with specific items
   */
  static async splitOrder(
    orderId: string,
    tenantId: string,
    itemIds: string[],
    reason: string,
    userId: string,
    userName: string
  ): Promise<any> {
    try {
      const supabase = await createClient();

      // Get parent order
      const { data: parentOrder, error: orderError } = await supabase
        .from('org_orders_mst')
        .select('*')
        .eq('id', orderId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (orderError || !parentOrder) {
        return {
          success: false,
          error: 'Parent order not found',
        };
      }

      // Get items to move
      const { data: items, error: itemsError } = await supabase
        .from('org_order_items_dtl')
        .select('*')
        .in('id', itemIds)
        .eq('order_id', orderId)
        .eq('tenant_org_id', tenantId);

      if (itemsError || !items || items.length === 0) {
        return {
          success: false,
          error: 'Items not found or already moved',
        };
      }

      // Generate suborder number
      const { data: orderNoData, error: orderNoError } = await supabase.rpc(
        'generate_order_number',
        { p_tenant_org_id: tenantId }
      );

      if (orderNoError || !orderNoData) {
        return {
          success: false,
          error: 'Failed to generate suborder number',
        };
      }

      // Create suborder
      const { data: suborder, error: suborderError } = await supabase
        .from('org_orders_mst')
        .insert({
          tenant_org_id: tenantId,
          branch_id: parentOrder.branch_id,
          customer_id: parentOrder.customer_id,
          order_type_id: parentOrder.order_type_id,
          order_no: orderNoData,
          status: 'intake',
          current_status: parentOrder.current_status,
          current_stage: parentOrder.current_stage,
          priority: parentOrder.priority,
          priority_multiplier: parentOrder.priority_multiplier,
          total_items: items.length,
          subtotal: items.reduce((sum, item) => sum + item.total_price, 0),
          discount: 0,
          tax: 0,
          total: items.reduce((sum, item) => sum + item.total_price, 0),
          workflow_template_id: parentOrder.workflow_template_id,
          parent_order_id: orderId,
          order_subtype: 'split_child',
          customer_notes: `Split from ${parentOrder.order_no}: ${reason}`,
          internal_notes: `Split order created - reason: ${reason}`,
        })
        .select()
        .single();

      if (suborderError || !suborder) {
        return {
          success: false,
          error: 'Failed to create suborder',
        };
      }

      // Move items to suborder
      const { error: moveError } = await supabase
        .from('org_order_items_dtl')
        .update({ order_id: suborder.id })
        .in('id', itemIds);

      if (moveError) {
        return {
          success: false,
          error: 'Failed to move items to suborder',
        };
      }

      // Update parent order
      await supabase
        .from('org_orders_mst')
        .update({
          has_split: true,
          total_items: parentOrder.total_items - items.length,
        })
        .eq('id', orderId);

      // Log to history
      await supabase.rpc('log_order_action', {
        p_tenant_org_id: tenantId,
        p_order_id: orderId,
        p_action_type: 'SPLIT',
        p_from_value: null,
        p_to_value: suborder.id,
        p_done_by: userId,
        p_payload: {
          reason,
          suborder_no: suborder.order_no,
          items_moved: items.length,
        },
      });

      return {
        success: true,
        suborder: {
          id: suborder.id,
          orderNo: suborder.order_no,
        },
      };
    } catch (error) {
      console.error('OrderService.splitOrder error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create issue for order or item
   * PRD-010: Track issues with photos and priority
   */
  static async createIssue(
    orderId: string,
    orderItemId: string | null,
    tenantId: string,
    issueCode: string,
    issueText: string,
    userId: string,
    photoUrl?: string,
    priority: string = 'normal'
  ): Promise<any> {
    try {
      const supabase = await createClient();

      const { data: issue, error: issueError } = await supabase
        .from('org_order_item_issues')
        .insert({
          tenant_org_id: tenantId,
          order_id: orderId,
          order_item_id: orderItemId || orderId, // Use order ID as fallback
          issue_code: issueCode,
          issue_text: issueText,
          photo_url: photoUrl,
          priority,
          created_by: userId,
        })
        .select()
        .single();

      if (issueError || !issue) {
        return {
          success: false,
          error: 'Failed to create issue',
        };
      }

      // Update order/item to indicate issue exists
      if (orderItemId) {
        await supabase
          .from('org_order_items_dtl')
          .update({ item_issue_id: issue.id, item_is_rejected: true })
          .eq('id', orderItemId);
      }

      await supabase
        .from('org_orders_mst')
        .update({ has_issue: true, is_rejected: true })
        .eq('id', orderId);

      // Log to history
      await supabase.rpc('log_order_action', {
        p_tenant_org_id: tenantId,
        p_order_id: orderId,
        p_action_type: 'ISSUE_CREATED',
        p_from_value: null,
        p_to_value: issueCode,
        p_done_by: userId,
        p_payload: {
          issue_id: issue.id,
          issue_text: issueText,
          priority,
        },
      });

      return {
        success: true,
        issue,
      };
    } catch (error) {
      console.error('OrderService.createIssue error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Resolve issue
   * PRD-010: Mark issue as solved with notes
   */
  static async resolveIssue(
    issueId: string,
    tenantId: string,
    solvedNotes: string,
    userId: string
  ): Promise<any> {
    try {
      const supabase = await createClient();

      const { data: issue, error: issueError } = await supabase
        .from('org_order_item_issues')
        .update({
          solved_at: new Date().toISOString(),
          solved_by: userId,
          solved_notes: solvedNotes,
        })
        .eq('id', issueId)
        .eq('tenant_org_id', tenantId)
        .select()
        .single();

      if (issueError || !issue) {
        return {
          success: false,
          error: 'Failed to resolve issue',
        };
      }

      // Check if all issues for order are resolved
      const { data: allIssues } = await supabase
        .from('org_order_item_issues')
        .select('solved_at')
        .eq('order_id', issue.order_id)
        .eq('tenant_org_id', tenantId);

      const allResolved = allIssues?.every(i => i.solved_at !== null);

      if (allResolved) {
        await supabase
          .from('org_orders_mst')
          .update({ has_issue: false })
          .eq('id', issue.order_id);
      }

      // Log to history
      await supabase.rpc('log_order_action', {
        p_tenant_org_id: tenantId,
        p_order_id: issue.order_id,
        p_action_type: 'ISSUE_SOLVED',
        p_from_value: issue.issue_code,
        p_to_value: 'resolved',
        p_done_by: userId,
        p_payload: {
          issue_id: issueId,
          solved_notes: solvedNotes,
        },
      });

      return {
        success: true,
        issue,
      };
    } catch (error) {
      console.error('OrderService.resolveIssue error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get order history timeline
   * PRD-010: Complete audit trail
   */
  static async getOrderHistory(orderId: string, tenantId: string): Promise<any[]> {
    try {
      const supabase = await createClient();

      const { data, error } = await supabase
        .from('org_order_history')
        .select('*')
        .eq('order_id', orderId)
        .eq('tenant_org_id', tenantId)
        .order('done_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch order history:', error);
        return [];
      }

      return (data || []) as any[];
    } catch (error) {
      console.error('OrderService.getOrderHistory error:', error);
      return [];
    }
  }

  /**
   * Split order by pieces (NEW)
   * Creates a new sub-order with selected pieces from items
   * PRD-010: Piece-level splitting for processing modal
   */
  static async splitOrderByPieces(
    orderId: string,
    tenantId: string,
    pieceIds: string[],
    reason: string,
    userId: string,
    userName: string
  ): Promise<any> {
    try {
      const supabase = await createClient();

      // Parse piece IDs to extract itemId and pieceNumber
      // Format: "{itemId}-piece-{pieceNumber}"
      const pieceMap = new Map<string, number[]>();

      pieceIds.forEach(pieceId => {
        const match = pieceId.match(/^(.+)-piece-(\d+)$/);
        if (match) {
          const itemId = match[1];
          const pieceNumber = parseInt(match[2], 10);
          const existing = pieceMap.get(itemId) || [];
          existing.push(pieceNumber);
          pieceMap.set(itemId, existing);
        }
      });

      if (pieceMap.size === 0) {
        return {
          success: false,
          error: 'No valid piece IDs found',
        };
      }

      // Get original order
      const { data: originalOrder, error: orderError } = await supabase
        .from('org_orders_mst')
        .select('*')
        .eq('id', orderId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (orderError || !originalOrder) {
        return {
          success: false,
          error: 'Order not found or access denied',
        };
      }

      // Get items that have pieces being split
      const itemIds = Array.from(pieceMap.keys());
      const { data: items, error: itemsError } = await supabase
        .from('org_order_items_dtl')
        .select('*')
        .in('id', itemIds)
        .eq('tenant_org_id', tenantId);

      if (itemsError || !items || items.length === 0) {
        return {
          success: false,
          error: 'Items not found',
        };
      }

      // Generate new order number
      const timestamp = Date.now().toString().slice(-6);
      const newOrderNo = `${originalOrder.order_no}-S${timestamp}`;

      // Create sub-order
      const { data: suborder, error: createError } = await supabase
        .from('org_orders_mst')
        .insert({
          tenant_org_id: tenantId,
          order_no: newOrderNo,
          customer_id: originalOrder.customer_id,
          branch_id: originalOrder.branch_id,
          service_category_code: originalOrder.service_category_code,
          status: 'processing',
          current_status: 'processing',
          parent_order_id: orderId,
          order_subtype: 'split',
          priority: originalOrder.priority,
          payment_status: 'pending',
          subtotal: 0,
          total: 0,
          received_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError || !suborder) {
        return {
          success: false,
          error: 'Failed to create sub-order',
        };
      }

      // Create items in sub-order and update original items
      let movedPieces = 0;
      for (const item of items) {
        const piecesToMove = pieceMap.get(item.id) || [];
        const movingQuantity = piecesToMove.length;

        if (movingQuantity === 0) continue;

        // Create new item in suborder with the moving quantity
        await supabase
          .from('org_order_items_dtl')
          .insert({
            tenant_org_id: tenantId,
            order_id: suborder.id,
            product_id: item.product_id,
            service_category_code: item.service_category_code,
            product_name: item.product_name,
            product_name2: item.product_name2,
            quantity: movingQuantity,
            quantity_ready: 0,
            price_per_unit: item.price_per_unit,
            total_price: item.price_per_unit * movingQuantity,
            status: item.status,
            created_at: new Date().toISOString(),
          });

        // Update original item quantity
        const newQuantity = item.quantity - movingQuantity;
        await supabase
          .from('org_order_items_dtl')
          .update({
            quantity: newQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id)
          .eq('tenant_org_id', tenantId);

        movedPieces += movingQuantity;
      }

      // Mark original order as having split
      await supabase
        .from('org_orders_mst')
        .update({
          has_split: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('tenant_org_id', tenantId);

      // Log history
      await supabase
        .from('org_order_history')
        .insert({
          tenant_org_id: tenantId,
          order_id: orderId,
          action_type: 'SPLIT',
          from_value: orderId,
          to_value: suborder.id,
          done_by: userId,
          done_at: new Date().toISOString(),
          payload: {
            reason,
            pieces_moved: movedPieces,
            new_order_no: newOrderNo,
            piece_ids: pieceIds,
          },
        });

      return {
        success: true,
        suborder,
      };
    } catch (error) {
      console.error('OrderService.splitOrderByPieces error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

