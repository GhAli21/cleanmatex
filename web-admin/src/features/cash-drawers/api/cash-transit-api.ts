'use client'

import { getCSRFHeader } from '@lib/hooks/use-csrf-token'

export type TransitStatus = 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED'
export type TransitStatusFilter = TransitStatus | 'ALL'

/** One in-transit transfer — mirrors `TransitRow` of the service. Money is an exact decimal string. */
export interface TransitEntry {
  id: string
  transitNo: string
  branchId: string
  branchName: string | null
  sourceDrawerId: string
  sourceDrawerName: string | null
  destDrawerId: string
  destDrawerName: string | null
  currencyCode: string
  amount: string
  status: TransitStatus
  notes: string | null
  carriedByUserId: string | null
  carriedByName: string | null
  sentBy: string
  sentByName: string | null
  sentAt: string
  settledBy: string | null
  settledByName: string | null
  settledAt: string | null
  cancelReason: string | null
}

export interface TransitPage {
  rows: TransitEntry[]
  totalCount: number
  page: number
  pageSize: number
}

/** Query key of the transfer list, shared by the screen and its mutations. */
export const transitListKey = (status: TransitStatusFilter, page: number) =>
  ['cash-drawers', 'transit', status, page] as const

interface Envelope<T> {
  success?: boolean
  data?: T
  error?: string
  code?: string
}

/** Rethrows an API refusal as `Error(code)` so `useCashDrawerErrorMessage` can translate it. */
async function read<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as Envelope<T>
  if (!response.ok || payload.success === false || payload.data === undefined) {
    throw new Error(payload.code || payload.error || `Request failed: ${response.status}`)
  }
  return payload.data
}

const jsonHeaders = (csrfToken: string | null) => ({ 'Content-Type': 'application/json', ...getCSRFHeader(csrfToken) })

/** Transfers for the viewer's branches, newest first (default filter: still on the road). */
export async function fetchTransits(input: {
  status: TransitStatusFilter
  page: number
  pageSize: number
}): Promise<TransitPage> {
  const params = new URLSearchParams({
    status: input.status,
    page: String(input.page),
    pageSize: String(input.pageSize),
  })
  return read<TransitPage>(await fetch(`/api/v1/cash-drawers/transit?${params.toString()}`, { credentials: 'include' }))
}

/** Sends cash in transit. `amount` is the exact decimal string the user typed. */
export async function postSendTransit(input: {
  sourceDrawerId: string
  destDrawerId: string
  amount: string
  notes?: string
  idempotencyKey: string
  csrfToken: string | null
}): Promise<{ transitId: string; transitNo: string }> {
  const { csrfToken, ...body } = input
  return read(
    await fetch('/api/v1/cash-drawers/transit', {
      method: 'POST',
      credentials: 'include',
      headers: jsonHeaders(csrfToken),
      body: JSON.stringify(body),
    }),
  )
}

/** Counts a transfer into its destination drawer. */
export async function postReceiveTransit(input: {
  transitId: string
  csrfToken: string | null
}): Promise<{ trxNo: string }> {
  return read(
    await fetch(`/api/v1/cash-drawers/transit/${input.transitId}/receive`, {
      method: 'POST',
      credentials: 'include',
      headers: jsonHeaders(input.csrfToken),
      body: '{}',
    }),
  )
}

/** Returns a transfer's cash to its source drawer; the reason is mandatory. */
export async function postCancelTransit(input: {
  transitId: string
  reason: string
  csrfToken: string | null
}): Promise<{ trxNo: string }> {
  return read(
    await fetch(`/api/v1/cash-drawers/transit/${input.transitId}/cancel`, {
      method: 'POST',
      credentials: 'include',
      headers: jsonHeaders(input.csrfToken),
      body: JSON.stringify({ reason: input.reason }),
    }),
  )
}
