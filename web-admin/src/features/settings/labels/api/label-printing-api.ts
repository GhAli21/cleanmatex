'use client'

import { getCSRFHeader } from '@lib/hooks/use-csrf-token'
import type { LabelPrintingValues } from '@/lib/services/labels/label-types'
import type { LabelPrintingConfigView } from '@features/settings/labels/model/label-printing-form'

export const LABEL_PRINTING_ENDPOINT = '/api/v1/settings/label-printing'

interface Envelope<T> {
  success?: boolean
  data?: T
  error?: string
}

export class LabelPrintingApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'LabelPrintingApiError'
  }
}

async function parse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as Envelope<T>
  if (!response.ok || payload.success === false || !payload.data) {
    throw new LabelPrintingApiError(payload.error || `Request failed: ${response.status}`, response.status)
  }
  return payload.data
}

/**
 * Loads system defaults, tenant overrides, the branch's overrides and the effective values.
 *
 * @param branchId branch to edit, or null for the tenant-wide scope
 * @returns the label printing config for that scope
 */
export async function fetchLabelPrintingConfig(branchId: string | null): Promise<LabelPrintingConfigView> {
  const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : ''
  const response = await fetch(`${LABEL_PRINTING_ENDPOINT}${qs}`, { credentials: 'include', cache: 'no-store' })
  return parse<LabelPrintingConfigView>(response)
}

/**
 * Saves the overrides of one scope (null values = use the default).
 *
 * @param input scope, rows and CSRF token
 * @returns the config after the save
 */
export async function saveLabelPrintingConfig(input: {
  branchId: string | null
  rows: LabelPrintingValues[]
  csrfToken: string | null
}): Promise<LabelPrintingConfigView> {
  const response = await fetch(LABEL_PRINTING_ENDPOINT, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getCSRFHeader(input.csrfToken) },
    body: JSON.stringify({ branchId: input.branchId, rows: input.rows }),
  })
  return parse<LabelPrintingConfigView>(response)
}
