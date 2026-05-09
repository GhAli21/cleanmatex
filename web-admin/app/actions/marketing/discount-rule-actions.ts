/**
 * Server Actions: Discount Rules
 *
 * CRUD operations for org_discount_rules_cf. All actions resolve tenant from
 * session and filter by tenant_org_id.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import {
  discountConditionsSchema,
  CONDITIONS_SCHEMA_VERSION,
} from '@/lib/constants/discount-conditions-schema';
import { logger } from '@/lib/utils/logger';
import type { DiscountRule } from '@/lib/types/payment';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const discountRuleFormSchema = z.object({
  rule_code: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase letters, digits, hyphens, or underscores'),
  rule_name: z.string().min(1).max(200),
  rule_name2: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  description2: z.string().max(500).optional(),
  rule_type: z.enum([
    'bulk_discount',
    'category_discount',
    'customer_tier',
    'seasonal',
    'first_order',
    'loyalty',
  ]).default('seasonal'),
  discount_type: z.enum(['percentage', 'fixed_amount']),
  discount_value: z.number().positive(),
  conditions: discountConditionsSchema,
  priority: z.number().int().min(0).default(0),
  can_stack_with_promo: z.boolean().default(false),
  can_stack_with_other_rules: z.boolean().default(false),
  valid_from: z.string().datetime(),
  valid_to: z.string().datetime().optional(),
  is_enabled: z.boolean().default(true),
});

type DiscountRuleFormInput = z.infer<typeof discountRuleFormSchema>;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): DiscountRule {
  return {
    id: row.id,
    tenant_org_id: row.tenant_org_id,
    rule_code: row.rule_code,
    rule_name: row.rule_name,
    rule_name2: row.rule_name2 ?? undefined,
    description: row.description ?? undefined,
    description2: row.description2 ?? undefined,
    rule_type: row.rule_type,
    discount_type: row.discount_type as 'percentage' | 'fixed_amount',
    discount_value: Number(row.discount_value),
    conditions: row.conditions,
    priority: row.priority,
    can_stack_with_promo: row.can_stack_with_promo,
    can_stack_with_other_rules: row.can_stack_with_other_rules,
    valid_from: row.valid_from.toISOString(),
    valid_to: row.valid_to?.toISOString(),
    is_active: row.is_active,
    is_enabled: row.is_enabled,
    metadata: row.metadata as Record<string, any> ?? undefined,
    created_at: row.created_at.toISOString(),
    created_by: row.created_by ?? undefined,
    updated_at: row.updated_at?.toISOString(),
    updated_by: row.updated_by ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * List discount rules for the current tenant with pagination.
 */
export async function listDiscountRules(params: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<
  | { success: true; data: DiscountRule[]; total: number }
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
      const where: Parameters<typeof prisma.org_discount_rules_cf.findMany>[0]['where'] = {
        tenant_org_id: tenantId,
        is_active: true,
      };

      if (params.search?.trim()) {
        where.OR = [
          { rule_code: { contains: params.search.trim(), mode: 'insensitive' } },
          { rule_name: { contains: params.search.trim(), mode: 'insensitive' } },
        ];
      }

      const [rows, total] = await Promise.all([
        prisma.org_discount_rules_cf.findMany({
          where,
          orderBy: [{ priority: 'desc' }, { created_at: 'desc' }],
          skip,
          take: limit,
        }),
        prisma.org_discount_rules_cf.count({ where }),
      ]);

      return { success: true, data: rows.map(mapRow), total };
    });
  } catch (error) {
    logger.error('listDiscountRules failed', error as Error, {});
    return { success: false, error: 'Failed to load discount rules' };
  }
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Create a new discount rule for the current tenant.
 */
export async function createDiscountRule(
  input: DiscountRuleFormInput
): Promise<{ success: true; data: DiscountRule } | { success: false; error: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId, userId } = auth;

    const parsed = discountRuleFormSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_discount_rules_cf.findFirst({
        where: {
          tenant_org_id: tenantId,
          rule_code: parsed.data.rule_code.toUpperCase(),
          is_active: true,
        },
        select: { id: true },
      });
      if (existing) {
        return { success: false, error: 'Rule code already exists for this tenant' };
      }

      const conditions = {
        schema_version: CONDITIONS_SCHEMA_VERSION,
        ...parsed.data.conditions,
      };

      const row = await prisma.org_discount_rules_cf.create({
        data: {
          tenant_org_id: tenantId,
          rule_code: parsed.data.rule_code.toUpperCase(),
          rule_name: parsed.data.rule_name,
          rule_name2: parsed.data.rule_name2,
          description: parsed.data.description,
          description2: parsed.data.description2,
          rule_type: parsed.data.rule_type,
          discount_type: parsed.data.discount_type,
          discount_value: parsed.data.discount_value,
          conditions: conditions as object,
          priority: parsed.data.priority,
          can_stack_with_promo: parsed.data.can_stack_with_promo,
          can_stack_with_other_rules: parsed.data.can_stack_with_other_rules,
          valid_from: new Date(parsed.data.valid_from),
          valid_to: parsed.data.valid_to ? new Date(parsed.data.valid_to) : undefined,
          is_enabled: parsed.data.is_enabled,
          is_active: true,
          created_at: new Date(),
          created_by: userId ?? undefined,
        },
      });

      revalidatePath('/dashboard/marketing/discount-rules');
      return { success: true, data: mapRow(row) };
    });
  } catch (error) {
    logger.error('createDiscountRule failed', error as Error, {});
    return { success: false, error: 'Failed to create discount rule' };
  }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/**
 * Update a discount rule. Verifies ownership by tenant_org_id.
 */
export async function updateDiscountRule(
  id: string,
  input: Partial<DiscountRuleFormInput>
): Promise<{ success: true; data: DiscountRule } | { success: false; error: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId, userId } = auth;

    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_discount_rules_cf.findFirst({
        where: { id, tenant_org_id: tenantId, is_active: true },
      });
      if (!existing) {
        return { success: false, error: 'Discount rule not found' };
      }

      const conditionsUpdate =
        input.conditions != null
          ? { schema_version: CONDITIONS_SCHEMA_VERSION, ...input.conditions }
          : undefined;

      const row = await prisma.org_discount_rules_cf.update({
        where: { id },
        data: {
          ...(input.rule_name != null && { rule_name: input.rule_name }),
          ...(input.rule_name2 !== undefined && { rule_name2: input.rule_name2 }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.description2 !== undefined && { description2: input.description2 }),
          ...(input.rule_type != null && { rule_type: input.rule_type }),
          ...(input.discount_type != null && { discount_type: input.discount_type }),
          ...(input.discount_value != null && { discount_value: input.discount_value }),
          ...(conditionsUpdate != null && { conditions: conditionsUpdate as object }),
          ...(input.priority != null && { priority: input.priority }),
          ...(input.can_stack_with_promo != null && { can_stack_with_promo: input.can_stack_with_promo }),
          ...(input.can_stack_with_other_rules != null && { can_stack_with_other_rules: input.can_stack_with_other_rules }),
          ...(input.valid_from != null && { valid_from: new Date(input.valid_from) }),
          ...(input.valid_to !== undefined && { valid_to: input.valid_to ? new Date(input.valid_to) : null }),
          ...(input.is_enabled != null && { is_enabled: input.is_enabled }),
          updated_at: new Date(),
          updated_by: userId ?? undefined,
        },
      });

      revalidatePath('/dashboard/marketing/discount-rules');
      return { success: true, data: mapRow(row) };
    });
  } catch (error) {
    logger.error('updateDiscountRule failed', error as Error, { id });
    return { success: false, error: 'Failed to update discount rule' };
  }
}

// ---------------------------------------------------------------------------
// Archive
// ---------------------------------------------------------------------------

/**
 * Soft-delete (archive) a discount rule by setting is_active = false.
 */
export async function archiveDiscountRule(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId, userId } = auth;

    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_discount_rules_cf.findFirst({
        where: { id, tenant_org_id: tenantId, is_active: true },
        select: { id: true },
      });
      if (!existing) {
        return { success: false, error: 'Discount rule not found' };
      }

      await prisma.org_discount_rules_cf.update({
        where: { id },
        data: { is_active: false, updated_at: new Date(), updated_by: userId ?? undefined },
      });

      revalidatePath('/dashboard/marketing/discount-rules');
      return { success: true };
    });
  } catch (error) {
    logger.error('archiveDiscountRule failed', error as Error, { id });
    return { success: false, error: 'Failed to archive discount rule' };
  }
}
