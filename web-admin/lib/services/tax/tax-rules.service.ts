/** Tax rules: which tax codes apply to a line. Ties are refused here, at save time. */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { withTenantContext } from '@/lib/db/tenant-context'
import { TAX_ROW_SOURCE, type TaxFlow, type TaxPartyScope } from '@/lib/constants/tax'
import { findTaxRuleConflict, type TaxRuleForMatch } from '@/lib/tax/determine'
import { TaxError, isoDate } from './tax-errors'
import { loadActiveTaxRules, serializeTaxRule, taxRuleCodesInclude } from './tax-rule-reader'
import type { TaxListQuery } from './tax-codes.service'

export interface TaxRuleFields {
  name: string
  name2: string | null
  docTypeCode: string | null
  taxFlowCode: TaxFlow | null
  branchId: string | null
  placeOfSupplyCountry: string | null
  taxItemClassCode: string | null
  partyTaxClassCode: string | null
  partyCountryScope: TaxPartyScope | null
  serviceCategoryCode: string | null
  effectiveFrom: string
  effectiveTo: string | null
  priority: number
  taxCodes: string[]
}
export type TaxRuleCreate = TaxRuleFields & { ruleCode: string }
export type TaxRulePatch = Partial<TaxRuleFields> & { isActive?: boolean }

const serialize = serializeTaxRule
const withCodes = taxRuleCodesInclude

/**
 * Lists tax rules with their ordered codes.
 * @param tenantOrgId - Organization, resolved from the session
 * @param q - Filters and page
 * @returns One page and the total
 */
export async function listTaxRules(tenantOrgId: string, q: TaxListQuery) {
  const where: Prisma.org_tax_rules_cfWhereInput = {
    tenant_org_id: tenantOrgId,
    rec_status: 1,
    ...(q.includeInactive ? {} : { is_active: true }),
    ...(q.flow ? { tax_flow_code: q.flow } : {}),
    ...(q.search
      ? { OR: [{ rule_code: { contains: q.search, mode: 'insensitive' as const } }, { name: { contains: q.search, mode: 'insensitive' as const } }, { name2: { contains: q.search, mode: 'insensitive' as const } }] }
      : {}),
  }
  return withTenantContext(tenantOrgId, async () => {
    const [rows, total] = await Promise.all([
      prisma.org_tax_rules_cf.findMany({
        where,
        include: withCodes(tenantOrgId),
        orderBy: [{ tax_flow_code: 'desc' }, { priority: 'asc' }, { rule_code: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.org_tax_rules_cf.count({ where }),
    ])
    return { rows: rows.map(serialize), total }
  })
}

function toCriteria(f: Partial<TaxRuleFields>) {
  return {
    doc_type_code: f.docTypeCode,
    tax_flow_code: f.taxFlowCode,
    branch_id: f.branchId,
    place_of_supply_country: f.placeOfSupplyCountry,
    tax_item_class_code: f.taxItemClassCode,
    party_tax_class_code: f.partyTaxClassCode,
    party_country_scope: f.partyCountryScope,
    service_category_code: f.serviceCategoryCode,
  }
}

async function assertNoTie(tx: Prisma.TransactionClient, tenantOrgId: string, candidate: TaxRuleForMatch): Promise<void> {
  const conflict = findTaxRuleConflict(candidate, await loadActiveTaxRules(tenantOrgId, tx))
  if (conflict) throw new TaxError('TAX_RULE_AMBIGUOUS')
}

async function replaceCodes(tx: Prisma.TransactionClient, tenantOrgId: string, ruleId: string, codes: string[], actor: string): Promise<void> {
  await tx.org_tax_rule_codes_dtl.deleteMany({ where: { tenant_org_id: tenantOrgId, rule_id: ruleId } })
  await tx.org_tax_rule_codes_dtl.createMany({
    data: codes.map((tax_code, i) => ({ tenant_org_id: tenantOrgId, rule_id: ruleId, seq_no: i + 1, tax_code, created_by: actor, created_info: 'tax rules' })),
  })
}

/**
 * Creates a tax rule and its ordered codes.
 * @param tenantOrgId - Organization, resolved from the session
 * @param actor - User id for the audit columns
 * @param input - The rule
 * @returns The new rule's id
 * @throws TaxError (`TAX_RULE_AMBIGUOUS`), database guards (`TAX_RULE_UNKNOWN_CODE`), P2002 for same code or same criteria
 */
export async function createTaxRule(tenantOrgId: string, actor: string, input: TaxRuleCreate) {
  return withTenantContext(tenantOrgId, async () =>
    prisma.$transaction(async (tx) => {
      const criteria = toCriteria(input) as TaxRuleForMatch
      await assertNoTie(tx, tenantOrgId, { ...criteria, id: '', priority: input.priority, effective_from: input.effectiveFrom, effective_to: input.effectiveTo })
      const rule = await tx.org_tax_rules_cf.create({
        data: {
          ...toCriteria(input),
          tenant_org_id: tenantOrgId,
          rule_code: input.ruleCode,
          name: input.name,
          name2: input.name2,
          priority: input.priority,
          effective_from: new Date(input.effectiveFrom),
          effective_to: input.effectiveTo ? new Date(input.effectiveTo) : null,
          source: TAX_ROW_SOURCE.TENANT,
          created_by: actor,
          created_info: 'tax rules',
        },
        select: { id: true },
      })
      await replaceCodes(tx, tenantOrgId, rule.id, input.taxCodes, actor)
      return rule
    }),
  )
}

/**
 * Changes a tax rule and, when given, replaces its codes.
 * @param tenantOrgId - Organization, resolved from the session
 * @param actor - User id for the audit columns
 * @param id - Rule id
 * @param patch - Fields to change
 * @throws TaxError when unknown or a tie would result, database guards for unknown codes
 */
export async function updateTaxRule(tenantOrgId: string, actor: string, id: string, patch: TaxRulePatch): Promise<void> {
  await withTenantContext(tenantOrgId, async () =>
    prisma.$transaction(async (tx) => {
      const row = await tx.org_tax_rules_cf.findFirst({ where: { id, tenant_org_id: tenantOrgId, rec_status: 1 } })
      if (!row) throw new TaxError('TAX_RULE_NOT_FOUND', 404)

      const next = {
        doc_type_code: row.doc_type_code,
        tax_flow_code: row.tax_flow_code,
        branch_id: row.branch_id,
        place_of_supply_country: row.place_of_supply_country,
        tax_item_class_code: row.tax_item_class_code,
        party_tax_class_code: row.party_tax_class_code,
        party_country_scope: row.party_country_scope,
        service_category_code: row.service_category_code,
        ...Object.fromEntries(Object.entries(toCriteria(patch)).filter(([, v]) => v !== undefined)),
      } as Omit<TaxRuleForMatch, 'id' | 'priority' | 'effective_from' | 'effective_to'>

      if (patch.isActive ?? row.is_active) {
        await assertNoTie(tx, tenantOrgId, {
          ...next,
          id,
          priority: patch.priority ?? row.priority,
          effective_from: patch.effectiveFrom ?? isoDate(row.effective_from),
          effective_to: patch.effectiveTo === undefined ? (row.effective_to ? isoDate(row.effective_to) : null) : patch.effectiveTo,
        })
      }

      const { count } = await tx.org_tax_rules_cf.updateMany({
        where: { id, tenant_org_id: tenantOrgId },
        data: {
          ...toCriteria(patch),
          name: patch.name,
          name2: patch.name2,
          priority: patch.priority,
          effective_from: patch.effectiveFrom ? new Date(patch.effectiveFrom) : undefined,
          effective_to: patch.effectiveTo === undefined ? undefined : patch.effectiveTo === null ? null : new Date(patch.effectiveTo),
          is_active: patch.isActive,
          updated_by: actor,
          updated_info: 'tax rules',
        },
      })
      if (count === 0) throw new TaxError('TAX_RULE_NOT_FOUND', 404)
      if (patch.taxCodes) await replaceCodes(tx, tenantOrgId, id, patch.taxCodes, actor)
    }),
  )
}
