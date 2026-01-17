/**
 * React Hook for CSRF Token
 * 
 * Provides CSRF token for use in client components making API requests
 */

import { useEffect, useState } from 'react';
import { getCSRFToken } from '@/lib/utils/csrf-token';

export function useCSRFToken() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchToken() {
      try {
        const csrfToken = await getCSRFToken();
        if (mounted) {
          setToken(csrfToken);
        }
      } catch (error) {
        console.error('Error fetching CSRF token:', error);
        if (mounted) {
          setToken(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchToken();

    return () => {
      mounted = false;
    };
  }, []);

  return { token, loading };
}

/**
 * Get CSRF token header for fetch requests
 */
export function getCSRFHeader(token: string | null): Record<string, string> {
  if (!token) {
    return {};
  }

  return {
    'X-CSRF-Token': token,
  };
}

