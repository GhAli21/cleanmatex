/** Tax return periods (T7): add, close (blocks new final tax lines dated inside it) and reopen with a reason. */
import { prisma } from '@/lib/db/prisma'
import { withTenantContext } from '@/lib/db/tenant-context'
import { isoDate } from '@/lib/tax/determine'
import { TaxError } from './tax-errors'

const OPEN = 'OPEN'
const CLOSED = 'CLOSED'

export interface TaxPeriodView {
  id: string
  periodStart: string
  periodEnd: string
  status: string
  closedAt: string | null
  closedBy: string | null
  reopenedAt: string | null
  reopenReason: string | null
}

type PeriodRow = Awaited<ReturnType<typeof prisma.org_tax_periods_mst.findFirstOrThrow>>
const view = (p: PeriodRow): TaxPeriodView => ({
  id: p.id,
  periodStart: isoDate(p.period_start),
  periodEnd: isoDate(p.period_end),
  status: p.status,
  closedAt: p.closed_at?.toISOString() ?? null,
  closedBy: p.closed_by,
  reopenedAt: p.reopened_at?.toISOString() ?? null,
  reopenReason: p.reopen_reason,
})

/**
 * @param tenantOrgId - Organization, resolved from the session
 * @returns Periods, newest first
 */
export async function listTaxPeriods(tenantOrgId: string): Promise<TaxPeriodView[]> {
  return withTenantContext(tenantOrgId, async () =>
    (await prisma.org_tax_periods_mst.findMany({
      where: { tenant_org_id: tenantOrgId, is_active: true, rec_status: 1 },
      orderBy: { period_start: 'desc' },
    })).map(view),
  )
}

/**
 * Adds an open period.
 * @param tenantOrgId - Organization, resolved from the session
 * @param actor - User id for the audit columns
 * @param input - First and last day
 * @returns The period
 * @throws TAX_PERIOD_OVERLAP from the database when it overlaps another period
 */
export async function createTaxPeriod(tenantOrgId: string, actor: string, input: { periodStart: string; periodEnd: string }) {
  return withTenantContext(tenantOrgId, async () =>
    view(await prisma.org_tax_periods_mst.create({
      data: {
        tenant_org_id: tenantOrgId,
        period_start: new Date(input.periodStart),
        period_end: new Date(input.periodEnd),
        status: OPEN,
        created_by: actor,
        created_info: 'tax periods',
      },
    })),
  )
}

/**
 * Closes or reopens a period. Closing stops new final tax lines dated inside it (fn_otl_guard);
 * reopening needs a reason, which stays on the period.
 * @param tenantOrgId - Organization, resolved from the session
 * @param actor - User id
 * @param id - Period
 * @param input - `close`, or `reopen` with a reason
 * @returns The period
 * @throws TaxError TAX_PERIOD_NOT_FOUND / TAX_PERIOD_STATE
 */
export async function changeTaxPeriod(
  tenantOrgId: string,
  actor: string,
  id: string,
  input: { action: 'close' } | { action: 'reopen'; reason: string },
) {
  return withTenantContext(tenantOrgId, async () => {
    const from = input.action === 'close' ? OPEN : CLOSED
    const now = new Date()
    const data = input.action === 'close'
      ? { status: CLOSED, closed_at: now, closed_by: actor }
      : { status: OPEN, reopened_at: now, reopened_by: actor, reopen_reason: input.reason }
    // The status condition makes a double click or a stale screen a no-op instead of a second change.
    const { count } = await prisma.org_tax_periods_mst.updateMany({
      where: { id, tenant_org_id: tenantOrgId, status: from, is_active: true, rec_status: 1 },
      data: { ...data, updated_by: actor, updated_info: `tax period ${input.action}` },
    })
    const period = await prisma.org_tax_periods_mst.findFirst({ where: { id, tenant_org_id: tenantOrgId, rec_status: 1 } })
    if (!period) throw new TaxError('TAX_PERIOD_NOT_FOUND', 404)
    if (count === 0) throw new TaxError('TAX_PERIOD_STATE')
    return view(period)
  })
}
