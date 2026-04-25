/**
 * OrderService
 * Core business logic for order operations
 * PRD-010: Advanced Order Management with workflow support
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getOrderById } from '@/lib/db/orders';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { WorkflowService } from './workflow-service';
import { OrderPieceService } from './order-piece-service';
import { createTenantSettingsService } from './tenant-settings.service';
import { logger } from '@/lib/utils/logger';
import type { OrderStatus } from '@/lib/types/workflow';
import { RETAIL_TERMINAL_STATUS } from '@/lib/constants/order-types';
import { generateOrderNumberWithTx } from '@/lib/utils/order-number-generator';
import { isOrderEditable } from '@/lib/utils/order-editability';
import { checkOrderLock, unlockOrder, lockOrderForEdit } from '@/lib/services/order-lock.service';
import { createEditAudit } from '@/lib/services/order-audit.service';
import { calculateOrderTotals } from '@/lib/services/order-calculation.service';
import type { UpdateOrderInput } from '@/lib/validations/edit-order-schemas';
import { getConditionPrefKind } from '@/lib/utils/condition-codes';
import { DEFAULT_ORDER_SOURCE_CODE } from '@/lib/constants/order-sources';
import { validateOrderSourceForCreation, type OrderSourceCatalogRow } from '@/lib/services/order-source-policy';

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
  packingPrefCode?: string;
  /** Piece-level service prefs (Enterprise-gated) */
  servicePrefs?: Array<{ preference_code: string; source: string; extra_price: number }>;
  /** Piece-level conditions (stains, damage, special) */
  conditions?: string[];
}

/** Service preference for order item (processing prefs: starch, perfume, etc.) */
export interface CreateOrderServicePref {
  preference_code: string;
  source: string;
  extra_price: number;
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
    /** Service preferences (starch, perfume, delicate, etc.) */
    servicePrefs?: CreateOrderServicePref[];
    /** Packing preference (hang, fold, box, etc.) */
    packingPrefCode?: string;
    packingPrefIsOverride?: boolean;
    packingPrefSource?: string;
    /** Aggregated charge from service prefs. Included in order total. */
    servicePrefCharge?: number;
  }>;
  isQuickDrop?: boolean;
  quickDropQuantity?: number;
  priority?: string;
  express?: boolean;
  customerNotes?: string;
  internalNotes?: string;
  paymentNotes?: string;
  paymentMethod?: string;
  readyByAt?: string; // ISO datetime string for ready-by date from screen
  /** B2B: Contract, cost center, PO */
  b2bContractId?: string;
  costCenterCode?: string;
  poNumber?: string;
  /** B2B: Credit limit override audit - set when admin overrides in payment modal */
  creditLimitOverrideBy?: string;
  creditLimitOverrideAt?: Date;
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
  /** FK to sys_order_sources_cd — sales / integration channel */
  orderSourceCode?: string;
  /** When set, overrides catalog-driven remote intake behavior */
  physicalIntakeStatus?: 'pending_dropoff' | 'received' | 'not_applicable';
  /** Optional escape hatch; normally derived from source + intake */
  initialWorkflowScreen?: string;
  /** Staff or integration notes before physical receipt */
  physicalIntakeInfo?: string | null;
  /** Staff or integration notes when goods are received at branch */
  receivedInfo?: string | null;
  /** Customer snapshot at order time (order-level, not customer master) */
  isDefaultCustomer?: boolean;
  customerMobile?: string;
  customerEmail?: string;
  customerName?: string;
  customerDetails?: Record<string, unknown>;
  /**
   * When set (e.g. public customer booking), used for Supabase writes. Cookie-based clients
   * have no staff JWT, so RLS `current_tenant_id()` fails unless this is the service-role client.
   */
  supabaseClient?: SupabaseClient;
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
    /** Service preference codes for SLA adjustment (extra_turnaround_minutes) */
    servicePrefs?: Array<{ preference_code: string }>;
  }>;
  isQuickDrop?: boolean;
  express?: boolean;
}

export interface EstimateReadyByResult {
  success: boolean;
  readyByAt?: string;
  error?: string;
}

export interface UpdateOrderParams extends Partial<UpdateOrderInput> {
  orderId: string;
  tenantId: string;
  userId: string;
  userName: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UpdateOrderResult {
  success: boolean;
  order?: any;
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
   * Shared workflow + physical-intake resolution for createOrder / createOrderInTransaction.
   * Remote channels (requires_remote_intake_confirm) use screen new_order → draft, null received_at.
   */
  private static async computeCreateOrderWorkflowState(args: {
    tenantId: string;
    items: CreateOrderParams['items'];
    isQuickDrop?: boolean;
    quickDropQuantity?: number;
    useOldWfCodeOrNew?: boolean;
    physicalIntakeStatus?: CreateOrderParams['physicalIntakeStatus'];
    initialWorkflowScreen?: string;
    sourceRow: OrderSourceCatalogRow;
  }): Promise<{
    v_initialStatus: string;
    v_transitionFrom: string;
    v_orderStatus: string;
    v_current_status: string;
    v_current_stage: string;
    physicalIntakeStatus: string;
    receivedAt: Date | null;
    contractScreen: string;
    isRetailOnlyOrder: boolean;
  }> {
    const {
      tenantId,
      items,
      isQuickDrop,
      quickDropQuantity,
      useOldWfCodeOrNew,
      physicalIntakeStatus,
      initialWorkflowScreen,
      sourceRow,
    } = args;

    const isRetailOnlyOrder =
      items.length > 0 && items.every((i) => i.serviceCategoryCode === 'RETAIL_ITEMS');

    if (isRetailOnlyOrder) {
      return {
        v_initialStatus: RETAIL_TERMINAL_STATUS,
        v_transitionFrom: RETAIL_TERMINAL_STATUS,
        v_orderStatus: RETAIL_TERMINAL_STATUS,
        v_current_status: RETAIL_TERMINAL_STATUS,
        v_current_stage: RETAIL_TERMINAL_STATUS,
        physicalIntakeStatus: 'received',
        receivedAt: new Date(),
        contractScreen: 'retail',
        isRetailOnlyOrder: true,
      };
    }

    let useRemoteIntake = false;
    if (physicalIntakeStatus === 'pending_dropoff') {
      useRemoteIntake = true;
    } else if (physicalIntakeStatus === 'received' || physicalIntakeStatus === 'not_applicable') {
      useRemoteIntake = false;
    } else {
      useRemoteIntake = sourceRow.requires_remote_intake_confirm;
    }

    if (useRemoteIntake) {
      const screen = initialWorkflowScreen ?? 'new_order';
      const contractStatus = await this.getInitialStatusFromContract(tenantId, screen, 'draft');
      return {
        v_initialStatus: contractStatus,
        v_transitionFrom: contractStatus,
        v_orderStatus: contractStatus,
        v_current_status: contractStatus,
        v_current_stage: contractStatus,
        physicalIntakeStatus: 'pending_dropoff',
        receivedAt: null,
        contractScreen: screen,
        isRetailOnlyOrder: false,
      };
    }

    let v_initialStatus: string;
    let v_transitionFrom: string;
    let v_orderStatus: string;
    let v_current_status: string;
    let v_current_stage: string;

    if (isQuickDrop === true && (items.length === 0 || (quickDropQuantity ?? 0) > items.length)) {
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

    let contractScreen = 'processing';
    if (useOldWfCodeOrNew === false) {
      const screen =
        isQuickDrop === true && (items.length === 0 || (quickDropQuantity ?? 0) > items.length)
          ? 'preparation'
          : 'processing';
      contractScreen = screen;
      const contractStatus = await this.getInitialStatusFromContract(
        tenantId,
        screen,
        v_current_status
      );
      v_current_status = contractStatus;
      v_orderStatus = contractStatus;
      v_initialStatus = contractStatus;
    }

    return {
      v_initialStatus,
      v_transitionFrom,
      v_orderStatus,
      v_current_status,
      v_current_stage,
      physicalIntakeStatus: 'received',
      receivedAt: new Date(),
      contractScreen,
      isRetailOnlyOrder: false,
    };
  }

  /**
   * Create new order with workflow logic
   * PRD-010: Quick Drop vs Normal order handling
   */
  static async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    try {
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
        isDefaultCustomer,
        customerMobile,
        customerEmail,
        customerName,
        customerDetails,
        supabaseClient,
      } = params;

      const supabase = supabaseClient ?? (await createClient());

      const orderSourceCode = (params.orderSourceCode ?? DEFAULT_ORDER_SOURCE_CODE).trim();
      const sourceValidated = await validateOrderSourceForCreation(tenantId, orderSourceCode);
      if (sourceValidated.ok === false) {
        return { success: false, error: sourceValidated.error };
      }

      const wf = await this.computeCreateOrderWorkflowState({
        tenantId,
        items,
        isQuickDrop,
        quickDropQuantity,
        useOldWfCodeOrNew,
        physicalIntakeStatus: params.physicalIntakeStatus,
        initialWorkflowScreen: params.initialWorkflowScreen,
        sourceRow: sourceValidated.row,
      });

      const {
        v_initialStatus,
        v_transitionFrom,
        v_orderStatus,
        v_current_status,
        v_current_stage,
        physicalIntakeStatus,
        receivedAt,
        contractScreen,
        isRetailOnlyOrder,
      } = wf;

      if (isRetailOnlyOrder) {
        logger.info('Retail order created with closed status (workflow skipped)', {
          tenantId,
          userId,
          feature: 'orders',
          action: 'create_order',
        });
      } else if (useOldWfCodeOrNew === false) {
        logger.info('Using new workflow system for order creation', {
          tenantId,
          userId,
          screen: contractScreen,
          contractStatus: v_current_status,
          isQuickDrop,
          physicalIntakeStatus,
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
      const subtotal =
        totals?.subtotal ??
        items.reduce(
          (sum, item) =>
            sum + item.totalPrice + (item.servicePrefCharge ?? 0),
          0
        );
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
        total_items:
          items.length > 0
            ? items.reduce((sum, item) => sum + item.quantity, 0)
            : quickDropQuantity || 0,
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
        order_source_code: orderSourceCode,
        physical_intake_status: physicalIntakeStatus,
        physical_intake_info: params.physicalIntakeInfo ?? null,
        received_info: params.receivedInfo ?? null,
        received_at: receivedAt ? receivedAt.toISOString() : null,
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
      if (params.paymentNotes != null) insertPayload.payment_notes = params.paymentNotes;
      if (isDefaultCustomer != null) insertPayload.is_default_customer = isDefaultCustomer;
      if (customerMobile != null && customerMobile !== '') {
        insertPayload.customer_mobile_number = customerMobile;
      }
      if (customerEmail != null && customerEmail !== '') {
        insertPayload.customer_email = customerEmail;
      }
      if (customerName != null && customerName !== '') {
        insertPayload.customer_name = customerName;
      }
      if (customerDetails != null && Object.keys(customerDetails).length > 0) {
        insertPayload.customer_details = customerDetails;
      }

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('org_orders_mst')
        .insert(insertPayload as any)
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
          branch_id: branchId ?? null,
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
          packing_pref_code: item.packingPrefCode ?? null,
          packing_pref_is_override: item.packingPrefIsOverride ?? false,
          packing_pref_source: item.packingPrefSource ?? null,
          service_pref_charge: item.servicePrefCharge ?? 0,
        }));

        const { error: itemsError, data: createdItems } = await supabase
          .from('org_order_items_dtl')
          .insert(itemsToInsert)
          .select();

        if (itemsError) {
          logger.error('Failed to create order items', new Error(itemsError.message), {
            tenantId,
            orderId: order.id,
            feature: 'orders',
            action: 'create_order',
          });
          await supabase
            .from('org_orders_mst')
            .delete()
            .eq('tenant_org_id', tenantId)
            .eq('id', order.id);
          return {
            success: false,
            error: 'Failed to create order items',
          };
        } else if (createdItems && createdItems.length > 0) {
          // Insert service preferences for items that have them
          const servicePrefsToInsert: Array<{
            tenant_org_id: string;
            order_id: string;
            prefs_no: number;
            prefs_level: string;
            order_item_id: string;
            preference_code: string;
            preference_sys_kind: string;
            prefs_source: string;
            extra_price: number;
            branch_id: string | null;
            created_by: string;
          }> = [];
          for (let i = 0; i < createdItems.length; i++) {
            const createdItem = createdItems[i];
            const itemData = items[i];
            const prefs = itemData?.servicePrefs;
            if (createdItem && prefs && prefs.length > 0) {
              prefs.forEach((pref, idx) => {
                servicePrefsToInsert.push({
                  tenant_org_id: tenantId,
                  order_id: order.id,
                  prefs_no: idx + 1,
                  prefs_level: 'ITEM',
                  order_item_id: createdItem.id,
                  preference_code: pref.preference_code,
                  preference_sys_kind: 'service_prefs',
                  prefs_source: pref.source,
                  extra_price: pref.extra_price,
                  branch_id: branchId ?? null,
                  created_by: userId,
                });
              });
            }
          }
          if (servicePrefsToInsert.length > 0) {
            const { error: prefsError } = await supabase
              .from('org_order_preferences_dtl')
              .insert(servicePrefsToInsert);
            if (prefsError) {
              logger.error('Failed to insert service preferences for order items', new Error(prefsError.message), {
                tenantId,
                orderId: order.id,
                feature: 'orders',
                action: 'create_order',
              });
              await supabase
                .from('org_orders_mst')
                .delete()
                .eq('tenant_org_id', tenantId)
                .eq('id', order.id);
              return {
                success: false,
                error: 'Failed to create order preferences',
              };
            }
          }

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
                    packingPrefCode: piece.packingPrefCode,
                    servicePrefs: piece.servicePrefs,
                    conditions: piece.conditions,
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
                  piecesData, // Pass piece-level data array
                  branchId ?? undefined,
                  supabase
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
      isDefaultCustomer,
      customerMobile,
      customerEmail,
      customerName,
      customerDetails,
      useOldWfCodeOrNew,
    } = params;

    const orderSourceCode = (params.orderSourceCode ?? DEFAULT_ORDER_SOURCE_CODE).trim();
    const sourceValidated = await validateOrderSourceForCreation(tenantId, orderSourceCode);
    if (sourceValidated.ok === false) {
      return { success: false, error: sourceValidated.error };
    }

    const wf = await OrderService.computeCreateOrderWorkflowState({
      tenantId,
      items,
      isQuickDrop,
      quickDropQuantity,
      useOldWfCodeOrNew,
      physicalIntakeStatus: params.physicalIntakeStatus,
      initialWorkflowScreen: params.initialWorkflowScreen,
      sourceRow: sourceValidated.row,
    });

    const {
      v_initialStatus,
      v_transitionFrom,
      v_orderStatus,
      v_current_status,
      v_current_stage,
      physicalIntakeStatus,
      receivedAt,
      isRetailOnlyOrder,
    } = wf;

    const orderNo = await generateOrderNumberWithTx(tx, tenantId);

    const subtotal =
      totals?.subtotal ??
      items.reduce(
        (sum, item) => sum + item.totalPrice + (item.servicePrefCharge ?? 0),
        0
      );
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
        total_items:
          items.length > 0
            ? items.reduce((sum, item) => sum + item.quantity, 0)
            : quickDropQuantity ?? 0,
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
        payment_notes: params.paymentNotes,
        created_by: userId,
        created_info: null,
        rec_status: 1,
        order_source_code: orderSourceCode,
        physical_intake_status: physicalIntakeStatus,
        physical_intake_info: params.physicalIntakeInfo ?? undefined,
        received_info: params.receivedInfo ?? undefined,
        received_at: receivedAt,
        ...(currencyCode && { currency_code: currencyCode, currency_ex_rate: currencyExRate }),
        ...(vatRate != null && { vat_rate: vatRate }),
        ...(vatAmount != null && { vat_amount: vatAmount }),
        ...(taxRate != null && { tax_rate: taxRate }),
        ...(discountRate != null && { discount_rate: discountRate }),
        ...readyByFields,
        ...(discountType != null && { discount_type: discountType }),
        ...(promoCodeId != null && { promo_code_id: promoCodeId }),
        ...(giftCardId != null && { gift_card_id: giftCardId }),
        ...(isDefaultCustomer != null && { is_default_customer: isDefaultCustomer }),
        ...(customerMobile != null && customerMobile !== '' && { customer_mobile_number: customerMobile }),
        ...(params.b2bContractId != null && { b2b_contract_id: params.b2bContractId }),
        ...(params.costCenterCode != null && params.costCenterCode !== '' && { cost_center_code: params.costCenterCode }),
        ...(params.poNumber != null && params.poNumber !== '' && { po_number: params.poNumber }),
        ...(params.creditLimitOverrideBy != null && { credit_limit_override_by: params.creditLimitOverrideBy }),
        ...(params.creditLimitOverrideAt != null && { credit_limit_override_at: params.creditLimitOverrideAt }),
        ...(customerEmail != null && customerEmail !== '' && { customer_email: customerEmail }),
        ...(customerName != null && customerName !== '' && { customer_name: customerName }),
        ...(customerDetails != null && Object.keys(customerDetails).length > 0 && { customer_details: customerDetails }),
        ...(promoDiscountAmount != null && { promo_discount_amount: promoDiscountAmount }),
        ...(giftCardDiscountAmount != null && { gift_card_discount_amount: giftCardDiscountAmount }),
        ...(paymentTypeCode != null && { payment_type_code: paymentTypeCode }),
      } as any,
    });

    if (items.length > 0) {
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        const createdItem = await tx.org_order_items_dtl.create({
          data: {
            order_id: order.id,
            tenant_org_id: tenantId,
            branch_id: branchId ?? null,
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
            packing_pref_code: item.packingPrefCode ?? null,
            packing_pref_is_override: item.packingPrefIsOverride ?? false,
            packing_pref_source: item.packingPrefSource ?? null,
            service_pref_charge: item.servicePrefCharge ?? 0,
          },
        });

        // Insert service preferences for this item (org_order_preferences_dtl, prefs_level=ITEM)
        const prefs = item.servicePrefs;
        if (prefs && prefs.length > 0) {
          await tx.org_order_preferences_dtl.createMany({
            data: prefs.map((pref, idx) => ({
              tenant_org_id: tenantId,
              order_id: order.id,
              prefs_no: idx + 1,
              prefs_level: 'ITEM',
              order_item_id: createdItem.id,
              preference_code: pref.preference_code,
              preference_sys_kind: 'service_prefs',
              prefs_source: pref.source,
              extra_price: pref.extra_price,
              branch_id: branchId ?? null,
              created_by: userId,
            })),
          });
        }

        // Always create pieces for each order item
        if (item.quantity > 0) {
          const pricePerPiece = item.totalPrice / item.quantity;

          for (let i = 0; i < item.quantity; i++) {
            const pieceInput = item.pieces?.[i];

            const createdPiece = await tx.org_order_item_pieces_dtl.create({
              data: {
                tenant_org_id: tenantId,
                order_id: order.id,
                order_item_id: createdItem.id,
                branch_id: branchId ?? null,
                piece_seq: i + 1,
                service_category_code: item.serviceCategoryCode,
                product_id: item.productId,
                scan_state: 'expected',
                quantity: 1,
                price_per_unit: pricePerPiece,
                total_price: pricePerPiece,
                piece_status: v_initialStatus,
                is_rejected: false,
                is_ready: false,
                color: pieceInput?.color ? { codes: [pieceInput.color], primary: pieceInput.color } : undefined,
                notes: pieceInput?.notes ?? null,
                has_stain: pieceInput?.hasStain ?? false,
                has_damage: pieceInput?.hasDamage ?? false,
              },
            });

            // Save piece conditions to org_order_preferences_dtl
            const conditions = pieceInput?.conditions ?? [];
            if (conditions.length > 0) {
              await tx.org_order_preferences_dtl.createMany({
                data: conditions.map((code, cidx) => {
                  const { preference_code, preference_sys_kind } = getConditionPrefKind(code);
                  return {
                    tenant_org_id: tenantId,
                    order_id: order.id,
                    prefs_no: cidx + 1,
                    prefs_level: 'PIECE',
                    order_item_id: createdItem.id,
                    order_item_piece_id: createdPiece.id,
                    preference_code,
                    preference_sys_kind,
                    prefs_source: 'ORDER_CREATE',
                    extra_price: 0,
                    branch_id: branchId ?? null,
                    created_by: userId,
                  };
                }),
              });
            }

            // Save piece-level service prefs to org_order_preferences_dtl
            const piecePrefs = pieceInput?.servicePrefs ?? [];
            if (piecePrefs.length > 0) {
              await tx.org_order_preferences_dtl.createMany({
                data: piecePrefs.map((pref, pidx) => ({
                  tenant_org_id: tenantId,
                  order_id: order.id,
                  prefs_no: conditions.length + pidx + 1,
                  prefs_level: 'PIECE',
                  order_item_id: createdItem.id,
                  order_item_piece_id: createdPiece.id,
                  preference_code: pref.preference_code,
                  preference_sys_kind: 'service_prefs',
                  prefs_source: pref.source,
                  extra_price: pref.extra_price,
                  branch_id: branchId ?? null,
                  created_by: userId,
                })),
              });
            }
          }
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

      // Add extra minutes from service preferences (SLA adjustment, migration 0139)
      let extraMinutes = 0;
      const prefCodes = [...new Set(items.flatMap((i) => i.servicePrefs?.map((p) => p.preference_code) ?? []))];
      if (prefCodes.length > 0) {
        const { data: prefs } = await supabase
          .from('sys_service_preference_cd')
          .select('code, extra_turnaround_minutes')
          .in('code', prefCodes);
        extraMinutes = (prefs ?? []).reduce((sum, p) => {
          const itemCount = items.filter((i) => i.servicePrefs?.some((sp) => sp.preference_code === p.code)).length;
          return sum + (p.extra_turnaround_minutes ?? 0) * Math.max(1, itemCount);
        }, 0);
      }

      // Apply priority multiplier if express
      const multiplier = express ? 0.5 : 1.0;
      const finalTurnaround = maxTurnaround * multiplier;

      // Calculate ready-by date (base hours + extra minutes from prefs)
      const readyByAt = new Date(Date.now() + finalTurnaround * 60 * 60 * 1000 + extraMinutes * 60 * 1000);

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
            branch_id: (item as any).branch_id ?? suborder.branch_id ?? null,
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

  /**
   * Update an existing order
   * PRD: Edit Order Feature - Backend Service
   *
   * Validates editability, manages locks, updates items/pieces, recalculates totals,
   * creates audit trail
   */
  static async updateOrder(params: UpdateOrderParams): Promise<UpdateOrderResult> {
    const {
      orderId,
      tenantId,
      userId,
      userName,
      ipAddress,
      userAgent,
      customerId,
      branchId,
      notes,
      customerNotes,
      paymentNotes,
      readyByAt,
      express,
      items,
      customerName,
      customerMobile,
      customerEmail,
      isDefaultCustomer,
      customerDetails,
      recalculate = false,
      expectedUpdatedAt,
      isQuickDrop,
      quickDropQuantity,
    } = params;

    try {
      // 1. Fetch existing order with items (use Prisma for consistency with GET - bypasses Supabase RLS)
      const orderFromDb = await getOrderById(tenantId, orderId);
      if (!orderFromDb) {
        return {
          success: false,
          error: 'Order not found',
        };
      }

      // Map to shape expected by rest of updateOrder (snake_case, items with product_id)
      const existingOrder = {
        ...orderFromDb,
        items: (orderFromDb.items ?? []).map((item: { id: string; product_id?: string; quantity?: number; price_per_unit?: unknown; total_price?: unknown; notes?: string; has_stain?: boolean; has_damage?: boolean }) => ({
          id: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price_per_unit: item.price_per_unit,
          total_price: item.total_price,
          notes: item.notes,
          has_stain: item.has_stain,
          has_damage: item.has_damage,
        })),
        ready_by_at: (orderFromDb as { ready_by?: Date; ready_by_at_new?: Date }).ready_by_at_new ?? (orderFromDb as { ready_by?: Date }).ready_by ?? null,
      };

      // 2. Validate editability
      const editabilityCheck = isOrderEditable(existingOrder);
      if (!editabilityCheck.canEdit) {
        return {
          success: false,
          error: editabilityCheck.reason || 'Order cannot be edited',
        };
      }

      // 3. Check for active lock
      const lockStatus = await checkOrderLock(orderId, tenantId);
      if (lockStatus.isLocked && lockStatus.lock?.lockedBy !== userId) {
        return {
          success: false,
          error: `Order is locked by ${lockStatus.lock?.lockedByName || 'another user'}`,
        };
      }

      // 4. Optimistic locking check
      if (expectedUpdatedAt) {
        const existingUpdatedAt = new Date(existingOrder.updated_at);
        const expectedDate = new Date(expectedUpdatedAt);
        if (existingUpdatedAt.getTime() !== expectedDate.getTime()) {
          return {
            success: false,
            error: 'Order has been modified by another user. Please refresh and try again.',
          };
        }
      }

      // 5. Create snapshot_before
      const snapshotBefore = {
        order: {
          id: existingOrder.id,
          orderNo: existingOrder.order_no,
          customerId: existingOrder.customer_id,
          branchId: existingOrder.branch_id,
          notes: existingOrder.internal_notes,
          customerNotes: existingOrder.customer_notes,
          paymentNotes: existingOrder.payment_notes,
          readyByAt: existingOrder.ready_by_at,
          express: existingOrder.priority_multiplier === 0.5,
          subtotal: existingOrder.subtotal,
          discount: existingOrder.discount,
          tax: existingOrder.tax,
          total: existingOrder.total,
          customerName: existingOrder.customer_name,
          customerMobile: existingOrder.customer_mobile_number,
          customerEmail: existingOrder.customer_email,
          isQuickDrop: existingOrder.is_order_quick_drop,
          quickDropQuantity: existingOrder.quick_drop_quantity,
        },
        items: existingOrder.items?.map((item: any) => ({
          id: item.id,
          productId: item.product_id,
          productName: item.product_name ?? item.productName ?? null,
          quantity: item.quantity,
          pricePerUnit: item.price_per_unit,
          totalPrice: item.total_price,
          notes: item.notes ?? null,
          hasStain: item.has_stain ?? null,
          hasDamage: item.has_damage ?? null,
          stainNotes: item.stain_notes ?? null,
          damageNotes: item.damage_notes ?? null,
        })) || [],
      };

      // 6. Use Prisma transaction for atomic updates
      const result = await prisma.$transaction(async (tx) => {
        // 7. Delete old items/pieces if items array provided
        if (items && items.length >= 0) {
          // Delete all pieces first
          await tx.org_order_item_pieces_dtl.deleteMany({
            where: {
              order_id: orderId,
              tenant_org_id: tenantId,
            },
          });

          // Delete all items
          await tx.org_order_items_dtl.deleteMany({
            where: {
              order_id: orderId,
              tenant_org_id: tenantId,
            },
          });
        }

        // 8. Recalculate totals if items changed or recalculate flag set
        let subtotal = existingOrder.subtotal;
        let discount = existingOrder.discount;
        let tax = existingOrder.tax;
        let total = existingOrder.total;
        let vatRate = (existingOrder as any).vat_rate;
        let vatAmount = (existingOrder as any).vat_amount;

        if ((items && items.length > 0) || recalculate) {
          if (items && items.length > 0) {
            // Calculate from new items
            const calculationResult = await calculateOrderTotals({
              tenantId,
              branchId: branchId ?? existingOrder.branch_id,
              items: items.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
              })),
              customerId: customerId ?? existingOrder.customer_id,
              isExpress: express ?? existingOrder.priority_multiplier === 0.5,
              userId,
            });

            subtotal = calculationResult.subtotal;
            discount = calculationResult.manualDiscount + calculationResult.promoDiscount;
            tax = calculationResult.taxAmount;
            total = calculationResult.finalTotal;
            vatRate = calculationResult.taxRate;
            vatAmount = calculationResult.vatValue;
          }
        }

        // 9. Create new items/pieces
        if (items && items.length > 0) {
          const orderNo = existingOrder.order_no;
          const v_initialStatus = existingOrder.current_status || 'processing';
          const v_transitionFrom = existingOrder.current_stage || 'intake';

          for (let index = 0; index < items.length; index++) {
            const item = items[index];

            // Create item (omit undefined - Prisma rejects undefined for optional fields)
            const createdItem = await tx.org_order_items_dtl.create({
              data: {
                order_id: orderId,
                tenant_org_id: tenantId,
                branch_id: branchId ?? existingOrder.branch_id ?? null,
                service_category_code: item.serviceCategoryCode || 'GENERAL',
                order_item_srno: `${orderNo}-${index + 1}`,
                product_id: item.productId,
                quantity: item.quantity,
                price_per_unit: item.pricePerUnit,
                total_price: item.totalPrice,
                status: 'pending',
                item_status: v_initialStatus,
                item_stage: v_transitionFrom,
                created_by: userId,
                rec_status: 1,
                ...(item.notes != null && { notes: item.notes }),
                ...(item.hasStain != null && { has_stain: item.hasStain }),
                ...(item.hasDamage != null && { has_damage: item.hasDamage }),
                ...(item.stainNotes != null && { stain_notes: item.stainNotes }),
                ...(item.damageNotes != null && { damage_notes: item.damageNotes }),
              },
            });

            // Create pieces for item
            const piecesData = item.pieces && item.pieces.length > 0
              ? item.pieces.map((piece, idx) => ({
                pieceSeq: piece.pieceSeq || idx + 1,
                color: piece.color,
                brand: piece.brand,
                hasStain: piece.hasStain ?? item.hasStain,
                hasDamage: piece.hasDamage ?? item.hasDamage,
                notes: piece.notes || item.notes,
                rackLocation: piece.rackLocation,
                metadata: piece.metadata || {},
                packingPrefCode: (piece as any).packingPrefCode,
                servicePrefs: (piece as any).servicePrefs,
                conditions: (piece as any).conditions,
              }))
              : undefined;

            // Use the tx-aware method: runs entirely within the Prisma transaction
            // so all writes are atomic and visible to each other without isolation gaps.
            await OrderPieceService.createPiecesForItemWithTx(
              tx,
              tenantId,
              orderId,
              createdItem.id,
              item.quantity,
              {
                serviceCategoryCode: item.serviceCategoryCode || 'GENERAL',
                productId: item.productId,
                pricePerUnit: item.pricePerUnit,
                totalPrice: item.totalPrice,
                hasStain: item.hasStain,
                hasDamage: item.hasDamage,
                notes: item.notes,
                metadata: {},
              },
              piecesData,
              branchId ?? existingOrder.branch_id ?? undefined
            );
          }
        }

        // 10. Update order master fields
        const updateData: any = {
          updated_at: new Date(),
          updated_by: userId,
        };

        if (customerId !== undefined) updateData.customer_id = customerId;
        if (branchId !== undefined) updateData.branch_id = branchId;
        if (notes !== undefined) updateData.internal_notes = notes;
        if (customerNotes !== undefined) updateData.customer_notes = customerNotes;
        if (paymentNotes !== undefined) updateData.payment_notes = paymentNotes;
        if (readyByAt !== undefined) {
          updateData.ready_by = readyByAt;
          updateData.ready_by_at_new = readyByAt;
        }
        if (express !== undefined) updateData.priority_multiplier = express ? 0.5 : 1.0;
        if (customerName !== undefined) updateData.customer_name = customerName;
        if (customerMobile !== undefined) updateData.customer_mobile_number = customerMobile;
        if (customerEmail !== undefined) updateData.customer_email = customerEmail;
        if (isDefaultCustomer !== undefined) updateData.is_default_customer = isDefaultCustomer;
        if (customerDetails !== undefined) updateData.customer_details = customerDetails;
        if (isQuickDrop !== undefined) updateData.is_order_quick_drop = isQuickDrop;
        if (quickDropQuantity !== undefined) updateData.quick_drop_quantity = quickDropQuantity;

        // Update totals if changed
        if (items && items.length >= 0) {
          updateData.subtotal = subtotal;
          updateData.discount = discount;
          updateData.tax = tax;
          updateData.total = total;
          updateData.vat_rate = vatRate;
          updateData.vat_amount = vatAmount;
          updateData.total_items = items.length;
        }

        const updatedOrder = await tx.org_orders_mst.update({
          where: {
            id: orderId,
            tenant_org_id: tenantId,
          },
          data: updateData,
        });

        return updatedOrder;
      });

      // 11. Fetch updated order with items for snapshot_after (use Prisma)
      const updatedOrderWithItems = await prisma.org_orders_mst.findUnique({
        where: { id: orderId, tenant_org_id: tenantId },
        include: { org_order_items_dtl: { orderBy: { created_at: 'asc' } } },
      });

      if (!updatedOrderWithItems) {
        logger.error('[updateOrder] Order not found after update', undefined, {
          feature: 'orders',
          action: 'update_order',
          orderId,
          tenantId,
        });
        return {
          success: false,
          error: 'Order not found',
        };
      }

      const readyByAtVal = updatedOrderWithItems.ready_by_at_new ?? updatedOrderWithItems.ready_by ?? null;

      // 12. Create snapshot_after
      // Build product name lookup from input items (DB re-fetch doesn't join product names)
      const inputItemNameMap = new Map<string, string>(
        (items ?? []).map((i) => [i.productId, i.productName ?? i.productId.slice(0, 8)])
      );

      const snapshotAfter = {
        order: {
          id: updatedOrderWithItems.id,
          orderNo: updatedOrderWithItems.order_no,
          customerId: updatedOrderWithItems.customer_id,
          branchId: updatedOrderWithItems.branch_id,
          notes: updatedOrderWithItems.internal_notes,
          customerNotes: updatedOrderWithItems.customer_notes,
          paymentNotes: updatedOrderWithItems.payment_notes,
          readyByAt: readyByAtVal,
          express: Number(updatedOrderWithItems.priority_multiplier) === 0.5,
          subtotal: updatedOrderWithItems.subtotal,
          discount: updatedOrderWithItems.discount,
          tax: updatedOrderWithItems.tax,
          total: updatedOrderWithItems.total,
          customerName: updatedOrderWithItems.customer_name,
          customerMobile: updatedOrderWithItems.customer_mobile_number,
          customerEmail: updatedOrderWithItems.customer_email,
          isQuickDrop: updatedOrderWithItems.is_order_quick_drop,
          quickDropQuantity: updatedOrderWithItems.quick_drop_quantity,
        },
        items: (updatedOrderWithItems.org_order_items_dtl ?? []).map((item) => {
          const inputItem = (items ?? []).find((i) => i.productId === item.product_id);
          return {
            id: item.id,
            productId: item.product_id,
            productName: inputItemNameMap.get(item.product_id ?? '') ?? (item as any).product_name ?? null,
            quantity: item.quantity,
            pricePerUnit: item.price_per_unit,
            totalPrice: item.total_price,
            notes: item.notes ?? null,
            hasStain: item.has_stain ?? null,
            hasDamage: item.has_damage ?? null,
            stainNotes: inputItem?.stainNotes ?? (item as any).stain_notes ?? null,
            damageNotes: inputItem?.damageNotes ?? (item as any).damage_notes ?? null,
          };
        }),
      };

      // 13. Create audit entry
      await createEditAudit({
        tenantId,
        orderId,
        orderNo: existingOrder.order_no,
        editedBy: userId,
        editedByName: userName,
        ipAddress,
        userAgent,
        snapshotBefore,
        snapshotAfter,
        paymentAdjusted: false, // Phase 5: will implement payment adjustment
        paymentAdjustmentAmount: undefined,
        paymentAdjustmentType: undefined,
      });

      // 14. Unlock order
      try {
        await unlockOrder({
          orderId,
          tenantId,
          userId,
        });
      } catch (unlockError) {
        // Log but don't fail - lock will expire anyway
        logger.warn('[updateOrder] Failed to unlock order', {
          feature: 'orders',
          action: 'update_order',
          orderId,
          error: unlockError instanceof Error ? unlockError.message : 'Unknown error',
        });
      }

      logger.info('[updateOrder] Order updated successfully', {
        feature: 'orders',
        action: 'update_order',
        orderId,
        userId,
        itemsChanged: items ? items.length : 0,
      });

      return {
        success: true,
        order: updatedOrderWithItems,
      };
    } catch (error) {
      logger.error('[updateOrder] Failed to update order', error as Error, {
        feature: 'orders',
        action: 'update_order',
        orderId,
        userId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update order',
      };
    }
  }
}

// Re-export lock service functions for convenience
export { lockOrderForEdit, unlockOrder, checkOrderLock } from '@/lib/services/order-lock.service';

