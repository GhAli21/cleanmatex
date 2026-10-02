import { getCSRFToken } from '@lib/utils/csrf-token'
import type { CustomerWithTenantData } from '@lib/types/customer'

/** Minimal customer data used by the consent editor; no other customer fields are submitted. */
export interface CustomerNotificationConsent {
  optedIn: boolean
  phone: string | null
  updatedAt: string
}

/**
 * Verify customer and organization identity before exposing consent to an open editor.
 * The API resolves its tenant from the session; tenantId is only an expected-tenant guard.
 *
 * @param tenantId - Expected authenticated organization for the customer record
 * @param customerId - Customer whose existing WhatsApp consent is being inspected
 * @param signal - Cancels an obsolete query when the customer editor changes
 * @returns Explicit consent, current contact phone, and the record revision timestamp
 * @throws Error when loading fails or the response belongs to a different customer or tenant
 */
export async function fetchCustomerNotificationConsent(tenantId: string, customerId: string, signal?: AbortSignal): Promise<CustomerNotificationConsent> {
  const response = await fetch(`/api/v1/customers/${encodeURIComponent(customerId)}`, {
    credentials: 'include', cache: 'no-store', signal,
    headers: { 'X-Tenant-Id': tenantId },
  })
  const result = await response.json() as { success?: boolean; data?: CustomerWithTenantData }
  const customer = result.data
  if (!response.ok || !result.success || !customer || customer.id !== customerId || customer.tenantData?.tenantOrgId !== tenantId) {
    throw new Error('Could not load customer notification consent')
  }
  return {
    optedIn: customer.preferences?.notifications?.whatsapp === true,
    phone: customer.phone,
    updatedAt: customer.updatedAt,
  }
}

/**
 * Save consent through a preferences-only patch that retains unrelated customer values.
 * Both the preflight read and the write verify the expected authenticated organization.
 *
 * @param tenantId - Expected authenticated organization for the customer record
 * @param customerId - Customer whose consent was explicitly confirmed by the operator
 * @param optedIn - True to record agreement; false to withdraw existing agreement
 * @returns Consent freshly read from the customer record after a successful update
 * @throws Error when CSRF protection, organization verification, saving, or reload fails
 */
export async function saveCustomerWhatsAppConsent(tenantId: string, customerId: string, optedIn: boolean): Promise<CustomerNotificationConsent> {
  // Require a session CSRF token so a cross-site request cannot change customer consent.
  const token = await getCSRFToken()
  if (!token) throw new Error('Could not establish secure customer update')
  // Revalidate the organization after fetching CSRF, before a potentially stale draft can write.
  await fetchCustomerNotificationConsent(tenantId, customerId)
  const response = await fetch(`/api/v1/customers/${encodeURIComponent(customerId)}`, {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token, 'X-Tenant-Id': tenantId },
    body: JSON.stringify({ preferences: { notifications: { whatsapp: optedIn } } }),
  })
  const result = await response.json() as { success?: boolean }
  if (!response.ok || !result.success) throw new Error('Could not save customer notification consent')
  return fetchCustomerNotificationConsent(tenantId, customerId)
}
