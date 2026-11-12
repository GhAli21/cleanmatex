/**
 * VAT return (T7): the organization's kit layout filled from its final tax lines dated in a range.
 * Amounts are in the organization's base currency. Every query filters `tenant_org_id`,
 * including each joined org_* table.
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { withTenantContext } from '@/lib/db/tenant-context'
import { computeTaxReturn, type ReturnBoxSource, type ReturnLineGroup } from '@/lib/tax/tax-return'
import { TaxError } from './tax-errors'

export interface TaxReturnBox {
  code: string
  section: string
  kind: string
  name: string
  name2: string | null
  showsAmount: boolean
  showsTax: boolean
  isVerified: boolean
  amount: string
  tax: string
}

export interface TaxReturnView {
  kitCode: string | null
  from: string
  to: string
  currencyCode: string | null
  currencyDecimals: number | null
  boxes: TaxReturnBox[]
  notOnReturn: { flow: string; category: string; reverseCharge: boolean; emirate: string | null; taxable: string; tax: string; lineCount: number }[]
  lineCount: number
}

export interface TaxReturnLine {
  id: string
  tax_date: string
  source_doc_type_code: string
  source_doc_no: string | null
  tax_code: string
  rate: string | null
  taxable: string
  tax: string
  recoverable: string
  is_reversal: boolean
}

/** Joins and filters shared by the summary and the drill-down (tenant on every org_* table). */
function linesFrom(tenantOrgId: string, from: string, to: string) {
  return Prisma.sql`
    FROM public.org_tax_lines_tr l
    LEFT JOIN public.org_tax_profiles_cf p ON p.tenant_org_id = l.tenant_org_id AND p.id = l.tax_profile_id
    LEFT JOIN public.org_branches_mst b ON b.tenant_org_id = l.tenant_org_id AND b.id = l.branch_id
    WHERE l.tenant_org_id = ${tenantOrgId}::uuid
      AND l.line_status = 'FINAL' AND l.is_active = true AND l.rec_status = 1
      AND l.tax_date BETWEEN ${from}::date AND ${to}::date`
}

// Recoverable is stored in the line currency; scale it like the tax to the base currency.
const BASE_RECOVERABLE = Prisma.sql`CASE WHEN l.tax_amount = 0 THEN 0 ELSE l.recoverable_amount * l.base_tax_amount / l.tax_amount END`

async function kitOf(tenantOrgId: string) {
  const config = await prisma.org_tax_config_cf.findFirst({
    where: { tenant_org_id: tenantOrgId, is_active: true, rec_status: 1 },
    select: { kit_version_id: true },
  })
  const kit = config?.kit_version_id
    ? await prisma.sys_tax_kit_versions_mst.findFirst({ where: { id: config.kit_version_id }, select: { kit_code: true } })
    : null
  return kit?.kit_code ?? null
}

async function sourcesOf(kitCode: string): Promise<ReturnBoxSource[]> {
  return prisma.sys_tax_return_box_map_dtl.findMany({
    where: { kit_code: kitCode, is_active: true, rec_status: 1 },
    select: {
      box_code: true, source_kind: true, tax_flow_code: true, tax_category_code: true, is_reverse_charge: true,
      emirate_code: true, tax_measure: true, source_box_code: true, sign: true,
    },
  })
}

/**
 * @param tenantOrgId - Organization, resolved from the session
 * @param range - First and last tax date
 * @returns Every box of the organization's return form and the lines no box takes
 */
export async function getTaxReturn(tenantOrgId: string, range: { from: string; to: string }): Promise<TaxReturnView> {
  return withTenantContext(tenantOrgId, async () => {
    const [kitCode, tenant] = await Promise.all([
      kitOf(tenantOrgId),
      prisma.org_tenants_mst.findFirst({ where: { id: tenantOrgId }, select: { currency: true } }),
    ])
    const currency = tenant?.currency
      ? await prisma.sys_currency_cd.findUnique({ where: { code: tenant.currency }, select: { minor_unit: true } })
      : null
    const empty: TaxReturnView = {
      kitCode, ...range, currencyCode: tenant?.currency ?? null, currencyDecimals: currency?.minor_unit ?? null,
      boxes: [], notOnReturn: [], lineCount: 0,
    }
    if (!kitCode) return empty

    const [boxes, sources, groups] = await Promise.all([
      prisma.sys_tax_return_box_cd.findMany({ where: { kit_code: kitCode, is_active: true, rec_status: 1 } }),
      sourcesOf(kitCode),
      prisma.$queryRaw<ReturnLineGroup[]>(Prisma.sql`
        SELECT l.tax_flow_code, l.tax_category_code,
               COALESCE(p.is_reverse_charge, false) AS is_reverse_charge, b.emirate_code,
               SUM(l.base_taxable_amount)::text AS taxable, SUM(l.base_tax_amount)::text AS tax,
               SUM(${BASE_RECOVERABLE})::text AS recoverable, COUNT(*)::int AS line_count
        ${linesFrom(tenantOrgId, range.from, range.to)}
        GROUP BY 1, 2, 3, 4`),
    ])
    const result = computeTaxReturn(boxes, sources, groups)
    return {
      ...empty,
      boxes: result.boxes.map((b) => ({
        code: b.box_code, section: b.section_code, kind: b.box_kind, name: b.name, name2: b.name2,
        showsAmount: b.shows_amount, showsTax: b.shows_tax, isVerified: b.is_verified,
        amount: b.amount.toFixed(4), tax: b.tax.toFixed(4),
      })),
      notOnReturn: result.notOnReturn.map((g) => ({
        flow: g.tax_flow_code, category: g.tax_category_code, reverseCharge: g.is_reverse_charge, emirate: g.emirate_code,
        taxable: g.taxable, tax: g.tax, lineCount: g.line_count,
      })),
      lineCount: groups.reduce((n, g) => n + g.line_count, 0),
    }
  })
}

/**
 * The final tax lines behind one LINES box (drill-down).
 * @param tenantOrgId - Organization, resolved from the session
 * @param q - Range, box and page
 * @returns One page of lines, newest first
 * @throws TaxError TAX_RETURN_BOX_NOT_FOUND for a box the organization's form does not have
 */
export async function getTaxReturnLines(
  tenantOrgId: string,
  q: { from: string; to: string; box: string; page: number; pageSize: number },
): Promise<{ items: TaxReturnLine[]; total: number }> {
  return withTenantContext(tenantOrgId, async () => {
    const kitCode = await kitOf(tenantOrgId)
    const sources = kitCode ? (await sourcesOf(kitCode)).filter((s) => s.box_code === q.box && s.source_kind === 'LINES') : []
    if (sources.length === 0) throw new TaxError('TAX_RETURN_BOX_NOT_FOUND', 404)

    const match = Prisma.join(sources.map((s) => Prisma.sql`(l.tax_flow_code = ${s.tax_flow_code}
      AND (${s.tax_category_code}::text IS NULL OR l.tax_category_code = ${s.tax_category_code})
      AND (${s.is_reverse_charge}::boolean IS NULL OR COALESCE(p.is_reverse_charge, false) = ${s.is_reverse_charge})
      AND (${s.emirate_code}::text IS NULL OR b.emirate_code = ${s.emirate_code}))`), ' OR ')
    const base = Prisma.sql`${linesFrom(tenantOrgId, q.from, q.to)} AND (${match})`
    const [items, count] = await Promise.all([
      prisma.$queryRaw<TaxReturnLine[]>(Prisma.sql`
        SELECT l.id::text AS id, to_char(l.tax_date, 'YYYY-MM-DD') AS tax_date, l.source_doc_type_code, l.source_doc_no,
               l.tax_code, l.rate::text AS rate, l.base_taxable_amount::text AS taxable, l.base_tax_amount::text AS tax,
               (${BASE_RECOVERABLE})::text AS recoverable, (l.reverses_tax_line_id IS NOT NULL) AS is_reversal
        ${base}
        ORDER BY l.tax_date DESC, l.created_at DESC, l.id
        LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`),
      prisma.$queryRaw<{ n: number }[]>(Prisma.sql`SELECT COUNT(*)::int AS n ${base}`),
    ])
    return { items, total: count[0]?.n ?? 0 }
  })
}
