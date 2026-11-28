import { getCSRFToken } from '@lib/utils/csrf-token'

export interface CustomerAppTemporaryPassword {
  temporaryPassword: string
  expiresAt: string
}

export interface CustomerAppCredentialStatus {
  hasPassword: boolean
  mustChangePassword: boolean
  passwordChangedAt: string | null
  tempPasswordExpiresAt: string | null
  isLocked: boolean
  hasContactIdentity: boolean
}

/**
 * Fetches safe Customer App credential status for one Organization customer.
 * @param tenantId - Expected Organization, used as a stale-context guard
 * @param customerId - Organization-scoped customer relationship identifier
 * @returns Non-sensitive credential metadata
 */
export async function fetchCustomerAppCredentialStatus(
  tenantId: string,
  customerId: string,
): Promise<CustomerAppCredentialStatus> {
  const response = await fetch(
    `/api/v1/customers/${encodeURIComponent(customerId)}/customer-app-password`,
    {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'X-Tenant-Id': tenantId,
      },
    },
  )
  const result = (await response.json()) as {
    success?: boolean
    data?: CustomerAppCredentialStatus
    error?: string
  }
  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error || 'Could not load Customer App password status')
  }
  return result.data
}

/**
 * Sets or resets a Customer App password directly for one Organization customer.
 * @param tenantId - Expected Organization, used as a stale-context guard
 * @param customerId - Organization-scoped customer relationship identifier
 * @param password - New password (minimum 8 characters)
 * @param requirePasswordChange - Whether customer must replace it after signing in
 * @returns Updated non-sensitive credential metadata
 */
export async function setCustomerAppPassword(
  tenantId: string,
  customerId: string,
  password: string,
  requirePasswordChange = false,
): Promise<CustomerAppCredentialStatus> {
  const csrfToken = await getCSRFToken()
  if (!csrfToken) throw new Error('Could not establish a secure credential request')

  const response = await fetch(
    `/api/v1/customers/${encodeURIComponent(customerId)}/customer-app-password`,
    {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'X-Tenant-Id': tenantId,
      },
      body: JSON.stringify({ password, requirePasswordChange }),
    },
  )
  const result = (await response.json()) as {
    success?: boolean
    data?: CustomerAppCredentialStatus
    error?: string
  }
  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error || 'Could not save Customer App password')
  }
  return result.data
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
  const result = (await response.json()) as {
    success?: boolean
    data?: CustomerAppTemporaryPassword
    error?: string
  }
  if (!response.ok || !result.success || !result.data?.temporaryPassword || !result.data.expiresAt) {
    throw new Error(result.error || 'Could not issue Customer App password')
  }
  return result.data
}
