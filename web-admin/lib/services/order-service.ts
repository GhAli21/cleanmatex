/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param */
/**
 * OrderService
 * Core business logic for order operations
 * PRD-010: Advanced Order Management with workflow support
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { type OrderPreferencesSourceDefault } from './order-piece-service';
import { resolveOrderCreateWorkflowState } from '@/lib/services/workflow/order-create-workflow.service';
import { generateOrderNumberWithTx } from '@/lib/utils/order-number-generator';
import type { CheckoutQuote } from '@/lib/services/commercial/commercial-checkout.service';
import { openCommercialCreateSession } from '@/lib/services/commercial/commercial-create.session';
import {
  splitOrderUnits,
  buildSplitLines,
  ORDER_SPLIT_ERRORS,
  type OrderSplitResult,
} from '@/lib/services/order-split.service';
import { getConditionPrefKind } from '@/lib/utils/condition-codes';
import { DEFAULT_ORDER_SOURCE_CODE, type OrderSourceCode } from '@/lib/constants/order-sources';
import type { OrderStatus } from '@/lib/types/workflow';
import { PAYMENT_METHODS, PAYMENT_TYPE_IDS } from '@/lib/constants/payment';
import { validateOrderSourceForCreation, type OrderSourceCatalogRow } from '@/lib/services/order-source-policy';
import { effectivePieceColorsForPersist } from '@/lib/utils/order-piece-color-persist';
import { fetchOrgPackingExtraPriceByCodesPrismaTx } from '@/lib/utils/org-packing-extra-price';
import { fetchOrgServicePreferenceCfIdsByCodesPrismaTx } from '@/lib/utils/org-service-preference-cf-lookup';
import type { PreferenceSnapshot } from '@/lib/utils/order-preference-snapshot';
import {
  normalizePieceColorCodes,
  type PieceSnapshot,
} from '@/lib/utils/order-piece-snapshot';
import {
  DEFAULT_PRIORITY,
  ORDER_ISSUE_ERROR,
  ORDER_ISSUE_SCOPE,
  ORDER_ISSUE_STATUS,
  type OrderIssueScope,
} from '@/lib/constants/order-issues';
import { lookupAuditActors } from '@/lib/services/audit-actor.service';
import {
  getIssueTypesByCodes,
  getPrioritiesByCodes,
  isActiveIssueType,
  isActivePriority,
} from '@/lib/services/lookups';
import {
  resolveWorkflowProfileBindingForOrderWithPrisma,
  WorkflowProfileResolutionError,
} from '@/lib/services/workflow/workflow-profile-resolution.service';
import { SemanticInitialStatusResolutionError } from '@/lib/services/workflow/initial-status-resolver.service';
import { OrderCreatePresetError } from '@/lib/services/workflow/order-create-hydrator';
import {
  staffEnForWorkflowProfileError,
} from '@/lib/services/workflow/workflow-profile-error-catalog';

/** The only channel whose retail orders may be paid later (on collection). */
const ONLINE_RETAIL_PAY_LATER_SOURCE = 'customer_mobile_app' satisfies OrderSourceCode;

/** Statuses at or past handover: an unpaid order must never start in one. */
const HANDED_OVER_STATUSES: ReadonlySet<string> = new Set<OrderStatus>(['out_for_delivery', 'delivered', 'closed']);

function createOrderFailureFromProfileError(error: unknown): CreateOrderResult | null {
  if (error instanceof SemanticInitialStatusResolutionError) {
    return {
      success: false,
      error: staffEnForWorkflowProfileError(error.code) ?? error.message,
      errorCode: error.code,
    };
  }
  if (error instanceof OrderCreatePresetError) {
    return {
      success: false,
      error: staffEnForWorkflowProfileError(error.code) ?? error.message,
      errorCode: error.code,
    };
  }
  if (error instanceof WorkflowProfileResolutionError) {
    return {
      success: false,
      error: staffEnForWorkflowProfileError(error.code, error.details) ?? error.message,
      errorCode: error.code,
      ...(error.details.serviceCode ? { serviceCode: error.details.serviceCode } : {}),
    };
  }
  return null;
}

/** Packing codes from order item payload (ITEM + piece rows). */
function collectPackingPrefCodesFromOrderPayload(
  orderItems: ReadonlyArray<{
    packingPrefCode?: string;
    pieces?: ReadonlyArray<{ packingPrefCode?: string }>;
  }>
): string[] {
  const c: string[] = [];
  for (const it of orderItems) {
    if (it.packingPrefCode) c.push(it.packingPrefCode);
    for (const p of it.pieces ?? []) {
      if (p.packingPrefCode) c.push(p.packingPrefCode);
    }
  }
  return c;
}

/** Catalog `preference_code` values for all piece-level conditions on the order (stain / damage / special). */
function collectConditionCatalogCodesFromOrderItems(
  orderItems: ReadonlyArray<{
    pieces?: ReadonlyArray<{ conditions?: string[] }>;
  }>
): string[] {
  const set = new Set<string>();
  for (const it of orderItems) {
    for (const p of it.pieces ?? []) {
      for (const uiCode of p.conditions ?? []) {
        set.add(getConditionPrefKind(uiCode).preference_code);
      }
    }
  }
  return [...set];
}

function inferredPackingLineChargeOnCreateItem(
  item: CreateOrderParams['items'][number],
  map: Map<string, number>
): number {
  const pcs = item.pieces ?? [];
  if (pcs.length === 0) {
    return item.packingPrefCode ? map.get(item.packingPrefCode) ?? 0 : 0;
  }
  let sum = 0;
  for (const p of pcs) {
    const code = p.packingPrefCode ?? item.packingPrefCode;
    if (code) sum += map.get(code) ?? 0;
  }
  return sum;
}

function persistedServicePrefChargeColumn(
  item: CreateOrderParams['items'][number],
  packingMap: Map<string, number>
): number {
  const packingLine =
    item.packingPrefCharge !== undefined && item.packingPrefCharge !== null
      ? Number(item.packingPrefCharge)
      : inferredPackingLineChargeOnCreateItem(item, packingMap);
  return (item.servicePrefCharge ?? 0) + packingLine;
}

/** Prisma transaction client for use inside $transaction */
type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export interface CreateOrderPieceData {
  pieceSeq: number;
  color?: string;
  colorCodes?: string[];
  /** Tenant CF ids for `color` rows — `org_service_preference_cf.id` */
  colorCfIds?: (string | null | undefined)[];
  brand?: string;
  hasStain?: boolean;
  hasDamage?: boolean;
  notes?: string;
  rackLocation?: string;
  metadata?: Record<string, any>;
  packingPrefCode?: string;
  packingCfId?: string | null;
  /** Piece-level service prefs (Enterprise-gated) */
  servicePrefs?: Array<{
    preference_code: string;
    source?: string;
    extra_price?: number;
    preferenceCfId?: string | null;
  }>;
  /** Piece-level conditions (stains, damage, special) */
  conditions?: string[];
}

/** Service preference for order item (processing prefs: starch, perfume, etc.) */
export interface CreateOrderServicePref {
  preference_code: string;
  source?: string;
  extra_price?: number;
  preferenceCfId?: string | null;
}

export interface CreateOrderParams {
  tenantId: string;
  customerId: string;
  branchId?: string;
  orderTypeId: string;
  items: Array<{
    /** Null for a custom item (P5-03e): the line has no catalog product. */
    productId?: string | null;
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
    packingCfId?: string | null;
    /** Line packing surcharge from catalog (`org_packing_preference_cf.extra_price`); included in persisted `service_pref_charge` plus preference row `extra_price`. */
    packingPrefCharge?: number;
    /** Aggregated charge from service prefs. Included in order total. */
    servicePrefCharge?: number;
    /** PF-01: overridden unit price; permission and reason are enforced by the submit orchestrator. */
    priceOverride?: number | null;
    /** PF-01: reason recorded with the override (`override_reason`). */
    overrideReason?: string | null;
  }>;
  /** B18 — order-level preferences (`org_order_preferences_dtl.prefs_level='ORDER'`), independent of any item. */
  orderServicePrefs?: CreateOrderServicePref[];
  /**
   * P5-02: the checkout quote the submit was checked against. When set, every
   * line-money column, preference price, discount, charge and tax row comes
   * from it (line `i` = quote line `L{i+1}`); client prices are ignored.
   * Only `createOrderInTransaction` reads it.
   */
  commercial: CheckoutQuote;
  isQuickDrop?: boolean;
  quickDropQuantity?: number;
  priority?: string;
  express?: boolean;
  customerNotes?: string;
  internalNotes?: string;
  paymentNotes?: string;
  paymentMethod?: string;
  idempotencyKey?: string;
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
  totals?: { subtotal: number; discount?: number; tax?: number; total: number; vatRate?: number; taxRate?: number; roundingAdjustment?: number; chargesTotal?: number };
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
  errorCode?: string;
  serviceCode?: string;
}

export class OrderService {
  /**
   * Workflow + create-hydration resolution for `createOrderInTransaction`.
   * Initial status and column stamps come from profile Initial rules + presets.
   */
  private static async computeCreateOrderWorkflowState(args: {
    tenantId: string;
    items: CreateOrderParams['items'];
    isQuickDrop?: boolean;
    quickDropQuantity?: number;
    physicalIntakeStatus?: CreateOrderParams['physicalIntakeStatus'];
    initialWorkflowScreen?: string;
    orderTypeId?: string | null;
    sourceRow: OrderSourceCatalogRow;
    semanticInitialRules: Parameters<typeof resolveOrderCreateWorkflowState>[0]['semanticInitialRules'];
    userId?: string | null;
    physicalIntakeInfo?: string | null;
    receivedInfo?: string | null;
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
    hydrated: Awaited<ReturnType<typeof resolveOrderCreateWorkflowState>>['hydrated'];
  }> {
    const resolved = await resolveOrderCreateWorkflowState({
      items: args.items.map((item) => ({
        serviceCategoryCode: item.serviceCategoryCode ?? 'GENERAL',
      })),
      isQuickDrop: args.isQuickDrop,
      physicalIntakeStatus: args.physicalIntakeStatus,
      initialWorkflowScreen: args.initialWorkflowScreen,
      orderTypeId: args.orderTypeId,
      sourceRow: args.sourceRow,
      semanticInitialRules: args.semanticInitialRules,
      userId: args.userId,
      physicalIntakeInfo: args.physicalIntakeInfo,
      receivedInfo: args.receivedInfo,
    });

    return {
      v_initialStatus: resolved.v_initialStatus,
      v_transitionFrom: resolved.v_transitionFrom,
      v_orderStatus: resolved.v_orderStatus,
      v_current_status: resolved.v_current_status,
      v_current_stage: resolved.v_current_stage,
      physicalIntakeStatus: resolved.physicalIntakeStatus,
      receivedAt: resolved.receivedAt,
      contractScreen: resolved.contractScreen,
      isRetailOnlyOrder: resolved.isRetailOnlyOrder,
      hydrated: resolved.hydrated,
    };
  }

  /**
   * Create an order within the caller's Prisma transaction: the only order writer.
   * Callers price it first (`quoteCheckout`) and pass the quote as `commercial`;
   * see `order-create-from-checkout.service.ts`. All operations use tx, so if any
   * step fails the whole transaction rolls back.
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
      orderServicePrefs,
      isQuickDrop,
      quickDropQuantity,
      priority,
      express,
      customerNotes,
      internalNotes,
      paymentMethod,
      idempotencyKey,
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
    } = params;

    const orderSourceCode = (params.orderSourceCode ?? DEFAULT_ORDER_SOURCE_CODE).trim();
    const sourceValidated = await validateOrderSourceForCreation(tenantId, orderSourceCode);
    if (sourceValidated.ok === false) {
      return { success: false, error: sourceValidated.error };
    }
    // P5-02: line money comes from the checkout quote.
    const commercial = openCommercialCreateSession(params.commercial);
    /** Server price of a preference row when Create is quote-driven; otherwise the given legacy value. */
    const prefPrice = (sysKind: string, code: string, legacy: number | Prisma.Decimal | string) =>
      (commercial.preferencePrice(sysKind, code)) ?? legacy;

    let wf: Awaited<ReturnType<typeof OrderService.computeCreateOrderWorkflowState>>;
    let workflowProfileBinding: Awaited<ReturnType<typeof resolveWorkflowProfileBindingForOrderWithPrisma>>;
    try {
      workflowProfileBinding = await resolveWorkflowProfileBindingForOrderWithPrisma(tx, {
        tenantId,
        branchId,
        serviceCodes: items.flatMap((item) => item.serviceCategoryCode ? [item.serviceCategoryCode] : []),
      });

      wf = await OrderService.computeCreateOrderWorkflowState({
        tenantId,
        items,
        isQuickDrop,
        quickDropQuantity,
        physicalIntakeStatus: params.physicalIntakeStatus,
        initialWorkflowScreen: params.initialWorkflowScreen,
        orderTypeId,
        sourceRow: sourceValidated.row,
        semanticInitialRules: workflowProfileBinding.initialRules,
        userId,
        physicalIntakeInfo: params.physicalIntakeInfo,
        receivedInfo: params.receivedInfo,
      });
    } catch (error) {
      const profileFailure = createOrderFailureFromProfileError(error);
      if (profileFailure) return profileFailure;
      throw error;
    }

    const {
      v_initialStatus,
      v_transitionFrom,
      v_orderStatus,
      v_current_status,
      v_current_stage,
      physicalIntakeStatus,
      receivedAt,
      isRetailOnlyOrder,
      hydrated,
    } = wf;

    // T03: retail sold at the counter must be paid there; do not rely on the client-side block alone.
    // Paid later by method (staff) or by payment type (a channel with no payment, e.g. booking).
    const paidLater = paymentMethod === PAYMENT_METHODS.PAY_ON_COLLECTION
      || paymentTypeCode === PAYMENT_TYPE_IDS.PAY_ON_COLLECTION
      || paymentTypeCode === PAYMENT_TYPE_IDS.PAY_ON_DELIVERY;
    if (isRetailOnlyOrder && paidLater) {
      // Owner rule (2026-10-30): only a customer-app retail order may be paid later, as
      // PAY_ON_COLLECTION (the type the pickup/delivery collection gates hold until paid),
      // and only when it starts before handover so the balance is collected on release.
      const onlinePayOnCollection = orderSourceCode === ONLINE_RETAIL_PAY_LATER_SOURCE
        && paymentTypeCode === PAYMENT_TYPE_IDS.PAY_ON_COLLECTION
        && paymentMethod !== PAYMENT_METHODS.PAY_ON_COLLECTION;
      if (!onlinePayOnCollection) {
        return {
          success: false,
          errorCode: 'RETAIL_PAY_ON_COLLECTION_NOT_ALLOWED',
          error: 'Retail orders must be paid at POS. Please select Cash or Card.',
        };
      }
      if (HANDED_OVER_STATUSES.has(v_initialStatus)) {
        return {
          success: false,
          errorCode: 'RETAIL_PAY_LATER_STARTS_HANDED_OVER',
          error: `The workflow profile starts this retail order as "${v_initialStatus}"; an unpaid order must start before handover.`,
        };
      }
    }

    const orderNo = await generateOrderNumberWithTx(tx, tenantId);

    /** Piece-level preference rows on order create (distinct from ORDER_EDIT on update). */
    const prefsSourceOnCreate: OrderPreferencesSourceDefault = 'ORDER_CREATE';

    const subtotal =
      totals?.subtotal ??
      items.reduce(
        (sum, item) => sum + item.totalPrice + (item.servicePrefCharge ?? 0),
        0
      );
    const discount = totals?.discount ?? 0;
    // A calculated order stores its whole tax (every tax line), so the header
    // agrees with org_order_taxes_dtl from the first insert.
    const tax = Number(params.commercial.quote.result.totals.taxTotal.toFixed(4));
    const total = totals?.total ?? subtotal - discount + tax;
    const vatRate = totals?.vatRate;
    const taxRate = totals?.taxRate;
    const roundingAdjustment = totals?.roundingAdjustment ?? 0;
    const chargesTotal = totals?.chargesTotal ?? 0;
    const currencyCode = passedCurrencyCode;
    const currencyExRate = passedCurrencyExRate ?? 1;
    const primaryServiceCategory = items[0]?.serviceCategoryCode || null;

    const workflowProfile = workflowProfileBinding;
    const v_workflowTemplateId = workflowProfile.basedOnTemplateId;

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
        wf_profile_id: workflowProfile.profileId,
        wf_version_no: workflowProfile.versionNo,
        wf_profile_version_id: workflowProfile.versionId,
        // wf_profile_artifact_id/checksum/schema_version: retired
        // compiled-artifact fields (Gate 5, ADR-SAAS-MNG-0010) — always null
        // for new orders. wf_profile_revision is the one field here that
        // still carries a real, useful value: the live policy_revision at
        // create time, kept for audit traceability only (nothing re-reads it
        // to make a decision).
        wf_profile_artifact_id: null,
        wf_profile_revision: workflowProfile.policyRevision,
        wf_profile_checksum: null,
        wf_profile_schema_version: null,
        current_status: v_current_status,
        current_stage: v_current_stage,
        priority: priority || 'normal',
        priority_multiplier: express ? 0.5 : 1.0,
        total_items:
          items.length > 0
            ? items.reduce((sum, item) => sum + item.quantity, 0)
            : quickDropQuantity ?? 0,
        subtotal_amount: subtotal,
        items_base_amount: subtotal,
        total_discount_amount: discount,
        total_tax_amount: tax,
        total_amount: total,
        rounding_adjustment_amount: roundingAdjustment,
        total_charges_amount: chargesTotal,
        payment_status: paymentMethod ? 'partial' : 'pending',
        payment_method_code: paymentMethod,
        idempotency_key: idempotencyKey ?? null,
        total_paid_amount: 0,
        outstanding_amount: total,
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
        physical_intake_at: hydrated.physical_intake_at ?? undefined,
        physical_intake_by: hydrated.physical_intake_by ?? undefined,
        physical_intake_info: hydrated.physical_intake_info ?? undefined,
        received_info: hydrated.received_info ?? undefined,
        received_at: receivedAt,
        preparation_status: hydrated.preparation_status,
        prepared_at: hydrated.prepared_at ?? undefined,
        prepared_by: hydrated.prepared_by ?? undefined,
        ...(currencyCode && { currency_code: currencyCode, currency_ex_rate: currencyExRate }),
        ...(vatRate != null && { vat_rate: vatRate }),
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
        ...(paymentTypeCode != null && { payment_type_code: paymentTypeCode }),
        // §5.3 snapshots, commercial_calc_version and the resolved ready-by (P5-02).
        ...(commercial && (() => {
          const snapshot = commercial.orderColumns();
          return { ...snapshot, ready_by_at_new: snapshot.ready_by };
        })()),
      } as any,
    });

    if (items.length > 0) {
      const packingPriceMapPrisma = await fetchOrgPackingExtraPriceByCodesPrismaTx(
        tx,
        tenantId,
        collectPackingPrefCodesFromOrderPayload(items)
      );

      const conditionCfIdByCode = await fetchOrgServicePreferenceCfIdsByCodesPrismaTx(
        tx,
        tenantId,
        collectConditionCatalogCodesFromOrderItems(items)
      );

      // PF-01: `override_by` references org_users_mst.id (not the auth user id), so
      // resolve the session user's membership row once, tenant-scoped.
      const hasAnyPriceOverride = items.some(
        (line) => line.priceOverride !== null && line.priceOverride !== undefined,
      );
      const overrideActorOrgUserId =
        hasAnyPriceOverride && userId
          ? (
              await tx.org_users_mst.findFirst({
                where: { tenant_org_id: tenantId, user_id: userId, is_active: true },
                select: { id: true },
              })
            )?.id ?? null
          : null;

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
            service_pref_charge: persistedServicePrefChargeColumn(item, packingPriceMapPrisma),
            // P5-02: every §6.1 column from the calculator, replacing the cart's prices above.
            ...commercial.itemColumns(index),
            // PF-01: override audit. The overriding user is the session user, never a client value.
            ...(item.priceOverride !== null && item.priceOverride !== undefined
              ? {
                  price_override: item.priceOverride,
                  override_reason: item.overrideReason?.trim() || null,
                  override_by: overrideActorOrgUserId,
                }
              : {}),
          },
        });

        commercial.recordItem(index, createdItem.id);

        // Insert service preferences for this item (org_order_preferences_dtl, prefs_level=ITEM)
        const prefs = item.servicePrefs;
        if (prefs && prefs.length > 0) {
          const createdPrefs = await tx.org_order_preferences_dtl.createManyAndReturn({
            select: { id: true, preference_code: true, preference_sys_kind: true },
            data: prefs.map((pref, idx) => ({
              tenant_org_id: tenantId,
              order_id: order.id,
              prefs_no: idx + 1,
              prefs_level: 'ITEM',
              order_item_id: createdItem.id,
              preference_code: pref.preference_code,
              preference_content: pref.preference_code,
              preference_sys_kind: 'service_prefs',
              prefs_source: pref.source ?? 'manual',
              extra_price: prefPrice('service_prefs', pref.preference_code, pref.extra_price ?? 0),
              branch_id: branchId ?? null,
              created_by: userId,
              ...(pref.preferenceCfId ? { preference_id: pref.preferenceCfId } : {}),
            })),
          });
          for (const row of createdPrefs) {
            commercial.recordPreference({ id: row.id, sysKind: row.preference_sys_kind ?? '', code: row.preference_code, index, pieceIndex: null });
          }
        }

        // Insert item packing pref into org_order_preferences_dtl
        if (item.packingPrefCode) {
          const createdPacking = await tx.org_order_preferences_dtl.create({
            select: { id: true },
            data: {
              tenant_org_id: tenantId,
              order_id: order.id,
              prefs_no: 1,
              prefs_level: 'ITEM',
              order_item_id: createdItem.id,
              preference_code: item.packingPrefCode,
              preference_content: item.packingPrefCode,
              preference_sys_kind: 'packing_prefs',
              prefs_owner_type: item.packingPrefIsOverride ? 'OVERRIDE' : 'SYSTEM',
              prefs_source: item.packingPrefSource ?? 'ORDER_CREATE',
              extra_price: prefPrice('packing_prefs', item.packingPrefCode, packingPriceMapPrisma.get(item.packingPrefCode) ?? 0),
              branch_id: branchId ?? null,
              created_by: userId,
              ...(item.packingCfId ? { preference_id: item.packingCfId } : {}),
            },
          });
          commercial.recordPreference({ id: createdPacking.id, sysKind: 'packing_prefs', code: item.packingPrefCode, index, pieceIndex: null });
        }

        // Always create pieces for each order item
        if (item.quantity > 0) {
          const pricePerPiece = item.totalPrice / item.quantity;

          for (let i = 0; i < item.quantity; i++) {
            const pieceInput = item.pieces?.[i];
            const pieceColors = effectivePieceColorsForPersist(pieceInput);
            const piecePrefs = pieceInput?.servicePrefs ?? [];
            const servicePrefChargePiece = piecePrefs.reduce(
              (s, p) => s + Number(p.extra_price ?? 0),
              0
            );
            const piecePackingCode = pieceInput?.packingPrefCode;
            const packingChargePiece = piecePackingCode
              ? packingPriceMapPrisma.get(piecePackingCode) ?? 0
              : 0;

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
                color:
                  pieceColors.codes.length > 0
                    ? { codes: pieceColors.codes, primary: pieceColors.codes[0] }
                    : undefined,
                notes: pieceInput?.notes ?? null,
                has_stain: pieceInput?.hasStain ?? false,
                has_damage: pieceInput?.hasDamage ?? false,
                packing_pref_code: pieceInput?.packingPrefCode ?? null,
                service_pref_charge: servicePrefChargePiece + packingChargePiece,
                // P5-02: the piece's own §6.1 columns (allocated from its item, or priced).
                ...commercial.pieceColumns(index, i),
              },
            });
            commercial.recordPiece(index, i, createdPiece.id);

            // Save piece conditions to org_order_preferences_dtl
            const conditions = pieceInput?.conditions ?? [];
            if (conditions.length > 0) {
              await tx.org_order_preferences_dtl.createMany({
                data: conditions.map((code, cidx) => {
                  const { preference_code, preference_sys_kind } = getConditionPrefKind(code);
                  const prefCfId = conditionCfIdByCode.get(preference_code);
                  return {
                    tenant_org_id: tenantId,
                    order_id: order.id,
                    prefs_no: cidx + 1,
                    prefs_level: 'PIECE',
                    order_item_id: createdItem.id,
                    order_item_piece_id: createdPiece.id,
                    preference_code,
                    preference_content: preference_code,
                    preference_sys_kind,
                    prefs_source: prefsSourceOnCreate,
                    extra_price: 0,
                    branch_id: branchId ?? null,
                    created_by: userId,
                    ...(prefCfId ? { preference_id: prefCfId } : {}),
                  };
                }),
              });
            }

            // Save piece-level service prefs to org_order_preferences_dtl
            if (piecePrefs.length > 0) {
              const createdPiecePrefs = await tx.org_order_preferences_dtl.createManyAndReturn({
                select: { id: true, preference_code: true, preference_sys_kind: true },
                data: piecePrefs.map((pref, pidx) => ({
                  tenant_org_id: tenantId,
                  order_id: order.id,
                  prefs_no: conditions.length + pidx + 1,
                  prefs_level: 'PIECE',
                  order_item_id: createdItem.id,
                  order_item_piece_id: createdPiece.id,
                  preference_code: pref.preference_code,
                  preference_content: pref.preference_code,
                  preference_sys_kind: 'service_prefs',
                  prefs_source: pref.source ?? 'manual',
                  extra_price: prefPrice('service_prefs', pref.preference_code, pref.extra_price ?? 0),
                  branch_id: branchId ?? null,
                  created_by: userId,
                  ...(pref.preferenceCfId ? { preference_id: pref.preferenceCfId } : {}),
                })),
              });
              for (const row of createdPiecePrefs) {
                commercial.recordPreference({ id: row.id, sysKind: row.preference_sys_kind ?? '', code: row.preference_code, index, pieceIndex: i });
              }
            }

            // Save piece packing pref to org_order_preferences_dtl (PIECE level)
            if (pieceInput?.packingPrefCode) {
              const createdPiecePacking = await tx.org_order_preferences_dtl.create({
                select: { id: true },
                data: {
                  tenant_org_id: tenantId,
                  order_id: order.id,
                  prefs_no: conditions.length + piecePrefs.length + 1,
                  prefs_level: 'PIECE',
                  order_item_id: createdItem.id,
                  order_item_piece_id: createdPiece.id,
                  preference_code: pieceInput.packingPrefCode,
                  preference_content: pieceInput.packingPrefCode,
                  preference_sys_kind: 'packing_prefs',
                  prefs_owner_type: 'SYSTEM',
                  prefs_source: prefsSourceOnCreate,
                  extra_price: prefPrice('packing_prefs', pieceInput.packingPrefCode, packingChargePiece),
                  branch_id: branchId ?? null,
                  created_by: userId,
                  ...(pieceInput.packingCfId ? { preference_id: pieceInput.packingCfId } : {}),
                },
              });
              commercial.recordPreference({ id: createdPiecePacking.id, sysKind: 'packing_prefs', code: pieceInput.packingPrefCode, index, pieceIndex: i });
            }

            const packingOffset = pieceInput?.packingPrefCode ? 1 : 0;

            // Save piece color(s) to org_order_preferences_dtl (PIECE level)
            if (pieceColors.codes.length > 0) {
              await tx.org_order_preferences_dtl.createMany({
                data: pieceColors.codes.map((code, ci) => ({
                  tenant_org_id: tenantId,
                  order_id: order.id,
                  prefs_no: conditions.length + piecePrefs.length + packingOffset + ci + 1,
                  prefs_level: 'PIECE',
                  order_item_id: createdItem.id,
                  order_item_piece_id: createdPiece.id,
                  preference_code: code,
                  preference_content: code,
                  preference_sys_kind: 'color',
                  prefs_source: prefsSourceOnCreate,
                  extra_price: 0,
                  branch_id: branchId ?? null,
                  created_by: userId,
                  ...(pieceColors.cfIds[ci]
                    ? { preference_id: pieceColors.cfIds[ci] as string }
                    : {}),
                })),
              });
            }

            const colorOffset = pieceColors.codes.length;

            // Save piece notes to org_order_preferences_dtl (PIECE level)
            if (pieceInput?.notes) {
              await tx.org_order_preferences_dtl.create({
                data: {
                  tenant_org_id: tenantId,
                  order_id: order.id,
                  prefs_no: conditions.length + piecePrefs.length + packingOffset + colorOffset + 1,
                  prefs_level: 'PIECE',
                  order_item_id: createdItem.id,
                  order_item_piece_id: createdPiece.id,
                  preference_code: pieceInput.notes,
                  preference_content: pieceInput.notes,
                  preference_sys_kind: 'note',
                  prefs_source: prefsSourceOnCreate,
                  extra_price: 0,
                  branch_id: branchId ?? null,
                  created_by: userId,
                },
              });
            }
          }
        }
      }

      // ── B18: order-level preferences + money PREFERENCE charges ─────────────
      // Item/piece extras stay inside line totals. Only prefs_level=ORDER extras
      // add as PREFERENCE charge facts (money addends for the snapshot).
      if (orderServicePrefs && orderServicePrefs.length > 0) {
        const createdOrderPrefs = await tx.org_order_preferences_dtl.createManyAndReturn({
          select: { id: true, preference_code: true, preference_sys_kind: true },
          data: orderServicePrefs.map((pref, idx) => ({
            tenant_org_id: tenantId,
            order_id: order.id,
            prefs_no: idx + 1,
            prefs_level: 'ORDER',
            preference_code: pref.preference_code,
            preference_content: pref.preference_code,
            preference_sys_kind: 'service_prefs',
            prefs_source: pref.source ?? 'ORDER_CREATE',
            extra_price: prefPrice('service_prefs', pref.preference_code, pref.extra_price ?? 0),
            branch_id: branchId ?? null,
            created_by: userId,
            ...(pref.preferenceCfId ? { preference_id: pref.preferenceCfId } : {}),
          })),
        });
        for (const row of createdOrderPrefs) {
          commercial.recordPreference({ id: row.id, sysKind: row.preference_sys_kind ?? '', code: row.preference_code, index: null, pieceIndex: null });
        }
      }

      if (commercial) {
        // P5-02: discount, charge and tax rows from the calculated order (the only writer of §6).
        // Charges carry their own tax (L25); the rollup rebuilds the header totals from these rows.
        const childRows = commercial.childRows({
          tenantOrgId: tenantId, orderId: order.id, currencyCode: order.currency_code ?? currencyCode ?? '', userId,
        });
        if (childRows.discounts.length > 0) await tx.org_order_discounts_dtl.createMany({ data: childRows.discounts });
        if (childRows.charges.length > 0) await tx.org_order_charges_dtl.createMany({ data: childRows.charges });
        if (childRows.taxes.length > 0) await tx.org_order_taxes_dtl.createMany({ data: childRows.taxes });
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
   * Split order into suborder (whole remaining units of the selected lines).
   * PRD-010 / Human-Friendly Codes P2: one transaction, sub-order number <root>-S<n>,
   * money stays on the parent (A-29). See lib/services/order-split.service.ts.
   */
  static async splitOrder(
    orderId: string,
    tenantId: string,
    itemIds: string[],
    reason: string,
    userId: string,
    userName: string
  ): Promise<OrderSplitResult> {
    return splitOrderUnits({
      tenantId,
      orderId,
      userId,
      userName,
      reason,
      lines: itemIds.map((itemId) => ({ itemId })),
    });
  }

  /**
   * Recompute org_orders_mst.has_issue from open rows in org_order_issues.
   * Report ≠ Reject — never touches is_rejected flags.
   */
  static async recomputeOrderHasIssue(
    orderId: string,
    tenantId: string,
    supabase?: SupabaseClient
  ): Promise<void> {
    const client = supabase ?? (await createClient());
    const { data: openRows } = await client
      .from('org_order_issues')
      .select('id')
      .eq('tenant_org_id', tenantId)
      .eq('order_id', orderId)
      .eq('status', ORDER_ISSUE_STATUS.OPEN)
      .limit(1);

    await client
      .from('org_orders_mst')
      .update({ has_issue: Boolean(openRows && openRows.length > 0) })
      .eq('id', orderId)
      .eq('tenant_org_id', tenantId);
  }

  /**
   * Derive scope when client omits scopeLevel (legacy body support).
   */
  static deriveIssueScope(
    scopeLevel: OrderIssueScope | undefined,
    orderItemId: string | null | undefined,
    orderItemPieceId: string | null | undefined
  ): OrderIssueScope {
    if (scopeLevel) return scopeLevel;
    if (orderItemPieceId) return ORDER_ISSUE_SCOPE.PIECE;
    if (orderItemId) return ORDER_ISSUE_SCOPE.ITEM;
    return ORDER_ISSUE_SCOPE.ORDER;
  }

  /**
   * Create issue at ORDER / ITEM / PIECE scope.
   * Does not set reject flags (Report ≠ Reject).
   */
  static async createIssue(params: {
    orderId: string;
    tenantId: string;
    userId: string;
    issueCode: string;
    issueText: string;
    scopeLevel?: OrderIssueScope;
    orderItemId?: string | null;
    orderItemPieceId?: string | null;
    photoUrl?: string;
    priority?: string;
    /** QA reject path only — Report Issue must leave this false/undefined */
    alsoReject?: boolean;
  }): Promise<{
    success: boolean;
    issue?: Record<string, unknown>;
    error?: string;
    errorCode?: string;
  }> {
    const {
      orderId,
      tenantId,
      userId,
      issueCode,
      issueText,
      photoUrl,
      priority = DEFAULT_PRIORITY,
    } = params;
    const orderItemId = params.orderItemId ?? null;
    const orderItemPieceId = params.orderItemPieceId ?? null;
    const scopeLevel = OrderService.deriveIssueScope(
      params.scopeLevel,
      orderItemId,
      orderItemPieceId
    );

    try {
      const supabase = await createClient();

      const normalizedCode = issueCode.trim();
      const typeOk = await isActiveIssueType(normalizedCode, supabase);
      if (!typeOk) {
        return {
          success: false,
          error: 'Invalid or inactive issue type',
          errorCode: ORDER_ISSUE_ERROR.INVALID_TYPE,
        };
      }

      const priorityOk = await isActivePriority(priority, supabase);
      if (!priorityOk) {
        return {
          success: false,
          error: 'Invalid or inactive priority',
          errorCode: ORDER_ISSUE_ERROR.INVALID_PRIORITY,
        };
      }

      if (scopeLevel === ORDER_ISSUE_SCOPE.ORDER) {
        if (orderItemId || orderItemPieceId) {
          return {
            success: false,
            error: 'ORDER scope must not include item or piece',
            errorCode: ORDER_ISSUE_ERROR.SCOPE_INVALID,
          };
        }
      }

      if (scopeLevel === ORDER_ISSUE_SCOPE.ITEM) {
        if (!orderItemId || orderItemPieceId) {
          return {
            success: false,
            error: 'ITEM scope requires orderItemId only',
            errorCode: ORDER_ISSUE_ERROR.SCOPE_INVALID,
          };
        }
        const { data: item } = await supabase
          .from('org_order_items_dtl')
          .select('id')
          .eq('id', orderItemId)
          .eq('order_id', orderId)
          .eq('tenant_org_id', tenantId)
          .maybeSingle();
        if (!item) {
          return {
            success: false,
            error: 'Order item not found on this order',
            errorCode: ORDER_ISSUE_ERROR.HIERARCHY_MISMATCH,
          };
        }
      }

      if (scopeLevel === ORDER_ISSUE_SCOPE.PIECE) {
        if (!orderItemId || !orderItemPieceId) {
          return {
            success: false,
            error: 'PIECE scope requires orderItemId and orderItemPieceId',
            errorCode: ORDER_ISSUE_ERROR.SCOPE_INVALID,
          };
        }
        const { data: piece } = await supabase
          .from('org_order_item_pieces_dtl')
          .select('id, order_item_id')
          .eq('id', orderItemPieceId)
          .eq('order_id', orderId)
          .eq('tenant_org_id', tenantId)
          .maybeSingle();
        if (!piece || piece.order_item_id !== orderItemId) {
          return {
            success: false,
            error: 'Piece does not belong to the given item/order',
            errorCode: ORDER_ISSUE_ERROR.HIERARCHY_MISMATCH,
          };
        }
      }

      const { data: issue, error: issueError } = await supabase
        .from('org_order_issues')
        .insert({
          tenant_org_id: tenantId,
          order_id: orderId,
          scope_level: scopeLevel,
          order_item_id: orderItemId,
          order_item_piece_id: orderItemPieceId,
          issue_code: normalizedCode,
          issue_text: issueText,
          photo_url: photoUrl,
          priority,
          status: ORDER_ISSUE_STATUS.OPEN,
          created_by: userId,
        })
        .select()
        .single();

      if (issueError || !issue) {
        console.error('OrderService.createIssue insert error:', issueError);
        return {
          success: false,
          error: 'Failed to create issue',
          errorCode: ORDER_ISSUE_ERROR.CREATE_FAILED,
        };
      }

      // Latest-open pointers only — never set reject flags
      if (scopeLevel === ORDER_ISSUE_SCOPE.ORDER) {
        await supabase
          .from('org_orders_mst')
          .update({ issue_id: issue.id })
          .eq('id', orderId)
          .eq('tenant_org_id', tenantId);
      }
      if (orderItemId) {
        await supabase
          .from('org_order_items_dtl')
          .update({ item_issue_id: issue.id })
          .eq('id', orderItemId)
          .eq('tenant_org_id', tenantId);
      }
      if (orderItemPieceId) {
        await supabase
          .from('org_order_item_pieces_dtl')
          .update({ issue_id: issue.id })
          .eq('id', orderItemPieceId)
          .eq('tenant_org_id', tenantId);
      }

      await OrderService.recomputeOrderHasIssue(orderId, tenantId, supabase);

      // Explicit reject (QA) — never implied by report alone
      if (params.alsoReject) {
        if (orderItemId) {
          await supabase
            .from('org_order_items_dtl')
            .update({ item_is_rejected: true })
            .eq('id', orderItemId)
            .eq('tenant_org_id', tenantId);
        }
        if (orderItemPieceId) {
          await supabase
            .from('org_order_item_pieces_dtl')
            .update({ is_rejected: true })
            .eq('id', orderItemPieceId)
            .eq('tenant_org_id', tenantId);
        }
        await supabase
          .from('org_orders_mst')
          .update({ is_rejected: true })
          .eq('id', orderId)
          .eq('tenant_org_id', tenantId);
      }

      await supabase.rpc('log_order_action', {
        p_tenant_org_id: tenantId,
        p_order_id: orderId,
        p_action_type: 'ISSUE_CREATED',
        p_from_value: null,
        p_to_value: normalizedCode,
        p_done_by: userId,
        p_payload: {
          issue_id: issue.id,
          issue_text: issueText,
          priority,
          scope_level: scopeLevel,
          order_item_id: orderItemId,
          order_item_piece_id: orderItemPieceId,
          also_reject: Boolean(params.alsoReject),
        },
      });

      return { success: true, issue };
    } catch (error) {
      console.error('OrderService.createIssue error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: ORDER_ISSUE_ERROR.CREATE_FAILED,
      };
    }
  }

  /**
   * List issues for an order with optional scope filters and counts.
   */
  static async listIssues(params: {
    orderId: string;
    tenantId: string;
    orderItemId?: string | null;
    orderItemPieceId?: string | null;
    status?: 'open' | 'solved' | 'all';
    includeChildren?: boolean;
    /** this = opener narrowing; order|item|piece|all = order-wide by scope_level */
    scopeFilter?: 'this' | 'order' | 'item' | 'piece' | 'all';
  }): Promise<{
    success: boolean;
    issues: Record<string, unknown>[];
    openCount: number;
    totalCount: number;
    error?: string;
  }> {
    try {
      const supabase = await createClient();
      const status = params.status ?? 'all';
      const scopeFilter = params.scopeFilter ?? 'this';
      const includeChildren = params.includeChildren !== false;
      const pieceId = params.orderItemPieceId ?? null;
      const itemId = params.orderItemId ?? null;

      let query = supabase
        .from('org_order_issues')
        .select('*')
        .eq('tenant_org_id', params.tenantId)
        .eq('order_id', params.orderId)
        .order('created_at', { ascending: false });

      if (scopeFilter === 'order') {
        query = query.eq('scope_level', ORDER_ISSUE_SCOPE.ORDER);
      } else if (scopeFilter === 'item') {
        query = query.eq('scope_level', ORDER_ISSUE_SCOPE.ITEM);
      } else if (scopeFilter === 'piece') {
        query = query.eq('scope_level', ORDER_ISSUE_SCOPE.PIECE);
      } else if (scopeFilter === 'all') {
        // no scope narrowing
      } else if (pieceId) {
        query = query.eq('order_item_piece_id', pieceId);
      } else if (itemId) {
        if (includeChildren) {
          query = query.eq('order_item_id', itemId);
        } else {
          query = query
            .eq('order_item_id', itemId)
            .eq('scope_level', ORDER_ISSUE_SCOPE.ITEM);
        }
      } else if (!includeChildren) {
        query = query.eq('scope_level', ORDER_ISSUE_SCOPE.ORDER);
      }

      if (status === 'open') {
        query = query.eq('status', ORDER_ISSUE_STATUS.OPEN);
      } else if (status === 'solved') {
        query = query.eq('status', ORDER_ISSUE_STATUS.SOLVED);
      }

      const { data, error } = await query;
      if (error) {
        console.error('OrderService.listIssues error:', error);
        return {
          success: false,
          issues: [],
          openCount: 0,
          totalCount: 0,
          error: error.message,
        };
      }

      const issues = (data ?? []) as Record<string, unknown>[];
      const enriched = await OrderService.enrichIssueRows(
        params.tenantId,
        issues
      );

      const openCount = enriched.filter(
        (i) => i.status === ORDER_ISSUE_STATUS.OPEN
      ).length;
      return {
        success: true,
        issues: enriched,
        openCount,
        totalCount: enriched.length,
      };
    } catch (error) {
      console.error('OrderService.listIssues error:', error);
      return {
        success: false,
        issues: [],
        openCount: 0,
        totalCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Enrich issue rows with actor names + type/priority catalog labels.
   */
  static async enrichIssueRows(
    tenantId: string,
    issues: Record<string, unknown>[]
  ): Promise<Record<string, unknown>[]> {
    if (issues.length === 0) return issues;
    const supabase = await createClient();

    const actorIds = issues.flatMap((row) =>
      [row.created_by, row.solved_by].filter(
        (id): id is string => typeof id === 'string' && id.length > 0
      )
    );
    let nameById: Record<string, string> = {};
    try {
      const actors = await lookupAuditActors(tenantId, actorIds);
      nameById = Object.fromEntries(
        actors.map((a) => [
          a.id,
          a.displayName || a.email || a.phone || a.id.slice(0, 8),
        ])
      );
    } catch (actorError) {
      console.error('OrderService.enrichIssueRows actor lookup:', actorError);
    }

    const typeCodes = [
      ...new Set(
        issues
          .map((r) => r.issue_code)
          .filter((c): c is string => typeof c === 'string' && c.length > 0)
      ),
    ];
    const priorityCodes = [
      ...new Set(
        issues
          .map((r) => r.priority)
          .filter((c): c is string => typeof c === 'string' && c.length > 0)
      ),
    ];

    const typeByCode: Record<
      string,
      { name: string | null; name2: string | null; color: string | null }
    > = {};
    if (typeCodes.length > 0) {
      const typesResult = await getIssueTypesByCodes(typeCodes, supabase);
      Object.assign(typeByCode, typesResult.data ?? {});
    }

    const priorityByCode: Record<
      string,
      {
        name: string | null;
        name2: string | null;
        color: string | null;
        display_order: number | null;
      }
    > = {};
    if (priorityCodes.length > 0) {
      const prioritiesResult = await getPrioritiesByCodes(
        priorityCodes,
        supabase
      );
      Object.assign(priorityByCode, prioritiesResult.data ?? {});
    }

    return issues
      .map((row): Record<string, unknown> => {
        const code =
          typeof row.issue_code === 'string' ? row.issue_code : null;
        const pri = typeof row.priority === 'string' ? row.priority : null;
        const typeMeta = code ? typeByCode[code] : undefined;
        const priMeta = pri ? priorityByCode[pri] : undefined;
        return {
          ...row,
          created_by_name:
            typeof row.created_by === 'string'
              ? nameById[row.created_by] ?? null
              : null,
          solved_by_name:
            typeof row.solved_by === 'string'
              ? nameById[row.solved_by] ?? null
              : null,
          issue_type_name: typeMeta?.name ?? null,
          issue_type_name2: typeMeta?.name2 ?? null,
          issue_type_color: typeMeta?.color ?? null,
          priority_name: priMeta?.name ?? null,
          priority_name2: priMeta?.name2 ?? null,
          priority_color: priMeta?.color ?? null,
          priority_display_order: priMeta?.display_order ?? 99,
        };
      })
      .sort((a, b) => {
        const ao = Number(a.priority_display_order ?? 99);
        const bo = Number(b.priority_display_order ?? 99);
        if (ao !== bo) return ao - bo;
        const at = String(a.created_at ?? '');
        const bt = String(b.created_at ?? '');
        return bt.localeCompare(at);
      });
  }

  /**
   * Open/total counts for order + per item + per piece (badge wiring).
   */
  static async getIssueSummary(
    orderId: string,
    tenantId: string
  ): Promise<{
    success: boolean;
    order: { open: number; total: number };
    byItem: Record<string, { open: number; total: number }>;
    byPiece: Record<string, { open: number; total: number }>;
    error?: string;
  }> {
    const empty = {
      success: false as const,
      order: { open: 0, total: 0 },
      byItem: {} as Record<string, { open: number; total: number }>,
      byPiece: {} as Record<string, { open: number; total: number }>,
    };
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('org_order_issues')
        .select('id, order_item_id, order_item_piece_id, status, solved_at, scope_level')
        .eq('tenant_org_id', tenantId)
        .eq('order_id', orderId);

      if (error) {
        return { ...empty, error: error.message };
      }

      const rows = data ?? [];
      const byItem: Record<string, { open: number; total: number }> = {};
      const byPiece: Record<string, { open: number; total: number }> = {};
      let orderScopedOpen = 0;
      let orderScopedTotal = 0;

      for (const row of rows) {
        const isOpen = row.status === ORDER_ISSUE_STATUS.OPEN;

        // Piece-scoped issues count only under the piece (not double-counted on item).
        if (row.order_item_piece_id) {
          const cur = byPiece[row.order_item_piece_id] ?? { open: 0, total: 0 };
          cur.total += 1;
          if (isOpen) cur.open += 1;
          byPiece[row.order_item_piece_id] = cur;
        } else if (row.order_item_id) {
          const cur = byItem[row.order_item_id] ?? { open: 0, total: 0 };
          cur.total += 1;
          if (isOpen) cur.open += 1;
          byItem[row.order_item_id] = cur;
        } else {
          orderScopedTotal += 1;
          if (isOpen) orderScopedOpen += 1;
        }
      }

      return {
        success: true,
        order: { open: orderScopedOpen, total: orderScopedTotal },
        byItem,
        byPiece,
      };
    } catch (error) {
      return {
        ...empty,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Resolve issue — sets solved_at / solved_by / solved_notes.
   */
  static async resolveIssue(
    issueId: string,
    tenantId: string,
    solvedNotes: string,
    userId: string,
    orderId?: string
  ): Promise<{
    success: boolean;
    issue?: Record<string, unknown>;
    error?: string;
    errorCode?: string;
  }> {
    try {
      const supabase = await createClient();

      let lookup = supabase
        .from('org_order_issues')
        .select('*')
        .eq('id', issueId)
        .eq('tenant_org_id', tenantId);
      if (orderId) {
        lookup = lookup.eq('order_id', orderId);
      }
      const { data: existing, error: lookupError } = await lookup.maybeSingle();

      if (lookupError || !existing) {
        return {
          success: false,
          error: 'Issue not found',
          errorCode: ORDER_ISSUE_ERROR.NOT_FOUND,
        };
      }

      if (existing.status === ORDER_ISSUE_STATUS.SOLVED || existing.solved_at) {
        return {
          success: false,
          issue: existing,
          error: 'Issue already solved',
          errorCode: ORDER_ISSUE_ERROR.ALREADY_SOLVED,
        };
      }

      const { data: issue, error: issueError } = await supabase
        .from('org_order_issues')
        .update({
          status: ORDER_ISSUE_STATUS.SOLVED,
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
          errorCode: ORDER_ISSUE_ERROR.RESOLVE_FAILED,
        };
      }

      await OrderService.recomputeOrderHasIssue(
        issue.order_id as string,
        tenantId,
        supabase
      );

      // Clear pointers when no open issues remain for that entity
      if (issue.order_item_piece_id) {
        const { data: openPiece } = await supabase
          .from('org_order_issues')
          .select('id')
          .eq('tenant_org_id', tenantId)
          .eq('order_item_piece_id', issue.order_item_piece_id)
          .eq('status', ORDER_ISSUE_STATUS.OPEN)
          .limit(1);
        if (!openPiece?.length) {
          await supabase
            .from('org_order_item_pieces_dtl')
            .update({ issue_id: null })
            .eq('id', issue.order_item_piece_id)
            .eq('tenant_org_id', tenantId);
        }
      }
      if (issue.order_item_id) {
        const { data: openItem } = await supabase
          .from('org_order_issues')
          .select('id')
          .eq('tenant_org_id', tenantId)
          .eq('order_item_id', issue.order_item_id)
          .eq('status', ORDER_ISSUE_STATUS.OPEN)
          .limit(1);
        if (!openItem?.length) {
          await supabase
            .from('org_order_items_dtl')
            .update({ item_issue_id: null })
            .eq('id', issue.order_item_id)
            .eq('tenant_org_id', tenantId);
        }
      }
      const { data: openOrderScoped } = await supabase
        .from('org_order_issues')
        .select('id')
        .eq('tenant_org_id', tenantId)
        .eq('order_id', issue.order_id)
        .eq('scope_level', ORDER_ISSUE_SCOPE.ORDER)
        .eq('status', ORDER_ISSUE_STATUS.OPEN)
        .limit(1);
      if (!openOrderScoped?.length) {
        await supabase
          .from('org_orders_mst')
          .update({ issue_id: null })
          .eq('id', issue.order_id)
          .eq('tenant_org_id', tenantId);
      }

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
          scope_level: issue.scope_level,
        },
      });

      return { success: true, issue };
    } catch (error) {
      console.error('OrderService.resolveIssue error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: ORDER_ISSUE_ERROR.RESOLVE_FAILED,
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
   * Split order by pieces ("{itemId}-piece-{n}" ids from the processing modal).
   * PRD-010 / Human-Friendly Codes P2: one transaction, sub-order number <root>-S<n>,
   * money stays on the parent (A-29). See lib/services/order-split.service.ts.
   */
  static async splitOrderByPieces(
    orderId: string,
    tenantId: string,
    pieceIds: string[],
    reason: string,
    userId: string,
    userName: string
  ): Promise<OrderSplitResult> {
    const built = buildSplitLines({ pieceIds });
    if ('errorCode' in built) {
      return { success: false, errorCode: built.errorCode, error: built.error };
    }
    if (built.lines.length === 0) {
      return { success: false, errorCode: ORDER_SPLIT_ERRORS.NOTHING_SELECTED, error: 'No valid piece IDs found' };
    }
    return splitOrderUnits({ tenantId, orderId, userId, userName, reason, lines: built.lines });
  }
}

// Re-export lock service functions for convenience
export { lockOrderForEdit, unlockOrder, checkOrderLock } from '@/lib/services/order-lock.service';
