'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MarketingConsentChannel } from '@/lib/constants/notification-campaigns'
import { fetchCustomerMarketingConsent, saveCustomerMarketingConsent } from '../api/customer-marketing-consent-api'

/**
 * Marketing consent of one customer, keyed by organization and customer.
 * @param tenantId - Organization owning the customer
 * @param customerId - Customer being viewed
 * @returns The consent query and a save mutation that replaces the cached value
 */
export function useCustomerMarketingConsent(tenantId: string, customerId: string) {
  const client = useQueryClient()
  const queryKey = ['customer-marketing-consent', tenantId, customerId] as const
  const query = useQuery({
    queryKey, enabled: Boolean(tenantId && customerId),
    queryFn: ({ signal }) => fetchCustomerMarketingConsent(tenantId, customerId, signal),
    // Consent may have been withdrawn elsewhere: always re-read on mount.
    staleTime: 0,
  })
  const mutation = useMutation({
    mutationFn: (channels: { channel: MarketingConsentChannel; agreed: boolean }[]) =>
      saveCustomerMarketingConsent(tenantId, customerId, channels),
    onSuccess: (data) => { client.setQueryData(queryKey, data) },
  })
  return { query, mutation }
}
