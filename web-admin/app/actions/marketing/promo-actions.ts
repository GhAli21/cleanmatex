/**
 * Server Actions: Promo Codes
 *
 * CRUD operations for org_promo_codes_mst. All actions resolve tenant from
 * session and filter by tenant_org_id — never expose cross-tenant data.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { getPromoCodeUsage } from '@/lib/services/discount-service';
import { logger } from '@/lib/utils/logger';
import type { PromoCode, PromoCodeUsage } from '@/lib/types/payment';

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const promoFormSchema = z.object({
  promo_code: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase letters, digits, hyphens, or underscores'),
  promo_name: z.string().min(1).max(200),
  promo_name2: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  description2: z.string().max(500).optional(),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.number().positive(),
  max_discount_amount: z.number().positive().optional(),
  min_order_amount: z.number().nonnegative().default(0),
  max_order_amount: z.number().positive().optional(),
  applicable_categories: z.array(z.string()).optional(),
  max_uses: z.number().int().positive().optional(),
  max_uses_per_customer: z.number().int().positive().optional(),
  valid_from: z.string().datetime(),
  valid_to: z.string().datetime().optional(),
  is_enabled: z.boolean().default(true),
});

type PromoFormInput = z.infer<typeof promoFormSchema>;

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * List promo codes for the current tenant with pagination and optional search.
 */
export async function listPromoCodes(params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'expired' | 'all';
}): Promise<
  | { success: true; data: PromoCode[]; total: number }
  | { success: false; error: string }
> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId } = auth;

    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, params.limit ?? 25);
    const skip = (page - 1) * limit;

    return withTenantContext(tenantId, async () => {
      // Build where clause — always filter by tenant_org_id.
      const where: Parameters<typeof prisma.org_promo_codes_mst.findMany>[0]['where'] = {
        tenant_org_id: tenantId,
        is_active: true,
      };

      if (params.search?.trim()) {
        where.OR = [
          { promo_code: { contains: params.search.trim(), mode: 'insensitive' } },
          { promo_name: { contains: params.search.trim(), mode: 'insensitive' } },
        ];
      }

      if (params.status === 'active') {
        where.is_enabled = true;
        where.valid_from = { lte: new Date() };
        where.OR = [
          ...(where.OR ?? []),
          { valid_to: null },
          { valid_to: { gte: new Date() } },
        ];
      } else if (params.status === 'expired') {
        where.valid_to = { lt: new Date() };
      }

      const [rows, total] = await Promise.all([
        prisma.org_promo_codes_mst.findMany({
          where,
          orderBy: { created_at: 'desc' },
          skip,
          take: limit,
        }),
        prisma.org_promo_codes_mst.count({ where }),
      ]);

      const data: PromoCode[] = rows.map((row) => ({
        id: row.id,
        tenant_org_id: row.tenant_org_id,
        promo_code: row.promo_code,
        promo_name: row.promo_name,
        promo_name2: row.promo_name2 ?? undefined,
        description: row.description ?? undefined,
        description2: row.description2 ?? undefined,
        discount_type: row.discount_type as 'percentage' | 'fixed',
        discount_value: Number(row.discount_value),
        max_discount_amount: row.max_discount_amount ? Number(row.max_discount_amount) : undefined,
        min_order_amount: Number(row.min_order_amount),
        max_order_amount: row.max_order_amount ? Number(row.max_order_amount) : undefined,
        applicable_categories: row.applicable_categories as string[] | undefined,
        max_uses: row.max_uses ?? undefined,
        max_uses_per_customer: row.max_uses_per_customer,
        current_uses: row.current_uses,
        valid_from: row.valid_from.toISOString(),
        valid_to: row.valid_to?.toISOString(),
        is_active: row.is_active,
        is_enabled: row.is_enabled,
        created_at: row.created_at.toISOString(),
        created_by: row.created_by ?? undefined,
        updated_at: row.updated_at?.toISOString(),
        updated_by: row.updated_by ?? undefined,
      }));

      return { success: true, data, total };
    });
  } catch (error) {
    logger.error('listPromoCodes failed', error as Error, {});
    return { success: false, error: 'Failed to load promo codes' };
  }
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Create a new promo code for the current tenant.
 */
export async function createPromoCode(
  input: PromoFormInput
): Promise<{ success: true; data: PromoCode } | { success: false; error: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId, userId } = auth;

    const parsed = promoFormSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    return withTenantContext(tenantId, async () => {
      // Enforce uniqueness per tenant.
      const existing = await prisma.org_promo_codes_mst.findFirst({
        where: {
          tenant_org_id: tenantId,
          promo_code: parsed.data.promo_code.toUpperCase(),
          is_active: true,
        },
        select: { id: true },
      });
      if (existing) {
        return { success: false, error: 'Promo code already exists for this tenant' };
      }

      const row = await prisma.org_promo_codes_mst.create({
        data: {
          tenant_org_id: tenantId,
          promo_code: parsed.data.promo_code.toUpperCase(),
          promo_name: parsed.data.promo_name,
          promo_name2: parsed.data.promo_name2,
          description: parsed.data.description,
          description2: parsed.data.description2,
          discount_type: parsed.data.discount_type,
          discount_value: parsed.data.discount_value,
          max_discount_amount: parsed.data.max_discount_amount,
          min_order_amount: parsed.data.min_order_amount,
          max_order_amount: parsed.data.max_order_amount,
          applicable_categories: parsed.data.applicable_categories,
          max_uses: parsed.data.max_uses,
          max_uses_per_customer: parsed.data.max_uses_per_customer,
          current_uses: 0,
          valid_from: new Date(parsed.data.valid_from),
          valid_to: parsed.data.valid_to ? new Date(parsed.data.valid_to) : undefined,
          is_enabled: parsed.data.is_enabled,
          is_active: true,
          created_at: new Date(),
          created_by: userId ?? undefined,
        },
      });

      revalidatePath('/dashboard/marketing/promos');

      return {
        success: true,
        data: {
          id: row.id,
          tenant_org_id: row.tenant_org_id,
          promo_code: row.promo_code,
          promo_name: row.promo_name,
          promo_name2: row.promo_name2 ?? undefined,
          description: row.description ?? undefined,
          description2: row.description2 ?? undefined,
          discount_type: row.discount_type as 'percentage' | 'fixed',
          discount_value: Number(row.discount_value),
          max_discount_amount: row.max_discount_amount ? Number(row.max_discount_amount) : undefined,
          min_order_amount: Number(row.min_order_amount),
          max_order_amount: row.max_order_amount ? Number(row.max_order_amount) : undefined,
          applicable_categories: row.applicable_categories as string[] | undefined,
          max_uses: row.max_uses ?? undefined,
          max_uses_per_customer: row.max_uses_per_customer,
          current_uses: row.current_uses,
          valid_from: row.valid_from.toISOString(),
          valid_to: row.valid_to?.toISOString(),
          is_active: row.is_active,
          is_enabled: row.is_enabled,
          created_at: row.created_at.toISOString(),
          created_by: row.created_by ?? undefined,
          updated_at: row.updated_at?.toISOString(),
          updated_by: row.updated_by ?? undefined,
        },
      };
    });
  } catch (error) {
    logger.error('createPromoCode failed', error as Error, {});
    return { success: false, error: 'Failed to create promo code' };
  }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/**
 * Update an existing promo code. Verifies ownership by tenant_org_id.
 */
export async function updatePromoCode(
  id: string,
  input: Partial<PromoFormInput>
): Promise<{ success: true; data: PromoCode } | { success: false; error: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId, userId } = auth;

    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_promo_codes_mst.findFirst({
        where: { id, tenant_org_id: tenantId, is_active: true },
      });
      if (!existing) {
        return { success: false, error: 'Promo code not found' };
      }

      const row = await prisma.org_promo_codes_mst.update({
        where: { id },
        data: {
          ...(input.promo_name != null && { promo_name: input.promo_name }),
          ...(input.promo_name2 !== undefined && { promo_name2: input.promo_name2 }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.description2 !== undefined && { description2: input.description2 }),
          ...(input.discount_type != null && { discount_type: input.discount_type }),
          ...(input.discount_value != null && { discount_value: input.discount_value }),
          ...(input.max_discount_amount !== undefined && { max_discount_amount: input.max_discount_amount }),
          ...(input.min_order_amount != null && { min_order_amount: input.min_order_amount }),
          ...(input.max_order_amount !== undefined && { max_order_amount: input.max_order_amount }),
          ...(input.applicable_categories !== undefined && { applicable_categories: input.applicable_categories }),
          ...(input.max_uses !== undefined && { max_uses: input.max_uses }),
          ...(input.max_uses_per_customer !== undefined && { max_uses_per_customer: input.max_uses_per_customer }),
          ...(input.valid_from != null && { valid_from: new Date(input.valid_from) }),
          ...(input.valid_to !== undefined && { valid_to: input.valid_to ? new Date(input.valid_to) : null }),
          ...(input.is_enabled != null && { is_enabled: input.is_enabled }),
          updated_at: new Date(),
          updated_by: userId ?? undefined,
        },
      });

      revalidatePath('/dashboard/marketing/promos');

      return {
        success: true,
        data: {
          id: row.id,
          tenant_org_id: row.tenant_org_id,
          promo_code: row.promo_code,
          promo_name: row.promo_name,
          promo_name2: row.promo_name2 ?? undefined,
          description: row.description ?? undefined,
          description2: row.description2 ?? undefined,
          discount_type: row.discount_type as 'percentage' | 'fixed',
          discount_value: Number(row.discount_value),
          max_discount_amount: row.max_discount_amount ? Number(row.max_discount_amount) : undefined,
          min_order_amount: Number(row.min_order_amount),
          max_order_amount: row.max_order_amount ? Number(row.max_order_amount) : undefined,
          applicable_categories: row.applicable_categories as string[] | undefined,
          max_uses: row.max_uses ?? undefined,
          max_uses_per_customer: row.max_uses_per_customer,
          current_uses: row.current_uses,
          valid_from: row.valid_from.toISOString(),
          valid_to: row.valid_to?.toISOString(),
          is_active: row.is_active,
          is_enabled: row.is_enabled,
          created_at: row.created_at.toISOString(),
          created_by: row.created_by ?? undefined,
          updated_at: row.updated_at?.toISOString(),
          updated_by: row.updated_by ?? undefined,
        },
      };
    });
  } catch (error) {
    logger.error('updatePromoCode failed', error as Error, { id });
    return { success: false, error: 'Failed to update promo code' };
  }
}

// ---------------------------------------------------------------------------
// Archive
// ---------------------------------------------------------------------------

/**
 * Soft-delete (archive) a promo code by setting is_active = false.
 */
export async function archivePromoCode(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId, userId } = auth;

    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_promo_codes_mst.findFirst({
        where: { id, tenant_org_id: tenantId, is_active: true },
        select: { id: true },
      });
      if (!existing) {
        return { success: false, error: 'Promo code not found' };
      }

      await prisma.org_promo_codes_mst.update({
        where: { id },
        data: { is_active: false, updated_at: new Date(), updated_by: userId ?? undefined },
      });

      revalidatePath('/dashboard/marketing/promos');
      return { success: true };
    });
  } catch (error) {
    logger.error('archivePromoCode failed', error as Error, { id });
    return { success: false, error: 'Failed to archive promo code' };
  }
}

// ---------------------------------------------------------------------------
// Usage history
// ---------------------------------------------------------------------------

/**
 * Get usage log for a promo code. Verifies ownership by tenant_org_id.
 */
export async function getPromoCodeUsageAction(
  promoCodeId: string
): Promise<{ success: true; data: PromoCodeUsage[] } | { success: false; error: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId } = auth;

    return withTenantContext(tenantId, async () => {
      // Verify ownership before returning usage logs.
      const owner = await prisma.org_promo_codes_mst.findFirst({
        where: { id: promoCodeId, tenant_org_id: tenantId },
        select: { id: true },
      });
      if (!owner) {
        return { success: false, error: 'Promo code not found' };
      }

      const data = await getPromoCodeUsage(promoCodeId);
      return { success: true, data };
    });
  } catch (error) {
    logger.error('getPromoCodeUsageAction failed', error as Error, { promoCodeId });
    return { success: false, error: 'Failed to load usage data' };
  }
}
