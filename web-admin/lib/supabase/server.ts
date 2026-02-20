/**
 * Supabase Server Client Configuration
 *
 * Creates server-side Supabase client for use in:
 * - Server Components
 * - Server Actions
 * - API Routes
 * - Middleware
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

/**
 * Get Supabase environment variables with validation
 * Provides placeholder values during build time to prevent build failures
 * @returns Object with url and anonKey
 */
function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // During build time (when env vars might not be available), use placeholders
  // At runtime, actual values will be used
  if (!url || !anonKey) {
    // Return placeholder values during build
    // These will be replaced with actual values at runtime when env vars are available
    return {
      url: url || 'https://placeholder.supabase.co',
      anonKey: anonKey || 'placeholder-key',
    }
  }

  return { url, anonKey }
}

/**
 * Create a Supabase client for server-side operations
 *
 * This client:
 * - Reads auth tokens from cookies
 * - Enforces RLS based on authenticated user
 * - Automatically refreshes tokens
 *
 * Usage in Server Components:
 * ```ts
 * const supabase = await createServerSupabaseClient()
 * const { data } = await supabase.from('table').select()
 * ```
 *
 * @returns Promise<SupabaseClient>
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  const { url, anonKey } = getSupabaseEnv()

  return createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Handle cases where cookies can't be set (e.g., middleware)
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Handle cases where cookies can't be removed
          }
        },
      },
    }
  )
}

/** Default max age for "Remember me" cookies: 1 day (in seconds). */
const REMEMBER_ME_COOKIE_MAX_AGE = 60 * 60 * 24

/**
 * Create a Supabase client for the login API route with optional session-only cookies.
 * When rememberMe is false, auth cookies are set without maxAge/expires so they are
 * session cookies (browser drops them when the browser is closed).
 * When rememberMe is true, auth cookies use an explicit maxAge (1 day).
 *
 * @param rememberMe - If false, auth cookies are session-only; if true, set maxAge (1 day)
 * @returns Promise<SupabaseClient>
 */
export async function createServerSupabaseClientForLogin(rememberMe: boolean) {
  const cookieStore = await cookies()
  const { url, anonKey } = getSupabaseEnv()

  return createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          try {
            const cookieOptions = rememberMe
              ? { ...options, maxAge: REMEMBER_ME_COOKIE_MAX_AGE, expires: undefined }
              : { ...options, maxAge: undefined, expires: undefined }
            cookieStore.set({ name, value, ...cookieOptions } as Parameters<typeof cookieStore.set>[0])
          } catch (error) {
            // Handle cases where cookies can't be set (e.g., middleware)
          }
        },
        remove(name: string, options: Record<string, unknown>) {
          try {
            cookieStore.set({ name, value: '', ...options } as Parameters<typeof cookieStore.set>[0])
          } catch (error) {
            // Handle cases where cookies can't be removed
          }
        },
      },
    }
  )
}

/**
 * Create an admin Supabase client (bypasses RLS)
 *
 * ⚠️ WARNING: This client has full database access
 * Use ONLY for:
 * - System operations
 * - Admin functions
 * - Background jobs
 *
 * NEVER expose service role key to client!
 *
 * @returns SupabaseClient with admin privileges
 */
export function createAdminSupabaseClient() {
  const { url } = getSupabaseEnv()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key'
  
  return createServerClient<Database>(
    url,
    serviceRoleKey,
    {
      cookies: {
        get() {
          return undefined
        },
        set() {},
        remove() {},
      },
    }
  )
}

/**
 * Alias for backward compatibility
 * @deprecated Use createServerSupabaseClient instead
 */
export const createClient = createServerSupabaseClient
