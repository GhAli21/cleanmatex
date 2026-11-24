'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchCampaignWhatsAppTemplates } from '../api/campaign-wa-templates-api'

/**
 * WhatsApp marketing templates for the campaign form, loaded only while WhatsApp is the chosen channel.
 *
 * @param tenantId - Authenticated organization; part of the cache key so a switch never shows another's templates
 * @param enabled - True while the form needs the list
 * @returns The TanStack query for the template list
 */
export function useCampaignWhatsAppTemplates(tenantId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['notifications', tenantId, 'campaign-wa-templates'] as const,
    enabled: enabled && Boolean(tenantId),
    queryFn: ({ signal }) => fetchCampaignWhatsAppTemplates(tenantId, signal),
    // HQ can activate or suspend a route at any time; read it fresh each time the form opens.
    staleTime: 0,
  })
}
