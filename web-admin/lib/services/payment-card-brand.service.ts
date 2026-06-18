import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import type { OrgCardBrandConfig, UpdateCardBrandConfigInput } from '@/lib/types/payment';

/**
 * Card brand rows are seeded from HQ but displayed and managed from the
 * tenant copy so each tenant can safely override labels and ordering.
 */
interface CardBrandSeedSource {
  code: string;
  name: string;
  name2: string | null;
  description: string | null;
  description2: string | null;
  display_order: number;
}

/**
 * Sorting is applied in the service so every caller gets the same stable order,
 * including rows with a null rec_order after manual tenant edits.
 * @param rows
 */
function sortCardBrands(rows: OrgCardBrandConfig[]): OrgCardBrandConfig[] {
  return [...rows].sort((left, right) => {
    const leftOrder = left.rec_order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.rec_order ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    const leftName = left.name.trim().toLowerCase();
    const rightName = right.name.trim().toLowerCase();

    if (leftName !== rightName) {
      return leftName.localeCompare(rightName);
    }

    return left.card_brand_code.localeCompare(right.card_brand_code);
  });
}

/**
 * Ensures a tenant always has config rows for any active HQ card brands that
 * were introduced after the initial rollout migration.
 *
 * @param tenantOrgId tenant resolved from authenticated session or API auth
 * @returns Promise that resolves once any missing tenant rows are inserted
 * @example
 * await ensureTenantCardBrandsSeeded('11111111-1111-1111-1111-111111111111')
 */
export async function ensureTenantCardBrandsSeeded(tenantOrgId: string): Promise<void> {
  await withTenantContext(tenantOrgId, async () => {
    const [sysBrands, existingRows] = await Promise.all([
      prisma.sys_card_brand_cd.findMany({
        where: {
          is_active: true,
          rec_status: 1,
        },
        select: {
          code: true,
          name: true,
          name2: true,
          description: true,
          description2: true,
          display_order: true,
        },
      }),
      prisma.org_card_brand_cf.findMany({
        where: {
          tenant_org_id: tenantOrgId,
          rec_status: 1,
        },
        select: {
          card_brand_code: true,
        },
      }),
    ]);

    const existingCodes = new Set(existingRows.map((row) => row.card_brand_code));
    const missingBrands = (sysBrands as CardBrandSeedSource[]).filter((brand) => !existingCodes.has(brand.code));

    if (!missingBrands.length) {
      return;
    }

    await prisma.org_card_brand_cf.createMany({
      data: missingBrands.map((brand) => ({
        tenant_org_id: tenantOrgId,
        card_brand_code: brand.code,
        name: brand.name,
        name2: brand.name2,
        description: brand.description,
        description2: brand.description2,
        rec_order: brand.display_order,
        is_active: true,
        rec_status: 1,
        created_by: 'auto_seed',
        created_info: 'Inserted from active sys_card_brand_cd during tenant read',
      })),
      skipDuplicates: true,
    });
  });
}

/**
 * Lists tenant card brand config rows after ensuring parity with active HQ
 * brands. This is the main read path used by both server actions and APIs.
 *
 * @param tenantOrgId tenant resolved from authenticated session or API auth
 * @returns Tenant-visible card brand config rows, including inactive ones
 * @example
 * const brands = await listTenantCardBrands(tenantId)
 */
export async function listTenantCardBrands(tenantOrgId: string): Promise<OrgCardBrandConfig[]> {
  await ensureTenantCardBrandsSeeded(tenantOrgId);

  const rows = await withTenantContext(tenantOrgId, async () =>
    prisma.org_card_brand_cf.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        rec_status: 1,
      },
    })
  );

  return sortCardBrands(rows as unknown as OrgCardBrandConfig[]);
}

/**
 * Updates the tenant-managed override fields without touching the source HQ code.
 *
 * @param tenantOrgId tenant resolved from authenticated session or API auth
 * @param brandId tenant card brand config row identifier
 * @param input editable override fields from the payment setup dialog
 * @param updatedBy actor identifier for auditability
 * @returns Updated tenant card brand config row
 * @example
 * await updateTenantCardBrandConfig(tenantId, brandId, { name: 'Visa' }, userId)
 */
export async function updateTenantCardBrandConfig(
  tenantOrgId: string,
  brandId: string,
  input: UpdateCardBrandConfigInput,
  updatedBy?: string | null
): Promise<OrgCardBrandConfig> {
  return withTenantContext(tenantOrgId, async () => {
    const existing = await prisma.org_card_brand_cf.findFirst({
      where: {
        id: brandId,
        tenant_org_id: tenantOrgId,
        rec_status: 1,
      },
    });

    if (!existing) {
      throw new Error('Card brand config not found');
    }

    const updated = await prisma.org_card_brand_cf.update({
      where: { id: brandId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.name2 !== undefined && { name2: input.name2 }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.description2 !== undefined && { description2: input.description2 }),
        ...(input.rec_order !== undefined && { rec_order: input.rec_order }),
        updated_at: new Date(),
        updated_by: updatedBy ?? null,
        updated_info: 'Updated from tenant payment setup card brands tab',
      },
    });

    return updated as unknown as OrgCardBrandConfig;
  });
}

/**
 * Toggles whether a tenant can currently use a seeded card brand without
 * deleting the row, which keeps re-enable flows and audit history simple.
 *
 * @param tenantOrgId tenant resolved from authenticated session or API auth
 * @param brandId tenant card brand config row identifier
 * @param isActive next active state chosen by the tenant
 * @param updatedBy actor identifier for auditability
 * @returns Updated tenant card brand config row
 * @example
 * await toggleTenantCardBrandActive(tenantId, brandId, false, userId)
 */
export async function toggleTenantCardBrandActive(
  tenantOrgId: string,
  brandId: string,
  isActive: boolean,
  updatedBy?: string | null
): Promise<OrgCardBrandConfig> {
  return withTenantContext(tenantOrgId, async () => {
    const existing = await prisma.org_card_brand_cf.findFirst({
      where: {
        id: brandId,
        tenant_org_id: tenantOrgId,
        rec_status: 1,
      },
    });

    if (!existing) {
      throw new Error('Card brand config not found');
    }

    const updated = await prisma.org_card_brand_cf.update({
      where: { id: brandId },
      data: {
        is_active: isActive,
        updated_at: new Date(),
        updated_by: updatedBy ?? null,
        updated_info: 'Toggled from tenant payment setup card brands tab',
      },
    });

    return updated as unknown as OrgCardBrandConfig;
  });
}
