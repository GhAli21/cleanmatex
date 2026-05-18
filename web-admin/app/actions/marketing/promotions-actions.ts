/**
 * Server Actions: Promotions Management
 *
 * listPromotionsAction    — paginated list of promotions for the tenant.
 * createPromotionAction   — create a new promotion.
 * updatePromotionAction   — update an existing promotion's editable fields.
 * togglePromotionAction   — activate or deactivate a promotion.
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
import type { PromoType } from '@/lib/constants/order-financial';

export async function listPromotionsAction(page = 1, pageSize = 20) {
  try {
    const auth = await getAuthContext();
    const result = await listPromotions(auth.tenantId, page, pageSize);
    return { success: true as const, data: result };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load promotions',
    };
  }
}

export interface CreatePromotionInput {
  name:                string;
  name2?:              string;
  promoCode?:          string;
  promoType:           PromoType;
  discountValue:       number;
  maxDiscountAmount?:  number;
  minOrderAmount?:     number;
  startsAt?:           string;
  expiresAt?:          string;
  maxUses?:            number;
  maxUsesPerCustomer?: number;
}

export async function createPromotionAction(input: CreatePromotionInput) {
  try {
    const auth = await getAuthContext();
    const promo = await createPromotion(auth.tenantId, {
      name:                input.name,
      name2:               input.name2,
      promoCode:           input.promoCode,
      promoType:           input.promoType,
      discountValue:       input.discountValue,
      maxDiscountAmount:   input.maxDiscountAmount,
      minOrderAmount:      input.minOrderAmount,
      startsAt:            input.startsAt ? new Date(input.startsAt) : undefined,
      expiresAt:           input.expiresAt ? new Date(input.expiresAt) : undefined,
      maxUses:             input.maxUses,
      maxUsesPerCustomer:  input.maxUsesPerCustomer,
      createdBy:           auth.userId,
    });
    revalidatePath('/dashboard/marketing/promotions');
    return { success: true as const, data: promo };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to create promotion',
    };
  }
}

export interface UpdatePromotionInput extends Partial<CreatePromotionInput> {
  id: string;
}

export async function updatePromotionAction(input: UpdatePromotionInput) {
  try {
    const auth = await getAuthContext();
    const tenantId = auth.tenantId;

    const updated = await withTenantContext(tenantId, () =>
      prisma.org_promotions_mst.update({
        where: { id: input.id, tenant_org_id: tenantId },
        data: {
          promo_name:            input.name,
          promo_name2:           input.name2 ?? null,
          promo_code:            input.promoCode ?? null,
          discount_type:         input.promoType,
          promo_type:            input.promoType,
          discount_value:        input.discountValue,
          max_discount_amount:   input.maxDiscountAmount ?? null,
          min_order_amount:      input.minOrderAmount ?? null,
          valid_from:            input.startsAt  ? new Date(input.startsAt)  : undefined,
          valid_to:              input.expiresAt ? new Date(input.expiresAt) : null,
          max_uses:              input.maxUses ?? null,
          max_uses_per_customer: input.maxUsesPerCustomer ?? null,
          updated_at:            new Date(),
        },
      })
    );

    revalidatePath('/dashboard/marketing/promotions');
    return { success: true as const, data: updated };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to update promotion',
    };
  }
}

export async function togglePromotionAction(promoId: string, isActive: boolean) {
  try {
    const auth = await getAuthContext();
    await togglePromotionActive(auth.tenantId, promoId, isActive);
    revalidatePath('/dashboard/marketing/promotions');
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to toggle promotion',
    };
  }
}
