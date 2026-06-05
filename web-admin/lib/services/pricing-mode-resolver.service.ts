import 'server-only';

import { prisma } from '@/lib/db/prisma';
import {
  TAX_PRICING_MODES,
  EXTRA_PRICE_PRICING_MODES,
} from '@/lib/constants/order-financial';
import type { TaxPricingMode, ExtraPricePricingMode } from '@/lib/types/order-financial';
import { getFeatureFlags } from '@/lib/services/feature-flags.service';
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type PrismaClient = typeof prisma | PrismaTransactionClient;

/**
 * Resolve the effective tax pricing mode for an order.
 *
 * Resolution order: branch override → tenant default → 'TAX_EXCLUSIVE'.
 * NULL on the branch column means "inherit from tenant".
 * TAX_INCLUSIVE is only returned when the FF_TAX_INCLUSIVE_PRICING flag is enabled
 * for the tenant — if the flag is off, the resolver falls back to TAX_EXCLUSIVE
 * regardless of the DB column value.
 * The result is safe to call inside a Prisma transaction (pass the tx client)
 * or outside one (pass the global prisma client).
 */
export async function resolveTaxPricingMode(
  client: PrismaClient,
  tenantId: string,
  branchId: string | null,
): Promise<TaxPricingMode> {
  const validModes = new Set<string>(Object.values(TAX_PRICING_MODES));

  let resolved: TaxPricingMode = TAX_PRICING_MODES.TAX_EXCLUSIVE;

  if (branchId) {
    const branch = await (client as typeof prisma).org_branches_mst.findFirst({
      where: { id: branchId, tenant_org_id: tenantId },
      select: { tax_pricing_mode: true },
    });
    const branchMode = branch?.tax_pricing_mode ?? null;
    if (branchMode && validModes.has(branchMode)) {
      resolved = branchMode as TaxPricingMode;
    }
  }

  if (resolved === TAX_PRICING_MODES.TAX_EXCLUSIVE) {
    const tenant = await (client as typeof prisma).org_tenants_mst.findFirst({
      where: { id: tenantId },
      select: { tax_pricing_mode: true },
    });
    const tenantMode = tenant?.tax_pricing_mode ?? null;
    if (tenantMode && validModes.has(tenantMode)) {
      resolved = tenantMode as TaxPricingMode;
    }
  }

  // Guard: TAX_INCLUSIVE requires the feature flag. Falls back to TAX_EXCLUSIVE when off.
  if (resolved === TAX_PRICING_MODES.TAX_INCLUSIVE) {
    try {
      const flags = await getFeatureFlags(tenantId);
      if (!flags[FEATURE_FLAG_KEYS.TAX_INCLUSIVE_PRICING]) {
        return TAX_PRICING_MODES.TAX_EXCLUSIVE;
      }
    } catch {
      return TAX_PRICING_MODES.TAX_EXCLUSIVE;
    }
  }

  return resolved;
}

/**
 * Resolve the effective extra-price presentation mode for an order.
 *
 * Resolution order: branch override → tenant default → 'INCLUDED_IN_ITEM_PRICE'.
 */
export async function resolveExtraPricePricingMode(
  client: PrismaClient,
  tenantId: string,
  branchId: string | null,
): Promise<ExtraPricePricingMode> {
  const validModes = new Set<string>(Object.values(EXTRA_PRICE_PRICING_MODES));

  if (branchId) {
    const branch = await (client as typeof prisma).org_branches_mst.findFirst({
      where: { id: branchId, tenant_org_id: tenantId },
      select: { extra_price_pricing_mode: true },
    });
    const branchMode = branch?.extra_price_pricing_mode ?? null;
    if (branchMode && validModes.has(branchMode)) {
      return branchMode as ExtraPricePricingMode;
    }
  }

  const tenant = await (client as typeof prisma).org_tenants_mst.findFirst({
    where: { id: tenantId },
    select: { extra_price_pricing_mode: true },
  });
  const tenantMode = tenant?.extra_price_pricing_mode ?? null;
  if (tenantMode && validModes.has(tenantMode)) {
    return tenantMode as ExtraPricePricingMode;
  }

  return EXTRA_PRICE_PRICING_MODES.INCLUDED_IN_ITEM_PRICE;
}
