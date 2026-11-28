import { getCSRFToken } from '@lib/utils/csrf-token'

export interface CustomerAppTemporaryPassword {
  temporaryPassword: string
  expiresAt: string
}

/**
 * Issues a one-time Customer App temporary password for one Organization customer.
 * @param tenantId - Expected Organization, used as a stale-context guard
 * @param customerId - Organization-scoped customer relationship identifier
 * @returns The temporary password exactly once with its UTC expiry
 */
export async function issueCustomerAppTemporaryPassword(
  tenantId: string,
  customerId: string,
): Promise<CustomerAppTemporaryPassword> {
  const csrfToken = await getCSRFToken()
  if (!csrfToken) throw new Error('Could not establish a secure credential request')

  const response = await fetch(
    `/api/v1/customers/${encodeURIComponent(customerId)}/customer-app-password`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'X-Tenant-Id': tenantId,
      },
    },
  )
  const result = await response.json() as {
    success?: boolean
    data?: CustomerAppTemporaryPassword
  }
  if (!response.ok || !result.success || !result.data?.temporaryPassword || !result.data.expiresAt) {
    throw new Error('Could not issue Customer App password')
  }
  return result.data
}
