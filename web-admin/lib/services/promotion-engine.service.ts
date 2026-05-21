import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import { PROMO_TYPES } from '@/lib/constants/order-financial';
import type { PromoType } from '@/lib/constants/order-financial';
import { Decimal } from '@prisma/client/runtime/library';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function toNumber(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

export interface PromoValidation {
  isValid:    boolean;
  promotion?: Awaited<ReturnType<typeof getPromotion>>;
  discount?:  number;
  error?:     string;
}

async function getPromotion(tenantId: string, promoId: string) {
  return prisma.org_promotions_mst.findFirst({
    where: { tenant_org_id: tenantId, id: promoId, is_active: true, rec_status: 1 },
  });
}

/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param, jsdoc/require-returns */
/**
 * Return all auto-apply promotions (NULL promo_code) for the given order context.
 */
export async function getAutoApplyPromotions(tenantId: string, orderAmount: number) {
  const now = new Date();
  return withTenantContext(tenantId, () =>
    prisma.org_promotions_mst.findMany({
      where: {
        tenant_org_id: tenantId,
        promo_code:    null,
        is_active:     true,
        rec_status:    1,
        valid_from:    { lte: now },
        OR: [{ valid_to: null }, { valid_to: { gte: now } }],
      },
      orderBy: { discount_value: 'desc' },
    })
  );
}

/**
 * Validate a promo code before checkout. Returns the resolved discount amount.
 */
export async function validatePromoCode(
  tenantId: string,
  code: string,
  customerId?: string,
  orderAmount = 0
): Promise<PromoValidation> {
  const now = new Date();

  const promo = await withTenantContext(tenantId, () =>
    prisma.org_promotions_mst.findFirst({
      where: {
        tenant_org_id: tenantId,
        promo_code:    code,
        is_active:     true,
        rec_status:    1,
        valid_from:    { lte: now },
        OR: [{ valid_to: null }, { valid_to: { gte: now } }],
      },
    })
  );

  if (!promo) return { isValid: false, error: 'Promo code not found or expired' };

  const minOrder = toNumber(promo.min_order_amount);
  if (minOrder > 0 && orderAmount < minOrder) {
    return { isValid: false, error: `Minimum order amount is ${minOrder}` };
  }

  if (promo.max_uses !== null && promo.max_uses !== undefined) {
    const used = await withTenantContext(tenantId, () =>
      prisma.org_promotion_usage_dtl.count({
        where: { tenant_org_id: tenantId, promo_code_id: promo.id },
      })
    );
    if (used >= promo.max_uses!) return { isValid: false, error: 'Promo code usage limit reached' };
  }

  if (customerId && promo.max_uses_per_customer !== null && promo.max_uses_per_customer !== undefined) {
    const usedByCustomer = await withTenantContext(tenantId, () =>
      prisma.org_promotion_usage_dtl.count({
        where: { tenant_org_id: tenantId, promo_code_id: promo.id, customer_id: customerId },
      })
    );
    if (usedByCustomer >= promo.max_uses_per_customer!) {
      return { isValid: false, error: 'You have already used this promo code the maximum number of times' };
    }
  }

  const discount = calculatePromotionDiscount(promo.discount_type as PromoType, promo, orderAmount);
  return { isValid: true, promotion: promo, discount };
}

/**
 * Calculate the discount amount for a promotion against the given order total.
 */
export function calculatePromotionDiscount(
  promoType: PromoType,
  promo: { discount_value?: Decimal | null; max_discount_amount?: Decimal | null },
  orderAmount: number
): number {
  if (promoType === PROMO_TYPES.PERCENTAGE) {
    const pct  = toNumber(promo.discount_value);
    const calc = orderAmount * (pct / 100);
    const max  = toNumber(promo.max_discount_amount);
    return max > 0 ? Math.min(calc, max) : calc;
  }
  if (promoType === PROMO_TYPES.FIXED_AMOUNT) {
    return Math.min(toNumber(promo.discount_value), orderAmount);
  }
  // BUY_X_GET_Y and FREE_ITEM require item-level logic — return 0 here (handled at item level)
  return 0;
}

/**
 * Apply a promotion within a transaction — writes usage record and increments counters.
 */
export async function applyPromotionTx(
  tx: PrismaTransactionClient,
  params: {
    tenantId:       string;
    promotionId:    string;
    customerId?:    string;
    orderId:        string;
    discountAmount: number;
    orderTotal:     number;
  }
) {
  const { tenantId, promotionId, customerId, orderId, discountAmount, orderTotal } = params;

  // Lock the promotion row for atomic usage counter update
  const rows = await tx.$queryRaw<{ id: string; current_uses: number }[]>`
    SELECT id, COALESCE(current_uses, 0) AS current_uses
    FROM org_promotions_mst
    WHERE tenant_org_id = ${tenantId}::uuid AND id = ${promotionId}::uuid
    FOR UPDATE`;

  if (!rows[0]) throw new Error('Promotion not found');

  await tx.org_promotions_mst.update({
    where: { id: promotionId },
    data:  { current_uses: { increment: 1 }, updated_at: new Date() },
  });

  return tx.org_promotion_usage_dtl.create({
    data: {
      tenant_org_id:     tenantId,
      promo_code_id:     promotionId,
      customer_id:       customerId ?? null,
      order_id:          orderId,
      discount_amount:   discountAmount,
      order_total_before: orderTotal + discountAmount,
      order_total_after:  orderTotal,
      used_at:           new Date(),
    },
  });
}

// ── CRUD helpers for the Promotions management UI ────────────────────────────

export async function listPromotions(tenantId: string, page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize;
  const [items, total] = await withTenantContext(tenantId, () =>
    Promise.all([
      prisma.org_promotions_mst.findMany({
        where:   { tenant_org_id: tenantId, rec_status: 1 },
        orderBy: { created_at: 'desc' },
        skip,
        take:    pageSize,
      }),
      prisma.org_promotions_mst.count({ where: { tenant_org_id: tenantId, rec_status: 1 } }),
    ])
  );
  return { items, total, page, pageSize };
}

export async function createPromotion(tenantId: string, data: {
  name: string; name2?: string;
  promoCode?: string; promoType: PromoType;
  discountValue: number; maxDiscountAmount?: number;
  minOrderAmount?: number; startsAt?: Date; expiresAt?: Date;
  maxUses?: number; maxUsesPerCustomer?: number;
  createdBy?: string;
}) {
  return withTenantContext(tenantId, () =>
    prisma.org_promotions_mst.create({
      data: {
        tenant_org_id:            tenantId,
        promo_name:               data.name,
        promo_name2:              data.name2 ?? null,
        promo_code:               data.promoCode ?? null,
        discount_type:            data.promoType,
        promo_type:               data.promoType,
        discount_value:           data.discountValue,
        max_discount_amount:      data.maxDiscountAmount ?? null,
        min_order_amount:         data.minOrderAmount ?? null,
        valid_from:               data.startsAt ?? new Date(),
        valid_to:                 data.expiresAt ?? null,
        max_uses:                 data.maxUses ?? null,
        max_uses_per_customer:    data.maxUsesPerCustomer ?? 1,
        current_uses:             0,
        is_active:                true,
        rec_status:               1,
        created_by:               data.createdBy ?? null,
      },
    })
  );
}

export async function togglePromotionActive(tenantId: string, promoId: string, isActive: boolean) {
  return withTenantContext(tenantId, () =>
    prisma.org_promotions_mst.update({
      where: { id: promoId, tenant_org_id: tenantId },
      data:  { is_active: isActive, updated_at: new Date() },
    })
  );
}
