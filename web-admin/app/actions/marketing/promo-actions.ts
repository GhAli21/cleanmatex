/**
 * Server Actions: Promo Codes
 *
 * CRUD operations for org_promotions_mst. All actions resolve tenant from
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
import type { PromoCode, PromoCodeUsage, PromoDiscountType } from '@/lib/types/payment';

function rowDiscountTypeToPromo(raw: string | null | undefined): PromoDiscountType {
  const v = (raw ?? '').toLowerCase();
  if (v === 'fixed' || v === 'fixed_amount') return 'fixed_amount';
  return 'percentage';
}

function promoTypeFromDiscount(discountType: PromoDiscountType): string {
  return discountType === 'fixed_amount' ? 'FIXED_AMOUNT' : 'PERCENTAGE';
}

/**
 * Empty / NaN / non-positive → null.
 * Used for optional caps where null means unlimited.
 */
function emptyToNullNumber(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isNaN(v)) return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function mapPromoRow(row: {
  id: string;
  tenant_org_id: string;
  promo_code: string | null;
  promo_name: string | null;
  promo_name2: string | null;
  description: string | null;
  description2: string | null;
  discount_type: string;
  discount_value: { toNumber?: () => number } | number;
  max_discount_amount: { toNumber?: () => number } | number | null;
  min_order_amount: { toNumber?: () => number } | number | null;
  max_order_amount: { toNumber?: () => number } | number | null;
  applicable_categories: unknown;
  applicable_customer_grps: string[] | null;
  max_uses: number | null;
  max_uses_per_customer: number | null;
  current_uses: number | null;
  promo_type: string | null;
  stackable: boolean;
  stacking_group: string | null;
  max_stacking_discount: { toNumber?: () => number } | number | null;
  valid_from: Date;
  valid_to: Date | null;
  is_active: boolean;
  is_enabled: boolean;
  metadata: unknown;
  created_at: Date;
  created_by: string | null;
  updated_at: Date | null;
  updated_by: string | null;
}): PromoCode {
  const num = (v: { toNumber?: () => number } | number | null | undefined): number | undefined => {
    if (v == null) return undefined;
    return typeof v === 'object' && typeof v.toNumber === 'function' ? v.toNumber() : Number(v);
  };

  return {
    id: row.id,
    tenant_org_id: row.tenant_org_id,
    promo_code: row.promo_code,
    promo_name: row.promo_name ?? '',
    promo_name2: row.promo_name2 ?? undefined,
    description: row.description ?? undefined,
    description2: row.description2 ?? undefined,
    discount_type: rowDiscountTypeToPromo(row.discount_type),
    discount_value: num(row.discount_value) ?? 0,
    max_discount_amount: num(row.max_discount_amount),
    promo_type: row.promo_type,
    min_order_amount: num(row.min_order_amount) ?? 0,
    max_order_amount: num(row.max_order_amount),
    applicable_categories: (row.applicable_categories as string[] | null) ?? undefined,
    applicable_customer_grps: row.applicable_customer_grps ?? undefined,
    max_uses: row.max_uses,
    max_uses_per_customer: row.max_uses_per_customer ?? 1,
    current_uses: row.current_uses ?? 0,
    stackable: row.stackable,
    stacking_group: row.stacking_group,
    max_stacking_discount: num(row.max_stacking_discount) ?? null,
    valid_from: row.valid_from.toISOString(),
    valid_to: row.valid_to?.toISOString() ?? null,
    is_active: row.is_active,
    is_enabled: row.is_enabled,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
    created_at: row.created_at.toISOString(),
    created_by: row.created_by ?? undefined,
    updated_at: row.updated_at?.toISOString(),
    updated_by: row.updated_by ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

/** Optional money/amount cap — null = no cap / unlimited. */
const optionalPositiveNumber = z.preprocess(
  emptyToNullNumber,
  z.union([z.number().positive(), z.null()]).optional()
);

/** Optional integer cap — null = unlimited (e.g. max_uses). */
const optionalPositiveInt = z.preprocess(
  (v) => {
    const n = emptyToNullNumber(v);
    return n == null ? null : Math.floor(n);
  },
  z.union([z.number().int().positive(), z.null()]).optional()
);

const promoFormSchema = z.object({
  // Empty / omitted = auto-apply promotion (no typed code)
  promo_code: z
    .string()
    .max(50)
    .regex(/^$|^[A-Z0-9_-]+$/, 'Code must be uppercase letters, digits, hyphens, or underscores')
    .optional()
    .nullable()
    .transform((v) => {
      const code = (v ?? '').trim().toUpperCase();
      return code.length > 0 ? code : null;
    }),
  promo_name: z.string().min(1).max(200),
  promo_name2: z.string().max(200).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  description2: z.string().max(500).optional().nullable(),
  discount_type: z.enum(['percentage', 'fixed', 'fixed_amount']).transform(
    (v): PromoDiscountType => (v === 'fixed' || v === 'fixed_amount' ? 'fixed_amount' : 'percentage')
  ),
  discount_value: z.number().positive(),
  max_discount_amount: optionalPositiveNumber,
  min_order_amount: z.preprocess(
    (v) => {
      const n = emptyToNullNumber(v);
      return n == null ? 0 : n;
    },
    z.number().nonnegative()
  ),
  max_order_amount: optionalPositiveNumber,
  applicable_categories: z.array(z.string()).optional().nullable(),
  applicable_customer_grps: z.array(z.string()).optional().nullable(),
  max_uses: optionalPositiveInt,
  max_uses_per_customer: optionalPositiveInt,
  valid_from: z.string().datetime(),
  valid_to: z
    .string()
    .datetime()
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v && v.length > 0 ? v : null)),
  is_enabled: z.boolean().default(true),
  stackable: z.boolean().default(false),
  stacking_group: z.string().max(100).optional().nullable(),
  max_stacking_discount: optionalPositiveNumber,
});

type PromoFormInput = z.infer<typeof promoFormSchema>;

function revalidatePromoPaths() {
  revalidatePath('/dashboard/marketing/promos');
  revalidatePath('/dashboard/marketing/promotions');
}

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
      const where: Parameters<typeof prisma.org_promotions_mst.findMany>[0]['where'] = {
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
        where.AND = [
          {
            OR: [{ valid_to: null }, { valid_to: { gte: new Date() } }],
          },
        ];
      } else if (params.status === 'expired') {
        where.valid_to = { lt: new Date() };
      }

      const [rows, total] = await Promise.all([
        prisma.org_promotions_mst.findMany({
          where,
          orderBy: { created_at: 'desc' },
          skip,
          take: limit,
        }),
        prisma.org_promotions_mst.count({ where }),
      ]);

      return { success: true, data: rows.map(mapPromoRow), total };
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
  input: unknown
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
      if (parsed.data.promo_code) {
        const existing = await prisma.org_promotions_mst.findFirst({
          where: {
            tenant_org_id: tenantId,
            promo_code: parsed.data.promo_code,
            is_active: true,
          },
          select: { id: true },
        });
        if (existing) {
          return { success: false, error: 'Promo code already exists for this tenant' };
        }
      }

      const row = await prisma.org_promotions_mst.create({
        data: {
          tenant_org_id: tenantId,
          promo_code: parsed.data.promo_code,
          promo_name: parsed.data.promo_name,
          promo_name2: parsed.data.promo_name2 || null,
          description: parsed.data.description || null,
          description2: parsed.data.description2 || null,
          discount_type: parsed.data.discount_type,
          promo_type: promoTypeFromDiscount(parsed.data.discount_type),
          discount_value: parsed.data.discount_value,
          max_discount_amount: parsed.data.max_discount_amount ?? null,
          min_order_amount: parsed.data.min_order_amount,
          max_order_amount: parsed.data.max_order_amount ?? null,
          applicable_categories: parsed.data.applicable_categories ?? undefined,
          applicable_customer_grps: parsed.data.applicable_customer_grps ?? [],
          max_uses: parsed.data.max_uses ?? null,
          max_uses_per_customer: parsed.data.max_uses_per_customer ?? 1,
          current_uses: 0,
          stackable: parsed.data.stackable,
          stacking_group: parsed.data.stacking_group || null,
          max_stacking_discount: parsed.data.max_stacking_discount ?? null,
          valid_from: new Date(parsed.data.valid_from),
          valid_to: parsed.data.valid_to ? new Date(parsed.data.valid_to) : null,
          is_enabled: parsed.data.is_enabled,
          is_active: true,
          rec_status: 1,
          created_at: new Date(),
          created_by: userId ?? undefined,
        },
      });

      revalidatePromoPaths();
      return { success: true, data: mapPromoRow(row) };
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
  input: unknown
): Promise<{ success: true; data: PromoCode } | { success: false; error: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId, userId } = auth;

    const parsed = promoFormSchema.partial().safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_promotions_mst.findFirst({
        where: { id, tenant_org_id: tenantId, is_active: true },
      });
      if (!existing) {
        return { success: false, error: 'Promo code not found' };
      }

      const data = parsed.data;
      const row = await prisma.org_promotions_mst.update({
        where: { id },
        data: {
          ...(data.promo_name != null && { promo_name: data.promo_name }),
          ...(data.promo_name2 !== undefined && { promo_name2: data.promo_name2 || null }),
          ...(data.description !== undefined && { description: data.description || null }),
          ...(data.description2 !== undefined && { description2: data.description2 || null }),
          ...(data.discount_type != null && {
            discount_type: data.discount_type,
            promo_type: promoTypeFromDiscount(data.discount_type),
          }),
          ...(data.discount_value != null && { discount_value: data.discount_value }),
          ...(data.max_discount_amount !== undefined && {
            max_discount_amount: data.max_discount_amount,
          }),
          ...(data.min_order_amount != null && { min_order_amount: data.min_order_amount }),
          ...(data.max_order_amount !== undefined && { max_order_amount: data.max_order_amount }),
          ...(data.applicable_categories !== undefined && {
            applicable_categories: data.applicable_categories ?? undefined,
          }),
          ...(data.applicable_customer_grps !== undefined && {
            applicable_customer_grps: data.applicable_customer_grps ?? [],
          }),
          // Explicit null clears the cap (unlimited). Do not skip when null.
          ...(data.max_uses !== undefined && { max_uses: data.max_uses ?? null }),
          ...(data.max_uses_per_customer !== undefined && {
            max_uses_per_customer: data.max_uses_per_customer ?? 1,
          }),
          ...(data.valid_from != null && { valid_from: new Date(data.valid_from) }),
          ...(data.valid_to !== undefined && {
            valid_to: data.valid_to ? new Date(data.valid_to) : null,
          }),
          ...(data.is_enabled != null && { is_enabled: data.is_enabled }),
          ...(data.stackable != null && { stackable: data.stackable }),
          ...(data.stacking_group !== undefined && {
            stacking_group: data.stacking_group || null,
          }),
          ...(data.max_stacking_discount !== undefined && {
            max_stacking_discount: data.max_stacking_discount,
          }),
          updated_at: new Date(),
          updated_by: userId ?? undefined,
        },
      });

      revalidatePromoPaths();
      return { success: true, data: mapPromoRow(row) };
    });
  } catch (error) {
    logger.error('updatePromoCode failed', error as Error, { id });
    return { success: false, error: 'Failed to update promo code' };
  }
}

// ---------------------------------------------------------------------------
// Enable / disable (quick toggle — not archive)
// ---------------------------------------------------------------------------

/**
 * Toggle `is_enabled` without archiving the promo.
 */
export async function setPromoCodeEnabled(
  id: string,
  isEnabled: boolean
): Promise<{ success: true; data: PromoCode } | { success: false; error: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId, userId } = auth;

    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_promotions_mst.findFirst({
        where: { id, tenant_org_id: tenantId, is_active: true },
        select: { id: true },
      });
      if (!existing) {
        return { success: false, error: 'Promo code not found' };
      }

      const row = await prisma.org_promotions_mst.update({
        where: { id },
        data: {
          is_enabled: isEnabled,
          updated_at: new Date(),
          updated_by: userId ?? undefined,
        },
      });

      revalidatePromoPaths();
      return { success: true, data: mapPromoRow(row) };
    });
  } catch (error) {
    logger.error('setPromoCodeEnabled failed', error as Error, { id });
    return { success: false, error: 'Failed to update promo status' };
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
      const existing = await prisma.org_promotions_mst.findFirst({
        where: { id, tenant_org_id: tenantId, is_active: true },
        select: { id: true },
      });
      if (!existing) {
        return { success: false, error: 'Promo code not found' };
      }

      await prisma.org_promotions_mst.update({
        where: { id },
        data: { is_active: false, updated_at: new Date(), updated_by: userId ?? undefined },
      });

      revalidatePromoPaths();
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
      const owner = await prisma.org_promotions_mst.findFirst({
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
