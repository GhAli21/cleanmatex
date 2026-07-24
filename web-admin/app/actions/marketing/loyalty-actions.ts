/**
 * Server Actions: Loyalty Program Management
 *
 * getLoyaltyConfigAction  — fetch the tenant's loyalty program config + tiers.
 * saveLoyaltyConfigAction — upsert the loyalty program settings.
 * saveTierAction          — create or update a loyalty tier.
 * deleteTierAction        — soft-delete a loyalty tier.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { getLoyaltyConfig } from '@/lib/services/loyalty.service';
import { LOYALTY_ROUNDING_RULES, type LoyaltyRoundingRule } from '@/lib/constants/order-financial';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

/**
 * B21 — the access-contract's `loyalty:view_config` page gate only
 * protects rendering the settings route; these mutations are server
 * actions the UI calls directly, which had no RBAC check at all before
 * this fix (any authenticated tenant user could call them regardless of
 * `loyalty:manage_config`). Mirrors the already-correct check in
 * `app/api/v1/loyalty/config/route.ts`'s PATCH handler.
 */
async function requireManageLoyaltyConfig(): Promise<void> {
  const allowed = await hasPermissionServer('loyalty:manage_config');
  if (!allowed) {
    throw new Error('Permission denied: loyalty:manage_config');
  }
}

/**
 *
 */
export async function getLoyaltyConfigAction() {
  try {
    const auth = await getAuthContext();
    const config = await getLoyaltyConfig(auth.tenantId);
    return { success: true as const, data: config };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load loyalty config',
    };
  }
}

/**
 *
 */
export interface SaveLoyaltyConfigInput {
  earnRatePerUnit:      number;
  redeemRatePerPoint:   number;
  minRedeemPoints:      number;
  maxRedeemPctOfOrder:  number;
  pointsExpiryDays:     number;
  /** B21 — HALF_UP/HALF_DOWN/FLOOR/CEIL; defaults to CEIL (pre-B21 behavior) when omitted. */
  roundingRule?:        LoyaltyRoundingRule;
  programName?:         string;
}

/**
 *
 * @param input
 */
export async function saveLoyaltyConfigAction(input: SaveLoyaltyConfigInput) {
  try {
    await requireManageLoyaltyConfig();
    const auth = await getAuthContext();
    const tenantId = auth.tenantId;

    // B21 — fail loudly with a clear message before hitting the DB CHECK
    // constraints (chk_loyalty_redeem_rate_positive / _min_redeem_nonneg,
    // migration 0433) — a raw constraint-violation error is a poor UX.
    if (!(input.redeemRatePerPoint > 0)) {
      return { success: false as const, error: 'Redeem rate must be greater than zero' };
    }
    if (input.minRedeemPoints < 0) {
      return { success: false as const, error: 'Minimum redeem points cannot be negative' };
    }

    // Check for existing program
    const existing = await withTenantContext(tenantId, () =>
      prisma.org_loyalty_programs_cf.findFirst({
        where: { tenant_org_id: tenantId },
      })
    );

    const expiryDays = input.pointsExpiryDays > 0 ? input.pointsExpiryDays : null;
    const programName = input.programName ?? 'Loyalty Program';

    const roundingRule = input.roundingRule ?? LOYALTY_ROUNDING_RULES.CEIL;

    let program;
    if (existing) {
      program = await withTenantContext(tenantId, () =>
        prisma.org_loyalty_programs_cf.update({
          where: { id: existing.id },
          data: {
            program_name:            programName,
            earn_rate_per_unit:      input.earnRatePerUnit,
            redeem_rate_per_point:   input.redeemRatePerPoint,
            min_redeem_points:       input.minRedeemPoints,
            max_redeem_pct_of_order: input.maxRedeemPctOfOrder,
            points_expiry_days:      expiryDays,
            rounding_rule:           roundingRule,
            updated_at:              new Date(),
          },
        })
      );
    } else {
      program = await withTenantContext(tenantId, () =>
        prisma.org_loyalty_programs_cf.create({
          data: {
            tenant_org_id:           tenantId,
            program_name:            programName,
            earn_rate_per_unit:      input.earnRatePerUnit,
            redeem_rate_per_point:   input.redeemRatePerPoint,
            min_redeem_points:       input.minRedeemPoints,
            max_redeem_pct_of_order: input.maxRedeemPctOfOrder,
            points_expiry_days:      expiryDays,
            rounding_rule:           roundingRule,
            is_active:               true,
            rec_status:              1,
          },
        })
      );
    }

    revalidatePath('/dashboard/marketing/loyalty');
    return { success: true as const, data: program };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to save loyalty config',
    };
  }
}

/**
 *
 */
export interface SaveTierInput {
  id?:             string;
  programId:       string;
  name:            string;
  name2?:          string;
  minPoints:       number;
  bonusMultiplier: number;
  sortOrder?:      number;
}

/**
 *
 * @param input
 */
export async function saveTierAction(input: SaveTierInput) {
  try {
    await requireManageLoyaltyConfig();
    const auth = await getAuthContext();
    const tenantId = auth.tenantId;

    let tier;
    if (input.id) {
      tier = await withTenantContext(tenantId, () =>
        prisma.org_loyalty_tiers_cf.update({
          where: { id: input.id!, tenant_org_id: tenantId },
          data: {
            name:             input.name,
            name2:            input.name2 ?? null,
            min_points:       input.minPoints,
            bonus_multiplier: input.bonusMultiplier,
            sort_order:       input.sortOrder ?? 0,
            updated_at:       new Date(),
          },
        })
      );
    } else {
      tier = await withTenantContext(tenantId, () =>
        prisma.org_loyalty_tiers_cf.create({
          data: {
            tenant_org_id:    tenantId,
            program_id:       input.programId,
            name:             input.name,
            name2:            input.name2 ?? null,
            min_points:       input.minPoints,
            bonus_multiplier: input.bonusMultiplier,
            sort_order:       input.sortOrder ?? 0,
            is_active:        true,
            rec_status:       1,
          },
        })
      );
    }

    revalidatePath('/dashboard/marketing/loyalty');
    return { success: true as const, data: tier };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to save tier',
    };
  }
}

/**
 *
 * @param tierId
 */
export async function deleteTierAction(tierId: string) {
  try {
    await requireManageLoyaltyConfig();
    const auth = await getAuthContext();
    const tenantId = auth.tenantId;

    await withTenantContext(tenantId, () =>
      prisma.org_loyalty_tiers_cf.update({
        where: { id: tierId, tenant_org_id: tenantId },
        data: { is_active: false, rec_status: 0, updated_at: new Date() },
      })
    );

    revalidatePath('/dashboard/marketing/loyalty');
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to delete tier',
    };
  }
}
