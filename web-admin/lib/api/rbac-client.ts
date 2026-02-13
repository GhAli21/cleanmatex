/**
 * RBAC API Client
 *
 * Shared fetch wrapper for all RBAC-related calls to the platform-api backend.
 * All RBAC data (users, roles, permissions) flows exclusively through platform-api,
 * never directly through Supabase or internal Next.js API routes.
 *
 * Base URL: NEXT_PUBLIC_PLATFORM_API_URL (defaults to http://localhost:3002/api/hq/v1)
 * Auth: Bearer JWT from session.access_token (obtained via useAuth())
 */

const PLATFORM_API_BASE =
  process.env.NEXT_PUBLIC_PLATFORM_API_URL || 'http://localhost:3002/api/hq/v1'

/**
 * Typed error class for platform-api HTTP errors.
 * Preserves HTTP status code for caller-side handling (e.g. 403, 404, 409).
 */
export class RbacApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'RbacApiError'
  }
}

export interface RbacFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Query params — undefined/null values are omitted automatically */
  queryParams?: Record<string, string | number | boolean | undefined | null>
}

/**
 * Core fetch wrapper for platform-api requests.
 *
 * Usage:
 * ```typescript
 * const { session } = useAuth()
 * const accessToken = session?.access_token ?? ''
 *
 * const roles = await rbacFetch<TenantRole[]>('/tenant-api/roles', accessToken)
 * ```
 *
 * @param endpoint - Path relative to PLATFORM_API_BASE (must start with '/')
 * @param accessToken - JWT Bearer token from session.access_token
 * @param options - Optional method, body, and query params
 * @throws RbacApiError if response is not 2xx
 */
export async function rbacFetch<T>(
  endpoint: string,
  accessToken: string,
  options: RbacFetchOptions = {}
): Promise<T> {
  const { method = 'GET', body, queryParams } = options

  // Build URL with query parameters
  const url = new URL(`${PLATFORM_API_BASE}${endpoint}`)
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value))
      }
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  }

  if (body !== undefined && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(url.toString(), fetchOptions)
  } catch (networkError) {
    // Network-level failure (CORS, backend down, DNS)
    throw new RbacApiError(
      0,
      `Cannot reach platform-api at ${PLATFORM_API_BASE}. Is the backend running on port 3002?`
    )
  }

  // Handle empty responses (204 No Content, DELETE etc.)
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T
  }

  let responseBody: unknown
  try {
    responseBody = await response.json()
  } catch {
    responseBody = null
  }

  if (!response.ok) {
    // Extract error message from platform-api response shapes:
    // { message: string } | { error: string } | { message: string[] }
    const data = responseBody as Record<string, unknown> | null
    let message = `HTTP ${response.status}`
    if (data) {
      if (Array.isArray(data.message)) {
        message = (data.message as string[]).join(', ')
      } else if (typeof data.message === 'string') {
        message = data.message
      } else if (typeof data.error === 'string') {
        message = data.error
      }
    }
    throw new RbacApiError(response.status, message)
  }

  return responseBody as T
}
