'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchNotificationProviders, saveWhatsAppTemplate } from '../api/notification-provider-api'
import type { WhatsAppTemplateFormValues } from '../model/whatsapp-template-settings'

/**
 * Keep provider bindings and save invalidation isolated to the authenticated organization.
 * The API verifies this expected tenant against its session-owned tenant resolution.
 *
 * @param tenantId - Authenticated organization whose provider configuration is being edited
 * @param enabled - Allows loading only when the consuming screen is ready
 * @returns Provider query and mutation that saves one template binding or removal
 * @example
 * const { query, mutation } = useNotificationProviders(currentTenant.tenant_id, true)
 */
export function useNotificationProviders(tenantId: string, enabled: boolean) {
  const client = useQueryClient()
  const queryKey = ['notifications', tenantId, 'whatsapp-providers'] as const
  const query = useQuery({
    // Prevent a provider request before both the screen and tenant identity are confirmed.
    queryKey, enabled: enabled && Boolean(tenantId),
    queryFn: ({ signal }) => fetchNotificationProviders(tenantId, signal),
    // Provider activation must be refreshed on each mount rather than reuse stale routing state.
    staleTime: 0,
  })
  const mutation = useMutation({
    mutationFn: (values: WhatsAppTemplateFormValues | { event: string; remove: true }) => saveWhatsAppTemplate(tenantId, values),
    onSuccess: () => client.invalidateQueries({ queryKey }),
  })
  return { query, mutation }
}
