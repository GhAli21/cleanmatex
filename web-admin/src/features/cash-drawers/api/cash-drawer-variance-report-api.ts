'use client'

/** Row of the cash-variance-by-cashier report — mirrors `VarianceByCashierRow` of the service. */
export interface VarianceByCashierEntry {
  cashierId: string | null
  cashierName: string | null
  currencyCode: string
  sessionCount: number
  balancedCount: number
  shortageCount: number
  overageCount: number
  totalVariance: string
  meanVariance: string
  absoluteVariance: string
  shortageTotal: string
  overageTotal: string
  largestShortage: string
  largestOverage: string
  shortageShare: number | null
  pendingDecisionCount: number
  rejectedCount: number
}

export interface VarianceByCashierData {
  filter: { dateFrom: string; dateTo: string; cashierId?: string }
  rows: VarianceByCashierEntry[]
}

export interface VarianceReportQuery {
  dateFrom: string
  dateTo: string
  branchId?: string
  cashierId?: string
}

/** Query key of the report, shared by the screen and the print page. */
export const varianceReportKey = (query: VarianceReportQuery) => ['cash-drawers', 'variance-report', query] as const

/**
 * Loads the cash variance by cashier report for a close-date range, limited server-side to the
 * actor's permitted branches.
 *
 * @param query inclusive `YYYY-MM-DD` range plus optional branch / cashier narrowing
 * @returns one row per cashier and currency
 * @throws Error carrying the API's stable code or message
 */
export async function fetchVarianceByCashier(query: VarianceReportQuery): Promise<VarianceByCashierData> {
  const params = new URLSearchParams({ dateFrom: query.dateFrom, dateTo: query.dateTo })
  if (query.branchId) params.set('branchId', query.branchId)
  if (query.cashierId) params.set('cashierId', query.cashierId)
  const response = await fetch(`/api/v1/cash-drawers/variance-report?${params.toString()}`, { credentials: 'include' })
  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean
    data?: VarianceByCashierData
    error?: string
    code?: string
  }
  if (!response.ok || payload.success === false || !payload.data) {
    throw new Error(payload.code || payload.error || `Request failed: ${response.status}`)
  }
  return payload.data
}
