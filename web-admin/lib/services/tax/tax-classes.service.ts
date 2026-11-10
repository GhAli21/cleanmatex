/** Item tax classes: which tax treatment a product belongs to. */
import { prisma } from '@/lib/db/prisma'
import { withTenantContext } from '@/lib/db/tenant-context'
import { TAX_ROW_SOURCE, type TaxClassFlow } from '@/lib/constants/tax'
import { TaxError } from './tax-errors'

export interface TaxClassFields {
  name: string
  name2: string | null
  description: string | null
  description2: string | null
  isDefault: boolean
}
export type TaxClassCreate = TaxClassFields & { classCode: string; taxFlowCode: TaxClassFlow }
export type TaxClassPatch = Partial<TaxClassFields> & { isActive?: boolean }

/**
 * Lists the organization's item tax classes.
 * @param tenantOrgId - Organization, resolved from the session
 * @param includeInactive - Also return deactivated classes
 * @returns Classes in display order
 */
export async function listTaxClasses(tenantOrgId: string, includeInactive: boolean) {
  return withTenantContext(tenantOrgId, async () =>
    prisma.org_tax_item_classes_cf.findMany({
      where: { tenant_org_id: tenantOrgId, rec_status: 1, ...(includeInactive ? {} : { is_active: true }) },
      orderBy: [{ tax_flow_code: 'desc' }, { display_order: 'asc' }, { class_code: 'asc' }],
    }),
  )
}

/**
 * Creates an item tax class.
 * @param tenantOrgId - Organization, resolved from the session
 * @param actor - User id for the audit columns
 * @param input - The class
 * @returns The new row
 * @throws P2002 when the code exists
 */
export async function createTaxClass(tenantOrgId: string, actor: string, input: TaxClassCreate) {
  return withTenantContext(tenantOrgId, async () =>
    prisma.$transaction(async (tx) => {
      // One default per flow (unique index): clear the old one first.
      if (input.isDefault) {
        await tx.org_tax_item_classes_cf.updateMany({
          where: { tenant_org_id: tenantOrgId, tax_flow_code: input.taxFlowCode, is_default: true },
          data: { is_default: false, updated_by: actor, updated_info: 'tax classes' },
        })
      }
      return tx.org_tax_item_classes_cf.create({
        data: {
          tenant_org_id: tenantOrgId,
          class_code: input.classCode,
          tax_flow_code: input.taxFlowCode,
          name: input.name,
          name2: input.name2,
          description: input.description,
          description2: input.description2,
          is_default: input.isDefault,
          source: TAX_ROW_SOURCE.TENANT,
          created_by: actor,
          created_info: 'tax classes',
        },
      })
    }),
  )
}

/**
 * Changes an item tax class. The code and flow never change: products and rules point to them.
 * @param tenantOrgId - Organization, resolved from the session
 * @param actor - User id for the audit columns
 * @param id - Class id
 * @param patch - Fields to change
 * @returns The updated row
 * @throws TaxError when unknown, or deactivated while products or rules use it, or while it is the default
 */
export async function updateTaxClass(tenantOrgId: string, actor: string, id: string, patch: TaxClassPatch) {
  return withTenantContext(tenantOrgId, async () =>
    prisma.$transaction(async (tx) => {
      const row = await tx.org_tax_item_classes_cf.findFirst({ where: { id, tenant_org_id: tenantOrgId, rec_status: 1 } })
      if (!row) throw new TaxError('TAX_CLASS_NOT_FOUND', 404)
      const audit = { updated_by: actor, updated_info: 'tax classes' }

      if (patch.isActive === false) {
        if (row.is_default) throw new TaxError('TAX_CLASS_IS_DEFAULT')
        const [products, rules] = await Promise.all([
          tx.org_product_data_mst.count({ where: { tenant_org_id: tenantOrgId, tax_item_class_code: row.class_code, is_active: true, rec_status: 1 } }),
          tx.org_tax_rules_cf.count({ where: { tenant_org_id: tenantOrgId, tax_item_class_code: row.class_code, is_active: true, rec_status: 1 } }),
        ])
        if (products + rules > 0) throw new TaxError('TAX_CLASS_IN_USE')
      }
      if (patch.isDefault === false && row.is_default) throw new TaxError('TAX_CLASS_IS_DEFAULT')
      if (patch.isDefault && !row.is_default) {
        await tx.org_tax_item_classes_cf.updateMany({
          where: { tenant_org_id: tenantOrgId, tax_flow_code: row.tax_flow_code, is_default: true },
          data: { is_default: false, ...audit },
        })
      }
      const { count } = await tx.org_tax_item_classes_cf.updateMany({
        where: { id, tenant_org_id: tenantOrgId },
        data: {
          name: patch.name,
          name2: patch.name2,
          description: patch.description,
          description2: patch.description2,
          is_default: patch.isDefault,
          is_active: patch.isActive,
          ...audit,
        },
      })
      if (count === 0) throw new TaxError('TAX_CLASS_NOT_FOUND', 404)
      return { ...row, ...patch }
    }),
  )
}
