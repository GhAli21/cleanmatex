/**
 * Server Actions: Promotions Management (legacy V2 API surface)
 *
 * Kept for API/e2e callers. UI redirects to /promos.
 * Semantics aligned with promo-actions: is_enabled toggle, lowercase
 * discount_type, end-of-local-day expiry for date-only inputs.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import {
  listPromotions,
  createPromotion,
  togglePromotionActive,
} from '@/lib/services/promotion-engine.service';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { ClockError } from '@cmx/clock';
import { isCivilDateText } from '@/lib/clock/api-input';
import { civilDayBounds, parseInstant } from '@/lib/utils/operational-time';
import { resolveOperationalTimeZone } from '@/lib/utils/operational-zone.server';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import type { PromoType } from '@/lib/constants/order-financial';

async function canRead(): Promise<boolean> {
  return (
    (await hasPermissionServer('promotions:view')) ||
    (await hasPermissionServer('promotions:read'))
  );
}

async function canWrite(): Promise<boolean> {
  return (
    (await hasPermissionServer('promotions:manage')) ||
    (await hasPermissionServer('promotions:write'))
  );
}

function discountTypeFromPromoType(promoType: PromoType | string): string {
  const upper = String(promoType).toUpperCase();
  if (upper === 'FIXED_AMOUNT' || upper === 'FIXED') return 'fixed_amount';
  return 'percentage';
}

/**
 * A promotion bound from the form (S6). A civil day is a day at the organization (`accept_order`
 * zone): start = first instant of the day, end = last millisecond of the day. Before S6 the day
 * was read in the server's zone. An instant needs an offset. No zone: `TIMEZONE_NOT_CONFIGURED`.
 */
async function promoBound(tenantId: string, value: string, edge: 'start' | 'end'): Promise<Date> {
  if (!isCivilDateText(value)) return parseInstant(value);
  const zone = await resolveOperationalTimeZone(tenantId, 'accept_order', null);
  if (!zone) throw new ClockError('TIMEZONE_NOT_CONFIGURED');
  const bounds = civilDayBounds(value, zone);
  return edge === 'start' ? bounds.start : new Date(bounds.end.getTime() - 1);
}

async function parseStart(tenantId: string, value?: string): Promise<Date | undefined> {
  return value ? promoBound(tenantId, value, 'start') : undefined;
}

async function parseEnd(tenantId: string, value?: string): Promise<Date | null> {
  return value ? promoBound(tenantId, value, 'end') : null;
}

/**
 * @param page
 * @param pageSize
 */
export async function listPromotionsAction(page = 1, pageSize = 20) {
  try {
    const auth = await getAuthContext();
    if (!(await canRead())) {
      return { success: false as const, error: 'Permission denied' };
    }
    const result = await listPromotions(auth.tenantId, page, pageSize);
    return { success: true as const, data: result };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load promotions',
    };
  }
}

/**
 *
 */
export interface CreatePromotionInput {
  name: string;
  name2?: string;
  promoCode?: string;
  promoType: PromoType;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  startsAt?: string;
  expiresAt?: string;
  maxUses?: number;
  maxUsesPerCustomer?: number;
  isAutoApply?: boolean;
}

/**
 * @param input
 */
export async function createPromotionAction(input: CreatePromotionInput) {
  try {
    const auth = await getAuthContext();
    if (!(await canWrite())) {
      return { success: false as const, error: 'Permission denied' };
    }
    const promo = await createPromotion(auth.tenantId, {
      name: input.name,
      name2: input.name2,
      promoCode: input.promoCode,
      promoType: input.promoType,
      discountValue: input.discountValue,
      maxDiscountAmount: input.maxDiscountAmount,
      minOrderAmount: input.minOrderAmount,
      startsAt: await parseStart(auth.tenantId, input.startsAt),
      expiresAt: (await parseEnd(auth.tenantId, input.expiresAt)) ?? undefined,
      maxUses: input.maxUses,
      maxUsesPerCustomer: input.maxUsesPerCustomer,
      isAutoApply: input.isAutoApply ?? !input.promoCode,
      createdBy: auth.userId,
    });
    revalidatePath('/dashboard/marketing/promotions');
    revalidatePath('/dashboard/marketing/promos');
    return { success: true as const, data: promo };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to create promotion',
    };
  }
}

/**
 *
 */
export interface UpdatePromotionInput extends Partial<CreatePromotionInput> {
  id: string;
}

/**
 * @param input
 */
export async function updatePromotionAction(input: UpdatePromotionInput) {
  try {
    const auth = await getAuthContext();
    if (!(await canWrite())) {
      return { success: false as const, error: 'Permission denied' };
    }
    const tenantId = auth.tenantId;
    const discountType = input.promoType
      ? discountTypeFromPromoType(input.promoType)
      : undefined;

    const validFrom = input.startsAt !== undefined ? await parseStart(tenantId, input.startsAt) : undefined;
    const validTo = input.expiresAt !== undefined ? await parseEnd(tenantId, input.expiresAt) : undefined;
    const updated = await withTenantContext(tenantId, () =>
      prisma.org_promotions_mst.update({
        where: { id: input.id, tenant_org_id: tenantId },
        data: {
          ...(input.name != null && { promo_name: input.name }),
          ...(input.name2 !== undefined && { promo_name2: input.name2 ?? null }),
          ...(input.promoCode !== undefined && {
            promo_code: input.promoCode ? input.promoCode.toUpperCase() : null,
          }),
          ...(discountType && {
            discount_type: discountType,
            promo_type: String(input.promoType).toUpperCase(),
          }),
          ...(input.discountValue != null && { discount_value: input.discountValue }),
          ...(input.maxDiscountAmount !== undefined && {
            max_discount_amount: input.maxDiscountAmount ?? null,
          }),
          ...(input.minOrderAmount !== undefined && {
            min_order_amount: input.minOrderAmount ?? null,
          }),
          ...(input.startsAt !== undefined && { valid_from: validFrom }),
          ...(input.expiresAt !== undefined && { valid_to: validTo }),
          ...(input.maxUses !== undefined && { max_uses: input.maxUses ?? null }),
          ...(input.maxUsesPerCustomer !== undefined && {
            max_uses_per_customer: input.maxUsesPerCustomer ?? null,
          }),
          ...(input.isAutoApply !== undefined && { is_auto_apply: input.isAutoApply }),
          updated_at: new Date(),
        },
      })
    );

    revalidatePath('/dashboard/marketing/promotions');
    revalidatePath('/dashboard/marketing/promos');
    return { success: true as const, data: updated };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to update promotion',
    };
  }
}

/**
 * @param promoId
 * @param isEnabled
 */
export async function togglePromotionAction(promoId: string, isEnabled: boolean) {
  try {
    const auth = await getAuthContext();
    if (!(await canWrite())) {
      return { success: false as const, error: 'Permission denied' };
    }
    await togglePromotionActive(auth.tenantId, promoId, isEnabled);
    revalidatePath('/dashboard/marketing/promotions');
    revalidatePath('/dashboard/marketing/promos');
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to toggle promotion',
    };
  }
}
