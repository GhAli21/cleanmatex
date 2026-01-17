/**
 * Client-side CSRF Token Utility
 * 
 * Provides a way for client components to get CSRF token from cookies
 * Note: CSRF token is set in httpOnly cookie by middleware, so client
 * needs to fetch it via API endpoint
 */

/**
 * Get CSRF token from server
 * This should be called from client components that need to include CSRF token in requests
 */
export async function getCSRFToken(): Promise<string | null> {
  try {
    const response = await fetch('/api/auth/csrf-token', {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.token || null;
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    return null;
  }
}

/**
 * Get CSRF token header name
 */
export function getCSRFTokenHeaderName(): string {
  return 'X-CSRF-Token';
}

