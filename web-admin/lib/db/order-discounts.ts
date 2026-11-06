import { prisma } from '@/lib/db/prisma';
import {
  DISCOUNT_SOURCE_TYPE,
  DISCOUNT_CALC_TYPE,
  type DiscountSourceType,
} from '@/lib/constants/discount-source-type';
import type { OrderDiscountLine } from './order-discounts-types';

export type { OrderDiscountLine } from './order-discounts-types';
export { sourceLabel } from './order-discounts-types';

/** Transaction client type for use inside prisma.$transaction */
type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// ============================================================================
// Types
// ============================================================================

/**
 *
 */
export interface DiscountLineInput {
  sourceType: DiscountSourceType;
  sourceId?: string;
  sourceName: string;
  sourceName2?: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountRate?: number;
  discountAmount: number;
}

// ============================================================================
// Helpers
// ============================================================================

/* eslint-disable jsdoc/require-param */
/**
 * Build discount lines from stored order fields.
 * Used by OrderService.createOrder (traditional path) and payment-service (quick-drop path).
 */
export function buildDiscountLinesFromOrderInput(input: {
  discountType?: string | null;
  discountRate?: number | null;
  discountAmount?: number | null;
  promoCodeId?: string | null;
  promoCode?: string | null;
  promoDiscountAmount?: number | null;
  giftCardId?: string | null;
  giftCardNumber?: string | null;
  giftCardDiscountAmount?: number | null;
}): DiscountLineInput[] {
  const lines: DiscountLineInput[] = [];

  const manualAmount = Number(input.discountAmount ?? 0);
  if (manualAmount > 0) {
    const isPercent = (input.discountType ?? '').toUpperCase() === DISCOUNT_CALC_TYPE.PERCENTAGE;
    lines.push({
      sourceType:    DISCOUNT_SOURCE_TYPE.MANUAL,
      sourceName:    'Manual Discount',
      sourceName2:   'خصم يدوي',
      discountType:  isPercent ? DISCOUNT_CALC_TYPE.PERCENTAGE : DISCOUNT_CALC_TYPE.FIXED_AMOUNT,
      discountRate:  isPercent ? (input.discountRate ?? undefined) : undefined,
      discountAmount: manualAmount,
    });
  }

  const promoAmount = Number(input.promoDiscountAmount ?? 0);
  if (promoAmount > 0) {
    const promoLabel = input.promoCode ? input.promoCode.toUpperCase() : 'Promo Code';
    lines.push({
      sourceType:    DISCOUNT_SOURCE_TYPE.PROMO_CODE,
      sourceId:      input.promoCodeId ?? undefined,
      sourceName:    promoLabel,
      discountType:  DISCOUNT_CALC_TYPE.FIXED_AMOUNT,
      discountAmount: promoAmount,
    });
  }

  return lines;
}

// ============================================================================
// DB Write Functions
// ============================================================================

/**
 * Void all active discount lines for an order (cancellation/refund flow).
 * Marks is_voided=true; rows remain in table for accounting history.
 */
export async function voidDiscountLinesTx(
  tx: PrismaTx,
  params: {
    orderId: string;
    tenantOrgId: string;
    voidedBy?: string;
  }
): Promise<void> {
  const { orderId, tenantOrgId, voidedBy } = params;
  await tx.org_order_discounts_dtl.updateMany({
    where: { order_id: orderId, tenant_org_id: tenantOrgId, is_voided: false },
    data: {
      is_voided:  true,
      voided_at:  new Date(),
      voided_by:  voidedBy ?? null,
      updated_at: new Date(),
      updated_by: voidedBy ?? null,
    },
  });
}

// ============================================================================
// DB Read Functions
// ============================================================================

/**
 * Read all active (non-voided) discount lines for an order.
 * Ordered by applied_seq ASC then created_at ASC to handle lines added in separate tx calls.
 */
export async function getDiscountLinesForOrder(
  tenantOrgId: string,
  orderId: string
): Promise<OrderDiscountLine[]> {
  const rows = await prisma.org_order_discounts_dtl.findMany({
    where:   { order_id: orderId, tenant_org_id: tenantOrgId, is_voided: false },
    orderBy: [{ applied_seq: 'asc' }, { created_at: 'asc' }],
    select: {
      id:              true,
      tenant_org_id:   true,
      order_id:        true,
      applied_seq:     true,
      source_type:     true,
      source_id:       true,
      source_name:     true,
      source_name2:    true,
      discount_type:   true,
      discount_rate:   true,
      discount_amount: true,
      is_voided:       true,
      voided_at:       true,
      voided_by:       true,
      created_at:      true,
      created_by:      true,
    },
  });

  return rows.map((r) => ({
    ...r,
    discount_rate:   r.discount_rate != null ? Number(r.discount_rate) : null,
    discount_amount: Number(r.discount_amount),
  }));
}
