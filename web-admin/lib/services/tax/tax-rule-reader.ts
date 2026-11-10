/** Reads tax rules in the engine's shape. Kept apart from the rule writers: the order loaders import it. */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { isoDate } from '@/lib/tax/determine'

export type TaxRuleRow = Prisma.org_tax_rules_cfGetPayload<{ include: { org_tax_rule_codes_dtl: true } }>

/**
 * A rule row with dates as ISO strings and its active codes in order.
 * @param r - The stored rule and its codes
 * @returns The rule the engine and the screens read
 */
export function serializeTaxRule(r: TaxRuleRow) {
  const { org_tax_rule_codes_dtl: codes, ...rule } = r
  return {
    ...rule,
    effective_from: isoDate(r.effective_from),
    effective_to: r.effective_to ? isoDate(r.effective_to) : null,
    tax_codes: codes.filter((c) => c.is_active).sort((a, b) => a.seq_no - b.seq_no).map((c) => c.tax_code),
  }
}

/**
 * The include that loads a rule's codes for one organization.
 * @param tenantOrgId - Organization, resolved from the session
 * @returns The Prisma include
 */
export const taxRuleCodesInclude = (tenantOrgId: string) => ({ org_tax_rule_codes_dtl: { where: { tenant_org_id: tenantOrgId } } })

/**
 * Every active rule of the organization, in the engine's shape.
 * @param tenantOrgId - Organization, resolved from the session
 * @param db - Client or open transaction
 * @returns Rules with ordered codes
 */
export async function loadActiveTaxRules(tenantOrgId: string, db: Prisma.TransactionClient = prisma) {
  const rows = await db.org_tax_rules_cf.findMany({ where: { tenant_org_id: tenantOrgId, is_active: true, rec_status: 1 }, include: taxRuleCodesInclude(tenantOrgId) })
  return rows.map(serializeTaxRule)
}
