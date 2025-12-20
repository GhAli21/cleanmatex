/**
 * Discount Service for CleanMateX
 *
 * Handles all discount-related operations including:
 * - Promo code validation and application
 * - Discount rule evaluation
 * - Usage tracking and limits
 * - Discount calculations
 */

import { prisma } from '../prisma';
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

// ============================================================================
// Promo Code Validation
// ============================================================================

/**
 * Validate and retrieve promo code information
 */
export async function validatePromoCode(
  input: ValidatePromoCodeInput
): Promise<ValidatePromoCodeResult> {
  try {
    // Find promo code
    const promoCode = await prisma.org_promo_codes_mst.findFirst({
      where: {
        promo_code: input.promo_code.toUpperCase(),
        is_active: true,
        is_enabled: true,
      },
    });

    if (!promoCode) {
      return {
        isValid: false,
        error: 'Promo code not found or is no longer active',
        errorCode: 'NOT_FOUND',
      };
    }

    // Check validity dates
    const now = new Date();
    const validFrom = new Date(promoCode.valid_from);
    const validTo = promoCode.valid_to ? new Date(promoCode.valid_to) : null;

    if (now < validFrom) {
      return {
        isValid: false,
        error: 'Promo code is not yet valid',
        errorCode: 'EXPIRED',
      };
    }

    if (validTo && now > validTo) {
      return {
        isValid: false,
        error: 'Promo code has expired',
        errorCode: 'EXPIRED',
      };
    }

    // Check max uses
    if (
      promoCode.max_uses !== null &&
      promoCode.current_uses !== null &&
      promoCode.current_uses >= promoCode.max_uses
    ) {
      return {
        isValid: false,
        error: 'Promo code has reached maximum usage limit',
        errorCode: 'MAX_USES_EXCEEDED',
      };
    }

    // Check minimum order amount
    if (input.order_total < Number(promoCode.min_order_amount)) {
      return {
        isValid: false,
        error: `Order total must be at least OMR ${Number(
          promoCode.min_order_amount
        ).toFixed(3)}`,
        errorCode: 'MIN_ORDER_NOT_MET',
      };
    }

    // Check maximum order amount
    if (
      promoCode.max_order_amount &&
      input.order_total > Number(promoCode.max_order_amount)
    ) {
      return {
        isValid: false,
        error: `Promo code only valid for orders up to OMR ${Number(
          promoCode.max_order_amount
        ).toFixed(3)}`,
        errorCode: 'MIN_ORDER_NOT_MET',
      };
    }

    // Check applicable categories
    if (
      promoCode.applicable_categories &&
      input.service_categories &&
      input.service_categories.length > 0
    ) {
      const applicableCategories = promoCode.applicable_categories as string[];
      const hasApplicableCategory = input.service_categories.some((cat) =>
        applicableCategories.includes(cat)
      );

      if (!hasApplicableCategory) {
        return {
          isValid: false,
          error: 'Promo code not applicable to selected services',
          errorCode: 'CATEGORY_NOT_APPLICABLE',
        };
      }
    }

    // Check customer usage limit
    if (input.customer_id && promoCode.max_uses_per_customer !== null) {
      const customerUsageCount = await prisma.org_promo_usage_log.count({
        where: {
          promo_code_id: promoCode.id,
          customer_id: input.customer_id,
        },
      });

      if (customerUsageCount >= promoCode.max_uses_per_customer) {
        return {
          isValid: false,
          error: 'You have reached the maximum usage limit for this promo code',
          errorCode: 'CUSTOMER_LIMIT_EXCEEDED',
        };
      }
    }

    // Calculate discount amount
    const discountAmount = calculatePromoDiscount(
      input.order_total,
      promoCode.discount_type as PromoDiscountType,
      Number(promoCode.discount_value),
      promoCode.max_discount_amount
        ? Number(promoCode.max_discount_amount)
        : undefined
    );

    return {
      isValid: true,
      promoCode: mapPromoCodeToType(promoCode),
      discountAmount,
    };
  } catch (error) {
    console.error('Error validating promo code:', error);
    return {
      isValid: false,
      error: 'An error occurred while validating promo code',
    };
  }
}

/**
 * Calculate promo code discount amount
 */
function calculatePromoDiscount(
  orderTotal: number,
  discountType: PromoDiscountType,
  discountValue: number,
  maxDiscountAmount?: number
): number {
  let discount = 0;

  if (discountType === 'percentage') {
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
 * Apply promo code to order and record usage
 */
export async function applyPromoCode(
  promoCodeId: string,
  orderId: string,
  invoiceId: string,
  tenantOrgId: string,
  customerId: string | undefined,
  discountAmount: number,
  orderTotalBefore: number,
  appliedBy?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Start transaction
    await prisma.$transaction(async (tx) => {
      // Record usage
      await tx.org_promo_usage_log.create({
        data: {
          tenant_org_id: tenantOrgId,
          promo_code_id: promoCodeId,
          customer_id: customerId,
          order_id: orderId,
          invoice_id: invoiceId,
          discount_amount: discountAmount,
          order_total_before: orderTotalBefore,
          order_total_after: orderTotalBefore - discountAmount,
          used_at: new Date(),
          used_by: appliedBy,
        },
      });

      // Increment usage count
      await tx.org_promo_codes_mst.update({
        where: { id: promoCodeId },
        data: {
          current_uses: {
            increment: 1,
          },
          updated_at: new Date(),
          updated_by: appliedBy,
        },
      });
    });

    return { success: true };
  } catch (error) {
    console.error('Error applying promo code:', error);
    return {
      success: false,
      error: 'Failed to apply promo code',
    };
  }
}

/**
 * Get promo code usage history
 */
export async function getPromoCodeUsage(
  promoCodeId: string
): Promise<PromoCodeUsage[]> {
  const usages = await prisma.org_promo_usage_log.findMany({
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
}

/**
 * Get customer's promo code usage count
 */
export async function getCustomerPromoUsageCount(
  promoCodeId: string,
  customerId: string
): Promise<number> {
  return prisma.org_promo_usage_log.count({
    where: {
      promo_code_id: promoCodeId,
      customer_id: customerId,
    },
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
  // Get all active discount rules
  const rules = await prisma.org_discount_rules_cf.findMany({
    where: {
      tenant_org_id: tenantOrgId,
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
  const promoCodes = await prisma.org_promo_codes_mst.findMany({
    where: {
      tenant_org_id: tenantOrgId,
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
  const promoCode = await prisma.org_promo_codes_mst.findUnique({
    where: { id: promoCodeId },
  });

  if (!promoCode) {
    throw new Error('Promo code not found');
  }

  const usages = await prisma.org_promo_usage_log.findMany({
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
