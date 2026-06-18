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
import { getLoyaltyConfig } from '@/lib/services/loyalty.service';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

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
  programName?:         string;
}

/**
 *
 * @param input
 */
export async function saveLoyaltyConfigAction(input: SaveLoyaltyConfigInput) {
  try {
    const auth = await getAuthContext();
    const tenantId = auth.tenantId;

    // Check for existing program
    const existing = await withTenantContext(tenantId, () =>
      prisma.org_loyalty_programs_cf.findFirst({
        where: { tenant_org_id: tenantId },
      })
    );

    const expiryDays = input.pointsExpiryDays > 0 ? input.pointsExpiryDays : null;
    const programName = input.programName ?? 'Loyalty Program';

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
