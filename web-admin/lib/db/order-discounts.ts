import { prisma } from '@/lib/db/prisma';
import {
  DISCOUNT_SOURCE_TYPE,
  DISCOUNT_CALC_TYPE,
  type DiscountSourceType,
} from '@/lib/constants/discount-source-type';

export type { OrderDiscountLine } from './order-discounts-types';
export { sourceLabel } from './order-discounts-types';

/** Transaction client type for use inside prisma.$transaction */
type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// ============================================================================
// Types
// ============================================================================

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

  const giftAmount = Number(input.giftCardDiscountAmount ?? 0);
  if (giftAmount > 0) {
    const last4 = input.giftCardNumber ? input.giftCardNumber.slice(-4) : '????';
    lines.push({
      sourceType:    DISCOUNT_SOURCE_TYPE.GIFT_CARD,
      sourceId:      input.giftCardId ?? undefined,
      sourceName:    `Gift Card …${last4}`,
      discountType:  DISCOUNT_CALC_TYPE.FIXED_AMOUNT,
      discountAmount: giftAmount,
    });
  }

  return lines;
}

// ============================================================================
// DB Write Functions
// ============================================================================

/** Prisma-compatible client interface for discount line operations (accepts tx or prisma directly) */
type DiscountDbClient = Pick<typeof prisma, 'org_ord_discounts_dtl'>;

/**
 * Insert discount lines using any Prisma-compatible client (tx or prisma directly).
 * applied_seq = MAX(existing seq for this order) + array_index + 1
 * — safe for multiple calls (creation + payment-time); never produces duplicate seq values.
 * Skips lines with discountAmount <= 0. Idempotency is caller's responsibility.
 */
async function insertDiscountLinesInternal(
  db: DiscountDbClient,
  params: {
    orderId: string;
    tenantOrgId: string;
    lines: DiscountLineInput[];
    createdBy?: string;
  }
): Promise<void> {
  const { orderId, tenantOrgId, lines, createdBy } = params;
  const positiveLines = lines.filter((l) => l.discountAmount > 0);
  if (positiveLines.length === 0) return;

  const existing = await db.org_ord_discounts_dtl.aggregate({
    where: { order_id: orderId, tenant_org_id: tenantOrgId },
    _max: { applied_seq: true },
  });
  const baseSeq = existing._max.applied_seq ?? 0;

  await db.org_ord_discounts_dtl.createMany({
    data: positiveLines.map((line, index) => ({
      tenant_org_id:   tenantOrgId,
      order_id:        orderId,
      applied_seq:     baseSeq + index + 1,
      source_type:     line.sourceType,
      source_id:       line.sourceId ?? null,
      source_name:     line.sourceName,
      source_name2:    line.sourceName2 ?? null,
      discount_type:   line.discountType,
      discount_rate:   line.discountRate != null ? line.discountRate : null,
      discount_amount: line.discountAmount,
      created_by:      createdBy ?? null,
    })),
  });
}

/**
 * Insert discount lines inside a caller-owned Prisma transaction.
 * applied_seq = MAX(existing seq for this order) + array_index + 1
 * — safe for multiple calls (creation + payment-time); never produces duplicate seq values.
 * Skips lines with discountAmount <= 0. Idempotency is caller's responsibility.
 */
export async function insertDiscountLinesTx(
  tx: PrismaTx,
  params: {
    orderId: string;
    tenantOrgId: string;
    lines: DiscountLineInput[];
    createdBy?: string;
  }
): Promise<void> {
  return insertDiscountLinesInternal(tx as unknown as DiscountDbClient, params);
}

/** Insert discount lines outside a transaction (e.g. createOrder Supabase path). */
export async function insertDiscountLines(params: {
  orderId: string;
  tenantOrgId: string;
  lines: DiscountLineInput[];
  createdBy?: string;
}): Promise<void> {
  return insertDiscountLinesInternal(prisma, params);
}

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
  await tx.org_ord_discounts_dtl.updateMany({
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
  const rows = await prisma.org_ord_discounts_dtl.findMany({
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
