'use client'

import { getCSRFHeader } from '@lib/hooks/use-csrf-token'
import type { CashControlSettings } from '@lib/constants/cash-control'
import type { CashControlSettingsPatchInput } from '@lib/validations/cash-control-schemas'

interface CashControlSettingsApiEnvelope<T> {
  success?: boolean
  data?: T
  error?: string
  fieldErrors?: Record<string, string>
}

export class CashControlSettingsApiError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors?: Record<string, string>
  ) {
    super(message)
    this.name = 'CashControlSettingsApiError'
  }
}

/**
 * Loads the resolved tenant-level cash-control policy.
 *
 * @returns fully-populated cash-control settings
 */
export async function fetchCashControlSettings(): Promise<CashControlSettings> {
  const response = await fetch('/api/v1/settings/payments/cash-control', {
    credentials: 'include',
  })
  return parseCashControlResponse<CashControlSettings>(response)
}

/**
 * Patches one or more tenant-level cash-control settings. A field set to
 * `null` clears that override (reverts to inherit); a field absent from the
 * patch is left untouched.
 *
 * @param input patch, optional change reason, and CSRF token
 * @returns the freshly resolved cash-control settings after the write
 */
export async function updateCashControlSettingsApi(input: {
  patch: CashControlSettingsPatchInput
  reason?: string
  csrfToken: string | null
}): Promise<CashControlSettings> {
  const response = await fetch('/api/v1/settings/payments/cash-control', {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getCSRFHeader(input.csrfToken),
    },
    body: JSON.stringify({ patch: input.patch, reason: input.reason || undefined }),
  })
  return parseCashControlResponse<CashControlSettings>(response)
}

async function parseCashControlResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as CashControlSettingsApiEnvelope<T>

  if (!response.ok || payload.success === false) {
    throw new CashControlSettingsApiError(
      payload.error || `Request failed: ${response.status}`,
      payload.fieldErrors
    )
  }

  if (!payload.data) {
    throw new CashControlSettingsApiError(`Request failed: ${response.status}`)
  }

  return payload.data
}
