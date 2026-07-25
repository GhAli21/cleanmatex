import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import { TAX_TYPES, TAX_PRICING_MODES } from '@/lib/constants/order-financial';
import { extractTaxFromInclusive } from './order-financial-write.service';
import type { TaxLineItem, TaxType, TaxPricingMode } from '@/lib/types/order-financial';
import { Decimal } from '@prisma/client/runtime/library';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 *
 */
export interface TaxCalcParams {
  tenantId: string;
  branchId?: string;
  serviceType?: string;
  serviceTypes?: string[];
  customerId?: string;
  baseAmount: number;
  currency?: string;
  decimalPlaces?: number;
  selectedProfileIds?: string[];
  /**
   * Resolved tax pricing mode (B11). TAX_EXCLUSIVE (default) treats `baseAmount`
   * as the net taxable amount and adds tax on top. TAX_INCLUSIVE treats
   * `baseAmount` as the tax-inclusive gross and extracts the embedded tax —
   * the returned lines' `baseAmount`/`taxAmount` reflect the extracted split,
   * so `netExtractedBase + sum(taxAmount) === baseAmount` (mod rounding).
   */
  pricingMode?: TaxPricingMode;
}

function toNumber(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

function roundAmount(value: number, decimalPlaces: number): number {
  return Number(value.toFixed(decimalPlaces));
}

type TaxProfileRow = Awaited<ReturnType<typeof prisma.org_tax_profiles_cf.findFirst>>;

async function resolveTaxProfiles(
  tenantId: string,
  selectedProfileIds: string[] | undefined,
): Promise<NonNullable<TaxProfileRow>[]> {
  const effectiveDate = new Date();

  return withTenantContext(tenantId, async () => {
    if (selectedProfileIds && selectedProfileIds.length > 0) {
      const uniqueIds = Array.from(new Set(selectedProfileIds.map((id) => id.trim()).filter(Boolean)));
      const profiles = await prisma.org_tax_profiles_cf.findMany({
        where: {
          tenant_org_id: tenantId,
          id:            { in: uniqueIds },
          is_active:     true,
          rec_status:    1,
          effective_from: { lte: effectiveDate },
          OR: [{ effective_to: null }, { effective_to: { gte: effectiveDate } }],
        },
        orderBy: { created_at: 'asc' },
      });

      if (profiles.length !== uniqueIds.length) {
        throw new Error('INVALID_TAX_PROFILE_SELECTION');
      }

      const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
      return uniqueIds
        .map((id) => profileMap.get(id))
        .filter((profile): profile is NonNullable<TaxProfileRow> => Boolean(profile));
    }

    return prisma.org_tax_profiles_cf.findMany({
      where: {
        tenant_org_id: tenantId,
        is_active:     true,
        is_default:    true,
        rec_status:    1,
        effective_from: { lte: effectiveDate },
        OR: [{ effective_to: null }, { effective_to: { gte: effectiveDate } }],
      },
      orderBy: { created_at: 'asc' },
    });
  });
}

async function isTaxExempt(
  tenantId: string,
  customerId: string | undefined,
  serviceTypes: string[] | undefined,
): Promise<boolean> {
  if (!customerId && (!serviceTypes || serviceTypes.length === 0)) {
    return false;
  }

  const effectiveDate = new Date();

  return withTenantContext(tenantId, async () => {
    const exemption = await prisma.org_tax_exemptions_cf.findFirst({
      where: {
        tenant_org_id: tenantId,
        is_active:     true,
        rec_status:    1,
        valid_from:    { lte: effectiveDate },
        OR: [
          ...(customerId ? [{ customer_id: customerId }] : []),
          ...((serviceTypes ?? []).length > 0 ? [{ service_type: { in: serviceTypes } }] : []),
        ],
        AND: [
          {
            OR: [{ valid_to: null }, { valid_to: { gte: effectiveDate } }],
          },
        ],
      },
      select: { id: true },
    });

    return Boolean(exemption);
  });
}

/**
 * Load the active tax profile for a tenant + branch + service-type combination,
 * then compute per-line tax breakdown. Falls back to tenant VAT setting if no
 * profile is configured.
 * @param params
 */
export async function calculateTax(params: TaxCalcParams): Promise<TaxLineItem[]> {
  const {
    tenantId,
    serviceType,
    serviceTypes,
    customerId,
    baseAmount,
    decimalPlaces = 3,
    selectedProfileIds,
    pricingMode = TAX_PRICING_MODES.TAX_EXCLUSIVE,
  } = params;

  const effectiveServiceTypes = Array.from(
    new Set([serviceType, ...(serviceTypes ?? [])].filter((value): value is string => Boolean(value?.trim())))
  );

  if (await isTaxExempt(tenantId, customerId, effectiveServiceTypes)) {
    return [];
  }

  const profiles = await resolveTaxProfiles(tenantId, selectedProfileIds);
  if (profiles.length === 0) {
    return [];
  }

  const orderedProfiles = [
    ...profiles.filter((profile) => !(profile.is_compound ?? false)),
    ...profiles.filter((profile) => profile.is_compound ?? false),
  ];

  // B11: under TAX_INCLUSIVE, `baseAmount` is the tax-inclusive gross (item
  // prices already embed all configured tax profiles). Solve the equivalent
  // net taxable base by running the SAME rate/compound rules used below in
  // a unitless pre-pass to get the combined multiplier K (gross = net * K),
  // then extract via the shared inclusive helper. The forward loop afterward
  // is untouched — it always adds tax on top of whatever base it is given,
  // so feeding it the extracted net base reproduces the correct per-line split.
  let effectiveBaseAmount = baseAmount;
  if (pricingMode === TAX_PRICING_MODES.TAX_INCLUSIVE) {
    let priorTaxFraction = 0;
    for (const profile of orderedProfiles) {
      const rateFraction = toNumber(profile.rate) / 100;
      const isCompound = profile.is_compound ?? false;
      const taxableFraction = isCompound ? 1 + priorTaxFraction : 1;
      priorTaxFraction += taxableFraction * rateFraction;
    }
    effectiveBaseAmount = extractTaxFromInclusive(baseAmount, priorTaxFraction).taxableAmount;
  }

  let accumulatedPriorTax = 0;

  return orderedProfiles.map((profile) => {
    const rate = toNumber(profile.rate);
    const isCompound = profile.is_compound ?? false;
    const taxableBase = isCompound ? effectiveBaseAmount + accumulatedPriorTax : effectiveBaseAmount;
    const taxAmount = roundAmount(taxableBase * (rate / 100), decimalPlaces);

    accumulatedPriorTax += taxAmount;

    return {
      taxType:    (profile.tax_type ?? TAX_TYPES.VAT) as TaxType,
      label:      profile.name ?? 'Tax',
      label2:     profile.name2 ?? null,
      rate,
      isCompound,
      baseAmount: taxableBase,
      taxAmount,
      profileId:  profile.id,
    };
  });
}

/**
 * Resolve tax lines inside an existing transaction (used by order-settlement.service.ts).
 * @param _tx
 * @param params
 */
export async function calculateTaxInTx(
  _tx: PrismaTransactionClient,
  params: TaxCalcParams
): Promise<TaxLineItem[]> {
  return calculateTax(params);
}
