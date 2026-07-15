import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import { PROMO_TYPES } from '@/lib/constants/order-financial';
import type { PromoType } from '@/lib/constants/order-financial';
import { applyPromoCodeTx, evaluatePromoCode } from './discount-service';
import { Decimal } from '@prisma/client/runtime/library';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function toNumber(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

/**
 *
 */
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

/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param */
/**
 * Return all auto-apply promotions (`is_auto_apply = true`) for the order context.
 */
export async function getAutoApplyPromotions(tenantId: string, _orderAmount: number) {
  const now = new Date();
  return withTenantContext(tenantId, () =>
    prisma.org_promotions_mst.findMany({
      where: {
        tenant_org_id: tenantId,
        is_auto_apply: true,
        is_active:     true,
        is_enabled:    true,
        rec_status:    1,
        valid_from:    { lte: now },
        AND: [{ OR: [{ valid_to: null }, { valid_to: { gte: now } }] }],
      },
      orderBy: { discount_value: 'desc' },
    })
  );
}

/**
 * Validate a promo code for the **marketing-admin** preview path
 * (`POST /api/v1/marketing/promotions/validate`).
 *
 * Thin adapter over the canonical {@link evaluatePromoCode} in
 * `discount-service.ts` — the SAME evaluation the checkout flow uses — so the
 * admin preview can never disagree with what checkout will actually accept.
 * Returns the marketing `PromoValidation` shape for backward compatibility with
 * this route.
 */
export async function validatePromoCode(
  tenantId: string,
  code: string,
  customerId?: string,
  orderAmount = 0
): Promise<PromoValidation> {
  const result = await evaluatePromoCode({ tenantId, code, customerId, orderTotal: orderAmount });

  if (!result.isValid || !result.promo) {
    return { isValid: false, error: result.error };
  }
  return { isValid: true, promotion: result.promo, discount: result.discountAmount };
}

/**
 * Calculate the discount amount for a promotion against the given order total.
 *
 * Case-insensitive on `promoType` — the `discount_type` column is stored
 * lower-case, so a value passed straight from the row must still match the
 * upper-case `PROMO_TYPES` codes (otherwise a percentage promo silently yields 0).
 *
 * @remarks Retained for backward compatibility; the canonical promo-apply and
 * preview discount math now lives in `discount-service` ({@link evaluatePromoCode}).
 */
export function calculatePromotionDiscount(
  promoType: PromoType,
  promo: { discount_value?: Decimal | null; max_discount_amount?: Decimal | null },
  orderAmount: number
): number {
  const type = String(promoType).toUpperCase();
  if (type === PROMO_TYPES.PERCENTAGE) {
    const pct  = toNumber(promo.discount_value);
    const calc = orderAmount * (pct / 100);
    const max  = toNumber(promo.max_discount_amount);
    return max > 0 ? Math.min(calc, max) : calc;
  }
  if (type === PROMO_TYPES.FIXED_AMOUNT) {
    return Math.min(toNumber(promo.discount_value), orderAmount);
  }
  // BUY_X_GET_Y and FREE_ITEM require item-level logic — return 0 here (handled at item level)
  return 0;
}

/**
 * Apply a promotion within a transaction — writes usage record and increments counters.
 *
 * @deprecated Use {@link applyPromoCodeTx} from `discount-service.ts` — the
 * canonical, hardened promo-apply path used by order submit. It re-checks
 * `max_uses` **inside** the row lock (no TOCTOU), writes the idempotency key
 * (DB-level dedupe via `uq_promo_usage_idempotency`), and has a reversal
 * counterpart (`reversePromoUsageTx`). This function has **no internal
 * callers**; it now delegates to `applyPromoCodeTx` so the two cannot drift.
 * Do not add new callers — call `applyPromoCodeTx` directly.
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
): Promise<void> {
  const { tenantId, promotionId, customerId, orderId, discountAmount, orderTotal } = params;

  await applyPromoCodeTx(tx, {
    promoCodeId:      promotionId,
    orderId,
    tenantOrgId:      tenantId,
    customerId,
    discountAmount,
    orderTotalBefore: orderTotal,
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
  isAutoApply?: boolean;
  createdBy?: string;
}) {
  return withTenantContext(tenantId, () =>
    prisma.org_promotions_mst.create({
      data: {
        tenant_org_id:            tenantId,
        promo_name:               data.name,
        promo_name2:              data.name2 ?? null,
        // Codes are matched case-insensitively (looked up upper-cased), so
        // store them upper-cased to guarantee a match at checkout/preview.
        promo_code:               data.promoCode ? data.promoCode.toUpperCase() : null,
        // `discount_type` column convention is lower-case (mirrors
        // `PromoDiscountType`); `promo_type` stays the upper-case PROMO_TYPES code.
        discount_type:            data.promoType.toLowerCase(),
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
        is_auto_apply:            data.isAutoApply ?? !data.promoCode,
        rec_status:               1,
        created_by:               data.createdBy ?? null,
      },
    })
  );
}

/**
 * Enable/disable a promotion without archiving it.
 * Writes `is_enabled` (same semantics as /promos), not `is_active`.
 */
export async function togglePromotionActive(tenantId: string, promoId: string, isEnabled: boolean) {
  return withTenantContext(tenantId, () =>
    prisma.org_promotions_mst.update({
      where: { id: promoId, tenant_org_id: tenantId },
      data:  { is_enabled: isEnabled, updated_at: new Date() },
    })
  );
}
