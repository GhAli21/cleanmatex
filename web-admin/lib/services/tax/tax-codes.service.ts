/** Versioned tax codes. A version orders already used never changes: a change makes a new version. */
import { Prisma, type org_tax_profiles_cf } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { withTenantContext } from '@/lib/db/tenant-context'
import { TAX_ROW_SOURCE, type TaxAmountKind, type TaxCalcLevel, type TaxFlow } from '@/lib/constants/tax'
import { TaxError, isoDate } from './tax-errors'

export interface TaxCodeFields {
  name: string
  name2: string | null
  taxType: string
  amountKind: TaxAmountKind
  rate: number | null
  fixedAmount: number | null
  calcLevel: TaxCalcLevel
  taxCategoryCode: string
  exemptReasonCode: string | null
  taxFlowCode: TaxFlow
  recoverablePct: number
  isReverseCharge: boolean
  priority: number
  effectiveFrom: string
  effectiveTo: string | null
}

export type TaxCodeCreate = TaxCodeFields & { taxCode: string }
export type TaxCodePatch = Partial<TaxCodeFields> & { isActive?: boolean }

export interface TaxListQuery {
  search?: string
  flow?: TaxFlow
  includeInactive?: boolean
  page: number
  pageSize: number
}

function toColumns(f: Partial<TaxCodeFields>) {
  return {
    name: f.name,
    name2: f.name2,
    tax_type: f.taxType,
    amount_kind: f.amountKind,
    rate: f.rate,
    fixed_amount: f.fixedAmount,
    calc_level: f.calcLevel,
    tax_category_code: f.taxCategoryCode,
    exempt_reason_code: f.exemptReasonCode,
    tax_flow_code: f.taxFlowCode,
    recoverable_pct: f.recoverablePct,
    is_reverse_charge: f.isReverseCharge,
    priority: f.priority,
    effective_from: f.effectiveFrom !== undefined ? new Date(f.effectiveFrom) : undefined,
    effective_to: f.effectiveTo === undefined ? undefined : f.effectiveTo === null ? null : new Date(f.effectiveTo),
  }
}

/** Fields the database freezes on a used version (fn_otp_guard_used); keep in step with it. */
const FROZEN_KEYS: (keyof TaxCodeFields)[] = [
  'taxType', 'amountKind', 'rate', 'fixedAmount', 'calcLevel', 'taxCategoryCode', 'taxFlowCode',
  'recoverablePct', 'isReverseCharge', 'priority', 'effectiveFrom',
]

function changesFrozenField(row: org_tax_profiles_cf, patch: TaxCodePatch): boolean {
  const current: Partial<Record<keyof TaxCodeFields, unknown>> = {
    taxType: row.tax_type,
    amountKind: row.amount_kind,
    rate: row.rate === null ? null : Number(row.rate),
    fixedAmount: row.fixed_amount === null ? null : Number(row.fixed_amount),
    calcLevel: row.calc_level,
    taxCategoryCode: row.tax_category_code,
    taxFlowCode: row.tax_flow_code,
    recoverablePct: Number(row.recoverable_pct),
    isReverseCharge: row.is_reverse_charge,
    priority: row.priority,
    effectiveFrom: isoDate(row.effective_from),
  }
  return FROZEN_KEYS.some((k) => patch[k] !== undefined && patch[k] !== current[k])
}

/**
 * Lists tax codes (every version), newest version first within a code.
 * @param tenantOrgId - Organization, resolved from the session
 * @param q - Filters and page
 * @returns One page and the total
 */
export async function listTaxCodes(tenantOrgId: string, q: TaxListQuery) {
  const where: Prisma.org_tax_profiles_cfWhereInput = {
    tenant_org_id: tenantOrgId,
    rec_status: 1,
    ...(q.includeInactive ? {} : { is_active: true }),
    ...(q.flow ? { tax_flow_code: q.flow } : {}),
    ...(q.search
      ? { AND: [{ OR: [{ tax_code: { contains: q.search, mode: 'insensitive' as const } }, { name: { contains: q.search, mode: 'insensitive' as const } }, { name2: { contains: q.search, mode: 'insensitive' as const } }] }] }
      : {}),
  }
  return withTenantContext(tenantOrgId, async () => {
    const [rows, total] = await Promise.all([
      prisma.org_tax_profiles_cf.findMany({
        where,
        orderBy: [{ display_order: 'asc' }, { tax_code: 'asc' }, { version_no: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.org_tax_profiles_cf.count({ where }),
    ])
    return { rows, total }
  })
}

/**
 * Creates a tax code at version 1.
 * @param tenantOrgId - Organization, resolved from the session
 * @param actor - User id for the audit columns
 * @param input - The code
 * @returns The new row
 * @throws TaxError when no kit is applied; P2002 when the code exists
 */
export async function createTaxCode(tenantOrgId: string, actor: string, input: TaxCodeCreate) {
  return withTenantContext(tenantOrgId, async () => {
    const config = await prisma.org_tax_config_cf.findUnique({ where: { tenant_org_id: tenantOrgId }, select: { kit_version_id: true } })
    if (!config) throw new TaxError('TAX_CONFIRM_NO_CONFIG', 404)
    const version = await prisma.sys_tax_kit_versions_mst.findUnique({
      where: { id: config.kit_version_id },
      select: { rounding_level: true, rounding_mode: true },
    })
    return prisma.org_tax_profiles_cf.create({
      data: {
        ...toColumns(input),
        name: input.name,
        tax_type: input.taxType,
        tax_category_code: input.taxCategoryCode,
        effective_from: new Date(input.effectiveFrom),
        tenant_org_id: tenantOrgId,
        tax_code: input.taxCode,
        version_no: 1,
        source: TAX_ROW_SOURCE.TENANT,
        // New codes round like the kit, so one document never mixes rounding styles.
        rounding_level: version?.rounding_level ?? 'LINE',
        rounding_mode: version?.rounding_mode ?? 'HALF_UP',
        created_by: actor,
        created_info: 'tax codes',
      },
    })
  })
}

/**
 * Changes a tax code. An unused version is edited in place. A used one, when a frozen
 * field changes, gets a new version from the patch's start date; the old version ends the day before.
 * @param tenantOrgId - Organization, resolved from the session
 * @param actor - User id for the audit columns
 * @param id - Version id
 * @param patch - Fields to change
 * @returns The row now in force
 * @throws TaxError when the code is unknown, still used by an active rule, or the new start date is not later
 */
export async function updateTaxCode(tenantOrgId: string, actor: string, id: string, patch: TaxCodePatch) {
  return withTenantContext(tenantOrgId, async () =>
    prisma.$transaction(async (tx) => {
      const row = await tx.org_tax_profiles_cf.findFirst({ where: { id, tenant_org_id: tenantOrgId, rec_status: 1 } })
      if (!row) throw new TaxError('TAX_CODE_NOT_FOUND', 404)
      const audit = { updated_by: actor, updated_info: 'tax codes' }

      if (patch.isActive === false) {
        const inRule = await tx.org_tax_rule_codes_dtl.count({
          where: { tenant_org_id: tenantOrgId, tax_code: row.tax_code, is_active: true, org_tax_rules_cf: { is_active: true, rec_status: 1 } },
        })
        const otherVersions = await tx.org_tax_profiles_cf.count({
          where: { tenant_org_id: tenantOrgId, tax_code: row.tax_code, is_active: true, rec_status: 1, id: { not: id } },
        })
        if (inRule > 0 && otherVersions === 0) throw new TaxError('TAX_CODE_IN_RULES')
      }

      const used = await tx.$queryRaw<{ used: boolean }[]>(
        Prisma.sql`SELECT public.fn_tax_profile_is_used(${tenantOrgId}::uuid, ${id}::uuid) AS used`,
      )
      if (!used[0]?.used || !changesFrozenField(row, patch)) {
        return tx.org_tax_profiles_cf.update({
          where: { tenant_org_id_id: { tenant_org_id: tenantOrgId, id } },
          data: { ...toColumns(patch), is_active: patch.isActive, ...audit },
        })
      }

      const startsOn = patch.effectiveFrom ?? isoDate(new Date())
      if (startsOn <= isoDate(row.effective_from)) throw new TaxError('TAX_VERSION_DATE_INVALID', 422)

      const last = await tx.org_tax_profiles_cf.aggregate({ where: { tenant_org_id: tenantOrgId, tax_code: row.tax_code }, _max: { version_no: true } })
      const dayBefore = new Date(`${startsOn}T00:00:00.000Z`)
      dayBefore.setUTCDate(dayBefore.getUTCDate() - 1)
      await tx.org_tax_profiles_cf.update({
        where: { tenant_org_id_id: { tenant_org_id: tenantOrgId, id } },
        data: { effective_to: dayBefore, ...audit },
      })

      const {
        id: _id, created_at: _ca, created_by: _cb, created_info: _ci, updated_at: _ua, updated_by: _ub, updated_info: _ui,
        updated_count: _uc, deleted_at: _da, deleted_by: _db, deleted_info: _di, ...copy
      } = row
      return tx.org_tax_profiles_cf.create({
        data: {
          ...copy,
          ...toColumns(patch),
          effective_from: new Date(startsOn),
          effective_to: patch.effectiveTo ? new Date(patch.effectiveTo) : null,
          name: patch.name ?? row.name,
          tax_type: patch.taxType ?? row.tax_type,
          tax_category_code: patch.taxCategoryCode ?? row.tax_category_code,
          version_no: (last._max.version_no ?? row.version_no) + 1,
          is_tenant_modified: true,
          created_by: actor,
          created_info: 'tax codes: new version',
        },
      })
    }),
  )
}
