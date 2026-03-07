/**
 * Supabase Client Configuration
 *
 * Creates browser-based Supabase client for client-side operations
 * Includes automatic token refresh and RLS enforcement
 * Respects sb-remember-me: when "0" or missing, auth cookies are session-only (expire on browser close)
 */

import { createBrowserClient } from '@supabase/ssr'
import { parse, serialize } from 'cookie'
import type { Database } from '@/types/database'

const SB_REMEMBER_ME_COOKIE = 'sb-remember-me'

function getRememberMe(): boolean {
  if (typeof document === 'undefined') return true
  const match = document.cookie.match(new RegExp(`${SB_REMEMBER_ME_COOKIE}=([^;]+)`))
  return match ? match[1] === '1' : false
}

/**
 * Create a Supabase client for client-side operations
 *
 * This client:
 * - Automatically handles auth token refresh
 * - Enforces Row-Level Security (RLS)
 * - Uses cookies for auth state persistence
 * - Session cookies (expire on browser close) when "Remember me" is unchecked
 *
 * @returns Supabase client instance
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => {
          if (typeof document === 'undefined') return []
          const parsed = parse(document.cookie)
          return Object.keys(parsed).map((name) => ({
            name,
            value: parsed[name] ?? '',
          }))
        },
        setAll: (cookiesToSet) => {
          if (typeof document === 'undefined') return
          const rememberMe = getRememberMe()
          cookiesToSet.forEach(({ name, value, options }) => {
            const opts = rememberMe
              ? options
              : { ...options, maxAge: undefined, expires: undefined }
            document.cookie = serialize(name, value, opts)
          })
        },
      },
    }
  )
}

/**
 * Singleton instance for client-side usage
 * Import this in client components
 */
export const supabase = createClient()
