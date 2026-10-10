'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCustomerNotificationConsent, saveCustomerPreferredLanguage, saveCustomerWhatsAppConsent } from '../api/customer-notification-api'

/**
 * Isolate consent queries and write results by authenticated organization and customer.
 * The API verifies the expected organization against its server-side session context.
 *
 * @param tenantId - Authenticated organization owning the customer record
 * @param customerId - Customer currently open in the consent editor
 * @returns Consent query and mutations that save an explicit WhatsApp opt-in decision or preferred language
 * @example
 * const { query, mutation, languageMutation } = useCustomerNotificationConsent(currentTenant.tenant_id, customer.id)
 */
export function useCustomerNotificationConsent(tenantId: string, customerId: string) {
  const client = useQueryClient()
  const queryKey = ['customer-notification-consent', tenantId, customerId] as const
  const query = useQuery({
    // Prevent loading until both tenant and customer identity have been confirmed.
    queryKey, enabled: Boolean(tenantId && customerId),
    queryFn: ({ signal }) => fetchCustomerNotificationConsent(tenantId, customerId, signal),
    // Consent must be refreshed on mount because it may have been revoked in another editor.
    staleTime: 0,
  })
  const mutation = useMutation({
    mutationFn: (optedIn: boolean) => saveCustomerWhatsAppConsent(tenantId, customerId, optedIn),
    onSuccess: (data) => { client.setQueryData(queryKey, data) },
  })
  const languageMutation = useMutation({
    mutationFn: (preferredLanguage: string | null) => saveCustomerPreferredLanguage(tenantId, customerId, preferredLanguage),
    onSuccess: (data) => { client.setQueryData(queryKey, data) },
  })
  return { query, mutation, languageMutation }
}
