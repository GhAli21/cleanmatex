import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import { TAX_TYPES } from '@/lib/constants/order-financial';
import type { TaxLineItem, TaxType } from '@/lib/types/order-financial';
import { Decimal } from '@prisma/client/runtime/library';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export interface TaxCalcParams {
  tenantId: string;
  branchId?: string;
  serviceType?: string;
  customerId?: string;
  baseAmount: number;
  currency?: string;
}

function toNumber(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

/**
 * Load the active tax profile for a tenant + branch + service-type combination,
 * then compute per-line tax breakdown. Falls back to tenant VAT setting if no
 * profile is configured.
 */
export async function calculateTax(params: TaxCalcParams): Promise<TaxLineItem[]> {
  const { tenantId, branchId, serviceType, customerId, baseAmount } = params;

  const profile = await withTenantContext(tenantId, async () => {
    return prisma.org_tax_profiles_cf.findFirst({
      where: {
        tenant_org_id: tenantId,
        is_active:     true,
        rec_status:    1,
        ...(serviceType ? { applies_to: { has: serviceType } } : {}),
      },
      orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
    });
  });

  if (!profile) return [];

  // Check exemptions
  if (customerId) {
    const exemption = await withTenantContext(tenantId, async () => {
      return prisma.org_tax_exemptions_cf.findFirst({
        where: {
          tenant_org_id: tenantId,
          customer_id:   customerId,
          is_active:     true,
          rec_status:    1,
        },
      });
    });
    if (exemption) return [];
  }

  const rate = toNumber(profile.rate);
  const isCompound = profile.is_compound ?? false;

  const primaryTaxAmount = baseAmount * (rate / 100);

  const lines: TaxLineItem[] = [
    {
      taxType:    (profile.tax_type ?? TAX_TYPES.VAT) as TaxType,
      label:      profile.name ?? 'Tax',
      label2:     profile.name2 ?? null,
      rate,
      isCompound: isCompound,
      baseAmount,
      taxAmount:  Number(primaryTaxAmount.toFixed(4)),
      profileId:  profile.id,
    },
  ];

  return lines;
}

/**
 * Resolve tax lines inside an existing transaction (used by order-settlement.service.ts).
 */
export async function calculateTaxInTx(
  _tx: PrismaTransactionClient,
  params: TaxCalcParams
): Promise<TaxLineItem[]> {
  return calculateTax(params);
}
