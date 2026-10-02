import { getCSRFToken } from '@lib/utils/csrf-token'
import { mergeTemplateBinding, type NotificationProviderConfig, type WhatsAppTemplateFormValues } from '../model/whatsapp-template-settings'

const ENDPOINT = '/api/v1/notifications/settings/providers'

/**
 * Load provider configuration with an expected-tenant guard against organization switches.
 * The API resolves the authoritative tenant from the authenticated session.
 *
 * @param tenantId - Expected authenticated organization; checked against the server session
 * @param signal - Cancels a request when its consuming query is no longer needed
 * @returns Non-secret WhatsApp provider configuration for the expected organization
 * @throws Error when the API rejects the request or returns an invalid provider list
 */
export async function fetchNotificationProviders(tenantId: string, signal?: AbortSignal): Promise<NotificationProviderConfig[]> {
  const response = await fetch(`${ENDPOINT}?channel_code=WHATSAPP`, {
    credentials: 'include', cache: 'no-store', signal,
    headers: { 'X-Tenant-Id': tenantId },
  })
  const json = await response.json() as { success?: boolean; data?: NotificationProviderConfig[] }
  if (!response.ok || !json.success || !Array.isArray(json.data)) throw new Error('Could not load providers')
  return json.data
}

/**
 * Re-read configuration before saving one event so unrelated provider options survive.
 * Saving also activates Twilio through the existing tenant-owned provider API.
 *
 * @param tenantId - Expected authenticated organization; checked against the server session
 * @param values - One validated template binding or an explicit event-removal request
 * @returns Resolves after the provider configuration has been saved and activated
 * @throws Error when provider lookup, creation, or activation fails
 */
export async function saveWhatsAppTemplate(tenantId: string, values: WhatsAppTemplateFormValues | { event: string; remove: true }): Promise<void> {
  // Include the session CSRF token to guard the provider write against cross-site requests.
  const csrf = await getCSRFToken()
  const providers = await fetchNotificationProviders(tenantId)
  const provider = providers.find((row) => row.provider_code === 'TWILIO_WHATSAPP')
  const config = mergeTemplateBinding(provider?.config ?? null, values)
  const headers = { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId, ...(csrf ? { 'X-CSRF-Token': csrf } : {}) }
  if (!provider) {
    const created = await fetch(ENDPOINT, {
      method: 'POST', credentials: 'include', headers,
      body: JSON.stringify({ channel_code: 'WHATSAPP', provider_code: 'TWILIO_WHATSAPP', config }),
    })
    if (!created.ok) throw new Error('Could not create provider')
  }
  const response = await fetch(ENDPOINT, {
    method: 'PUT', credentials: 'include', headers,
    body: JSON.stringify({ channel_code: 'WHATSAPP', provider_code: 'TWILIO_WHATSAPP', config }),
  })
  const json = await response.json() as { success?: boolean }
  if (!response.ok || !json.success) throw new Error('Could not save provider')
}
