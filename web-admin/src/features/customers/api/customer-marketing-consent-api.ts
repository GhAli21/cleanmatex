import { getCSRFToken } from '@lib/utils/csrf-token'
import type { MarketingConsentChannel } from '@/lib/constants/notification-campaigns'

/** One channel's marketing consent as the API returns it. */
export interface MarketingConsentEntry {
  channel: MarketingConsentChannel
  agreed: boolean
  givenAt: string | null
  withdrawnAt: string | null
}

/** A customer's marketing consent on every channel, with whether each channel has an address. */
export interface CustomerMarketingConsent {
  customerId: string
  hasEmail: boolean
  hasPhone: boolean
  channels: MarketingConsentEntry[]
}

const url = (customerId: string) => `/api/v1/customers/${encodeURIComponent(customerId)}/marketing-consent`

/**
 * Loads consent for the open customer; the organization comes from the session, `tenantId` is a stale-selection guard.
 * @param tenantId - Expected organization
 * @param customerId - Customer being viewed
 * @param signal - Cancels an obsolete load
 * @returns Consent per channel
 * @throws Error when loading fails or the answer is for another customer
 */
export async function fetchCustomerMarketingConsent(tenantId: string, customerId: string, signal?: AbortSignal): Promise<CustomerMarketingConsent> {
  const response = await fetch(url(customerId), { credentials: 'include', cache: 'no-store', signal, headers: { 'X-Tenant-Id': tenantId } })
  const result = await response.json() as { success?: boolean; data?: CustomerMarketingConsent }
  if (!response.ok || !result.success || result.data?.customerId !== customerId) throw new Error('Could not load marketing consent')
  return result.data
}

/**
 * Saves the channels the operator changed.
 * @param tenantId - Expected organization
 * @param customerId - Customer being edited
 * @param channels - Changed channels only
 * @returns Consent after saving
 * @throws Error when CSRF, saving or the answer fails
 */
export async function saveCustomerMarketingConsent(
  tenantId: string,
  customerId: string,
  channels: { channel: MarketingConsentChannel; agreed: boolean }[],
): Promise<CustomerMarketingConsent> {
  const token = await getCSRFToken()
  if (!token) throw new Error('Could not establish secure customer update')
  const response = await fetch(url(customerId), {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token, 'X-Tenant-Id': tenantId },
    body: JSON.stringify({ channels }),
  })
  const result = await response.json() as { success?: boolean; data?: CustomerMarketingConsent }
  if (!response.ok || !result.success || result.data?.customerId !== customerId) throw new Error('Could not save marketing consent')
  return result.data
}
