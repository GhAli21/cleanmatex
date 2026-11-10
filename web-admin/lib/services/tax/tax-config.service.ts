/**
 * Tax setup of one organization: the applied kit, registrations, mode, confirmation.
 * Kit apply and confirm stay in the database functions, shared with HQ.
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { withTenantContext } from '@/lib/db/tenant-context'
import { TAX_CONFIG_STATUS, TAX_ROW_SOURCE, type TaxEmirate, type TaxReadinessCode, type TaxSetupMode } from '@/lib/constants/tax'
import { TaxError } from './tax-errors'

const ACTIVE = { is_active: true, rec_status: 1 } as const

export interface TaxConfirmResult {
  ok: boolean
  already_active?: boolean
  errors: TaxReadinessCode[]
}

export interface TaxConfigUpdate {
  setupMode?: TaxSetupMode
  taxEnabled?: boolean
  orgRegistrationNo?: string | null
  registrations?: { branchId: string; taxRegistrationNo: string | null; emirateCode: TaxEmirate | null }[]
}

/**
 * Everything the setup screens need in one read.
 * @param tenantOrgId - Organization, resolved from the session
 * @returns Config, kit facts, package, registrations, and codes still needing a rate; null config if no kit was applied
 */
export async function getTaxConfig(tenantOrgId: string) {
  return withTenantContext(tenantOrgId, async () => {
    const [config, tenant, branches, ratesMissing, counts] = await Promise.all([
      prisma.org_tax_config_cf.findUnique({ where: { tenant_org_id: tenantOrgId } }),
      prisma.org_tenants_mst.findUnique({
        where: { id: tenantOrgId },
        select: { country: true, currency: true, tax_registration_no: true, tax_pricing_mode: true },
      }),
      prisma.org_branches_mst.findMany({
        where: { tenant_org_id: tenantOrgId, ...ACTIVE },
        select: { id: true, name: true, name2: true, branch_name: true, country: true, tax_registration_no: true, emirate_code: true },
        orderBy: { name: 'asc' },
      }),
      prisma.org_tax_profiles_cf.findMany({
        where: { tenant_org_id: tenantOrgId, ...ACTIVE, amount_kind: 'PERCENT', rate: null, tax_category_code: 'STANDARD' },
        select: { id: true, tax_code: true, name: true, name2: true, version_no: true },
        orderBy: { display_order: 'asc' },
      }),
      Promise.all([
        prisma.org_tax_profiles_cf.count({ where: { tenant_org_id: tenantOrgId, ...ACTIVE, source: TAX_ROW_SOURCE.HQ_KIT } }),
        prisma.org_tax_rules_cf.count({ where: { tenant_org_id: tenantOrgId, ...ACTIVE } }),
        prisma.org_tax_item_classes_cf.count({ where: { tenant_org_id: tenantOrgId, ...ACTIVE } }),
      ]),
    ])
    if (!config) return { config: null, tenant, branches, ratesMissing, counts: null, kit: null, pkg: null, triggers: [], examples: [] }

    const [kitVersion, kit, pkg, triggers, examples] = await Promise.all([
      prisma.sys_tax_kit_versions_mst.findUnique({ where: { id: config.kit_version_id } }),
      prisma.sys_tax_kits_mst.findUnique({ where: { kit_code: config.kit_code } }),
      prisma.sys_starter_pkg_mst.findUnique({ where: { pkg_code: config.starter_pkg_code } }),
      prisma.sys_starter_pkg_trig_dtl.findMany({
        where: { pkg_code: config.starter_pkg_code, is_active: true, rec_status: 1 },
        select: { trigger_event: true, document_type: true },
      }),
      prisma.sys_tax_kit_vectors_dtl.findMany({
        where: { kit_version_id: config.kit_version_id, is_active: true, rec_status: 1 },
        select: { vector_code: true, description: true, description2: true, expected: true },
        orderBy: { vector_code: 'asc' },
      }),
    ])
    return {
      config,
      tenant,
      branches,
      ratesMissing,
      counts: { codes: counts[0], rules: counts[1], classes: counts[2] },
      kit: kit && kitVersion ? { ...kit, version: kitVersion } : null,
      pkg,
      triggers,
      examples,
    }
  })
}

/**
 * Starter packages this organization may choose: its country's and the generic ones.
 * @param tenantOrgId - Organization, resolved from the session
 * @returns Active packages, defaults first
 */
export async function listTaxPackages(tenantOrgId: string) {
  return withTenantContext(tenantOrgId, async () => {
    const tenant = await prisma.org_tenants_mst.findUnique({ where: { id: tenantOrgId }, select: { country: true } })
    const country = tenant?.country?.toUpperCase() ?? null
    return prisma.sys_starter_pkg_mst.findMany({
      where: { is_active: true, rec_status: 1, OR: [{ country_code: null }, ...(country ? [{ country_code: country }] : [])] },
      select: { pkg_code: true, name: true, name2: true, description: true, description2: true, country_code: true, segment_code: true, tax_kit_code: true, tax_pricing_mode: true, is_country_default: true },
      orderBy: [{ is_country_default: 'desc' }, { display_order: 'asc' }],
    })
  })
}

/**
 * Lookups for the tax code and rule forms.
 * @param tenantOrgId - Organization, resolved from the session
 * @returns Reference lists plus this organization's branches, classes and active codes
 */
export async function getTaxOptions(tenantOrgId: string) {
  return withTenantContext(tenantOrgId, async () => {
    const tenant = await prisma.org_tenants_mst.findUnique({ where: { id: tenantOrgId }, select: { country: true } })
    const named = { name: true, name2: true } as const
    const [taxTypes, categories, exemptReasons, docTypes, partyClasses, countries, serviceCategories, branches, classes, codes] = await Promise.all([
      prisma.sys_tax_types_cd.findMany({ where: { is_active: true, rec_status: 1 }, select: { tax_type: true, ...named }, orderBy: { sort_order: 'asc' } }),
      prisma.sys_tax_category_cd.findMany({ where: { is_active: true, rec_status: 1 }, select: { code: true, ...named }, orderBy: { display_order: 'asc' } }),
      prisma.sys_tax_exempt_reason_cd.findMany({ where: { is_active: true, rec_status: 1, country: tenant?.country?.toUpperCase() ?? '' }, select: { code: true, ...named }, orderBy: { code: 'asc' } }),
      prisma.sys_doc_seq_type_cd.findMany({ where: { is_active: true, rec_status: 1, is_tax_relevant: true }, select: { doc_type_code: true, tax_flow_code: true, ...named }, orderBy: { doc_type_code: 'asc' } }),
      prisma.sys_tax_party_class_cd.findMany({ where: { is_active: true, rec_status: 1 }, select: { party_class_code: true, ...named }, orderBy: { display_order: 'asc' } }),
      prisma.sys_country_cd.findMany({ where: { is_active: true, rec_status: 1 }, select: { code: true, ...named }, orderBy: { name: 'asc' } }),
      prisma.sys_service_category_cd.findMany({ where: { is_active: true, rec_status: 1 }, select: { service_category_code: true, ctg_name: true, ctg_name2: true }, orderBy: { ctg_name: 'asc' } }),
      prisma.org_branches_mst.findMany({ where: { tenant_org_id: tenantOrgId, ...ACTIVE }, select: { id: true, branch_name: true, ...named }, orderBy: { name: 'asc' } }),
      prisma.org_tax_item_classes_cf.findMany({ where: { tenant_org_id: tenantOrgId, ...ACTIVE }, select: { class_code: true, tax_flow_code: true, is_default: true, ...named }, orderBy: { display_order: 'asc' } }),
      prisma.org_tax_profiles_cf.findMany({
        where: { tenant_org_id: tenantOrgId, ...ACTIVE },
        distinct: ['tax_code'],
        select: { tax_code: true, tax_flow_code: true, ...named },
        orderBy: [{ tax_code: 'asc' }, { version_no: 'desc' }],
      }),
    ])
    return { taxTypes, categories, exemptReasons, docTypes, partyClasses, countries, serviceCategories, branches, classes, codes }
  })
}

/**
 * Applies a starter package (kit) as a pending candidate; with `activate` also confirms it.
 * @param tenantOrgId - Organization, resolved from the session
 * @param actor - User id for the audit columns
 * @param pkgCode - Package to apply
 * @param activate - Required when the current setup is already active
 * @param note - Optional confirmation note
 * @returns The apply summary, with conflicts the organization must review
 * @throws Database guard errors (`TAX_APPLY_*`, `TAX_ACTIVATE_NOT_READY`)
 */
export async function applyTaxKit(tenantOrgId: string, actor: string, pkgCode: string, activate: boolean, note?: string) {
  return withTenantContext(tenantOrgId, async () => {
    const rows = await prisma.$queryRaw<{ summary: Prisma.JsonValue }[]>(Prisma.sql`
      SELECT public.fn_tax_kit_apply(${tenantOrgId}::uuid, ${pkgCode}, ${actor}, ${activate}, ${note ?? null}) AS summary`)
    return rows[0]?.summary ?? null
  })
}

/**
 * Activates the pending setup when it is ready.
 * @param tenantOrgId - Organization, resolved from the session
 * @param actor - User id for the audit columns
 * @param note - Optional confirmation note
 * @returns `ok` plus readiness codes when it is not ready
 */
export async function confirmTaxConfig(tenantOrgId: string, actor: string, note?: string): Promise<TaxConfirmResult> {
  return withTenantContext(tenantOrgId, async () => {
    const rows = await prisma.$queryRaw<{ result: TaxConfirmResult }[]>(Prisma.sql`
      SELECT public.fn_tax_config_confirm(${tenantOrgId}::uuid, ${actor}, ${note ?? null}) AS result`)
    return rows[0].result
  })
}

async function assertCanLeaveAdvanced(tenantOrgId: string): Promise<void> {
  const notBasic = { tenant_org_id: tenantOrgId, ...ACTIVE, OR: [{ source: TAX_ROW_SOURCE.TENANT }, { is_tenant_modified: true }] }
  const [rules, classes] = await Promise.all([
    prisma.org_tax_rules_cf.count({ where: notBasic }),
    prisma.org_tax_item_classes_cf.count({ where: notBasic }),
  ])
  if (rules + classes > 0) throw new TaxError('TAX_MODE_HAS_ADVANCED_ROWS')
}

/**
 * Saves mode, on/off and registrations in one transaction.
 * @param tenantOrgId - Organization, resolved from the session
 * @param actor - User id for the audit columns
 * @param input - Only the fields present change
 * @throws TaxError when no kit is applied, a branch is unknown, tax is toggled before activation, or Basic would hide custom rows
 */
export async function updateTaxConfig(tenantOrgId: string, actor: string, input: TaxConfigUpdate): Promise<void> {
  await withTenantContext(tenantOrgId, async () => {
    const config = await prisma.org_tax_config_cf.findUnique({ where: { tenant_org_id: tenantOrgId } })
    if (!config) throw new TaxError('TAX_CONFIRM_NO_CONFIG', 404)
    if (input.taxEnabled !== undefined && config.status !== TAX_CONFIG_STATUS.ACTIVE) throw new TaxError('TAX_NOT_ACTIVE')
    if (input.setupMode === 'BASIC' && config.setup_mode === 'ADVANCED') await assertCanLeaveAdvanced(tenantOrgId)

    const audit = { updated_by: actor, updated_info: 'tax settings' }
    await prisma.$transaction(async (tx) => {
      if (input.setupMode !== undefined || input.taxEnabled !== undefined) {
        await tx.org_tax_config_cf.updateMany({
          where: { tenant_org_id: tenantOrgId },
          data: { setup_mode: input.setupMode, tax_enabled: input.taxEnabled, ...audit },
        })
      }
      if (input.orgRegistrationNo !== undefined) {
        await tx.org_tenants_mst.update({ where: { id: tenantOrgId }, data: { tax_registration_no: input.orgRegistrationNo, ...audit } })
      }
      for (const r of input.registrations ?? []) {
        const { count } = await tx.org_branches_mst.updateMany({
          where: { id: r.branchId, tenant_org_id: tenantOrgId },
          data: { tax_registration_no: r.taxRegistrationNo, emirate_code: r.emirateCode, ...audit },
        })
        if (count === 0) throw new TaxError('TAX_BRANCH_NOT_FOUND', 404)
      }
    })
  })
}
