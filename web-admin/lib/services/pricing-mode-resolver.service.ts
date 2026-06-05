import 'server-only';

import { prisma } from '@/lib/db/prisma';
import {
  TAX_PRICING_MODES,
  EXTRA_PRICE_PRICING_MODES,
} from '@/lib/constants/order-financial';
import type { TaxPricingMode, ExtraPricePricingMode } from '@/lib/types/order-financial';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type PrismaClient = typeof prisma | PrismaTransactionClient;

/**
 * Resolve the effective tax pricing mode for an order.
 *
 * Resolution order: branch override → tenant default → 'TAX_EXCLUSIVE'.
 * NULL on the branch column means "inherit from tenant".
 * The result is safe to call inside a Prisma transaction (pass the tx client)
 * or outside one (pass the global prisma client).
 */
export async function resolveTaxPricingMode(
  client: PrismaClient,
  tenantId: string,
  branchId: string | null,
): Promise<TaxPricingMode> {
  const validModes = new Set<string>(Object.values(TAX_PRICING_MODES));

  if (branchId) {
    const branch = await (client as typeof prisma).org_branches_mst.findFirst({
      where: { id: branchId, tenant_org_id: tenantId },
      select: { tax_pricing_mode: true },
    });
    const branchMode = branch?.tax_pricing_mode ?? null;
    if (branchMode && validModes.has(branchMode)) {
      return branchMode as TaxPricingMode;
    }
  }

  const tenant = await (client as typeof prisma).org_tenants_mst.findFirst({
    where: { id: tenantId },
    select: { tax_pricing_mode: true },
  });
  const tenantMode = tenant?.tax_pricing_mode ?? null;
  if (tenantMode && validModes.has(tenantMode)) {
    return tenantMode as TaxPricingMode;
  }

  return TAX_PRICING_MODES.TAX_EXCLUSIVE;
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
