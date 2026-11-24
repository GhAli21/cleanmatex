import type { WhatsAppMarketingTemplate } from '@lib/notifications/campaign-wa-templates.service'

/**
 * Loads the approved WhatsApp marketing templates the Organization can choose on a campaign.
 *
 * @param tenantId - Expected authenticated organization; checked against the server session
 * @param signal - Cancels the request when its query is no longer needed
 * @returns Templates with their languages and variables; empty when none is available
 * @throws Error when the API rejects the request
 */
export async function fetchCampaignWhatsAppTemplates(tenantId: string, signal?: AbortSignal): Promise<WhatsAppMarketingTemplate[]> {
  const response = await fetch('/api/v1/notifications/campaigns/whatsapp-templates', {
    credentials: 'include', cache: 'no-store', signal,
    headers: { 'X-Tenant-Id': tenantId },
  })
  const json = await response.json() as { success?: boolean; data?: WhatsAppMarketingTemplate[] }
  if (!response.ok || !json.success || !Array.isArray(json.data)) throw new Error('Could not load WhatsApp templates')
  return json.data
}
