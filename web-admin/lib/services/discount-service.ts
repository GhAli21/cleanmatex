/* eslint-disable jsdoc/require-param */
/**
 * Discount Service for CleanMateX
 *
 * Handles all discount-related operations including:
 * - Promo code validation and application
 * - Discount rule evaluation
 * - Usage tracking and limits
 * - Discount calculations
 */

import { prisma } from '@/lib/db/prisma';
import { withTenantContext, getTenantIdFromSession } from '../db/tenant-context';
import { logger } from '@/lib/utils/logger';

/** Prisma interactive-transaction client type — matches what prisma.$transaction callback receives */
type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
import type {
  PromoCode,
  PromoCodeUsage,
  ValidatePromoCodeInput,
  ValidatePromoCodeResult,
  DiscountRule,
  EvaluateDiscountRulesInput,
  EvaluatedDiscount,
  PromoDiscountType,
} from '../types/payment';
import { tenantSettingsService } from '@/lib/services/tenant-settings.service';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';

// ============================================================================
// Promo Code Validation
// ============================================================================

/** Raw promotion row as returned by Prisma. */
type PromoRow = NonNullable<Awaited<ReturnType<typeof prisma.org_promotions_mst.findFirst>>>;

/** Error codes a promo evaluation can produce (superset of both callers'). */
export type PromoEvalErrorCode =
  | 'NOT_FOUND'
  | 'EXPIRED'
  | 'MAX_USES_EXCEEDED'
  | 'MIN_ORDER_NOT_MET'
  | 'MAX_ORDER_EXCEEDED'
  | 'CATEGORY_NOT_APPLICABLE'
  | 'CUSTOMER_LIMIT_EXCEEDED';

/** Canonical result of evaluating a promo code against an order context. */
export interface PromoEvaluation {
  isValid: boolean;
  errorCode?: PromoEvalErrorCode;
  error?: string;
  /** The resolved promotion row (present whenever the code was found). */
  promo?: PromoRow;
  discountAmount?: number;
}

/**
 * Canonical promo-code evaluation — the **single source of truth** shared by
 * the checkout validator ({@link validatePromoCode} → `ValidatePromoCodeResult`)
 * and the marketing-admin preview (`promotion-engine.validatePromoCode` →
 * `PromoValidation`). One implementation guarantees the preview and checkout
 * never disagree on validity or discount.
 *
 * Runs inside `withTenantContext`; every query is also explicitly tenant-scoped.
 * `tenantId` is passed in (callers resolve it from session or an authenticated
 * route), so this is reusable outside a request context.
 */
export async function evaluatePromoCode(params: {
  tenantId: string;
  code: string;
  orderTotal: number;
  customerId?: string;
  serviceCategories?: string[];
}): Promise<PromoEvaluation> {
  const { tenantId, code, orderTotal, customerId, serviceCategories } = params;

  return withTenantContext(tenantId, async () => {
    const promo = await prisma.org_promotions_mst.findFirst({
      where: {
        tenant_org_id: tenantId,
        promo_code: code.toUpperCase(),
        is_active: true,
        is_enabled: true,
        rec_status: 1,
      },
    });

    if (!promo) {
      return { isValid: false, errorCode: 'NOT_FOUND', error: 'Promo code not found or is no longer active' };
    }

    const moneyCfg = await tenantSettingsService.getCurrencyConfig(tenantId);
    const fmtMoney = (amount: number) =>
      formatMoneyAmountWithCode(amount, {
        currencyCode: moneyCfg.currencyCode,
        decimalPlaces: moneyCfg.decimalPlaces,
        locale: 'en',
      });

    // Validity window
    const now = new Date();
    const validFrom = new Date(promo.valid_from);
    const validTo = promo.valid_to ? new Date(promo.valid_to) : null;
    if (now < validFrom) {
      return { isValid: false, errorCode: 'EXPIRED', error: 'Promo code is not yet valid', promo };
    }
    if (validTo && now > validTo) {
      return { isValid: false, errorCode: 'EXPIRED', error: 'Promo code has expired', promo };
    }

    // Global usage cap — uses the atomic `current_uses` counter, the same value
    // the apply path enforces under lock (reversals decrement it).
    if (promo.max_uses !== null && promo.current_uses !== null && promo.current_uses >= promo.max_uses) {
      return { isValid: false, errorCode: 'MAX_USES_EXCEEDED', error: 'Promo code has reached maximum usage limit', promo };
    }

    // Order-amount thresholds
    const minOrder = Number(promo.min_order_amount ?? 0);
    if (orderTotal < minOrder) {
      return { isValid: false, errorCode: 'MIN_ORDER_NOT_MET', error: `Order total must be at least ${fmtMoney(minOrder)}`, promo };
    }
    if (promo.max_order_amount != null && orderTotal > Number(promo.max_order_amount)) {
      return { isValid: false, errorCode: 'MAX_ORDER_EXCEEDED', error: `Promo code only valid for orders up to ${fmtMoney(Number(promo.max_order_amount))}`, promo };
    }

    // Applicable service categories (only enforced when the caller supplies them)
    if (promo.applicable_categories && serviceCategories && serviceCategories.length > 0) {
      const applicable = promo.applicable_categories as string[];
      const hasMatch = serviceCategories.some((cat) => applicable.includes(cat));
      if (!hasMatch) {
        return { isValid: false, errorCode: 'CATEGORY_NOT_APPLICABLE', error: 'Promo code not applicable to selected services', promo };
      }
    }

    // Per-customer usage cap — excludes voided (reversed) usages.
    if (customerId && promo.max_uses_per_customer !== null && promo.max_uses_per_customer !== undefined) {
      const usedByCustomer = await prisma.org_promotion_usage_dtl.count({
        where: { tenant_org_id: tenantId, promo_code_id: promo.id, customer_id: customerId, voided_at: null },
      });
      if (usedByCustomer >= promo.max_uses_per_customer) {
        return { isValid: false, errorCode: 'CUSTOMER_LIMIT_EXCEEDED', error: 'You have reached the maximum usage limit for this promo code', promo };
      }
    }

    const discountAmount = calculatePromoDiscount(
      orderTotal,
      promo.discount_type,
      Number(promo.discount_value),
      promo.max_discount_amount != null ? Number(promo.max_discount_amount) : undefined,
    );

    return { isValid: true, promo, discountAmount };
  });
}

/**
 * Validate and retrieve promo code information for the **checkout** flow.
 * Thin adapter over {@link evaluatePromoCode}.
 */
export async function validatePromoCode(
  input: ValidatePromoCodeInput
): Promise<ValidatePromoCodeResult> {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    return { isValid: false, error: 'Unauthorized: Tenant ID required', errorCode: 'UNAUTHORIZED' };
  }

  try {
    const result = await evaluatePromoCode({
      tenantId,
      code: input.promo_code,
      orderTotal: input.order_total,
      customerId: input.customer_id,
      serviceCategories: input.service_categories,
    });

    if (!result.isValid || !result.promo) {
      const thresholdAmount =
        result.errorCode === 'MIN_ORDER_NOT_MET'
          ? Number(result.promo?.min_order_amount ?? 0)
          : result.errorCode === 'MAX_ORDER_EXCEEDED'
            ? Number(result.promo?.max_order_amount ?? 0)
            : undefined;
      return { isValid: false, error: result.error, errorCode: result.errorCode, thresholdAmount };
    }
    return { isValid: true, promoCode: mapPromoCodeToType(result.promo), discountAmount: result.discountAmount };
  } catch (error) {
    logger.error('Error validating promo code', error as Error, { tenantId });
    return { isValid: false, error: 'An error occurred while validating promo code' };
  }
}

/**
 * Calculate a promo discount amount. **Case-insensitive** on `discountType`:
 * the `discount_type` column is stored lower-case (`percentage`/`fixed_amount`),
 * but tolerate either case so a mis-cased value can never silently yield 0.
 */
function calculatePromoDiscount(
  orderTotal: number,
  discountType: string,
  discountValue: number,
  maxDiscountAmount?: number
): number {
  let discount = 0;

  if (String(discountType).toLowerCase() === 'percentage') {
    discount = (orderTotal * discountValue) / 100;
    if (maxDiscountAmount && discount > maxDiscountAmount) {
      discount = maxDiscountAmount;
    }
  } else {
    discount = discountValue;
  }

  // Ensure discount doesn't exceed order total
  return Math.min(discount, orderTotal);
}

// ============================================================================
// Promo Code Application
// ============================================================================

/**
 * Apply promo code inside an existing Prisma transaction.
 *
 * Uses SELECT FOR UPDATE to prevent TOCTOU race conditions on max_uses.
 * Must be called from within a prisma.$transaction callback.
 *
 * invoiceId is optional — cash sales do not produce an org_invoice_mst row
 * (ADR_ar_invoice_is_receivable_only.md). The DB column
 * org_promotion_usage_dtl.invoice_id is already nullable.
 */
export async function applyPromoCodeTx(
  tx: PrismaTransactionClient,
  params: {
    promoCodeId: string;
    orderId: string;
    invoiceId?: string;
    tenantOrgId: string;
    customerId?: string;
    discountAmount: number;
    orderTotalBefore: number;
    appliedBy?: string;
  }
): Promise<void> {
  const {
    promoCodeId,
    orderId,
    invoiceId,
    tenantOrgId,
    customerId,
    discountAmount,
    orderTotalBefore,
    appliedBy,
  } = params;

  // SELECT FOR UPDATE locks the row for the duration of the transaction.
  // This prevents a concurrent request from reading the same current_uses
  // value before the increment is committed (TOCTOU race).
  const locked = await tx.$queryRaw<
    { id: string; current_uses: number; max_uses: number | null }[]
  >`
    SELECT id, current_uses, max_uses
    FROM org_promotions_mst
    WHERE id = CAST(${promoCodeId} AS uuid)
      AND tenant_org_id = CAST(${tenantOrgId} AS uuid)
    FOR UPDATE
  `;

  if (!locked.length) throw new Error('PROMO_NOT_FOUND');

  const row = locked[0];

  // Idempotency (PR-2): one usage per (order, promo). The FOR UPDATE lock above
  // serialises concurrent applies on the promo row, so a second caller for the
  // same order sees the committed usage row here and skips — no double
  // increment. `uq_promo_usage_idempotency (tenant_org_id, idempotency_key)`
  // (migration 0288) is the hard DB backstop. Today this also runs inside the
  // order-submit `withIdempotency` envelope; the key makes apply replay-safe on
  // any future standalone path too.
  const idempotencyKey = `${orderId}:${promoCodeId}`;
  const existingUsage = await tx.org_promotion_usage_dtl.findFirst({
    where: { tenant_org_id: tenantOrgId, idempotency_key: idempotencyKey },
  });
  if (existingUsage) return;

  if (row.max_uses !== null && row.current_uses >= row.max_uses) {
    throw new Error('PROMO_MAX_USES_EXCEEDED');
  }

  await tx.org_promotion_usage_dtl.create({
    data: {
      tenant_org_id: tenantOrgId,
      promo_code_id: promoCodeId,
      customer_id: customerId,
      order_id: orderId,
      invoice_id: invoiceId ?? null,
      discount_amount: discountAmount,
      order_total_before: orderTotalBefore,
      order_total_after: orderTotalBefore - discountAmount,
      idempotency_key: idempotencyKey,
      used_at: new Date(),
      used_by: appliedBy,
    },
  });

  // Safe to increment here because SELECT FOR UPDATE held the lock.
  await tx.org_promotions_mst.update({
    where: { id: promoCodeId },
    data: {
      current_uses: { increment: 1 },
      updated_at: new Date(),
      updated_by: appliedBy,
    },
  });
}

/**
 * Apply promo code to order and record usage.
 *
 * Thin standalone wrapper around applyPromoCodeTx. Starts its own
 * transaction so the SELECT FOR UPDATE is still honoured when called
 * outside a larger transaction context.
 */
export async function applyPromoCode(
  promoCodeId: string,
  orderId: string,
  invoiceId: string | undefined,
  tenantOrgId: string,
  customerId: string | undefined,
  discountAmount: number,
  orderTotalBefore: number,
  appliedBy?: string
): Promise<{ success: boolean; error?: string }> {
  return withTenantContext(tenantOrgId, async () => {
    try {
      await prisma.$transaction((tx) =>
        applyPromoCodeTx(tx, {
          promoCodeId,
          orderId,
          invoiceId,
          tenantOrgId,
          customerId,
          discountAmount,
          orderTotalBefore,
          appliedBy,
        })
      );
      return { success: true };
    } catch (error) {
      logger.error('Error applying promo code', error as Error, { tenantOrgId, promoCodeId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to apply promo code',
      };
    }
  });
}

/**
 * Reverse promo code usage for a cancelled order.
 *
 * Marks all non-voided usage log rows for the order as voided (sets
 * `voided_at` + `voided_by`) and decrements `current_uses` on each affected
 * promo by the number of reversed usages for that promo.
 *
 * @remarks
 * Uses SELECT FOR UPDATE on each affected promo row to avoid TOCTOU races
 * with concurrent applies. Aggregates voided rows per `promo_code_id` to
 * apply a single decrement per promo (avoids double-decrement when an order
 * has multiple usage rows for the same promo).
 *
 * @returns the number of usage log rows reversed.
 * @throws when the underlying writes fail.
 */
export async function reversePromoUsageTx(
  tx: PrismaTransactionClient,
  params: {
    orderId: string;
    tenantOrgId: string;
    voidedBy?: string;
  }
): Promise<{ reversedCount: number }> {
  const { orderId, tenantOrgId, voidedBy } = params;

  // Find non-voided usage rows for this order — middleware adds tenant filter
  // but we also pass it explicitly for clarity.
  const usages = await tx.org_promotion_usage_dtl.findMany({
    where: {
      tenant_org_id: tenantOrgId,
      order_id: orderId,
      voided_at: null,
    },
    select: {
      id: true,
      promo_code_id: true,
    },
  });

  if (usages.length === 0) {
    return { reversedCount: 0 };
  }

  // Aggregate count per promo so we issue exactly one decrement per promo.
  const decrementByPromo = new Map<string, number>();
  for (const u of usages) {
    decrementByPromo.set(u.promo_code_id, (decrementByPromo.get(u.promo_code_id) ?? 0) + 1);
  }

  // Lock affected promo rows BEFORE updating to prevent races with concurrent
  // applyPromoCodeTx calls reading stale current_uses.
  for (const promoCodeId of decrementByPromo.keys()) {
    await tx.$queryRaw`
      SELECT id FROM org_promotions_mst
      WHERE id = CAST(${promoCodeId} AS uuid)
        AND tenant_org_id = CAST(${tenantOrgId} AS uuid)
      FOR UPDATE
    `;
  }

  // Mark all matching usage rows as voided in one statement.
  await tx.org_promotion_usage_dtl.updateMany({
    where: {
      tenant_org_id: tenantOrgId,
      order_id: orderId,
      voided_at: null,
    },
    data: {
      voided_at: new Date(),
      voided_by: voidedBy,
    },
  });

  // Decrement current_uses per promo by exactly the count we voided.
  for (const [promoCodeId, decBy] of decrementByPromo) {
    await tx.org_promotions_mst.update({
      where: { id: promoCodeId },
      data: {
        current_uses: { decrement: decBy },
        updated_at: new Date(),
        updated_by: voidedBy,
      },
    });
  }

  return { reversedCount: usages.length };
}

/**
 * Get promo code usage history
 */
export async function getPromoCodeUsage(
  promoCodeId: string
): Promise<PromoCodeUsage[]> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    const usages = await prisma.org_promotion_usage_dtl.findMany({
      where: {
        promo_code_id: promoCodeId,
      },
      orderBy: {
        used_at: 'desc',
      },
    });

    return usages.map((usage) => ({
      id: usage.id,
      tenant_org_id: usage.tenant_org_id,
      promo_code_id: usage.promo_code_id,
      customer_id: usage.customer_id ?? undefined,
      order_id: usage.order_id ?? undefined,
      invoice_id: usage.invoice_id ?? undefined,
      discount_amount: Number(usage.discount_amount),
      order_total_before: Number(usage.order_total_before),
      order_total_after: Number(usage.order_total_after),
      used_at: usage.used_at.toISOString(),
      used_by: usage.used_by ?? undefined,
      metadata: usage.metadata ? JSON.parse(usage.metadata as string) : undefined,
    }));
  });
}

/**
 * Get customer's promo code usage count
 */
export async function getCustomerPromoUsageCount(
  promoCodeId: string,
  customerId: string
): Promise<number> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    return prisma.org_promotion_usage_dtl.count({
      where: {
        promo_code_id: promoCodeId,
        customer_id: customerId,
      },
    });
  });
}

// ============================================================================
// Discount Rules Evaluation
// ============================================================================

/**
 * Evaluate all applicable discount rules for an order
 */
export async function evaluateDiscountRules(
  tenantOrgId: string,
  input: EvaluateDiscountRulesInput
): Promise<EvaluatedDiscount[]> {
  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantOrgId, async () => {
    // Get all active discount rules - middleware adds tenant_org_id automatically
    const rules = await prisma.org_discount_rules_cf.findMany({
      where: {
        tenant_org_id: tenantOrgId, // Explicit filter for clarity (middleware also adds it)
        is_active: true,
        is_enabled: true,
      },
      orderBy: {
        priority: 'desc', // Higher priority first
      },
    });

    const evaluatedDiscounts: EvaluatedDiscount[] = [];

    for (const rule of rules) {
      const isApplicable = checkRuleConditions(rule, input);

      if (isApplicable) {
        const discountAmount = calculateRuleDiscount(
          input.order_total,
          rule.discount_type as PromoDiscountType,
          Number(rule.discount_value)
        );

        evaluatedDiscounts.push({
          rule: mapDiscountRuleToType(rule),
          discount_amount: discountAmount,
          applied: true,
        });
      }
    }

    return evaluatedDiscounts;
  });
}

/**
 * Check if discount rule conditions are met
 */
function checkRuleConditions(
  rule: any,
  input: EvaluateDiscountRulesInput
): boolean {
  const conditions = rule.conditions as any;

  // Check minimum order amount
  if (conditions.min_order_amount && input.order_total < conditions.min_order_amount) {
    return false;
  }

  // Check minimum items
  if (conditions.min_items && input.items_count < conditions.min_items) {
    return false;
  }

  // Check service categories
  if (conditions.service_categories && conditions.service_categories.length > 0) {
    const hasMatchingCategory = input.service_categories.some((cat) =>
      conditions.service_categories.includes(cat)
    );
    if (!hasMatchingCategory) {
      return false;
    }
  }

  // Check customer tier
  if (
    conditions.customer_tiers &&
    conditions.customer_tiers.length > 0 &&
    input.customer_tier
  ) {
    if (!conditions.customer_tiers.includes(input.customer_tier)) {
      return false;
    }
  }

  // Check day of week
  if (conditions.days_of_week && conditions.days_of_week.length > 0) {
    const orderDate = input.order_date ? new Date(input.order_date) : new Date();
    const dayOfWeek = orderDate.getDay();
    if (!conditions.days_of_week.includes(dayOfWeek)) {
      return false;
    }
  }

  // Check time ranges
  if (conditions.time_ranges && conditions.time_ranges.length > 0) {
    const orderDate = input.order_date ? new Date(input.order_date) : new Date();
    const currentTime = orderDate.toTimeString().slice(0, 5); // HH:MM format

    const isInTimeRange = conditions.time_ranges.some((range: any) => {
      return currentTime >= range.start && currentTime <= range.end;
    });

    if (!isInTimeRange) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate discount amount based on rule
 */
function calculateRuleDiscount(
  orderTotal: number,
  discountType: PromoDiscountType,
  discountValue: number
): number {
  if (discountType === 'percentage') {
    return (orderTotal * discountValue) / 100;
  }
  return discountValue;
}

/**
 * Get best applicable discount for order
 */
export async function getBestDiscount(
  tenantOrgId: string,
  input: EvaluateDiscountRulesInput
): Promise<EvaluatedDiscount | null> {
  const discounts = await evaluateDiscountRules(tenantOrgId, input);

  if (discounts.length === 0) {
    return null;
  }

  // Return discount with highest amount
  return discounts.reduce((best, current) =>
    current.discount_amount > best.discount_amount ? current : best
  );
}

// ============================================================================
// Promo Code Management
// ============================================================================

/**
 * Get all active promo codes for tenant
 */
export async function getActivePromoCodes(
  tenantOrgId: string
): Promise<PromoCode[]> {
  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantOrgId, async () => {
    const promoCodes = await prisma.org_promotions_mst.findMany({
      where: {
        tenant_org_id: tenantOrgId, // Explicit filter for clarity (middleware also adds it)
        is_active: true,
        is_enabled: true,
        valid_from: {
          lte: new Date(),
        },
        OR: [
          { valid_to: null },
          { valid_to: { gte: new Date() } },
        ],
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return promoCodes.map(mapPromoCodeToType);
  });
}

/**
 * Get promo code statistics
 */
export async function getPromoCodeStats(promoCodeId: string): Promise<{
  total_uses: number;
  total_discount_given: number;
  remaining_uses: number | null;
  unique_customers: number;
}> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    const promoCode = await prisma.org_promotions_mst.findUnique({
      where: { id: promoCodeId },
    });

    if (!promoCode) {
      throw new Error('Promo code not found');
    }

    const usages = await prisma.org_promotion_usage_dtl.findMany({
      where: {
        promo_code_id: promoCodeId,
      },
    });

    const totalDiscountGiven = usages.reduce(
      (sum, usage) => sum + Number(usage.discount_amount),
      0
    );

    const uniqueCustomers = new Set(
      usages.filter((u) => u.customer_id).map((u) => u.customer_id)
    ).size;

    const remainingUses =
      promoCode.max_uses !== null && promoCode.current_uses !== null
        ? Math.max(0, promoCode.max_uses - promoCode.current_uses)
        : null;

    return {
      total_uses: promoCode.current_uses || 0,
      total_discount_given: totalDiscountGiven,
      remaining_uses: remainingUses,
      unique_customers: uniqueCustomers,
    };
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map Prisma promo code to PromoCode type
 */
function mapPromoCodeToType(promoCode: any): PromoCode {
  return {
    id: promoCode.id,
    tenant_org_id: promoCode.tenant_org_id,
    promo_code: promoCode.promo_code,
    promo_name: promoCode.promo_name,
    promo_name2: promoCode.promo_name2 ?? undefined,
    description: promoCode.description ?? undefined,
    description2: promoCode.description2 ?? undefined,
    discount_type: promoCode.discount_type as PromoDiscountType,
    discount_value: Number(promoCode.discount_value),
    max_discount_amount: promoCode.max_discount_amount
      ? Number(promoCode.max_discount_amount)
      : undefined,
    min_order_amount: Number(promoCode.min_order_amount),
    max_order_amount: promoCode.max_order_amount
      ? Number(promoCode.max_order_amount)
      : undefined,
    applicable_categories: promoCode.applicable_categories as string[] | undefined,
    max_uses: promoCode.max_uses ?? undefined,
    max_uses_per_customer: promoCode.max_uses_per_customer,
    current_uses: promoCode.current_uses,
    valid_from: promoCode.valid_from.toISOString(),
    valid_to: promoCode.valid_to?.toISOString(),
    is_active: promoCode.is_active,
    is_enabled: promoCode.is_enabled,
    metadata: promoCode.metadata
      ? JSON.parse(promoCode.metadata as string)
      : undefined,
    created_at: promoCode.created_at.toISOString(),
    created_by: promoCode.created_by ?? undefined,
    updated_at: promoCode.updated_at?.toISOString(),
    updated_by: promoCode.updated_by ?? undefined,
  };
}

/**
 * Map Prisma discount rule to DiscountRule type
 */
function mapDiscountRuleToType(rule: any): DiscountRule {
  return {
    id: rule.id,
    tenant_org_id: rule.tenant_org_id,
    rule_code: rule.rule_code,
    rule_name: rule.rule_name,
    rule_name2: rule.rule_name2 ?? undefined,
    description: rule.description ?? undefined,
    description2: rule.description2 ?? undefined,
    rule_type: rule.rule_type,
    discount_type: rule.discount_type as PromoDiscountType,
    discount_value: Number(rule.discount_value),
    conditions: rule.conditions as any,
    priority: rule.priority,
    can_stack_with_promo: rule.can_stack_with_promo,
    can_stack_with_other_rules: rule.can_stack_with_other_rules,
    valid_from: rule.valid_from.toISOString(),
    valid_to: rule.valid_to?.toISOString(),
    is_active: rule.is_active,
    is_enabled: rule.is_enabled,
    metadata: rule.metadata ? JSON.parse(rule.metadata as string) : undefined,
    created_at: rule.created_at.toISOString(),
    created_by: rule.created_by ?? undefined,
    updated_at: rule.updated_at?.toISOString(),
    updated_by: rule.updated_by ?? undefined,
  };
}
