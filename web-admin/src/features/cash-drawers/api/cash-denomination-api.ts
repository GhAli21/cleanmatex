'use client'

import { getCSRFHeader } from '@lib/hooks/use-csrf-token'

/** One HQ denomination with this tenant's override applied — mirrors `EffectiveDenomination`. */
export interface EffectiveDenominationEntry {
  denominationCode: string
  denominationMinor: number
  denomKind: string
  name: string
  name2: string | null
  hqDisplayOrder: number | null
  displayOrderOverride: number | null
  isEnabled: boolean
}

export interface DenominationOverrideItem {
  denominationCode: string
  isEnabled: boolean
  displayOrder?: number | null
}

interface Envelope<T> {
  success?: boolean
  data?: T
  error?: string
  code?: string
}

async function read<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as Envelope<T>
  if (!response.ok || payload.success === false || payload.data === undefined) {
    throw new Error(payload.code || payload.error || `Request failed: ${response.status}`)
  }
  return payload.data
}

/** Currencies the tenant counts cash in that have an HQ denomination catalog. */
export async function fetchCountableCurrencies(): Promise<string[]> {
  return read<string[]>(await fetch('/api/v1/cash-drawers/denominations/currencies', { credentials: 'include' }))
}

/** HQ denominations of a currency with the tenant's switched-off flags and order applied. */
export async function fetchEffectiveDenominations(currencyCode: string): Promise<EffectiveDenominationEntry[]> {
  return read<EffectiveDenominationEntry[]>(
    await fetch(`/api/v1/cash-drawers/denominations?currency=${encodeURIComponent(currencyCode)}`, {
      credentials: 'include',
    }),
  )
}

/** Saves the tenant's overrides for one currency; returns the refreshed effective list. */
export async function saveDenominationOverridesApi(input: {
  currencyCode: string
  items: DenominationOverrideItem[]
  csrfToken: string | null
}): Promise<EffectiveDenominationEntry[]> {
  return read<EffectiveDenominationEntry[]>(
    await fetch('/api/v1/cash-drawers/denominations', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...getCSRFHeader(input.csrfToken) },
      body: JSON.stringify({ currencyCode: input.currencyCode, items: input.items }),
    }),
  )
}
