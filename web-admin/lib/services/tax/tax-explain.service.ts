/** "Why this tax?": runs the same determination the order engine will use, without saving anything. */
import { prisma } from '@/lib/db/prisma'
import { withTenantContext } from '@/lib/db/tenant-context'
import { determineTaxRule, pickTaxCodeVersion, type TaxFacts } from '@/lib/tax/determine'
import { TAX_CONFIG_STATUS } from '@/lib/constants/tax'
import { isoDate } from '@/lib/tax/determine'
import { businessDateForTimezone, isValidTimeZone } from '@/lib/utils/business-date'
import { loadActiveTaxRules } from './tax-rule-reader'

/**
 * Explains which rule and tax codes apply to a set of line facts.
 * @param tenantOrgId - Organization, resolved from the session
 * @param facts - The line facts
 * @returns The outcome, the codes in calculation order (`missing` when no version covers the date), and all matching rules
 */
export async function explainTax(tenantOrgId: string, facts: TaxFacts) {
  return withTenantContext(tenantOrgId, async () => {
    const [rules, versions] = await Promise.all([
      loadActiveTaxRules(tenantOrgId),
      prisma.org_tax_profiles_cf.findMany({ where: { tenant_org_id: tenantOrgId, is_active: true, rec_status: 1 } }),
    ])
    const outcome = determineTaxRule(facts, rules)
    const codes = (outcome.rule?.tax_codes ?? []).map((taxCode) => {
      const found = pickTaxCodeVersion(
        versions
          .filter((v) => v.tax_code === taxCode)
          .map((v) => ({ ...v, effective_from: isoDate(v.effective_from), effective_to: v.effective_to ? isoDate(v.effective_to) : null })),
        facts.date,
      )
      return found
        ? {
            tax_code: taxCode,
            missing: false,
            version_no: found.version_no,
            name: found.name,
            name2: found.name2,
            tax_category_code: found.tax_category_code,
            amount_kind: found.amount_kind,
            rate: found.rate === null ? null : Number(found.rate),
            fixed_amount: found.fixed_amount === null ? null : Number(found.fixed_amount),
            is_reverse_charge: found.is_reverse_charge,
          }
        : { tax_code: taxCode, missing: true }
    })
    return {
      status: outcome.status,
      rule: outcome.rule,
      codes,
      candidates: outcome.candidates.map((r) => ({ id: r.id, rule_code: r.rule_code, name: r.name, name2: r.name2, priority: r.priority })),
    }
  })
}

/**
 * The VAT rate a walk-in customer pays on a default-class line, as a fraction, for display.
 * @param tenantOrgId - Organization, resolved by the caller
 * @returns The rate (0.05); 0 when the tax setup is not active or the rule charges nothing
 */
export async function getDefaultSalesVatRate(tenantOrgId: string): Promise<number> {
  const [config, tenant, defaultClass] = await withTenantContext(tenantOrgId, () =>
    Promise.all([
      prisma.org_tax_config_cf.findFirst({ where: { tenant_org_id: tenantOrgId, is_active: true, rec_status: 1 }, select: { status: true, tax_enabled: true } }),
      prisma.org_tenants_mst.findFirst({ where: { id: tenantOrgId }, select: { country: true, timezone: true } }),
      prisma.org_tax_item_classes_cf.findFirst({
        where: { tenant_org_id: tenantOrgId, tax_flow_code: 'OUTPUT', is_default: true, is_active: true, rec_status: 1 },
        select: { class_code: true },
      }),
    ]),
  )
  if (config?.status !== TAX_CONFIG_STATUS.ACTIVE || !config.tax_enabled || !tenant?.country) return 0

  const now = new Date()
  const { codes } = await explainTax(tenantOrgId, {
    date: isValidTimeZone(tenant.timezone) ? businessDateForTimezone(tenant.timezone as string, now) : isoDate(now),
    doc_type_code: 'ORDER',
    tax_flow_code: 'OUTPUT',
    branch_id: null,
    place_of_supply_country: tenant.country,
    tax_item_class_code: defaultClass?.class_code ?? null,
    party_tax_class_code: 'CONSUMER',
    party_country_scope: 'DOMESTIC',
    service_category_code: null,
  })
  const percent = codes.reduce((sum, c) => sum + ('rate' in c && c.tax_category_code === 'STANDARD' && c.amount_kind === 'PERCENT' ? c.rate ?? 0 : 0), 0)
  return Math.round(percent * 100) / 10000
}
